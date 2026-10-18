import { beforeEach, describe, expect, it } from 'vitest';
import { CreateShapeCommand } from '../../src/commands/CreateShapeCommand.js';
import { DeleteShapeCommand } from '../../src/commands/DeleteShapeCommand.js';
import { MoveCommand } from '../../src/commands/MoveCommand.js';
import { ScaleCommand } from '../../src/commands/ScaleCommand.js';
import { SetAttributeCommand } from '../../src/commands/SetAttributeCommand.js';
import type { Command } from '../../src/commands/Command.js';
import { TestEditor } from '../support/TestEditor.js';

let ed: TestEditor;

function create(type: string, id: string, args: string[], containerId?: string): Command {
  return new CreateShapeCommand(ed.document, ed.factory, type, id, args, containerId);
}

/** 断言命令失败，且文档快照、历史深度都没变。 */
function expectFailsWithoutChange(command: Command, message: string): void {
  const before = ed.snapshot();
  const depth = ed.history.undoDepth;
  expect(() => ed.run(command)).toThrow(message);
  expect(ed.snapshot()).toBe(before);
  expect(ed.history.undoDepth).toBe(depth);
}

beforeEach(() => {
  ed = new TestEditor();
});

describe('CreateShapeCommand', () => {
  it('creates at the canvas root and reports like the spec', () => {
    expect(ed.run(create('rect', 'r1', ['10', '20', '100', '50', '#eee']))).toBe('rect#r1 created');
    expect(ed.document.find('r1').parent).toBe(ed.document.root);
  });

  it('`in` puts the shape into the container as last child', () => {
    ed.run(create('g', 'node1', []));
    expect(ed.run(create('rect', 'start', ['120', '100', '160', '60', '#4a90d9'], 'node1'))).toBe(
      'rect#start created in g#node1',
    );
    expect(ed.run(create('text', 'start-label', ['155', '135', '开始'], 'node1'))).toBe(
      'text#start-label created in g#node1',
    );
    expect(ed.outline()).toBe('node1\n  start\n  start-label');
  });

  it('undo removes it; redo brings back the same object', () => {
    ed.run(create('rect', 'r1', ['0', '0', '1', '1']));
    const original = ed.document.find('r1');
    expect(ed.history.undo()).toBe('rect#r1 removed');
    expect(ed.document.tryFind('r1')).toBeUndefined();
    ed.history.redo();
    expect(ed.document.find('r1')).toBe(original);
  });

  it('error cases leave the document untouched', () => {
    ed.run(create('rect', 'r1', ['0', '0', '1', '1']));
    ed.run(create('g', 'node1', []));
    expectFailsWithoutChange(create('rect', 'r1', ['0', '0', '1', '1']), 'id already exists: r1');
    expectFailsWithoutChange(create('rect', 'r2', ['0', '0', '1', '1'], 'node9'), 'no such container: node9');
    expectFailsWithoutChange(create('rect', 'r2', ['0', '0', '1', '1'], 'r1'), 'not a container: r1');
    expectFailsWithoutChange(create('hexagon', 'h', []), 'unknown shape type: hexagon (is the plugin loaded?)');
    expectFailsWithoutChange(create('rect', 'r2', ['0', '0', 'wide', '1']), 'invalid number: wide');
    expectFailsWithoutChange(create('rect', 'r2', ['0', '0']), 'usage: create rect');
  });

  it('id clash is also detected on redo', () => {
    const cmd = create('rect', 'r1', ['0', '0', '1', '1']);
    ed.run(cmd);
    ed.history.undo();
    ed.run(create('circle', 'r1', ['0', '0', '1']));
    expect(() => cmd.execute()).toThrow('id already exists: r1');
  });
});

describe('DeleteShapeCommand', () => {
  beforeEach(() => {
    ed.run(create('g', 'markers', []));
    ed.run(create('circle', 'c1', ['100', '100', '20', 'red'], 'markers'));
    ed.run(create('rect', 'box', ['200', '80', '60', '60', '#3366ff'], 'markers'));
    ed.run(create('text', 'after', ['1', '2', 'x']));
  });

  it('deletes a leaf, undo restores it at the same index', () => {
    const before = ed.snapshot();
    expect(ed.run(new DeleteShapeCommand(ed.document, 'c1'))).toBe('circle#c1 deleted');
    expect(ed.outline()).toBe('markers\n  box\nafter');
    expect(ed.history.undo()).toBe('circle#c1 restored into g#markers');
    expect(ed.snapshot()).toBe(before);
  });

  it('deleting a container removes the whole subtree as one undo unit', () => {
    const before = ed.snapshot();
    ed.run(new DeleteShapeCommand(ed.document, 'markers'));
    expect(ed.outline()).toBe('after');
    expect(ed.document.tryFind('c1')).toBeUndefined();
    ed.history.undo();
    expect(ed.snapshot()).toBe(before);
  });

  it('unknown id', () => {
    expectFailsWithoutChange(new DeleteShapeCommand(ed.document, 'r9'), 'no such shape: r9');
  });
});

describe('MoveCommand', () => {
  beforeEach(() => {
    ed.run(create('g', 'markers', []));
    ed.run(create('circle', 'c1', ['100', '100', '20'], 'markers'));
    ed.run(create('rect', 'box', ['200', '80', '60', '60'], 'markers'));
  });

  it('leaf: messages match the spec transcript', () => {
    expect(ed.run(new MoveCommand(ed.document, 'c1', 30, 0))).toBe('circle#c1 moved to (130,100)');
    expect(ed.history.undo()).toBe('circle#c1 moved back to (100,100)');
    expect(ed.history.redo()).toBe('circle#c1 moved to (130,100)');
  });

  it('container: moves every descendant, messages use `by`', () => {
    expect(ed.run(new MoveCommand(ed.document, 'markers', 0, 100))).toBe('g#markers moved by (0,100)');
    expect(ed.snapshot()).toContain('cy=200');
    expect(ed.snapshot()).toContain('y=180');
    expect(ed.history.undo()).toBe('g#markers moved back by (0,-100)');
  });

  it('undo restores the exact numbers even with float noise', () => {
    const before = ed.snapshot();
    ed.run(new MoveCommand(ed.document, 'markers', 0.1, 0.2));
    ed.run(new MoveCommand(ed.document, 'markers', 0.7, 0.3));
    ed.history.undo();
    ed.history.undo();
    expect(ed.snapshot()).toBe(before);
  });

  it('unknown id', () => {
    expectFailsWithoutChange(new MoveCommand(ed.document, 'nope', 1, 1), 'no such shape: nope');
  });
});

describe('ScaleCommand', () => {
  beforeEach(() => {
    ed.run(create('g', 'g1', []));
    ed.run(create('rect', 'r', ['10', '20', '30', '40'], 'g1'));
    ed.run(create('circle', 'c', ['5', '5', '2'], 'g1'));
  });

  it('scales the whole subtree and undo is exact', () => {
    const before = ed.snapshot();
    expect(ed.run(new ScaleCommand(ed.document, 'g1', 0.3))).toBe('g#g1 scaled by 0.3');
    expect(ed.snapshot()).toContain('width=9');
    expect(ed.history.undo()).toBe('g#g1 scale undone');
    expect(ed.snapshot()).toBe(before);
  });

  it('non-positive factor is rejected without change', () => {
    expectFailsWithoutChange(new ScaleCommand(ed.document, 'g1', 0), 'scale factor must be positive');
    expectFailsWithoutChange(new ScaleCommand(ed.document, 'g1', -1), 'scale factor must be positive');
    expectFailsWithoutChange(new ScaleCommand(ed.document, 'zz', 2), 'no such shape: zz');
  });
});

describe('SetAttributeCommand', () => {
  beforeEach(() => {
    ed.run(create('text', 'title', ['20', '40', 'My Diagram']));
    ed.run(create('g', 'g1', []));
    ed.run(create('rect', 'a', ['0', '0', '1', '1', 'red'], 'g1'));
    ed.run(create('rect', 'b', ['0', '0', '1', '1'], 'g1'));
  });

  it('text content: messages match the spec transcript', () => {
    expect(ed.run(new SetAttributeCommand(ed.document, 'title', 'text', 'My Diagram v2'))).toBe(
      'text#title updated: text="My Diagram v2"',
    );
    expect(ed.history.undo()).toBe('text#title updated: text="My Diagram"');
    expect(ed.history.redo()).toContain('My Diagram v2');
  });

  it('geometry and style attributes', () => {
    expect(ed.run(new SetAttributeCommand(ed.document, 'a', 'width', '99'))).toBe('rect#a updated: width=99');
    expect(ed.run(new SetAttributeCommand(ed.document, 'a', 'stroke-width', '3'))).toBe(
      'rect#a updated: stroke-width=3',
    );
  });

  it('undo of a previously unset attribute removes it again', () => {
    const before = ed.snapshot();
    ed.run(new SetAttributeCommand(ed.document, 'b', 'fill', 'blue'));
    expect(ed.history.undo()).toBe('rect#b restored: fill');
    expect(ed.snapshot()).toBe(before);
  });

  it('on a container, style propagates and undo gives each child its own old value back', () => {
    const before = ed.snapshot();
    expect(ed.run(new SetAttributeCommand(ed.document, 'g1', 'fill', 'green'))).toBe('g#g1 updated: fill=green');
    expect(ed.document.find('a').attributes()).toContainEqual(['fill', 'green']);
    expect(ed.document.find('b').attributes()).toContainEqual(['fill', 'green']);
    ed.history.undo();
    expect(ed.snapshot()).toBe(before);
  });

  it('error cases leave everything untouched', () => {
    expectFailsWithoutChange(new SetAttributeCommand(ed.document, 'a', 'bogus', '1'), 'unknown attribute: bogus');
    expectFailsWithoutChange(new SetAttributeCommand(ed.document, 'a', 'r', '1'), 'unknown attribute: r');
    expectFailsWithoutChange(new SetAttributeCommand(ed.document, 'a', 'width', 'x'), 'invalid number: x');
    expectFailsWithoutChange(new SetAttributeCommand(ed.document, 'g1', 'x', '1'), 'unknown attribute: x');
    expectFailsWithoutChange(new SetAttributeCommand(ed.document, 'g1', 'stroke-width', 'x'), 'invalid number: x');
    expectFailsWithoutChange(new SetAttributeCommand(ed.document, 'zz', 'fill', 'red'), 'no such shape: zz');
  });
});
