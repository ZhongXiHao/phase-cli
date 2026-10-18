import { describe, expect, it } from 'vitest';
import { Editor } from '../../src/app/Editor.js';
import { Interpreter } from '../../src/cli/Interpreter.js';
import { SvgParser } from '../../src/io/SvgParser.js';
import { SvgSerializer } from '../../src/io/SvgSerializer.js';
import { Document } from '../../src/model/Document.js';
import { Group } from '../../src/model/Group.js';
import { Text } from '../../src/model/Text.js';
import { ShapeFactory } from '../../src/model/ShapeFactory.js';
import { InMemoryFileSystem } from '../support/InMemoryFileSystem.js';

function build(...lines: string[]): { fs: InMemoryFileSystem; run: (line: string) => string[] } {
  const fs = new InMemoryFileSystem();
  const interpreter = new Interpreter(new Editor(fs));
  lines.forEach((line) => interpreter.run(line));
  return { fs, run: (line) => interpreter.run(line) };
}

describe('SvgSerializer', () => {
  it('reproduces the spec 0.1 sample byte for byte (init 400 200 + four commands)', () => {
    const { fs, run } = build(
      'init 400 200',
      'create g flow',
      'create rect start 30 70 120 60 #4a90d9 in flow',
      'create line edge 150 100 250 100 black in flow',
      'create rect end 250 70 120 60 #f5a623 in flow',
    );
    run('save demo.svg');
    expect(fs.files.get('demo.svg')).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">',
        '  <g id="flow">',
        '    <rect id="start" x="30" y="70" width="120" height="60" fill="#4a90d9"/>',
        '    <line id="edge" x1="150" y1="100" x2="250" y2="100" stroke="black"/>',
        '    <rect id="end" x="250" y="70" width="120" height="60" fill="#f5a623"/>',
        '  </g>',
        '</svg>',
        '',
      ].join('\n'),
    );
  });

  it('text content is a child text node; empty containers self-close; nesting is indented', () => {
    const { fs, run } = build(
      'init 100 50',
      'create g outer',
      'create g empty in outer',
      'create text t 10 20 "Hello 开始" in outer',
    );
    run('save a.svg');
    expect(fs.files.get('a.svg')).toContain(
      ['  <g id="outer">', '    <g id="empty"/>', '    <text id="t" x="10" y="20">Hello 开始</text>', '  </g>'].join('\n'),
    );
  });

  it('escapes XML special characters in content and attribute values', () => {
    const doc = new Document(10, 10);
    doc.root.insertChild(new Text('t"1', 1, 2, 'a < b & c > d'));
    const xml = new SvgSerializer().serialize(doc);
    expect(xml).toContain('<text id="t&quot;1" x="1" y="2">a &lt; b &amp; c &gt; d</text>');
    const back = new SvgParser(ShapeFactory.withBuiltIns()).parse(xml).document;
    expect(back.find('t"1').textContent()).toBe('a < b & c > d');
  });

  it('writes style attributes after geometry and keeps group transform', () => {
    const doc = new Document(10, 10);
    const g = new Group('g', 'translate(60,40)');
    doc.root.insertChild(g);
    const xml = new SvgSerializer().serialize(doc);
    expect(xml).toContain('<g id="g" transform="translate(60,40)"/>');
  });

  it('serialises an empty document', () => {
    expect(new SvgSerializer().serialize(new Document(800, 600))).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">',
        '</svg>',
        '',
      ].join('\n'),
    );
  });
});

describe('round trip: save then read gives the same document', () => {
  it('preserves structure, order, attributes and text', () => {
    const { fs, run } = build(
      'init 640 480',
      'create rect bg 0 0 640 480 #ffffff',
      'create g scene',
      'create circle c1 100.5 100 20 red in scene',
      'create ellipse e1 1 2 3 4 in scene',
      'create g inner in scene',
      'create text t 5 6 "a & b" in inner',
      'create line l 0 0 5 5 black',
      'set c1 stroke-width 2.5',
      'set c1 stroke blue',
      'front bg',
    );
    run('tree');
    const before = run('tree');
    const beforeShow = run('show c1');
    run('save rt.svg');

    const reread = build();
    reread.fs.files.set('rt.svg', fs.files.get('rt.svg') as string);
    expect(reread.run('read rt.svg')).toEqual(['read rt.svg (7 elements)']);
    expect(reread.run('tree')).toEqual(before);
    expect(reread.run('show c1')).toEqual(beforeShow);

    reread.run('save rt2.svg');
    expect(reread.fs.files.get('rt2.svg')).toBe(fs.files.get('rt.svg'));
  });
});
