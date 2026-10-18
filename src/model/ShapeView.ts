/** 图形的只读视图：cli 只能通过它观察模型，看不到任何变更方法。 */
export interface ShapeView {
  readonly id: string;
  readonly kind: string;
  readonly isContainer: boolean;
  readonly parent: ShapeView | null;
  /** 如 `rect#r1`；画布根为 `svg`。 */
  label(): string;
  children(): readonly ShapeView[];
  /** SVG 属性名 → 值，按序列化顺序（id 在最前）。 */
  attributes(): ReadonlyArray<readonly [string, string]>;
  /** 元素的文本内容（仅 text 有），其余为 null。 */
  textContent(): string | null;
  /** tree 用的内联摘要，如 `x=0 y=0 w=800 h=600 fill=#fff`。 */
  describe(): string;
  /** show 用的属性明细行。 */
  details(): string[];
}
