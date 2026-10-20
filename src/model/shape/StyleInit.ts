/** 所有图形共有的外观属性；缺省表示"不写入该属性，遵循 SVG 渲染默认"。 */
export interface StyleInit {
  fill?: string | undefined;
  stroke?: string | undefined;
  strokeWidth?: number | undefined;
}
