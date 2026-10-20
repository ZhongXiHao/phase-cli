import { InvalidArgumentsError } from '../errors/InvalidArgumentsError.js';
import { ShapeAttributes } from './ShapeAttributes.js';
import type { Shape } from './Shape.js';

export type ShapeBuilder = (id: string, attributes: ShapeAttributes) => Shape;

/**
 * 一种图形类型的"创建说明书"：CLI 位置参数表 + 构造函数。
 * 新图形类型（包括后续插件）只需要提供一份 ShapeSpec 注册到 ShapeFactory。
 */
export class ShapeSpec {
  constructor(
    readonly type: string,
    /** `create <type> ` 之后的用法文本，用于参数个数错误时的提示。 */
    private readonly usage: string,
    /** 必填位置参数对应的属性名（按位置）。 */
    private readonly required: readonly string[],
    /** 可选位置参数对应的属性名（紧跟必填之后）。 */
    private readonly optional: readonly string[],
    private readonly build: ShapeBuilder,
  ) {}

  /** CLI 路径：位置参数 → 属性名 → 图形。 */
  fromArguments(id: string, args: readonly string[]): Shape {
    if (args.length < this.required.length || args.length > this.required.length + this.optional.length) {
      throw new InvalidArgumentsError(`create ${this.type} ${this.usage}`);
    }
    const names = [...this.required, ...this.optional];
    const values = new Map<string, string>();
    args.forEach((arg, index) => values.set(names[index] as string, arg));
    return this.build(id, new ShapeAttributes(values));
  }

  /** SVG 读入路径：属性已经是属性名 → 值。 */
  fromAttributes(id: string, attributes: ReadonlyMap<string, string>): Shape {
    return this.build(id, new ShapeAttributes(attributes));
  }
}
