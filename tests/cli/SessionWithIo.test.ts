import { beforeEach, describe, expect, it } from 'vitest';
import { Editor } from '../../src/app/Editor.js';
import { Interpreter } from '../../src/cli/Interpreter.js';
import { InMemoryFileSystem } from '../support/InMemoryFileSystem.js';

let fs: InMemoryFileSystem;
let run: (line: string) => string[];

beforeEach(() => {
  fs = new InMemoryFileSystem();
  const interpreter = new Interpreter(new Editor(fs));
  run = (line) => interpreter.run(line);
});

function replay(steps: ReadonlyArray<readonly [string, ...string[]]>): void {
  for (const [input, ...expected] of steps) {
    expect(run(input), `after: ${input}`).toEqual(expected);
  }
}

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

describe('spec section 6: the complete transcript, including save and read', () => {
  it('replays exactly', () => {
    fs.files.set('other.svg', OTHER_SVG);
    replay([
      ['init 800 600', 'canvas 800x600 created'],
      ['create rect bg 0 0 800 600 #ffffff', 'rect#bg created'],
      ['create text title 20 40 "My Diagram"', 'text#title created'],
      ['create circle c1 100 100 20 red', 'circle#c1 created'],
      ['create rect box 200 80 60 60 #3366ff', 'rect#box created'],
      ['group markers c1 box', 'g#markers created with 2 children'],
      ['move c1 30 0', 'circle#c1 moved to (130,100)'],
      ['undo', 'circle#c1 moved back to (100,100)'],
      ['redo', 'circle#c1 moved to (130,100)'],
      ['set title text "My Diagram v2"', 'text#title updated: text="My Diagram v2"'],
      ['undo', 'text#title updated: text="My Diagram"'],
      ['group bad c1 markers', 'error: cannot group a container into its own descendant: markers'],
      ['delete box', 'rect#box deleted'],
      ['undo', 'rect#box restored into g#markers'],
      ['save demo.svg', 'saved to demo.svg (5 elements)'],
      ['undo', 'error: undo not allowed after io command'],
      [
        'read other.svg',
        'warning: assigned id rect1 to unnamed <rect>',
        'read other.svg (7 elements)',
      ],
      [
        'tree',
        'svg (400x300)',
        '├── rect#rect1     x=0 y=0 w=400 h=300 fill=#ffffff',
        '├── text#t1        (10,290) "imported"',
        '├── circle#c1      cx=50 cy=50 r=10',
        '├── g#g1',
        '│   ├── rect#r2    x=0 y=0 w=10 h=10',
        '│   └── circle#c2  cx=5 cy=5 r=2',
        '└── ellipse#e1     cx=1 cy=2 rx=3 ry=4',
      ],
    ]);
    expect(fs.files.has('demo.svg')).toBe(true);
  });
});

describe('spec 6.1: flowchart saved as 8 elements', () => {
  it('builds with `in` and saves', () => {
    for (const line of [
      'init 800 600',
      'create g flowchart',
      'create g node1 in flowchart',
      'create rect start 120 100 160 60 #4a90d9 in node1',
      'create text start-label 155 135 "开始" in node1',
      'create g node2 in flowchart',
      'create rect process 520 100 160 60 #f5a623 in node2',
      'create text process-label 545 135 "处理数据" in node2',
      'create line arrow1 280 130 520 130 black in flowchart',
    ]) {
      run(line);
    }
    expect(run('save flowchart.svg')).toEqual(['saved to flowchart.svg (8 elements)']);
  });
});

describe('save / read semantics', () => {
  beforeEach(() => {
    run('init 100 100');
    run('create rect a 0 0 10 10');
  });

  it('save without argument is refused when the document has no path yet', () => {
    expect(run('save')).toEqual(["error: no file path. use 'save <file.svg>'"]);
  });

  it('save without argument writes back to the path it was read from', () => {
    fs.files.set('in.svg', OTHER_SVG);
    run('read in.svg');
    run('delete c1');
    expect(run('save')).toEqual(['saved to in.svg (6 elements)']);
    expect(fs.files.get('in.svg')).not.toContain('id="c1"');
  });

  it('save with a path makes that the default path for later saves', () => {
    run('save one.svg');
    run('create rect b 0 0 1 1');
    expect(run('save')).toEqual(['saved to one.svg (2 elements)']);
  });

  it('init forgets the path', () => {
    run('save one.svg');
    run('init');
    expect(run('save')).toEqual(["error: no file path. use 'save <file.svg>'"]);
  });

  it('save and read leave undo barred until the next edit, and the old history is gone', () => {
    run('save one.svg');
    expect(run('undo')).toEqual(['error: undo not allowed after io command']);
    expect(run('redo')).toEqual(['error: undo not allowed after io command']);
    run('create rect b 0 0 1 1');
    expect(run('undo')).toEqual(['rect#b removed']);
    expect(run('undo')).toEqual(['error: nothing to undo']);
  });

  it('save requires a document', () => {
    const fresh = new Interpreter(new Editor(new InMemoryFileSystem()));
    expect(fresh.run('save x.svg')).toEqual(["error: no document. use 'init' or 'read' first"]);
  });

  it('read works as the very first command', () => {
    const fresh = new Interpreter(new Editor(new InMemoryFileSystem({ 'o.svg': OTHER_SVG })));
    expect(fresh.run('read o.svg').at(-1)).toBe('read o.svg (7 elements)');
    expect(fresh.run('tree')[0]).toBe('svg (400x300)');
  });
});

describe('io failures change nothing', () => {
  beforeEach(() => {
    run('init 100 100');
    run('create rect a 0 0 10 10');
    run('create rect b 0 0 10 10');
  });

  it('reading a missing file keeps the current document and undo history', () => {
    const before = run('tree');
    expect(run('read nope.svg')).toEqual(['error: cannot read file: nope.svg']);
    expect(run('tree')).toEqual(before);
    expect(run('undo')).toEqual(['rect#b removed']);
  });

  it('reading a malformed or duplicate-id file keeps the current document', () => {
    fs.files.set('bad.svg', '<svg><g></svg>');
    fs.files.set('dup.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect id="x"/><rect id="x"/></svg>');
    const before = run('tree');
    expect(run('read bad.svg')[0]).toMatch(/^error: invalid svg: /);
    expect(run('read dup.svg')).toEqual(['error: id already exists: x']);
    expect(run('tree')).toEqual(before);
    expect(run('undo')).toEqual(['rect#b removed']);
  });

  it('a failed save leaves history and the undo permission untouched', () => {
    fs.readOnly.add('ro.svg');
    expect(run('save ro.svg')).toEqual(['error: cannot write file: ro.svg']);
    expect(run('undo')).toEqual(['rect#b removed']);
  });

  it('a failed save does not become the default path', () => {
    fs.readOnly.add('ro.svg');
    run('save ro.svg');
    expect(run('save')).toEqual(["error: no file path. use 'save <file.svg>'"]);
  });
});
