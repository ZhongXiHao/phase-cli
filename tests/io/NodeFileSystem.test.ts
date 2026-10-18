import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { NodeFileSystem } from '../../src/io/NodeFileSystem.js';

const dir = mkdtempSync(join(tmpdir(), 'svg-editor-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('NodeFileSystem', () => {
  const fs = new NodeFileSystem();

  it('writes and reads UTF-8 text', () => {
    const path = join(dir, 'a.svg');
    fs.writeText(path, '<svg>开始</svg>\n');
    expect(fs.readText(path)).toBe('<svg>开始</svg>\n');
  });

  it('strips a UTF-8 BOM on read', () => {
    const path = join(dir, 'bom.svg');
    writeFileSync(path, '﻿<svg/>', 'utf8');
    expect(fs.readText(path)).toBe('<svg/>');
  });

  it('reports a missing file with the path as given', () => {
    const path = join(dir, 'missing.svg');
    expect(() => fs.readText(path)).toThrow(`cannot read file: ${path}`);
  });

  it('reports an unwritable path', () => {
    const path = join(dir, 'no-such-dir', 'x.svg');
    expect(() => fs.writeText(path, 'x')).toThrow(`cannot write file: ${path}`);
  });
});
