import type { ShapeView } from '../model/shape/ShapeView.js';

/** 单个图形的属性明细：首行标签与父级，其后是缩进的明细行。 */
export class ShowRenderer {
  render(shape: ShapeView): string[] {
    const parent = shape.parent === null ? '' : `  parent=${shape.parent.label()}`;
    return [`${shape.label()}${parent}`, ...shape.details().map((line) => `  ${line}`)];
  }
}
