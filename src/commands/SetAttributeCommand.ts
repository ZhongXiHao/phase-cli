import type { Document } from '../model/Document.js';
import type { Shape } from '../model/shape/Shape.js';
import type { ShapeState } from '../model/shape/ShapeState.js';
import type { Command } from './Command.js';

export class SetAttributeCommand implements Command {
  private target: { shape: Shape; before: ShapeState; oldValue: string | undefined } | null = null;

  constructor(
    private readonly document: Document,
    private readonly id: string,
    private readonly attribute: string,
    private readonly value: string,
  ) {}

  execute(): string {
    const shape = this.document.find(this.id);
    const before = shape.captureState();
    const oldValue = SetAttributeCommand.valueOf(shape, this.attribute);
    shape.setAttribute(this.attribute, this.value);
    this.target = { shape, before, oldValue };
    return `${shape.label()} updated: ${this.assignment(this.value)}`;
  }

  /** 快照还原；对容器则每个子孙回到各自原来的值。 */
  undo(): string {
    const { shape, before, oldValue } = this.target as NonNullable<typeof this.target>;
    shape.restoreState(before);
    return oldValue === undefined
      ? `${shape.label()} restored: ${this.attribute}`
      : `${shape.label()} updated: ${this.assignment(oldValue)}`;
  }

  /** text 内容带引号显示（与规范示例一致），其余属性不带。 */
  private assignment(value: string): string {
    return this.attribute === 'text' ? `text="${value}"` : `${this.attribute}=${value}`;
  }

  private static valueOf(shape: Shape, attribute: string): string | undefined {
    if (attribute === 'text') {
      return shape.textContent() ?? undefined;
    }
    return shape.attributes().find(([name]) => name === attribute)?.[1];
  }
}
