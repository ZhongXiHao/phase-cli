import type { Editor } from '../app/Editor.js';
import { InvalidArgumentsError } from '../model/errors/InvalidArgumentsError.js';

/**
 * 一条用户命令的处理器（Template Method）：先检查参数个数，再交给子类把
 * 字符串参数转成类型化参数、调用 Editor。处理器只做"文本 → 调用"的翻译，不含业务规则。
 */
export abstract class CliHandler {
  protected constructor(
    readonly name: string,
    /** 如 `move <id> <dx> <dy>`，同时用于参数个数错误提示和 help。 */
    readonly usage: string,
    readonly description: string,
    private readonly minArgs: number,
    private readonly maxArgs: number = minArgs,
  ) {}

  run(args: readonly string[], editor: Editor): string[] {
    if (!this.acceptsArgCount(args.length)) {
      throw new InvalidArgumentsError(this.usage);
    }
    return this.execute(args, editor);
  }

  /** 默认接受 [minArgs, maxArgs]；"要么 0 个要么 2 个"之类的规则由子类重写。 */
  protected acceptsArgCount(count: number): boolean {
    return count >= this.minArgs && count <= this.maxArgs;
  }

  protected abstract execute(args: readonly string[], editor: Editor): string[];
}
