import type { Command } from '../../src/commands/Command.js';
import { History } from '../../src/commands/History.js';
import { Document } from '../../src/model/Document.js';
import { ShapeFactory } from '../../src/model/shape/ShapeFactory.js';
import type { ShapeView } from '../../src/model/shape/ShapeView.js';

/** 测试用的小夹具：一份文档 + 工厂 + 历史，以及整棵树的文本快照。 */
export class TestEditor {
  readonly document = new Document(800, 600);
  readonly factory = ShapeFactory.withBuiltIns();
  readonly history = new History();

  run(command: Command): string {
    return this.history.run(command);
  }

  /** 整棵树的完整快照（含全部属性与次序），用来断言"没变"或"完全还原"。 */
  snapshot(): string {
    const lines: string[] = [`svg ${this.document.width}x${this.document.height}`];
    const visit = (shape: ShapeView, depth: number): void => {
      const attrs = shape.attributes().map(([k, v]) => `${k}=${v}`).join(' ');
      const text = shape.textContent();
      lines.push(`${'  '.repeat(depth)}${shape.kind} ${attrs}${text === null ? '' : ` "${text}"`}`);
      shape.children().forEach((child) => visit(child, depth + 1));
    };
    this.document.root.children().forEach((child) => visit(child, 1));
    return lines.join('\n');
  }

  /** 只看结构：`id` 缩进树，便于断言父子与次序。 */
  outline(): string {
    const lines: string[] = [];
    const visit = (shape: ShapeView, depth: number): void => {
      lines.push(`${'  '.repeat(depth)}${shape.id}`);
      shape.children().forEach((child) => visit(child, depth + 1));
    };
    this.document.root.children().forEach((child) => visit(child, 0));
    return lines.join('\n');
  }
}
