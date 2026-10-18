import type { Editor } from '../app/Editor.js';
import { DomainError } from '../model/errors/DomainError.js';
import { CommandTable } from './CommandTable.js';
import { Tokenizer } from './Tokenizer.js';

/**
 * 一行文本 → 输出行。不碰 stdin/stdout，所以既能被 Repl 驱动，也能在测试里直接回放脚本。
 * 统一错误处理：领域错误一行一条，加 `error:` 前缀；命令失败不改变任何状态（由命令层保证）。
 */
export class Interpreter {
  private readonly tokenizer = new Tokenizer();
  private readonly table: CommandTable;

  constructor(
    private readonly editor: Editor,
    onExit: () => void = () => {},
  ) {
    this.table = CommandTable.standard(onExit);
  }

  run(line: string): string[] {
    try {
      const tokens = this.tokenizer.tokenize(line);
      return tokens.length === 0 ? [] : this.table.dispatch(tokens, this.editor);
    } catch (error) {
      if (error instanceof DomainError) {
        return [`error: ${error.message}`];
      }
      // 非领域错误是程序缺陷：照实报告，但不让会话崩溃
      return [`error: internal: ${error instanceof Error ? error.message : String(error)}`];
    }
  }
}
