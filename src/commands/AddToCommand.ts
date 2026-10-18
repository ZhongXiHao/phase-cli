import { CannotGroupIntoDescendantError } from '../model/errors/CannotGroupIntoDescendantError.js';
import type { Document } from '../model/Document.js';
import type { Shape } from '../model/Shape.js';
import type { Command } from './Command.js';

/** 把已有图形移入容器，作为最后一个子节点。 */
export class AddToCommand implements Command {
  private done: { shape: Shape; container: Shape; oldParent: Shape; oldIndex: number } | null = null;

  constructor(
    private readonly document: Document,
    private readonly containerId: string,
    private readonly id: string,
  ) {}

  execute(): string {
    const container = this.document.findContainer(this.containerId);
    const shape = this.document.find(this.id);
    if (container === shape || container.isDescendantOf(shape)) {
      throw new CannotGroupIntoDescendantError(shape.id);
    }

    const oldParent = shape.parent as Shape;
    const oldIndex = oldParent.removeChild(shape);
    container.insertChild(shape);

    this.done = { shape, container, oldParent, oldIndex };
    return `${shape.label()} moved into ${container.label()}`;
  }

  undo(): string {
    const { shape, container, oldParent, oldIndex } = this.done as NonNullable<typeof this.done>;
    container.removeChild(shape);
    oldParent.insertChild(shape, oldIndex);
    return `${shape.label()} moved back into ${oldParent.label()}`;
  }
}
