import { UnknownAttributeError } from './errors/UnknownAttributeError.js';
import { NumberCodec } from './NumberCodec.js';
import { Shape } from './Shape.js';
import { ShapeSpec } from './ShapeSpec.js';
import type { ShapeState } from './ShapeState.js';
import type { StyleInit } from './StyleInit.js';

export class Circle extends Shape {
  constructor(
    id: string,
    private _cx: number,
    private _cy: number,
    private _r: number,
    style: StyleInit = {},
  ) {
    super(id, style);
  }

  static spec(): ShapeSpec {
    return new ShapeSpec('circle', '<id> <cx> <cy> <r> [fill]', ['cx', 'cy', 'r'], ['fill'], (id, a) =>
      new Circle(id, a.number('cx'), a.number('cy'), a.number('r'), a.style()),
    );
  }

  get kind(): string {
    return 'circle';
  }

  get cx(): number {
    return this._cx;
  }

  get cy(): number {
    return this._cy;
  }

  get r(): number {
    return this._r;
  }

  anchor(): readonly [number, number] {
    return [this._cx, this._cy];
  }

  translate(dx: number, dy: number): void {
    this._cx += dx;
    this._cy += dy;
  }

  protected scaleBy(factor: number): void {
    this._cx *= factor;
    this._cy *= factor;
    this._r *= factor;
  }

  protected setOwnAttribute(name: string, value: string): void {
    switch (name) {
      case 'cx':
        this._cx = NumberCodec.parse(value);
        break;
      case 'cy':
        this._cy = NumberCodec.parse(value);
        break;
      case 'r':
        this._r = NumberCodec.parse(value);
        break;
      default:
        throw new UnknownAttributeError(name);
    }
  }

  protected ownAttributes(): Array<[string, string]> {
    return [
      ['cx', NumberCodec.format(this._cx)],
      ['cy', NumberCodec.format(this._cy)],
      ['r', NumberCodec.format(this._r)],
    ];
  }

  describe(): string {
    const f = NumberCodec.format;
    return this.withFill(`cx=${f(this._cx)} cy=${f(this._cy)} r=${f(this._r)}`);
  }

  protected captureOwn(): Record<string, number> {
    return { cx: this._cx, cy: this._cy, r: this._r };
  }

  protected restoreOwn(state: ShapeState): void {
    this._cx = state.number('cx');
    this._cy = state.number('cy');
    this._r = state.number('r');
  }
}
