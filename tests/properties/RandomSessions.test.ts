import { describe, expect, it } from 'vitest';
import { Editor } from '../../src/app/Editor.js';
import { Interpreter } from '../../src/cli/Interpreter.js';
import { SvgSerializer } from '../../src/io/SvgSerializer.js';
import type { Document } from '../../src/model/Document.js';
import { InMemoryFileSystem } from '../support/InMemoryFileSystem.js';

/**
 * 随机会话的性质测试：随机生成命令序列，每一步都核对不变量，并用"游标模型"核对 undo / redo。
 *
 * 状态快照是精确的：结构（先序遍历的 id 与父 id）+ 每个图形 captureState() 的 JSON，
 * 数字以完整精度比较，所以浮点漂移也会被发现。
 *
 * 命令生成是"感知当前文档"的：绝大多数时候从真实存在的图形 / 容器里挑目标，
 * 只有少数故意用不存在的 id、重复 id、非法参数，以同时覆盖成功路径与失败路径。
 * 末尾的统计断言保证生成器不会退化成"几乎全是失败"。
 */

// ---- 可复现的伪随机数 ----
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Gen {
  private fresh = 0;

  constructor(private readonly next: () => number) {}

  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)] as T;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  num(): string {
    return this.pick(['0', '1', '10', '0.1', '0.3', '7.25', '-5', '100', '33.333']);
  }

  /** 新 id；偶尔故意复用已有 id 以触发 `id already exists`。 */
  newId(existing: readonly string[]): string {
    return existing.length > 0 && this.chance(0.05) ? this.pick(existing) : `n${this.fresh++}`;
  }
}

/** 当前文档里真实存在的图形，供生成器挑目标。 */
function world(editor: Editor): { ids: string[]; containers: string[]; nested: string[] } {
  const document = editor.documentView() as Document;
  const shapes = document.allShapes();
  return {
    ids: shapes.map((s) => s.id),
    containers: shapes.filter((s) => s.isContainer).map((s) => s.id),
    nested: shapes.filter((s) => s.isContainer && !document.isTopLevel(s)).map((s) => s.id),
  };
}

function randomCommand(g: Gen, editor: Editor): string {
  const { ids, containers, nested } = world(editor);
  const existing = (): string => (ids.length > 0 && !g.chance(0.05) ? g.pick(ids) : 'nope');
  const container = (): string => {
    if (containers.length > 0 && g.chance(0.6)) {
      return ` in ${g.pick(containers)}`;
    }
    return g.chance(0.04) ? ' in nope' : '';
  };

  switch (g.int(15)) {
    case 0:
      return `create rect ${g.newId(ids)} ${g.num()} ${g.num()} ${g.num()} ${g.num()}${g.chance(0.5) ? ' red' : ''}${container()}`;
    case 1:
      return `create circle ${g.newId(ids)} ${g.num()} ${g.num()} ${g.num()}${container()}`;
    case 2:
      return `create line ${g.newId(ids)} ${g.num()} ${g.num()} ${g.num()} ${g.num()}${container()}`;
    case 3:
      return `create text ${g.newId(ids)} ${g.num()} ${g.num()} "hello ${g.int(9)}"${container()}`;
    case 4:
    case 5:
      return `create g ${g.newId(ids)}${container()}`;
    case 6:
      return `create ellipse ${g.newId(ids)} ${g.num()} ${g.num()} ${g.num()} ${g.num()}${container()}`;
    case 7:
      return `delete ${existing()}`;
    case 8:
      return `move ${existing()} ${g.num()} ${g.num()}`;
    case 9:
      return `scale ${existing()} ${g.pick(['2', '0.5', '0.3', '1.7', '1.1', '0', '-1', 'x'])}`;
    case 10:
      // 大多数是合法的"属性 + 值"搭配，少数故意不匹配，以覆盖校验失败路径
      return g.chance(0.8)
        ? `set ${existing()} ${g.pick(['fill red', 'stroke blue', 'stroke-width 2', 'text hello', 'x 10.5', 'y 3', 'width 7', 'r 4', 'cx 9'])}`
        : `set ${existing()} ${g.pick(['fill', 'x', 'width', 'stroke-width', 'bogus'])} ${g.pick(['abc', '', '-1'])}`;
    case 11: {
      const members = Array.from({ length: 1 + g.int(3) }, existing).join(' ');
      return `group ${g.newId(ids)} ${members}`;
    }
    case 12:
      // 优先解散嵌套容器（根级容器按规范不可解散）；偶尔故意选任意图形
      return `ungroup ${nested.length > 0 && !g.chance(0.15) ? g.pick(nested) : existing()}`;
    case 13:
      return `addto ${containers.length > 0 && !g.chance(0.05) ? g.pick(containers) : 'nope'} ${existing()}`;
    default:
      return `${g.pick(['front', 'back'])} ${existing()}`;
  }
}

// ---- 精确快照与不变量 ----
function snapshot(editor: Editor): string {
  const document = editor.documentView() as Document;
  return document
    .allShapes()
    .map((shape) => `${shape.id}<${shape.parent?.id ?? '?'}:${JSON.stringify(shape.captureState())}`)
    .join('\n');
}

function assertTreeInvariants(editor: Editor, context: string): void {
  const document = editor.documentView() as Document;
  const shapes = document.allShapes();
  const ids = shapes.map((s) => s.id);
  expect(new Set(ids).size, `${context}: ids must be unique: ${ids.join(',')}`).toBe(ids.length);
  for (const shape of shapes) {
    const parent = shape.parent;
    expect(parent, `${context}: ${shape.id} has no parent`).not.toBeNull();
    expect(parent?.children().includes(shape), `${context}: ${shape.id} missing from its parent's children`).toBe(true);
    for (const child of shape.children()) {
      expect(child.parent, `${context}: child ${child.id} of ${shape.id} points elsewhere`).toBe(shape);
    }
  }
  for (const child of document.root.children()) {
    expect(child.parent).toBe(document.root);
  }
}

const EDIT = /^(create|delete|move|scale|set|group|ungroup|addto|front|back) /;

/** verb → [成功次数, 失败次数] */
const stats = new Map<string, [number, number]>();
function record(line: string, failed: boolean): void {
  const verb = line.split(' ')[0] as string;
  const entry = stats.get(verb) ?? [0, 0];
  entry[failed ? 1 : 0]++;
  stats.set(verb, entry);
}

function runSession(seed: number, steps: number): void {
  const g = new Gen(mulberry32(seed));
  const fs = new InMemoryFileSystem();
  const editor = new Editor(fs);
  const interpreter = new Interpreter(editor);
  const log: string[] = [];
  const where = (): string => `seed=${seed}\n${log.join('\n')}`;

  interpreter.run('init 800 600');
  // 游标模型：states[cursor] 是"当前应有的状态"；undo/redo 只移动游标
  const states: string[] = [snapshot(editor)];
  let cursor = 0;
  let barrier = true; // init 之后在第一次成功编辑之前禁止 undo / redo

  for (let step = 0; step < steps; step++) {
    const roll = g.int(10);
    const line = roll < 8 ? randomCommand(g, editor) : roll < 9 ? 'undo' : 'redo';
    log.push(line);
    const before = snapshot(editor);
    const output = interpreter.run(line);
    const failed = output.length === 1 && output[0]?.startsWith('error:') === true;
    record(line, failed);
    const after = snapshot(editor);
    expect(output.length, `one output line per command\n${where()}\n${output.join('\n')}`).toBe(1);
    expect(output[0]?.startsWith('error: internal'), `internal error\n${where()}\n${output.join('\n')}`).toBe(false);
    assertTreeInvariants(editor, `after "${line}"\n${where()}`);

    if (failed) {
      expect(after, `failed command changed the document\n${where()}\n${output[0]}`).toBe(before);
      continue;
    }

    if (EDIT.test(line)) {
      states.length = cursor + 1; // 新编辑清空 redo
      states.push(after);
      cursor++;
      barrier = false;
    } else if (line === 'undo') {
      expect(barrier, `undo succeeded while barred\n${where()}`).toBe(false);
      cursor--;
      expect(after, `undo did not restore the previous state\n${where()}`).toBe(states[cursor]);
    } else {
      expect(barrier, `redo succeeded while barred\n${where()}`).toBe(false);
      cursor++;
      expect(after, `redo did not reproduce the state\n${where()}`).toBe(states[cursor]);
    }
  }

  // 游标模型的边界：到底之后 undo 必须报错；到顶之后 redo 必须报错
  if (!barrier) {
    while (cursor > 0) {
      expect(interpreter.run('undo')[0], where()).not.toMatch(/^error/);
      cursor--;
      expect(snapshot(editor), `undo-all step\n${where()}`).toBe(states[cursor]);
    }
    expect(interpreter.run('undo')).toEqual(['error: nothing to undo']);
    while (cursor < states.length - 1) {
      expect(interpreter.run('redo')[0], where()).not.toMatch(/^error/);
      cursor++;
      expect(snapshot(editor), `redo-all step\n${where()}`).toBe(states[cursor]);
    }
    expect(interpreter.run('redo')).toEqual(['error: nothing to redo']);
  }

  // 往返：保存、读回，tree 应相同，且不应产生警告
  const treeBefore = interpreter.run('tree');
  expect(interpreter.run('save rt.svg')[0], where()).toMatch(/^saved to rt\.svg/);
  const reader = new Interpreter(new Editor(new InMemoryFileSystem({ 'rt.svg': fs.files.get('rt.svg') as string })));
  const readResult = reader.run('read rt.svg');
  expect(readResult.filter((l) => l.startsWith('warning')), `unexpected warnings\n${where()}`).toEqual([]);
  expect(reader.run('tree'), `round trip changed the tree\n${where()}`).toEqual(treeBefore);
}

describe('random sessions (property-based, deterministic seeds)', () => {
  it('failed commands never change state; undo / redo follow the cursor model exactly; trees stay consistent', () => {
    for (let seed = 1; seed <= 300; seed++) {
      runSession(seed, 40);
    }
    if (process.env.PROPERTY_STATS) {
      console.log([...stats].map(([verb, [ok, error]]) => `${verb}: ok=${ok} error=${error}`).join('\n'));
    }
    // 生成器必须真的走到各类命令的成功路径与失败路径，否则上面的断言是空转
    for (const verb of ['create', 'delete', 'move', 'scale', 'set', 'group', 'ungroup', 'addto', 'front', 'back', 'undo', 'redo']) {
      const [ok, error] = stats.get(verb) ?? [0, 0];
      expect(ok, `${verb} succeeded only ${ok} times (${error} failures)`).toBeGreaterThanOrEqual(100);
      expect(error, `${verb} never failed`).toBeGreaterThan(0);
    }
  }, 60_000);

  it('longer sessions', () => {
    for (let seed = 1000; seed < 1015; seed++) {
      runSession(seed, 150);
    }
  }, 60_000);

  it('serialisation is stable: save -> read -> save is byte-identical', () => {
    for (let seed = 5000; seed < 5100; seed++) {
      const g = new Gen(mulberry32(seed));
      const fs = new InMemoryFileSystem();
      const editor = new Editor(fs);
      const interpreter = new Interpreter(editor);
      interpreter.run('init 640 480');
      for (let i = 0; i < 40; i++) {
        interpreter.run(randomCommand(g, editor));
      }
      interpreter.run('save one.svg');
      const first = fs.files.get('one.svg') as string;

      const reader = new Editor(new InMemoryFileSystem({ 'one.svg': first }));
      reader.read('one.svg');
      const again = new SvgSerializer().serialize(reader.documentView());
      expect(again, `seed=${seed}`).toBe(first);
    }
  }, 60_000);
});
