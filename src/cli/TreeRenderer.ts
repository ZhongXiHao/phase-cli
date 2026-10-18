import type { DocumentView } from '../model/DocumentView.js';
import { NumberCodec } from '../model/NumberCodec.js';
import type { ShapeView } from '../model/ShapeView.js';

interface Entry {
  readonly head: string;
  readonly description: string;
}

/**
 * 结构树，属性内联。所有带描述的行的描述列统一对齐：
 * 列位置 = 全树最长的"前缀 + 标签" + 2 个空格。
 */
export class TreeRenderer {
  renderDocument(document: DocumentView): string[] {
    const header = `svg (${NumberCodec.format(document.width)}x${NumberCodec.format(document.height)})`;
    const entries: Entry[] = [];
    this.walk(document.root.children(), '', entries);
    return [header, ...this.align(entries)];
  }

  /** 只显示以 root 为根的子树。 */
  renderSubtree(root: ShapeView): string[] {
    const entries: Entry[] = [{ head: root.label(), description: root.describe() }];
    this.walk(root.children(), '', entries);
    return this.align(entries);
  }

  private walk(nodes: readonly ShapeView[], prefix: string, entries: Entry[]): void {
    nodes.forEach((node, index) => {
      const last = index === nodes.length - 1;
      entries.push({ head: `${prefix}${last ? '└── ' : '├── '}${node.label()}`, description: node.describe() });
      this.walk(node.children(), `${prefix}${last ? '    ' : '│   '}`, entries);
    });
  }

  private align(entries: readonly Entry[]): string[] {
    const width = Math.max(0, ...entries.filter((e) => e.description !== '').map((e) => e.head.length));
    return entries.map((e) => (e.description === '' ? e.head : `${e.head.padEnd(width + 2)}${e.description}`));
  }
}
