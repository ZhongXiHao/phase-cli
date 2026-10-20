import { describe, expect, it } from 'vitest';
import { SvgParser } from '../../src/io/SvgParser.js';
import { ShapeFactory } from '../../src/model/shape/ShapeFactory.js';
import { TreeRenderer } from '../../src/cli/TreeRenderer.js';

const parser = new SvgParser(ShapeFactory.withBuiltIns());
const tree = (xml: string): string[] => new TreeRenderer().renderDocument(parser.parse(xml).document);

const OTHER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
</svg>
`;

describe('SvgParser: spec other.svg', () => {
  it('assigns rect1 to the unnamed rect, warns, and builds the spec tree', () => {
    const result = parser.parse(OTHER_SVG);
    expect(result.warnings).toEqual(['warning: assigned id rect1 to unnamed <rect>']);
    expect(result.document.elementCount()).toBe(7);
    expect(tree(OTHER_SVG)).toEqual([
      'svg (400x300)',
      '├── rect#rect1     x=0 y=0 w=400 h=300 fill=#ffffff',
      '├── text#t1        (10,290) "imported"',
      '├── circle#c1      cx=50 cy=50 r=10',
      '├── g#g1',
      '│   ├── rect#r2    x=0 y=0 w=10 h=10',
      '│   └── circle#c2  cx=5 cy=5 r=2',
      '└── ellipse#e1     cx=1 cy=2 rx=3 ry=4',
    ]);
  });
});

describe('SvgParser: spec 0.1 samples', () => {
  it('reads the minimal sample', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <g id="flow">
    <rect id="start" x="30" y="70" width="120" height="60" fill="#4a90d9"/>
    <line id="edge" x1="150" y1="100" x2="250" y2="100" stroke="black"/>
    <rect id="end" x="250" y="70" width="120" height="60" fill="#f5a623"/>
  </g>
</svg>`;
    expect(parser.parse(xml).warnings).toEqual([]);
    expect(tree(xml)).toEqual([
      'svg (400x200)',
      '└── g#flow',
      '    ├── rect#start  x=30 y=70 w=120 h=60 fill=#4a90d9',
      '    ├── line#edge   (150,100) -> (250,100)',
      '    └── rect#end    x=250 y=70 w=120 h=60 fill=#f5a623',
    ]);
  });

  it('reads the transform sample: nested groups, transform kept, extra text attributes dropped silently', () => {
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <!-- comment -->
  <g id="diagram" transform="translate(60,40)">
    <rect id="a" x="0" y="0" width="120" height="60" fill="#4a90d9"/>
    <line id="e" x1="120" y1="30" x2="200" y2="30" stroke="black"/>
    <g id="nodeB" transform="translate(200,0) scale(0.8)">
      <rect x="0" y="0" width="120" height="60" fill="#f5a623"/>
      <text x="60" y="38" text-anchor="middle" font-size="16" fill="white">End</text>
    </g>
  </g>
</svg>`;
    const { document, warnings } = parser.parse(xml);
    expect(warnings).toEqual(['warning: assigned id rect1 to unnamed <rect>', 'warning: assigned id text1 to unnamed <text>']);
    expect(document.find('diagram').attributes()).toContainEqual(['transform', 'translate(60,40)']);
    expect(document.find('nodeB').attributes()).toContainEqual(['transform', 'translate(200,0) scale(0.8)']);
    expect(document.find('text1').textContent()).toBe('End');
    expect(document.find('text1').fill).toBe('white');
  });
});

describe('SvgParser: ids', () => {
  it('auto ids never collide with an explicit id that appears later in the file', () => {
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
  <rect x="0" y="0" width="1" height="1"/>
  <rect id="rect1" x="0" y="0" width="1" height="1"/>
  <rect x="0" y="0" width="1" height="1"/>
</svg>`;
    const { document, warnings } = parser.parse(xml);
    expect(document.allShapes().map((s) => s.id)).toEqual(['rect2', 'rect1', 'rect3']);
    expect(warnings).toEqual([
      'warning: assigned id rect2 to unnamed <rect>',
      'warning: assigned id rect3 to unnamed <rect>',
    ]);
  });

  it('an empty id attribute counts as missing', () => {
    const xml = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><circle id="" cx="0" cy="0" r="1"/></svg>';
    expect(parser.parse(xml).document.allShapes().map((s) => s.id)).toEqual(['circle1']);
  });

  it('duplicate explicit ids are rejected', () => {
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">
  <rect id="a" x="0" y="0" width="1" height="1"/>
  <g id="g"><circle id="a" cx="0" cy="0" r="1"/></g>
</svg>`;
    expect(() => parser.parse(xml)).toThrow('id already exists: a');
  });
});

describe('SvgParser: robustness', () => {
  it('skips unsupported elements (whole subtree) with a warning', () => {
    const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
  <defs><rect id="hidden" x="0" y="0" width="1" height="1"/></defs>
  <path id="p" d="M0 0L1 1"/>
  <rect id="ok" x="0" y="0" width="1" height="1"/>
</svg>`;
    const { document, warnings } = parser.parse(xml);
    expect(document.allShapes().map((s) => s.id)).toEqual(['ok']);
    expect(warnings).toEqual(['warning: skipped unsupported element <defs>', 'warning: skipped unsupported element <path>']);
  });

  it('canvas size: width/height win, then viewBox, then 800x600; px suffix accepted', () => {
    const size = (attrs: string): string[] =>
      new TreeRenderer().renderDocument(parser.parse(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}></svg>`).document);
    expect(size('width="320px" height="240"')).toEqual(['svg (320x240)']);
    expect(size('viewBox="0 0 100 50"')).toEqual(['svg (100x50)']);
    expect(size('width="50%" height="50%" viewBox="0 0 100 50"')).toEqual(['svg (100x50)']);
    expect(size('')).toEqual(['svg (800x600)']);
  });

  it('works with a namespace prefix on the elements', () => {
    const xml = `<s:svg xmlns:s="http://www.w3.org/2000/svg" width="10" height="10"><s:rect id="r" x="1" y="2" width="3" height="4"/></s:svg>`;
    expect(tree(xml)).toEqual(['svg (10x10)', '└── rect#r  x=1 y=2 w=3 h=4']);
  });

  it('malformed XML is reported as invalid svg, without leaking parser logs', () => {
    expect(() => parser.parse('<svg><g></svg>')).toThrow(/^invalid svg: /);
    expect(() => parser.parse('')).toThrow(/^invalid svg: /);
    expect(() => parser.parse('hello')).toThrow(/^invalid svg: /);
  });

  it('a root that is not <svg> is rejected', () => {
    expect(() => parser.parse('<html/>')).toThrow('invalid svg: root element is <html>, expected <svg>');
  });

  it('invalid numeric attributes are rejected', () => {
    const xml = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect id="r" x="abc" y="0" width="1" height="1"/></svg>';
    expect(() => parser.parse(xml)).toThrow('invalid number: abc');
  });
});
