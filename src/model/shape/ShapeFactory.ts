import { UnknownShapeTypeError } from '../errors/UnknownShapeTypeError.js';
import { Circle } from './Circle.js';
import { Ellipse } from './Ellipse.js';
import { Group } from './Group.js';
import { Line } from './Line.js';
import { Rect } from './Rect.js';
import { Text } from './Text.js';
import type { Shape } from './Shape.js';
import type { ShapeSpec } from './ShapeSpec.js';

/**
 * 图形工厂：类型名 → ShapeSpec 的注册表（按名字分派的两处之一）。
 * 待重构：插件阶段改为由 ShapeProvider 插件注册自己的 ShapeSpec。
 */
export class ShapeFactory {
  private readonly specs = new Map<string, ShapeSpec>();

  static withBuiltIns(): ShapeFactory {
    const factory = new ShapeFactory();
    for (const spec of [Rect.spec(), Circle.spec(), Ellipse.spec(), Line.spec(), Text.spec(), Group.spec()]) {
      factory.register(spec);
    }
    return factory;
  }

  register(spec: ShapeSpec): void {
    if (this.specs.has(spec.type)) {
      throw new Error(`shape type already registered: ${spec.type}`);
    }
    this.specs.set(spec.type, spec);
  }

  has(type: string): boolean {
    return this.specs.has(type);
  }

  /** CLI 路径：位置参数。 */
  create(type: string, id: string, args: readonly string[]): Shape {
    return this.specFor(type).fromArguments(id, args);
  }

  /** SVG 读入路径：属性名 → 值。 */
  createFromAttributes(type: string, id: string, attributes: ReadonlyMap<string, string>): Shape {
    return this.specFor(type).fromAttributes(id, attributes);
  }

  private specFor(type: string): ShapeSpec {
    const spec = this.specs.get(type);
    if (spec === undefined) {
      throw new UnknownShapeTypeError(type);
    }
    return spec;
  }
}
