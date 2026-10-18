import type { Editor } from '../app/Editor.js';
import type { CliHandler } from './CliHandler.js';
import { AddToHandler } from './handlers/AddToHandler.js';
import { BackHandler } from './handlers/BackHandler.js';
import { CanvasHandler } from './handlers/CanvasHandler.js';
import { CreateHandler } from './handlers/CreateHandler.js';
import { DeleteHandler } from './handlers/DeleteHandler.js';
import { ExitHandler } from './handlers/ExitHandler.js';
import { FrontHandler } from './handlers/FrontHandler.js';
import { GroupHandler } from './handlers/GroupHandler.js';
import { HelpHandler } from './handlers/HelpHandler.js';
import { InitHandler } from './handlers/InitHandler.js';
import { MoveHandler } from './handlers/MoveHandler.js';
import { RedoHandler } from './handlers/RedoHandler.js';
import { ScaleHandler } from './handlers/ScaleHandler.js';
import { SetHandler } from './handlers/SetHandler.js';
import { ShowHandler } from './handlers/ShowHandler.js';
import { TreeHandler } from './handlers/TreeHandler.js';
import { UndoHandler } from './handlers/UndoHandler.js';
import { UngroupHandler } from './handlers/UngroupHandler.js';
import { UnknownCommandError } from './UnknownCommandError.js';

/**
 * 命令名 → 处理器的注册表（按名字分派的两处之一）。
 * 待重构：插件阶段改为由 CommandProvider 注册，而不是在这里硬编码列表。
 */
export class CommandTable {
  private readonly byName = new Map<string, CliHandler>();

  static standard(onExit: () => void): CommandTable {
    const table = new CommandTable();
    for (const handler of [
      new InitHandler(),
      new CanvasHandler(),
      new CreateHandler(),
      new DeleteHandler(),
      new MoveHandler(),
      new ScaleHandler(),
      new SetHandler(),
      new GroupHandler(),
      new UngroupHandler(),
      new AddToHandler(),
      new FrontHandler(),
      new BackHandler(),
      new TreeHandler(),
      new ShowHandler(),
      new UndoHandler(),
      new RedoHandler(),
      new HelpHandler(() => table.handlers()),
      new ExitHandler(onExit),
    ]) {
      table.register(handler);
    }
    return table;
  }

  register(handler: CliHandler): void {
    if (this.byName.has(handler.name)) {
      throw new Error(`command already registered: ${handler.name}`);
    }
    this.byName.set(handler.name, handler);
  }

  /** 按注册顺序，供 help 使用。 */
  handlers(): CliHandler[] {
    return [...this.byName.values()];
  }

  dispatch(tokens: readonly string[], editor: Editor): string[] {
    const [name, ...args] = tokens as [string, ...string[]];
    const handler = this.byName.get(name);
    if (handler === undefined) {
      throw new UnknownCommandError(name);
    }
    return handler.run(args, editor);
  }
}
