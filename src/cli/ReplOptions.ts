export interface ReplOptions {
  /** 输入不是终端时（管道 / 脚本文件）把读到的行回显在提示符后，输出就是完整的会话记录。 */
  readonly echoInput: boolean;
  /** 输入是真实终端：由 readline 负责行编辑与回显。 */
  readonly interactive: boolean;
}
