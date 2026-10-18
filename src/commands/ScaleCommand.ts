import { NumberCodec } from '../model/NumberCodec.js';
import type { Document } from '../model/Document.js';
import type { Shape } from '../model/Shape.js';
import type { ShapeState } from '../model/ShapeState.js';
import type { Command } from './Command.js';

export class ScaleCommand implements Command {
  private target: { shape: Shape; before: ShapeState } | null = null;

  constructor(
    private readonly document: Document,
    private readonly id: string,
    private readonly factor: number,
  ) {}

  execute(): string {
    const shape = this.document.find(this.id);
    const before = shape.captureState();
    shape.scale(this.factor);
    this.target = { shape, before };
    return `${shape.label()} scaled by ${NumberCodec.format(this.factor)}`;
  }

  undo(): string {
    const { shape, before } = this.target as NonNullable<typeof this.target>;
    shape.restoreState(before);
    return `${shape.label()} scale undone`;
  }
}
