import { describe, expect, it } from 'vitest';
import type { Command } from '../../src/commands/Command.js';
import { History } from '../../src/commands/History.js';

class CountingCommand implements Command {
  constructor(
    private readonly log: string[],
    private readonly name: string,
    private readonly failOnExecute = false,
  ) {}

  execute(): string {
    if (this.failOnExecute) {
      throw new Error('boom');
    }
    this.log.push(`do ${this.name}`);
    return `did ${this.name}`;
  }

  undo(): string {
    this.log.push(`undo ${this.name}`);
    return `undid ${this.name}`;
  }
}

describe('History', () => {
  it('runs, undoes and redoes in LIFO order and returns the command messages', () => {
    const log: string[] = [];
    const h = new History();
    expect(h.run(new CountingCommand(log, 'a'))).toBe('did a');
    h.run(new CountingCommand(log, 'b'));
    expect(h.undo()).toBe('undid b');
    expect(h.undo()).toBe('undid a');
    expect(h.redo()).toBe('did a');
    expect(h.redo()).toBe('did b');
    expect(log).toEqual(['do a', 'do b', 'undo b', 'undo a', 'do a', 'do b']);
  });

  it('a new edit after undo clears the redo stack', () => {
    const log: string[] = [];
    const h = new History();
    h.run(new CountingCommand(log, 'a'));
    h.undo();
    expect(h.redoDepth).toBe(1);
    h.run(new CountingCommand(log, 'c'));
    expect(h.redoDepth).toBe(0);
    expect(() => h.redo()).toThrow('nothing to redo');
  });

  it('a failing command is not recorded and does not clear redo', () => {
    const log: string[] = [];
    const h = new History();
    h.run(new CountingCommand(log, 'a'));
    h.undo();
    expect(() => h.run(new CountingCommand(log, 'bad', true))).toThrow('boom');
    expect(h.undoDepth).toBe(0);
    expect(h.redoDepth).toBe(1);
  });

  it('reports nothing to undo / redo on empty stacks', () => {
    const h = new History();
    expect(() => h.undo()).toThrow('nothing to undo');
    expect(() => h.redo()).toThrow('nothing to redo');
  });

  it('clear empties both stacks', () => {
    const log: string[] = [];
    const h = new History();
    h.run(new CountingCommand(log, 'a'));
    h.run(new CountingCommand(log, 'b'));
    h.undo();
    h.clear();
    expect([h.undoDepth, h.redoDepth]).toEqual([0, 0]);
  });
});
