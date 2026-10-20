import type { Document } from '../model/Document.js';
import type { Shape } from '../model/shape/Shape.js';
import type { Command } from './Command.js';

export class DeleteShapeCommand implements Command {
  private removed: { shape: Shape; parent: Shape; index: number } | null = null;

  constructor(
    private readonly document: Document,
    private readonly id: string,
  ) {}

  execute(): string {
    const shape = this.document.find(this.id);
    const parent = shape.parent as Shape;
    const index = parent.removeChild(shape);
    this.removed = { shape, parent, index };
    return `${shape.label()} deleted`;
  }

  /** 原对象连同整棵子树按原下标放回去。 */
  undo(): string {
    const { shape, parent, index } = this.removed as NonNullable<typeof this.removed>;
    parent.insertChild(shape, index);
    return `${shape.label()} restored into ${parent.label()}`;
  }
}
