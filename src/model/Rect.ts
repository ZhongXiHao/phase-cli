import { UnknownAttributeError } from './errors/UnknownAttributeError.js';
import { NumberCodec } from './NumberCodec.js';
import { Shape } from './Shape.js';
import { ShapeSpec } from './ShapeSpec.js';
import type { ShapeState } from './ShapeState.js';
import type { StyleInit } from './StyleInit.js';

export class Rect extends Shape {
  constructor(
    id: string,
    private _x: number,
    private _y: number,
    private _width: number,
    private _height: number,
    style: StyleInit = {},
  ) {
    super(id, style);
  }

  static spec(): ShapeSpec {
    return new ShapeSpec('rect', '<id> <x> <y> <w> <h> [fill]', ['x', 'y', 'width', 'height'], ['fill'], (id, a) =>
      new Rect(id, a.number('x'), a.number('y'), a.number('width'), a.number('height'), a.style()),
    );
  }

  get kind(): string {
    return 'rect';
  }

  get x(): number {
    return this._x;
  }

  get y(): number {
    return this._y;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
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
    this._width *= factor;
    this._height *= factor;
  }

  protected setOwnAttribute(name: string, value: string): void {
    switch (name) {
      case 'x':
        this._x = NumberCodec.parse(value);
        break;
      case 'y':
        this._y = NumberCodec.parse(value);
        break;
      case 'width':
        this._width = NumberCodec.parse(value);
        break;
      case 'height':
        this._height = NumberCodec.parse(value);
        break;
      default:
        throw new UnknownAttributeError(name);
    }
  }

  protected ownAttributes(): Array<[string, string]> {
    return [
      ['x', NumberCodec.format(this._x)],
      ['y', NumberCodec.format(this._y)],
      ['width', NumberCodec.format(this._width)],
      ['height', NumberCodec.format(this._height)],
    ];
  }

  describe(): string {
    const f = NumberCodec.format;
    return this.withFill(`x=${f(this._x)} y=${f(this._y)} w=${f(this._width)} h=${f(this._height)}`);
  }

  protected captureOwn(): Record<string, number> {
    return { x: this._x, y: this._y, width: this._width, height: this._height };
  }

  protected restoreOwn(state: ShapeState): void {
    this._x = state.number('x');
    this._y = state.number('y');
    this._width = state.number('width');
    this._height = state.number('height');
  }
}
