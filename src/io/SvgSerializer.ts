import type { DocumentView } from '../model/DocumentView.js';
import { NumberCodec } from '../model/NumberCodec.js';
import type { ShapeView } from '../model/ShapeView.js';

/**
 * Document → SVG 文本。只依赖 ShapeView 的 kind / attributes / textContent / children，
 * 不认识任何具体图形类，所以新增图形类型（包括后续插件）无需改这里。
 */
export class SvgSerializer {
  serialize(document: DocumentView): string {
    const width = NumberCodec.format(document.width);
    const height = NumberCodec.format(document.height);
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    ];
    for (const child of document.root.children()) {
      this.writeElement(child, 1, lines);
    }
    lines.push('</svg>');
    return `${lines.join('\n')}\n`;
  }

  private writeElement(shape: ShapeView, depth: number, lines: string[]): void {
    const indent = '  '.repeat(depth);
    const attributes = shape
      .attributes()
      .map(([name, value]) => ` ${name}="${SvgSerializer.escape(value)}"`)
      .join('');
    const text = shape.textContent();
    const children = shape.children();

    if (children.length === 0 && (text === null || text === '')) {
      lines.push(`${indent}<${shape.kind}${attributes}/>`);
    } else if (children.length === 0) {
      lines.push(`${indent}<${shape.kind}${attributes}>${SvgSerializer.escape(text as string)}</${shape.kind}>`);
    } else {
      lines.push(`${indent}<${shape.kind}${attributes}>`);
      for (const child of children) {
        this.writeElement(child, depth + 1, lines);
      }
      lines.push(`${indent}</${shape.kind}>`);
    }
  }

  private static escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
