import type { Document } from '../model/Document.js';
import type { Shape } from '../model/shape/Shape.js';
import type { Command } from './Command.js';

/** 调整同级 z-order：front = 同级最后一个（绘制在最上层），back = 同级第一个。 */
export class ZOrderCommand implements Command {
  private done: { shape: Shape; parent: Shape; oldIndex: number } | null = null;

  private constructor(
    private readonly document: Document,
    private readonly id: string,
    private readonly toFront: boolean,
  ) {}

  static front(document: Document, id: string): ZOrderCommand {
    return new ZOrderCommand(document, id, true);
  }

  static back(document: Document, id: string): ZOrderCommand {
    return new ZOrderCommand(document, id, false);
  }

  execute(): string {
    const shape = this.document.find(this.id);
    const parent = shape.parent as Shape;
    const oldIndex = parent.removeChild(shape);
    parent.insertChild(shape, this.toFront ? parent.children().length : 0);
    this.done = { shape, parent, oldIndex };
    return `${shape.label()} ${this.toFront ? 'brought to front' : 'sent to back'}`;
  }

  undo(): string {
    const { shape, parent, oldIndex } = this.done as NonNullable<typeof this.done>;
    parent.removeChild(shape);
    parent.insertChild(shape, oldIndex);
    return `${shape.label()} z-order restored`;
  }
}
