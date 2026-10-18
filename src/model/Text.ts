import { UnknownAttributeError } from './errors/UnknownAttributeError.js';
import { NumberCodec } from './NumberCodec.js';
import { Shape } from './Shape.js';
import { ShapeSpec } from './ShapeSpec.js';
import type { ShapeState } from './ShapeState.js';
import type { StyleInit } from './StyleInit.js';

export class Text extends Shape {
  constructor(
    id: string,
    private _x: number,
    private _y: number,
    private _content: string,
    style: StyleInit = {},
  ) {
    super(id, style);
  }

  static spec(): ShapeSpec {
    return new ShapeSpec('text', '<id> <x> <y> "content"', ['x', 'y', 'text'], [], (id, a) =>
      new Text(id, a.number('x'), a.number('y'), a.text('text'), a.style()),
    );
  }

  get kind(): string {
    return 'text';
  }

  get x(): number {
    return this._x;
  }

  get y(): number {
    return this._y;
  }

  get content(): string {
    return this._content;
  }

  override textContent(): string {
    return this._content;
  }

  anchor(): readonly [number, number] {
    return [this._x, this._y];
  }

  translate(dx: number, dy: number): void {
    this._x += dx;
    this._y += dy;
  }

  protected scaleBy(factor: number): void {
    this._x *= factor;
    this._y *= factor;
  }

  protected setOwnAttribute(name: string, value: string): void {
    switch (name) {
      case 'x':
        this._x = NumberCodec.parse(value);
        break;
      case 'y':
        this._y = NumberCodec.parse(value);
        break;
      case 'text':
        this._content = value;
        break;
      default:
        throw new UnknownAttributeError(name);
    }
  }

  protected ownAttributes(): Array<[string, string]> {
    return [
      ['x', NumberCodec.format(this._x)],
      ['y', NumberCodec.format(this._y)],
    ];
  }

  describe(): string {
    return `(${NumberCodec.format(this._x)},${NumberCodec.format(this._y)}) "${this._content}"`;
  }

  /** 几何行之后紧跟文本内容行，再是外观行。 */
  override details(): string[] {
    const lines = super.details();
    lines.splice(1, 0, `text="${this._content}"`);
    return lines;
  }

  protected captureOwn(): Record<string, number | string> {
    return { x: this._x, y: this._y, content: this._content };
  }

  protected restoreOwn(state: ShapeState): void {
    this._x = state.number('x');
    this._y = state.number('y');
    this._content = state.text('content');
  }
}
