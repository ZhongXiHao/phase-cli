import { UnknownAttributeError } from './errors/UnknownAttributeError.js';
import { NumberCodec } from './NumberCodec.js';
import { Shape } from './Shape.js';
import { ShapeSpec } from './ShapeSpec.js';
import type { ShapeState } from './ShapeState.js';
import type { StyleInit } from './StyleInit.js';

export class Line extends Shape {
  constructor(
    id: string,
    private _x1: number,
    private _y1: number,
    private _x2: number,
    private _y2: number,
    style: StyleInit = {},
  ) {
    super(id, style);
  }

  static spec(): ShapeSpec {
    return new ShapeSpec('line', '<id> <x1> <y1> <x2> <y2> [stroke]', ['x1', 'y1', 'x2', 'y2'], ['stroke'], (id, a) =>
      new Line(id, a.number('x1'), a.number('y1'), a.number('x2'), a.number('y2'), a.style()),
    );
  }

  get kind(): string {
    return 'line';
  }

  get x1(): number {
    return this._x1;
  }

  get y1(): number {
    return this._y1;
  }

  get x2(): number {
    return this._x2;
  }

  get y2(): number {
    return this._y2;
  }

  anchor(): readonly [number, number] {
    return [this._x1, this._y1];
  }

  translate(dx: number, dy: number): void {
    this._x1 += dx;
    this._y1 += dy;
    this._x2 += dx;
    this._y2 += dy;
  }

  protected scaleBy(factor: number): void {
    this._x1 *= factor;
    this._y1 *= factor;
    this._x2 *= factor;
    this._y2 *= factor;
  }

  protected setOwnAttribute(name: string, value: string): void {
    switch (name) {
      case 'x1':
        this._x1 = NumberCodec.parse(value);
        break;
      case 'y1':
        this._y1 = NumberCodec.parse(value);
        break;
      case 'x2':
        this._x2 = NumberCodec.parse(value);
        break;
      case 'y2':
        this._y2 = NumberCodec.parse(value);
        break;
      default:
        throw new UnknownAttributeError(name);
    }
  }

  protected ownAttributes(): Array<[string, string]> {
    return [
      ['x1', NumberCodec.format(this._x1)],
      ['y1', NumberCodec.format(this._y1)],
      ['x2', NumberCodec.format(this._x2)],
      ['y2', NumberCodec.format(this._y2)],
    ];
  }

  /** 与规范 tree 示例一致：只显示端点，不显示 stroke。 */
  describe(): string {
    const f = NumberCodec.format;
    return `(${f(this._x1)},${f(this._y1)}) -> (${f(this._x2)},${f(this._y2)})`;
  }

  protected captureOwn(): Record<string, number> {
    return { x1: this._x1, y1: this._y1, x2: this._x2, y2: this._y2 };
  }

  protected restoreOwn(state: ShapeState): void {
    this._x1 = state.number('x1');
    this._y1 = state.number('y1');
    this._x2 = state.number('x2');
    this._y2 = state.number('y2');
  }
}
