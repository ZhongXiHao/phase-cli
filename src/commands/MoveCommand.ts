import { NumberCodec } from '../model/NumberCodec.js';
import type { Document } from '../model/Document.js';
import type { Shape } from '../model/Shape.js';
import type { ShapeState } from '../model/ShapeState.js';
import type { Command } from './Command.js';

export class MoveCommand implements Command {
  private target: { shape: Shape; before: ShapeState } | null = null;

  constructor(
    private readonly document: Document,
    private readonly id: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {}

  execute(): string {
    const shape = this.document.find(this.id);
    this.target = { shape, before: shape.captureState() };
    shape.translate(this.dx, this.dy);
    const anchor = shape.anchor();
    return anchor === null
      ? `${shape.label()} moved by ${MoveCommand.pair(this.dx, this.dy)}`
      : `${shape.label()} moved to ${MoveCommand.pair(anchor[0], anchor[1])}`;
  }

  /** 用快照还原，而不是反向平移，保证数值逐位一致。 */
  undo(): string {
    const { shape, before } = this.target as NonNullable<typeof this.target>;
    shape.restoreState(before);
    const anchor = shape.anchor();
    return anchor === null
      ? `${shape.label()} moved back by ${MoveCommand.pair(-this.dx, -this.dy)}`
      : `${shape.label()} moved back to ${MoveCommand.pair(anchor[0], anchor[1])}`;
  }

  private static pair(x: number, y: number): string {
    return `(${NumberCodec.format(x)},${NumberCodec.format(y)})`;
  }
}
