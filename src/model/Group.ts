import { Shape } from './Shape.js';
import { ShapeSpec } from './ShapeSpec.js';
import { ShapeState } from './ShapeState.js';

/**
 * 容器（SVG 的 `<g>`）。对 translate / scale / setAttribute 一律递归转发给子节点，
 * 因此容器与叶子对命令表现一致。
 */
export class Group extends Shape {
  private readonly childList: Shape[] = [];

  /** `transform` 作为不透明字符串原样保留以便读回后不丢数据；move/scale 不改写它。 */
  constructor(
    id: string,
    private _transform?: string,
  ) {
    super(id);
  }

  static spec(): ShapeSpec {
    return new ShapeSpec('g', '<id>', [], [], (id, a) => new Group(id, a.optionalText('transform')));
  }

  get kind(): string {
    return 'g';
  }

  override get isContainer(): boolean {
    return true;
  }

  get transform(): string | undefined {
    return this._transform;
  }

  override children(): readonly Shape[] {
    return this.childList;
  }

  override insertChild(child: Shape, index: number = this.childList.length): void {
    if (child.parent !== null) {
      throw new Error(`shape already has a parent: ${child.id}`);
    }
    if (!Number.isInteger(index) || index < 0 || index > this.childList.length) {
      throw new Error(`child index out of range: ${index}`);
    }
    this.childList.splice(index, 0, child);
    child.setParent(this);
  }

  override removeChild(child: Shape): number {
    const index = this.indexOf(child);
    this.childList.splice(index, 1);
    child.setParent(null);
    return index;
  }

  override indexOf(child: Shape): number {
    const index = this.childList.indexOf(child);
    if (index < 0) {
      throw new Error(`shape is not a child of ${this.id}: ${child.id}`);
    }
    return index;
  }

  override canUngroup(): boolean {
    return true;
  }

  translate(dx: number, dy: number): void {
    for (const child of this.childList) {
      child.translate(dx, dy);
    }
  }

  protected scaleBy(factor: number): void {
    for (const child of this.childList) {
      child.scale(factor);
    }
  }

  /** 只有外观属性可对容器设置，并传播到全部子孙；先整体校验再逐个赋值。 */
  override setAttribute(name: string, value: string): void {
    Shape.validateStyle(name, value);
    for (const child of this.childList) {
      child.setAttribute(name, value);
    }
  }

  protected setOwnAttribute(name: string, value: string): void {
    this.setAttribute(name, value);
  }

  protected ownAttributes(): Array<[string, string]> {
    return this._transform === undefined ? [] : [['transform', this._transform]];
  }

  describe(): string {
    return '';
  }

  override details(): string[] {
    return [...super.details(), `children=${this.childList.length}`];
  }

  protected captureOwn(): Record<string, string | undefined> {
    return { transform: this._transform };
  }

  protected restoreOwn(state: ShapeState): void {
    this._transform = state.optionalText('transform');
  }

  override captureState(): ShapeState {
    const childStates = new Map<string, ShapeState>();
    for (const child of this.childList) {
      childStates.set(child.id, child.captureState());
    }
    return new ShapeState(this.captureValues(), childStates);
  }

  override restoreState(state: ShapeState): void {
    super.restoreState(state);
    for (const child of this.childList) {
      const childState = state.childState(child.id);
      if (childState !== undefined) {
        child.restoreState(childState);
      }
    }
  }
}
