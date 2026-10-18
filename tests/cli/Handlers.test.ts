import { beforeEach, describe, expect, it } from 'vitest';
import { Editor } from '../../src/app/Editor.js';
import { Interpreter } from '../../src/cli/Interpreter.js';
import { FileReadError } from '../../src/io/FileReadError.js';
import type { FileSystem } from '../../src/io/FileSystem.js';
import { InMemoryFileSystem } from '../support/InMemoryFileSystem.js';

let interpreter: Interpreter;
const run = (line: string): string[] => interpreter.run(line);

beforeEach(() => {
  interpreter = new Interpreter(new Editor(new InMemoryFileSystem()));
  run('init 800 600');
});

describe('every user command reaches the editor and reports its result', () => {
  beforeEach(() => {
    run('create rect a 0 0 10 10');
    run('create rect b 20 0 10 10');
    run('create g box');
  });

  it('create: all six built-in types', () => {
    expect(run('create ellipse e 1 2 3 4 yellow')).toEqual(['ellipse#e created']);
    expect(run('create line l 0 0 5 5')).toEqual(['line#l created']);
    expect(run('create circle c 1 1 1')).toEqual(['circle#c created']);
    expect(run('create text t 1 2 hi')).toEqual(['text#t created']);
    expect(run('show e')).toEqual(['ellipse#e  parent=svg', '  cx=1 cy=2 rx=3 ry=4', '  fill=yellow']);
  });

  it('scale', () => {
    expect(run('scale a 2')).toEqual(['rect#a scaled by 2']);
    expect(run('show a')[1]).toBe('  x=0 y=0 width=20 height=20');
    expect(run('undo')).toEqual(['rect#a scale undone']);
    expect(run('scale a abc')).toEqual(['error: invalid number: abc']);
  });

  it('set', () => {
    expect(run('set a fill red')).toEqual(['rect#a updated: fill=red']);
    expect(run('set a width 99')).toEqual(['rect#a updated: width=99']);
    expect(run('set a')).toEqual(['error: usage: set <id> <attr> <value>']);
  });

  it('delete / undo', () => {
    expect(run('delete a')).toEqual(['rect#a deleted']);
    expect(run('undo')).toEqual(['rect#a restored into svg']);
  });

  it('addto, then undo', () => {
    expect(run('addto box a')).toEqual(['rect#a moved into g#box']);
    expect(run('tree box')).toEqual(['g#box', '└── rect#a  x=0 y=0 w=10 h=10']);
    expect(run('undo')).toEqual(['rect#a moved back into svg']);
  });

  it('ungroup, then undo (needs a non-top-level container)', () => {
    run('create g outer');
    run('addto outer box');
    run('addto box a');
    expect(run('ungroup box')).toEqual(['g#box ungrouped (1 children moved to g#outer)']);
    expect(run('tree outer')).toEqual(['g#outer', '└── rect#a  x=0 y=0 w=10 h=10']);
    expect(run('undo')).toEqual(['g#box restored with 1 children']);
  });

  it('front and back', () => {
    expect(run('front a')).toEqual(['rect#a brought to front']);
    expect(run('tree').slice(1).map((l) => l.replace(/\s+.*/, ''))).toEqual(['├──', '├──', '└──']);
    expect(run('back box')).toEqual(['g#box sent to back']);
    expect(run('tree')[1]).toContain('g#box');
    expect(run('undo')).toEqual(['g#box z-order restored']);
  });

  it('group with more members', () => {
    expect(run('group both a b')).toEqual(['g#both created with 2 children']);
  });

  it('canvas arity: none or both', () => {
    expect(run('canvas 100')).toEqual(['error: usage: canvas [w] [h]']);
    expect(run('canvas x y')).toEqual(['error: invalid number: x']);
  });
});

describe('create ... in: parsing of the trailing clause', () => {
  beforeEach(() => {
    run('create g box');
  });

  it('the text content may itself be the word "in"', () => {
    expect(run('create text t 1 2 "in" in box')).toEqual(['text#t created in g#box']);
    expect(run('show t')[2]).toBe('  text="in"');
  });

  it('a dangling `in` without a container is read as a parameter, not a clause', () => {
    // circle 只有一个可选参数：`0 0 1 2 in` 共 5 个位置参数，超出，按用法错误处理
    expect(run('create circle c 0 0 1 2 in')).toEqual(['error: usage: create circle <id> <cx> <cy> <r> [fill]']);
    // 而 rect 的第 5 个位置参数是 fill，`in` 就被当作颜色值（规范没有禁止）
    expect(run('create rect r 0 0 1 1 in')).toEqual(['rect#r created']);
  });
});

describe('non-domain failures are reported without ending the session', () => {
  it('an unexpected error becomes `error: internal: …` and the next command still works', () => {
    const exploding: FileSystem = {
      readText() {
        throw new TypeError('disk on fire');
      },
      writeText() {
        throw new FileReadError('unused');
      },
    };
    const session = new Interpreter(new Editor(exploding));
    expect(session.run('read x.svg')).toEqual(['error: internal: disk on fire']);
    expect(session.run('init 5 5')).toEqual(['canvas 5x5 created']);
  });
});
