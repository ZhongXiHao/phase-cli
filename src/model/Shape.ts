import { InvalidScaleFactorError } from './errors/InvalidScaleFactorError.js';
import { InvalidValueError } from './errors/InvalidValueError.js';
import { NotAContainerError } from './errors/NotAContainerError.js';
import { UnknownAttributeError } from './errors/UnknownAttributeError.js';
import { NumberCodec } from './NumberCodec.js';
import { ShapeState } from './ShapeState.js';
import type { ShapeView } from './ShapeView.js';
import type { StyleInit } from './StyleInit.js';

/**
 * 所有图形（叶子与容器）的统一抽象 —— 透明式 Composite。
 * 子节点管理方法在基类声明，叶子调用即抛 `not a container`，
 * 因此命令类面向 Shape 编程，不需要 instanceof 或类型断言。
 */
export abstract class Shape implements ShapeView {
  private static readonly STYLE_ATTRIBUTES: readonly string[] = ['fill', 'stroke', 'stroke-width'];

  private _parent: Shape | null = null;
  private _fill: string | undefined;
  private _stroke: string | undefined;
  private _strokeWidth: number | undefined;

  protected constructor(
    readonly id: string,
    style: StyleInit = {},
  ) {
    this._fill = style.fill;
    this._stroke = style.stroke;
    this._strokeWidth = style.strokeWidth;
  }

  abstract get kind(): string;

  get isContainer(): boolean {
    return false;
  }

  get parent(): Shape | null {
    return this._parent;
  }

  /** 仅供 Group.insertChild / removeChild 维护父子关系，不属于 ShapeView。 */
  setParent(parent: Shape | null): void {
    this._parent = parent;
  }

  get fill(): string | undefined {
    return this._fill;
  }

  get stroke(): string | undefined {
    return this._stroke;
  }

  get strokeWidth(): number | undefined {
    return this._strokeWidth;
  }

  label(): string {
    return `${this.kind}#${this.id}`;
  }

  /** 自身是否位于 ancestor 的子树内（不含自身）。 */
  isDescendantOf(ancestor: Shape): boolean {
    for (let node = this._parent; node !== null; node = node._parent) {
      if (node === ancestor) {
        return true;
      }
    }
    return false;
  }

  // ---- 容器能力（叶子默认不支持） ----

  children(): readonly Shape[] {
    return [];
  }

  insertChild(_child: Shape, _index?: number): void {
    throw new NotAContainerError(this.id);
  }

  /** 摘下子节点，返回它原来的下标。 */
  removeChild(_child: Shape): number {
    throw new NotAContainerError(this.id);
  }

  indexOf(_child: Shape): number {
    throw new NotAContainerError(this.id);
  }

  /** 能否被 ungroup；容器为 true，复合图形（如后续的 box）为 false，叶子无意义。 */
  canUngroup(): boolean {
    return false;
  }

  // ---- 几何变换 ----

  abstract translate(dx: number, dy: number): void;

  /** 等比缩放：因子同乘全部几何属性；容器递归到子孙。非正因子在改动任何东西之前拒绝。 */
  scale(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new InvalidScaleFactorError();
    }
    this.scaleBy(factor);
  }

  protected abstract scaleBy(factor: number): void;

  // ---- 属性 ----

  /** 设置白名单内的属性；先校验后赋值，失败时不留下半成品。 */
  setAttribute(name: string, value: string): void {
    if (Shape.isStyleAttribute(name)) {
      this.setStyle(name, value);
    } else {
      this.setOwnAttribute(name, value);
    }
  }

  /** 设置类型自有的属性（几何、text 内容…）；不认识的名字抛 UnknownAttributeError。 */
  protected abstract setOwnAttribute(name: string, value: string): void;

  protected static isStyleAttribute(name: string): boolean {
    return Shape.STYLE_ATTRIBUTES.includes(name);
  }

  protected static validateStyle(name: string, value: string): void {
    if (!Shape.isStyleAttribute(name)) {
      throw new UnknownAttributeError(name);
    }
    if (name === 'stroke-width') {
      NumberCodec.parse(value);
    } else if (value.trim() === '') {
      throw new InvalidValueError(name, value);
    }
  }

  private setStyle(name: string, value: string): void {
    Shape.validateStyle(name, value);
    if (name === 'fill') {
      this._fill = value;
    } else if (name === 'stroke') {
      this._stroke = value;
    } else {
      this._strokeWidth = NumberCodec.parse(value);
    }
  }

  // ---- 对外描述（序列化、tree、show 共用） ----

  /** 类型自有的 SVG 属性（几何等），按序列化顺序。 */
  protected abstract ownAttributes(): Array<[string, string]>;

  abstract describe(): string;

  textContent(): string | null {
    return null;
  }

  attributes(): Array<[string, string]> {
    return [['id', this.id], ...this.ownAttributes(), ...this.styleAttributes()];
  }

  details(): string[] {
    const lines: string[] = [];
    const own = Shape.join(this.ownAttributes());
    if (own !== '') {
      lines.push(own);
    }
    const style = Shape.join(this.styleAttributes());
    if (style !== '') {
      lines.push(style);
    }
    return lines;
  }

  /** describe() 的公共尾巴：设置了 fill 才追加 ` fill=…`。 */
  protected withFill(summary: string): string {
    return this._fill === undefined ? summary : `${summary} fill=${this._fill}`;
  }

  private styleAttributes(): Array<[string, string]> {
    const result: Array<[string, string]> = [];
    if (this._fill !== undefined) {
      result.push(['fill', this._fill]);
    }
    if (this._stroke !== undefined) {
      result.push(['stroke', this._stroke]);
    }
    if (this._strokeWidth !== undefined) {
      result.push(['stroke-width', NumberCodec.format(this._strokeWidth)]);
    }
    return result;
  }

  private static join(pairs: ReadonlyArray<readonly [string, string]>): string {
    return pairs.map(([name, value]) => `${name}=${value}`).join(' ');
  }

  // ---- Memento ----

  captureState(): ShapeState {
    return new ShapeState(this.captureValues());
  }

  restoreState(state: ShapeState): void {
    this._fill = state.optionalText('fill');
    this._stroke = state.optionalText('stroke');
    this._strokeWidth = state.optionalNumber('strokeWidth');
    this.restoreOwn(state);
  }

  protected captureValues(): Record<string, number | string | undefined> {
    return {
      fill: this._fill,
      stroke: this._stroke,
      strokeWidth: this._strokeWidth,
      ...this.captureOwn(),
    };
  }

  protected abstract captureOwn(): Record<string, number | string | undefined>;

  protected abstract restoreOwn(state: ShapeState): void;
}
