import { beforeEach, describe, expect, it } from 'vitest';
import { Editor } from '../../src/app/Editor.js';
import { InMemoryFileSystem } from '../support/InMemoryFileSystem.js';
import { Interpreter } from '../../src/cli/Interpreter.js';

let interpreter: Interpreter;

beforeEach(() => {
  interpreter = new Interpreter(new Editor(new InMemoryFileSystem()));
});

/** 每项是 [输入, ...期望输出行]；逐条执行并断言，等价于对照规范的 transcript。 */
function replay(steps: ReadonlyArray<readonly [string, ...string[]]>): void {
  for (const [input, ...expected] of steps) {
    expect(interpreter.run(input), `after: ${input}`).toEqual(expected);
  }
}

describe('spec section 6 transcript (without io commands)', () => {
  it('replays exactly', () => {
    replay([
      ['init 800 600', 'canvas 800x600 created'],
      ['create rect bg 0 0 800 600 #ffffff', 'rect#bg created'],
      ['create text title 20 40 "My Diagram"', 'text#title created'],
      ['create circle c1 100 100 20 red', 'circle#c1 created'],
      ['create rect box 200 80 60 60 #3366ff', 'rect#box created'],
      ['group markers c1 box', 'g#markers created with 2 children'],
      [
        'tree',
        'svg (800x600)',
        '├── rect#bg        x=0 y=0 w=800 h=600 fill=#ffffff',
        '├── text#title     (20,40) "My Diagram"',
        '└── g#markers',
        '    ├── circle#c1  cx=100 cy=100 r=20 fill=red',
        '    └── rect#box   x=200 y=80 w=60 h=60 fill=#3366ff',
      ],
      ['move c1 30 0', 'circle#c1 moved to (130,100)'],
      ['undo', 'circle#c1 moved back to (100,100)'],
      ['redo', 'circle#c1 moved to (130,100)'],
      ['set title text "My Diagram v2"', 'text#title updated: text="My Diagram v2"'],
      ['undo', 'text#title updated: text="My Diagram"'],
      ['group bad c1 markers', 'error: cannot group a container into its own descendant: markers'],
      ['delete box', 'rect#box deleted'],
      ['undo', 'rect#box restored into g#markers'],
      ['show c1', 'circle#c1  parent=g#markers', '  cx=130 cy=100 r=20', '  fill=red'],
    ]);
  });
});

describe('spec 6.1: build with the `in` clause', () => {
  it('builds the two-node flowchart top-down', () => {
    replay([
      ['init 800 600', 'canvas 800x600 created'],
      ['# a comment line produces no output'],
      [''],
      ['create g flowchart', 'g#flowchart created'],
      ['create g node1 in flowchart', 'g#node1 created in g#flowchart'],
      ['create rect start 120 100 160 60 #4a90d9 in node1', 'rect#start created in g#node1'],
      ['create text start-label 155 135 "开始" in node1', 'text#start-label created in g#node1'],
      ['create g node2 in flowchart', 'g#node2 created in g#flowchart'],
      ['create rect process 520 100 160 60 #f5a623 in node2', 'rect#process created in g#node2'],
      ['create text process-label 545 135 "处理数据" in node2', 'text#process-label created in g#node2'],
      ['create line arrow1 280 130 520 130 black in flowchart', 'line#arrow1 created in g#flowchart'],
      ['move node2 0 100', 'g#node2 moved by (0,100)'],
      ['undo', 'g#node2 moved back by (0,-100)'],
      ['set process-label text "处理数据 v2"', 'text#process-label updated: text="处理数据 v2"'],
    ]);
    expect(interpreter.run('tree flowchart')).toEqual([
      'g#flowchart',
      '├── g#node1',
      '│   ├── rect#start          x=120 y=100 w=160 h=60 fill=#4a90d9',
      '│   └── text#start-label    (155,135) "开始"',
      '├── g#node2',
      '│   ├── rect#process        x=520 y=100 w=160 h=60 fill=#f5a623',
      '│   └── text#process-label  (545,135) "处理数据 v2"',
      '└── line#arrow1             (280,130) -> (520,130)',
    ]);
  });
});

describe('error output (spec 4.2): `error:` prefix, one line, state unchanged', () => {
  beforeEach(() => {
    interpreter.run('init');
    interpreter.run('create rect r1 0 0 10 10');
    interpreter.run('create g scene');
    interpreter.run('create rect inner 0 0 1 1 in scene');
  });

  it.each([
    ['create rect r1 0 0 1 1', 'error: id already exists: r1'],
    ['delete r9', 'error: no such shape: r9'],
    ['create rect x 0 0 1 1 in node9', 'error: no such container: node9'],
    ['create rect x 0 0 1 1 in r1', 'error: not a container: r1'],
    ['create hexagon h', 'error: unknown shape type: hexagon (is the plugin loaded?)'],
    ['ungroup scene', 'error: cannot ungroup top-level container: scene'],
    ['scale r1 0', 'error: scale factor must be positive'],
    ['scale r1 -2', 'error: scale factor must be positive'],
    ['set r1 bogus 1', 'error: unknown attribute: bogus'],
    ['set r1 width wide', 'error: invalid number: wide'],
    ['move r1 a b', 'error: invalid number: a'],
    ['bogus', "error: unknown command: bogus (type 'help' for commands)"],
    ['create text t 1 2 "oops', 'error: unterminated quote'],
  ])('%s -> %s', (input, expected) => {
    const before = interpreter.run('tree');
    expect(interpreter.run(input)).toEqual([expected]);
    expect(interpreter.run('tree')).toEqual(before);
  });

  it('wrong argument counts print the usage', () => {
    expect(interpreter.run('move r1 1')).toEqual(['error: usage: move <id> <dx> <dy>']);
    expect(interpreter.run('delete')).toEqual(['error: usage: delete <id>']);
    expect(interpreter.run('undo now')).toEqual(['error: usage: undo']);
    expect(interpreter.run('init 800')).toEqual(['error: usage: init [w] [h]']);
    expect(interpreter.run('create rect x 0 0')).toEqual(['error: usage: create rect <id> <x> <y> <w> <h> [fill]']);
    expect(interpreter.run('group g')).toEqual(['error: usage: group <newGid> <id1> <id2>…']);
  });

  it('a failed command does not enter the undo stack', () => {
    interpreter.run('move r1 5 5');
    interpreter.run('move nope 1 1');
    expect(interpreter.run('undo')).toEqual(['rect#r1 moved back to (0,0)']);
  });
});

describe('no document / io barrier', () => {
  it('every document command is refused before init, display and help are not', () => {
    for (const line of ['tree', 'show a', 'create rect a 0 0 1 1', 'undo', 'redo', 'canvas', 'delete a']) {
      expect(interpreter.run(line), line).toEqual(["error: no document. use 'init' or 'read' first"]);
    }
    expect(interpreter.run('help')[0]).toContain('Commands');
  });

  it('undo/redo are refused right after init until the next edit', () => {
    interpreter.run('init');
    expect(interpreter.run('undo')).toEqual(['error: undo not allowed after io command']);
    expect(interpreter.run('redo')).toEqual(['error: undo not allowed after io command']);
    interpreter.run('create rect a 0 0 1 1');
    expect(interpreter.run('undo')).toEqual(['rect#a removed']);
  });

  it('a failed edit does not lift the barrier', () => {
    interpreter.run('init');
    interpreter.run('delete nope');
    expect(interpreter.run('undo')).toEqual(['error: undo not allowed after io command']);
  });

  it('canvas without arguments shows the size; with arguments it resizes and bars undo', () => {
    interpreter.run('init 400 300');
    interpreter.run('create rect a 0 0 1 1');
    expect(interpreter.run('canvas')).toEqual(['canvas 400x300']);
    expect(interpreter.run('undo')).toEqual(['rect#a removed']);
    interpreter.run('redo');
    expect(interpreter.run('canvas 800 600')).toEqual(['canvas resized to 800x600']);
    expect(interpreter.run('undo')).toEqual(['error: undo not allowed after io command']);
    expect(interpreter.run('tree')[0]).toBe('svg (800x600)');
  });

  it('init discards the old document and history', () => {
    interpreter.run('init');
    interpreter.run('create rect a 0 0 1 1');
    interpreter.run('init 100 100');
    expect(interpreter.run('tree')).toEqual(['svg (100x100)']);
    interpreter.run('create rect b 0 0 1 1');
    expect(interpreter.run('undo')).toEqual(['rect#b removed']);
    expect(interpreter.run('undo')).toEqual(['error: nothing to undo']);
  });

  it('an invalid canvas size keeps the previous document', () => {
    interpreter.run('init 100 100');
    interpreter.run('create rect a 0 0 1 1');
    expect(interpreter.run('init 0 0')).toEqual(['error: canvas size must be positive']);
    expect(interpreter.run('tree')).toEqual(['svg (100x100)', '└── rect#a  x=0 y=0 w=1 h=1']);
  });
});

describe('redo semantics', () => {
  it('a new edit after undo clears redo', () => {
    interpreter.run('init');
    interpreter.run('create rect a 0 0 1 1');
    interpreter.run('undo');
    interpreter.run('create rect b 0 0 1 1');
    expect(interpreter.run('redo')).toEqual(['error: nothing to redo']);
  });
});

describe('tree and show', () => {
  beforeEach(() => {
    interpreter.run('init 800 600');
    interpreter.run('create g markers');
    interpreter.run('create circle c1 100 100 20 red in markers');
  });

  it('tree of an empty document is just the header', () => {
    expect(new Interpreter(new Editor(new InMemoryFileSystem())).run('init 5 5')).toEqual(['canvas 5x5 created']);
  });

  it('tree <id> shows only that subtree; a leaf shows one line', () => {
    expect(interpreter.run('tree markers')).toEqual(['g#markers', '└── circle#c1  cx=100 cy=100 r=20 fill=red']);
    expect(interpreter.run('tree c1')).toEqual(['circle#c1  cx=100 cy=100 r=20 fill=red']);
    expect(interpreter.run('tree nope')).toEqual(['error: no such shape: nope']);
  });

  it('show on a container, a top-level shape and a text', () => {
    expect(interpreter.run('show markers')).toEqual(['g#markers  parent=svg', '  children=1']);
    interpreter.run('create text t 1 2 "hi there"');
    expect(interpreter.run('show t')).toEqual(['text#t  parent=svg', '  x=1 y=2', '  text="hi there"']);
  });
});

describe('exit', () => {
  it('invokes the exit callback', () => {
    let exited = false;
    const withExit = new Interpreter(new Editor(new InMemoryFileSystem()), () => {
      exited = true;
    });
    expect(withExit.run('exit')).toEqual([]);
    expect(exited).toBe(true);
  });
});

describe('help', () => {
  it('lists every command with its syntax', () => {
    const text = interpreter.run('help').join('\n');
    for (const usage of [
      'init [w] [h]',
      'canvas [w] [h]',
      'create <type> <id> [params…] [in <containerId>]',
      'delete <id>',
      'move <id> <dx> <dy>',
      'scale <id> <factor>',
      'set <id> <attr> <value>',
      'group <newGid> <id1> <id2>…',
      'ungroup <gid>',
      'addto <gid> <id>',
      'front <id>',
      'back <id>',
      'tree [id]',
      'show <id>',
      'undo',
      'redo',
      'help',
    ]) {
      expect(text, usage).toContain(usage);
    }
  });
});
