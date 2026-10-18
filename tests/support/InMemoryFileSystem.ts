import type { FileSystem } from '../../src/io/FileSystem.js';
import { FileReadError } from '../../src/io/FileReadError.js';
import { FileWriteError } from '../../src/io/FileWriteError.js';

/** 测试用的内存文件系统；`readOnly` 里的路径写入时失败。 */
export class InMemoryFileSystem implements FileSystem {
  readonly files = new Map<string, string>();
  readonly readOnly = new Set<string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(initial)) {
      this.files.set(path, content);
    }
  }

  readText(path: string): string {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new FileReadError(path);
    }
    return content;
  }

  writeText(path: string, content: string): void {
    if (this.readOnly.has(path)) {
      throw new FileWriteError(path);
    }
    this.files.set(path, content);
  }
}
