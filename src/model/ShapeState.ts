export type StateValue = number | string | undefined;

/**
 * 图形状态快照（Memento）。对外不透明：只有产生它的 Shape 知道各键的含义。
 * 容器的快照按子节点 id 递归保存子孙的状态；结构（谁在谁里面）不在快照范围内。
 */
export class ShapeState {
  constructor(
    private readonly values: Readonly<Record<string, StateValue>>,
    private readonly childStates: ReadonlyMap<string, ShapeState> = new Map(),
  ) {}

  number(key: string): number {
    const value = this.values[key];
    if (typeof value !== 'number') {
      throw new Error(`state value is not a number: ${key}`);
    }
    return value;
  }

  text(key: string): string {
    const value = this.values[key];
    if (typeof value !== 'string') {
      throw new Error(`state value is not a string: ${key}`);
    }
    return value;
  }

  optionalNumber(key: string): number | undefined {
    const value = this.values[key];
    return typeof value === 'number' ? value : undefined;
  }

  optionalText(key: string): string | undefined {
    const value = this.values[key];
    return typeof value === 'string' ? value : undefined;
  }

  childState(childId: string): ShapeState | undefined {
    return this.childStates.get(childId);
  }
}
