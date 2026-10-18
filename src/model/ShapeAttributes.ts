import { NumberCodec } from './NumberCodec.js';
import type { StyleInit } from './StyleInit.js';

/** 创建图形时的"属性名 → 文本值"袋。CLI 位置参数与 SVG 属性都先归一化成它。 */
export class ShapeAttributes {
  constructor(private readonly values: ReadonlyMap<string, string>) {}

  /** 缺省按 SVG 规则取 0。 */
  number(name: string): number {
    const raw = this.values.get(name);
    return raw === undefined ? 0 : NumberCodec.parse(raw);
  }

  text(name: string): string {
    return this.values.get(name) ?? '';
  }

  optionalText(name: string): string | undefined {
    return this.values.get(name);
  }

  style(): StyleInit {
    const strokeWidth = this.values.get('stroke-width');
    return {
      fill: this.values.get('fill'),
      stroke: this.values.get('stroke'),
      strokeWidth: strokeWidth === undefined ? undefined : NumberCodec.parse(strokeWidth),
    };
  }
}
