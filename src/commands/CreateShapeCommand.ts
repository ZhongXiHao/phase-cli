import type { Document } from '../model/Document.js';
import type { Shape } from '../model/shape/Shape.js';
import type { ShapeFactory } from '../model/shape/ShapeFactory.js';
import type { Command } from './Command.js';

export class CreateShapeCommand implements Command {
  /** 首次 execute 时创建，之后 redo 复用同一个对象，保证与其他命令持有的引用一致。 */
  private shape: Shape | null = null;

  constructor(
    private readonly document: Document,
    private readonly factory: ShapeFactory,
    private readonly type: string,
    private readonly id: string,
    private readonly args: readonly string[],
    private readonly containerId?: string,
  ) {}

  execute(): string {
    const shape = this.shape ?? this.factory.create(this.type, this.id, this.args);
    this.document.assertIdFree(this.id);
    const parent = this.containerId === undefined ? this.document.root : this.document.findContainer(this.containerId);

    parent.insertChild(shape);
    this.shape = shape;
    return this.containerId === undefined
      ? `${shape.label()} created`
      : `${shape.label()} created in ${parent.label()}`;
  }

  undo(): string {
    const shape = this.created();
    shape.parent?.removeChild(shape);
    return `${shape.label()} removed`;
  }

  private created(): Shape {
    if (this.shape === null) {
      throw new Error('CreateShapeCommand.undo called before execute');
    }
    return this.shape;
  }
}
