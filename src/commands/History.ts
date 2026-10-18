import type { Command } from './Command.js';
import { NothingToRedoError } from './NothingToRedoError.js';
import { NothingToUndoError } from './NothingToUndoError.js';

/** 撤销栈与重做栈。一条 Command = 一个 undo 单元；执行抛错的命令不会入栈。 */
export class History {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];

  /** 执行并记录；成功后 redo 栈清空（undo 后若有新编辑，redo 不再可用）。 */
  run(command: Command): string {
    const message = command.execute();
    this.undoStack.push(command);
    this.redoStack.length = 0;
    return message;
  }

  undo(): string {
    const command = this.undoStack.at(-1);
    if (command === undefined) {
      throw new NothingToUndoError();
    }
    const message = command.undo();
    this.undoStack.pop();
    this.redoStack.push(command);
    return message;
  }

  redo(): string {
    const command = this.redoStack.at(-1);
    if (command === undefined) {
      throw new NothingToRedoError();
    }
    const message = command.execute();
    this.redoStack.pop();
    this.undoStack.push(command);
    return message;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  get undoDepth(): number {
    return this.undoStack.length;
  }

  get redoDepth(): number {
    return this.redoStack.length;
  }
}
