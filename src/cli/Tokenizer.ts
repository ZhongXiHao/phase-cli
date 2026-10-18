import { UnterminatedQuoteError } from './UnterminatedQuoteError.js';

/**
 * 把一行输入切成 token。
 * - 空白分隔；双引号包裹的内容是一个 token（可含空格，`\"` 与 `\\` 为转义，`""` 是空 token）；
 * - 以 `#` 开头的整行是注释（只看行首，所以 `#4a90d9` 这样的颜色值仍是普通 token）。
 */
export class Tokenizer {
  tokenize(line: string): string[] {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      return [];
    }

    const tokens: string[] = [];
    let current = '';
    let started = false;
    let inQuote = false;

    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed.charAt(i);
      if (inQuote) {
        if (ch === '\\' && (trimmed.charAt(i + 1) === '"' || trimmed.charAt(i + 1) === '\\')) {
          current += trimmed.charAt(i + 1);
          i++;
        } else if (ch === '"') {
          inQuote = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuote = true;
        started = true;
      } else if (/\s/.test(ch)) {
        if (started) {
          tokens.push(current);
          current = '';
          started = false;
        }
      } else {
        current += ch;
        started = true;
      }
    }

    if (inQuote) {
      throw new UnterminatedQuoteError();
    }
    if (started) {
      tokens.push(current);
    }
    return tokens;
  }
}
