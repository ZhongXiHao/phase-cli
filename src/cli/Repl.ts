import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { Editor } from '../app/Editor.js';
import { Interpreter } from './Interpreter.js';

export interface ReplOptions {
  /** 输入不是终端时（管道 / 脚本文件）把读到的行回显在提示符后，输出就是完整的会话记录。 */
  readonly echoInput: boolean;
  readonly interactive: boolean;
}

/** 读一行、执行、打印的循环。只负责 I/O，输入输出流由外部注入。 */
export class Repl {
  static readonly PROMPT = 'svg> ';
  static readonly BANNER = "svg-editor 0.1 — type 'help' for commands";

  private readonly interpreter: Interpreter;
  private stopRequested = false;
  private close: () => void = () => {};

  constructor(
    editor: Editor,
    private readonly input: Readable,
    private readonly output: Writable,
    private readonly options: ReplOptions = { echoInput: false, interactive: false },
  ) {
    this.interpreter = new Interpreter(editor, () => this.stop());
  }

  /** 运行到输入结束或收到 exit。 */
  run(): Promise<void> {
    return new Promise((resolve) => {
      const rl = createInterface({
        input: this.input,
        output: this.output,
        prompt: Repl.PROMPT,
        terminal: this.options.interactive,
        crlfDelay: Number.POSITIVE_INFINITY,
      });
      this.close = () => rl.close();

      this.output.write(`${Repl.BANNER}\n\n`);
      rl.prompt();
      rl.on('line', (line) => {
        // exit 之后，readline 仍会把同一块输入里已缓冲的行发出来，这里丢弃
        if (this.stopRequested) {
          return;
        }
        if (this.options.echoInput) {
          this.output.write(`${line}\n`);
        }
        for (const out of this.interpreter.run(line)) {
          this.output.write(`${out}\n`);
        }
        if (this.stopRequested) {
          rl.close();
        } else {
          rl.prompt();
        }
      });
      rl.on('close', () => {
        if (!this.options.interactive || !this.stopRequested) {
          this.output.write('\n');
        }
        resolve();
      });
    });
  }

  private stop(): void {
    this.stopRequested = true;
  }
}
