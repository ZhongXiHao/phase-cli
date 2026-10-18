/**
 * 一次可撤销的编辑（Command 模式）。
 *
 * 契约：
 * - `execute()` 先完整校验全部前置条件，再开始修改；抛错时文档保持原样。
 * - `execute()` 可在 `undo()` 之后再次调用（redo），结果与第一次一致。
 * - 两个方法都返回一行结果摘要，由上层原样展示。
 */
export interface Command {
  execute(): string;
  undo(): string;
}
