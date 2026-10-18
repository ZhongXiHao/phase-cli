import { readFileSync, writeFileSync } from 'node:fs';
import type { FileSystem } from './FileSystem.js';
import { FileReadError } from './FileReadError.js';
import { FileWriteError } from './FileWriteError.js';

/** 真实磁盘上的 UTF-8 文本文件。 */
export class NodeFileSystem implements FileSystem {
  readText(path: string): string {
    try {
      return readFileSync(path, 'utf8').replace(/^﻿/, '');
    } catch {
      throw new FileReadError(path);
    }
  }

  writeText(path: string, content: string): void {
    try {
      writeFileSync(path, content, 'utf8');
    } catch {
      throw new FileWriteError(path);
    }
  }
}
