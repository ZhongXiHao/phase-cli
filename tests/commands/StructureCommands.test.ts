import { beforeEach, describe, expect, it } from 'vitest';
import { AddToCommand } from '../../src/commands/AddToCommand.js';
import { CreateShapeCommand } from '../../src/commands/CreateShapeCommand.js';
import { GroupCommand } from '../../src/commands/GroupCommand.js';
import { UngroupCommand } from '../../src/commands/UngroupCommand.js';
import { ZOrderCommand } from '../../src/commands/ZOrderCommand.js';
import type { Command } from '../../src/commands/Command.js';
import { Group } from '../../src/model/Group.js';
import { TestEditor } from '../support/TestEditor.js';

let ed: TestEditor;

function create(type: string, id: string, args: string[], containerId?: string): Command {
  return new CreateShapeCommand(ed.document, ed.factory, type, id, args, containerId);
}

function expectFailsWithoutChange(command: Command, message: string): void {
  const before = ed.snapshot();
  const depth = ed.history.undoDepth;
  expect(() => ed.run(command)).toThrow(message);
  expect(ed.snapshot()).toBe(before);
  expect(ed.history.undoDepth).toBe(depth);
}

/** 规范第 6 节的起始场景：bg、title、c1、box 四个根级图形。 */
function specScene(): void {
  ed.run(create('rect', 'bg', ['0', '0', '800', '600', '#ffffff']));
  ed.run(create('text', 'title', ['20', '40', 'My Diagram']));
  ed.run(create('circle', 'c1', ['100', '100', '20', 'red']));
  ed.run(create('rect', 'box', ['200', '80', '60', '60', '#3366ff']));
}

beforeEach(() => {
  ed = new TestEditor();
});

describe('GroupCommand', () => {
  it('spec scenario: group markers c1 box', () => {
    specScene();
    expect(ed.run(new GroupCommand(ed.document, 'markers', ['c1', 'box']))).toBe('g#markers created with 2 children');
    expect(ed.outline()).toBe('bg\ntitle\nmarkers\n  c1\n  box');
  });

  it('undo restores everything in one step; redo regroups', () => {
    specScene();
    const before = ed.snapshot();
    ed.run(new GroupCommand(ed.document, 'markers', ['c1', 'box']));
    const grouped = ed.snapshot();
    expect(ed.history.undo()).toBe('g#markers removed (2 children restored)');
    expect(ed.snapshot()).toBe(before);
    ed.history.redo();
    expect(ed.snapshot()).toBe(grouped);
  });

  it('new container takes the first member position; members keep document order, not argument order', () => {
    specScene();
    ed.run(new GroupCommand(ed.document, 'g', ['box', 'bg']));
    expect(ed.outline()).toBe('g\n  bg\n  box\ntitle\nc1');
  });

  it('duplicate ids in the list are collapsed', () => {
    specScene();
    ed.run(new GroupCommand(ed.document, 'g', ['c1', 'c1', 'box']));
    expect(ed.outline()).toBe('bg\ntitle\ng\n  c1\n  box');
  });

  it('members from different parents are pulled into the first member parent, undo restores each', () => {
    ed.run(create('g', 'A', []));
    ed.run(create('rect', 'r1', ['0', '0', '1', '1'], 'A'));
    ed.run(create('rect', 'r2', ['0', '0', '1', '1'], 'A'));
    ed.run(create('circle', 'c1', ['0', '0', '1']));
    const before = ed.snapshot();
    ed.run(new GroupCommand(ed.document, 'G', ['c1', 'r1']));
    expect(ed.outline()).toBe('A\n  G\n    r1\n    c1\n  r2');
    ed.history.undo();
    expect(ed.snapshot()).toBe(before);
  });

  it('undo restores original indexes for interleaved members', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      ed.run(create('rect', id, ['0', '0', '1', '1']));
    }
    const before = ed.snapshot();
    ed.run(new GroupCommand(ed.document, 'G', ['b', 'd', 'e']));
    expect(ed.outline()).toBe('a\nG\n  b\n  d\n  e\nc');
    ed.history.undo();
    expect(ed.snapshot()).toBe(before);
  });

  it('error: container together with its own descendant', () => {
    specScene();
    ed.run(new GroupCommand(ed.document, 'markers', ['c1', 'box']));
    expectFailsWithoutChange(
      new GroupCommand(ed.document, 'bad', ['c1', 'markers']),
      'cannot group a container into its own descendant: markers',
    );
  });

  it('other errors leave the document untouched', () => {
    specScene();
    expectFailsWithoutChange(new GroupCommand(ed.document, 'g', ['c1', 'nope']), 'no such shape: nope');
    expectFailsWithoutChange(new GroupCommand(ed.document, 'bg', ['c1']), 'id already exists: bg');
    expectFailsWithoutChange(new GroupCommand(ed.document, 'g', []), 'usage: group');
  });
});

describe('UngroupCommand', () => {
  beforeEach(() => {
    ed.run(create('g', 'outer', []));
    ed.run(create('rect', 'before', ['0', '0', '1', '1'], 'outer'));
    ed.run(create('g', 'inner', [], 'outer'));
    ed.run(create('circle', 'x', ['0', '0', '1'], 'inner'));
    ed.run(create('circle', 'y', ['0', '0', '1'], 'inner'));
    ed.run(create('rect', 'after', ['0', '0', '1', '1'], 'outer'));
  });

  it('promotes children to the parent, in place of the container', () => {
    expect(ed.run(new UngroupCommand(ed.document, 'inner'))).toBe('g#inner ungrouped (2 children moved to g#outer)');
    expect(ed.outline()).toBe('outer\n  before\n  x\n  y\n  after');
  });

  it('undo restores the container and its children', () => {
    const before = ed.snapshot();
    ed.run(new UngroupCommand(ed.document, 'inner'));
    expect(ed.history.undo()).toBe('g#inner restored with 2 children');
    expect(ed.snapshot()).toBe(before);
  });

  it('errors', () => {
    expectFailsWithoutChange(new UngroupCommand(ed.document, 'outer'), 'cannot ungroup top-level container: outer');
    expectFailsWithoutChange(new UngroupCommand(ed.document, 'before'), 'not a container: before');
    expectFailsWithoutChange(new UngroupCommand(ed.document, 'nope'), 'no such shape: nope');
  });

  it('a container that forbids ungrouping (future composite shapes) is rejected', () => {
    class Opaque extends Group {
      override canUngroup(): boolean {
        return false;
      }
    }
    ed.document.find('outer').insertChild(new Opaque('n1'));
    expectFailsWithoutChange(new UngroupCommand(ed.document, 'n1'), 'cannot ungroup composite shape: n1');
  });
});

describe('AddToCommand', () => {
  beforeEach(() => {
    ed.run(create('g', 'A', []));
    ed.run(create('rect', 'r1', ['0', '0', '1', '1'], 'A'));
    ed.run(create('rect', 'r2', ['0', '0', '1', '1'], 'A'));
    ed.run(create('g', 'B', []));
    ed.run(create('circle', 'c1', ['0', '0', '1'], 'B'));
  });

  it('moves a shape to the end of the container; undo puts it back at the old index', () => {
    const before = ed.snapshot();
    expect(ed.run(new AddToCommand(ed.document, 'B', 'r1'))).toBe('rect#r1 moved into g#B');
    expect(ed.outline()).toBe('A\n  r2\nB\n  c1\n  r1');
    expect(ed.history.undo()).toBe('rect#r1 moved back into g#A');
    expect(ed.snapshot()).toBe(before);
  });

  it('moving within the same container sends it to the end and undo restores', () => {
    const before = ed.snapshot();
    ed.run(new AddToCommand(ed.document, 'A', 'r1'));
    expect(ed.outline()).toBe('A\n  r2\n  r1\nB\n  c1');
    ed.history.undo();
    expect(ed.snapshot()).toBe(before);
  });

  it('errors', () => {
    expectFailsWithoutChange(new AddToCommand(ed.document, 'A', 'A'), 'cannot group a container into its own descendant: A');
    ed.run(create('g', 'inner', [], 'A'));
    expectFailsWithoutChange(
      new AddToCommand(ed.document, 'inner', 'A'),
      'cannot group a container into its own descendant: A',
    );
    expectFailsWithoutChange(new AddToCommand(ed.document, 'nope', 'r1'), 'no such container: nope');
    expectFailsWithoutChange(new AddToCommand(ed.document, 'r2', 'r1'), 'not a container: r2');
    expectFailsWithoutChange(new AddToCommand(ed.document, 'A', 'nope'), 'no such shape: nope');
  });
});

describe('ZOrderCommand', () => {
  beforeEach(() => {
    for (const id of ['a', 'b', 'c']) {
      ed.run(create('rect', id, ['0', '0', '1', '1']));
    }
  });

  it('front puts the shape last among siblings; undo restores', () => {
    const before = ed.snapshot();
    expect(ed.run(ZOrderCommand.front(ed.document, 'a'))).toBe('rect#a brought to front');
    expect(ed.outline()).toBe('b\nc\na');
    expect(ed.history.undo()).toBe('rect#a z-order restored');
    expect(ed.snapshot()).toBe(before);
  });

  it('back puts the shape first among siblings; undo restores', () => {
    const before = ed.snapshot();
    expect(ed.run(ZOrderCommand.back(ed.document, 'c'))).toBe('rect#c sent to back');
    expect(ed.outline()).toBe('c\na\nb');
    ed.history.undo();
    expect(ed.snapshot()).toBe(before);
  });

  it('works inside a container and for a shape already at the target position', () => {
    ed.run(create('g', 'g1', []));
    ed.run(create('rect', 'x', ['0', '0', '1', '1'], 'g1'));
    ed.run(create('rect', 'y', ['0', '0', '1', '1'], 'g1'));
    ed.run(ZOrderCommand.front(ed.document, 'y'));
    expect(ed.outline()).toBe('a\nb\nc\ng1\n  x\n  y');
    ed.history.undo();
    expect(ed.outline()).toBe('a\nb\nc\ng1\n  x\n  y');
  });

  it('unknown id', () => {
    expectFailsWithoutChange(ZOrderCommand.front(ed.document, 'nope'), 'no such shape: nope');
  });
});

describe('long undo/redo chain', () => {
  it('undoing everything returns to the empty document; redoing everything returns to the end state', () => {
    specScene();
    ed.run(new GroupCommand(ed.document, 'markers', ['c1', 'box']));
    ed.run(ZOrderCommand.back(ed.document, 'markers'));
    ed.run(create('g', 'outer', []));
    ed.run(new AddToCommand(ed.document, 'outer', 'markers'));
    ed.run(new UngroupCommand(ed.document, 'markers'));
    expect(ed.outline()).toBe('bg\ntitle\nouter\n  c1\n  box');
    const end = ed.snapshot();
    while (ed.history.undoDepth > 0) {
      ed.history.undo();
    }
    expect(ed.snapshot()).toBe('svg 800x600');
    while (ed.history.redoDepth > 0) {
      ed.history.redo();
    }
    expect(ed.snapshot()).toBe(end);
  });
});
