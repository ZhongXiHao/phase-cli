import { UnknownAttributeError } from './errors/UnknownAttributeError.js';
import { NumberCodec } from './NumberCodec.js';
import { Shape } from './Shape.js';
import { ShapeSpec } from './ShapeSpec.js';
import type { ShapeState } from './ShapeState.js';
import type { StyleInit } from './StyleInit.js';

export class Ellipse extends Shape {
  constructor(
    id: string,
    private _cx: number,
    private _cy: number,
    private _rx: number,
    private _ry: number,
    style: StyleInit = {},
  ) {
    super(id, style);
  }

  static spec(): ShapeSpec {
    return new ShapeSpec('ellipse', '<id> <cx> <cy> <rx> <ry> [fill]', ['cx', 'cy', 'rx', 'ry'], ['fill'], (id, a) =>
      new Ellipse(id, a.number('cx'), a.number('cy'), a.number('rx'), a.number('ry'), a.style()),
    );
  }

  get kind(): string {
    return 'ellipse';
  }

  get cx(): number {
    return this._cx;
  }

  get cy(): number {
    return this._cy;
  }

  get rx(): number {
    return this._rx;
  }

  get ry(): number {
    return this._ry;
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
    this._rx *= factor;
    this._ry *= factor;
  }

  protected setOwnAttribute(name: string, value: string): void {
    switch (name) {
      case 'cx':
        this._cx = NumberCodec.parse(value);
        break;
      case 'cy':
        this._cy = NumberCodec.parse(value);
        break;
      case 'rx':
        this._rx = NumberCodec.parse(value);
        break;
      case 'ry':
        this._ry = NumberCodec.parse(value);
        break;
      default:
        throw new UnknownAttributeError(name);
    }
  }

  protected ownAttributes(): Array<[string, string]> {
    return [
      ['cx', NumberCodec.format(this._cx)],
      ['cy', NumberCodec.format(this._cy)],
      ['rx', NumberCodec.format(this._rx)],
      ['ry', NumberCodec.format(this._ry)],
    ];
  }

  describe(): string {
    const f = NumberCodec.format;
    return this.withFill(`cx=${f(this._cx)} cy=${f(this._cy)} rx=${f(this._rx)} ry=${f(this._ry)}`);
  }

  protected captureOwn(): Record<string, number> {
    return { cx: this._cx, cy: this._cy, rx: this._rx, ry: this._ry };
  }

  protected restoreOwn(state: ShapeState): void {
    this._cx = state.number('cx');
    this._cy = state.number('cy');
    this._rx = state.number('rx');
    this._ry = state.number('ry');
  }
}
