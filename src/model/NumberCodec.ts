import { InvalidNumberError } from './errors/InvalidNumberError.js';

/** 数字与文本之间的唯一转换点：解析用户输入、格式化输出。 */
export class NumberCodec {
  private static readonly NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

  static parse(raw: string): number {
    const text = raw.trim();
    if (!NumberCodec.NUMBER_PATTERN.test(text)) {
      throw new InvalidNumberError(raw);
    }
    return Number(text);
  }

  /** 整数不带小数点；浮点去掉累积误差与多余尾零；-0 输出为 0。 */
  static format(value: number): string {
    const rounded = Number(value.toFixed(9));
    return String(rounded === 0 ? 0 : rounded);
  }
}
