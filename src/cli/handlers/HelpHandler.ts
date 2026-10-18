import { CliHandler } from '../CliHandler.js';

export class HelpHandler extends CliHandler {
  /** @param catalog 返回当前全部处理器；用函数而非 CommandTable 本身，避免两者互相引用。 */
  constructor(private readonly catalog: () => readonly CliHandler[]) {
    super('help', 'help', 'show all commands and their syntax', 0);
  }

  protected execute(): string[] {
    const handlers = this.catalog();
    const width = Math.max(...handlers.map((h) => h.usage.length));
    return [
      'Commands (a line starting with # is a comment; use "double quotes" for arguments with spaces):',
      ...handlers.map((h) => `  ${h.usage.padEnd(width + 2)}${h.description}`),
    ];
  }
}
