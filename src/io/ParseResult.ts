import type { Document } from '../model/Document.js';

export interface ParseResult {
  readonly document: Document;
  /** 形如 `warning: assigned id rect1 to unnamed <rect>`，按文档顺序。 */
  readonly warnings: readonly string[];
}
