import { DOMParser, type Element } from '@xmldom/xmldom';
import { Document } from '../model/Document.js';
import { IdAlreadyExistsError } from '../model/errors/IdAlreadyExistsError.js';
import type { Shape } from '../model/shape/Shape.js';
import type { ShapeFactory } from '../model/shape/ShapeFactory.js';
import { InvalidSvgError } from './InvalidSvgError.js';
import type { ParseResult } from './ParseResult.js';

/**
 * SVG 文本 → Document。元素按 ShapeFactory 里注册的类型创建；
 * 缺 id 的元素按"标签名 + 序号"补 id 并产生警告；不认识的元素整棵子树跳过并产生警告。
 * 已知限制：图形类型不认识的属性（如 rx、font-size、opacity）在读入时丢弃。
 */
export class SvgParser {
  private static readonly LENGTH = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(?:px)?\s*$/;

  constructor(private readonly factory: ShapeFactory) {}

  parse(xml: string): ParseResult {
    const root = this.parseXml(xml);
    if (SvgParser.tagOf(root) !== 'svg') {
      throw new InvalidSvgError(`root element is <${SvgParser.tagOf(root)}>, expected <svg>`);
    }

    const [width, height] = SvgParser.canvasSize(root);
    const document = new Document(width, height);
    const usedIds = new Set<string>();
    this.collectExplicitIds(root, usedIds);

    const warnings: string[] = [];
    this.build(root, document.root, usedIds, warnings);
    return { document, warnings };
  }

  private parseXml(xml: string): Element {
    // xmldom 会把 onError 里抛出的异常再包一层，所以这里只记录第一个错误，解析完再统一抛出
    let firstError: string | null = null;
    const parser = new DOMParser({
      onError: (level, message) => {
        if (level !== 'warning' && firstError === null) {
          firstError = message.split('\n')[0]?.trim() ?? 'malformed xml';
        }
      },
    });
    let parsed;
    try {
      parsed = parser.parseFromString(xml, 'image/svg+xml');
    } catch (error) {
      // 致命错误（标签不匹配、没有根元素…）xmldom 仍会自己抛 ParseError
      const reason = error instanceof Error ? error.message : String(error);
      throw new InvalidSvgError(firstError ?? reason.split('\n')[0]?.trim() ?? 'malformed xml');
    }
    if (firstError !== null) {
      throw new InvalidSvgError(firstError);
    }
    if (parsed.documentElement === null) {
      throw new InvalidSvgError('missing root element');
    }
    return parsed.documentElement;
  }

  /** 第一遍：收集全部显式 id，既检查重复，也避免自动补的 id 与文件里后出现的显式 id 撞车。 */
  private collectExplicitIds(parent: Element, used: Set<string>): void {
    for (const element of SvgParser.childElements(parent)) {
      if (!this.factory.has(SvgParser.tagOf(element))) {
        continue;
      }
      const id = element.getAttribute('id');
      if (id !== null && id !== '') {
        if (used.has(id)) {
          throw new IdAlreadyExistsError(id);
        }
        used.add(id);
      }
      this.collectExplicitIds(element, used);
    }
  }

  /** 第二遍：创建图形并挂到树上。 */
  private build(parent: Element, container: Shape, used: Set<string>, warnings: string[]): void {
    for (const element of SvgParser.childElements(parent)) {
      const tag = SvgParser.tagOf(element);
      if (!this.factory.has(tag)) {
        warnings.push(`warning: skipped unsupported element <${tag}>`);
        continue;
      }

      let id = element.getAttribute('id');
      if (id === null || id === '') {
        id = SvgParser.freshId(tag, used);
        warnings.push(`warning: assigned id ${id} to unnamed <${tag}>`);
      }

      const shape = this.factory.createFromAttributes(tag, id, SvgParser.attributesOf(element));
      container.insertChild(shape);
      if (shape.isContainer) {
        this.build(element, shape, used, warnings);
      }
    }
  }

  /** 不带命名空间前缀的标签名。 */
  private static tagOf(element: Element): string {
    return element.localName ?? element.tagName;
  }

  private static attributesOf(element: Element): Map<string, string> {
    const attributes = new Map<string, string>();
    for (let i = 0; i < element.attributes.length; i++) {
      const attribute = element.attributes.item(i);
      if (attribute !== null) {
        attributes.set(attribute.name, attribute.value);
      }
    }
    // 元素的文本内容在规范里是 text 的 `text` 属性
    attributes.set('text', element.textContent ?? '');
    return attributes;
  }

  private static freshId(tag: string, used: Set<string>): string {
    let n = 1;
    while (used.has(`${tag}${n}`)) {
      n++;
    }
    const id = `${tag}${n}`;
    used.add(id);
    return id;
  }

  private static childElements(parent: Element): Element[] {
    const result: Element[] = [];
    for (let i = 0; i < parent.childNodes.length; i++) {
      const node = parent.childNodes.item(i);
      if (node !== null && node.nodeType === 1) {
        result.push(node as Element);
      }
    }
    return result;
  }

  /** width / height 优先，其次 viewBox，都没有则 800x600。 */
  private static canvasSize(root: Element): [number, number] {
    const viewBox = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
    const fromViewBox = viewBox.length === 4 && viewBox.every(Number.isFinite) ? viewBox : null;
    const width = SvgParser.length(root.getAttribute('width')) ?? fromViewBox?.[2] ?? 800;
    const height = SvgParser.length(root.getAttribute('height')) ?? fromViewBox?.[3] ?? 600;
    return [width, height];
  }

  private static length(raw: string | null): number | null {
    const match = raw === null ? null : SvgParser.LENGTH.exec(raw);
    return match === null ? null : Number(match[1]);
  }
}
