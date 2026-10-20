import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * 端到端：真正启动 `src/main.ts`（经 tsx），走真实的 stdin / 文件系统 / 退出码。
 * 其余测试都在进程内用内存流驱动，覆盖不到组合根 main.ts。
 */
const ROOT = resolve(__dirname, '..', '..');
const dir = mkdtempSync(join(tmpdir(), 'svg-editor-e2e-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function runCli(args: string[], input?: string): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/main.ts', ...args], {
    cwd: ROOT,
    input,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

describe('CLI process', () => {
  it('replays a script file, writes a real SVG, and exits 0', () => {
    const svg = join(dir, 'out.svg');
    const script = join(dir, 'session.txt');
    writeFileSync(script, ['init 400 200', 'create rect r1 10 20 100 50 red', 'tree', `save ${svg}`, 'undo', ''].join('\n'), 'utf8');

    const { stdout, stderr, status } = runCli([script]);

    expect(status).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain("svg-editor 0.1 — type 'help' for commands");
    expect(stdout).toContain('svg> init 400 200\ncanvas 400x200 created\n');
    expect(stdout).toContain('svg (400x200)\n└── rect#r1  x=10 y=20 w=100 h=50 fill=red\n');
    expect(stdout).toContain(`saved to ${svg} (1 elements)\nsvg> undo\nerror: undo not allowed after io command\n`);
    expect(readFileSync(svg, 'utf8')).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">',
        '  <rect id="r1" x="10" y="20" width="100" height="50" fill="red"/>',
        '</svg>',
        '',
      ].join('\n'),
    );
  });

  it('reads commands from a pipe', () => {
    const { stdout, status } = runCli([], 'init 5 5\ncreate circle c 1 1 1\nshow c\n');
    expect(status).toBe(0);
    expect(stdout).toContain('svg> show c\ncircle#c  parent=svg\n  cx=1 cy=1 r=1\n');
  });

  it('a missing script file is a clean one-line error with a non-zero exit code, not a stack trace', () => {
    const missing = join(dir, 'nope.txt');
    const { stdout, stderr, status } = runCli([missing]);
    expect(status).toBe(1);
    expect(stderr.trim()).toBe(`error: cannot read file: ${missing}`);
    expect(stderr).not.toContain('node:events');
    expect(stdout).toBe('');
  });

  it('`exit` in a script stops the session; later lines are not executed', () => {
    const script = join(dir, 'exit.txt');
    writeFileSync(script, 'init\nexit\ncreate rect r 0 0 1 1\n', 'utf8');
    const { stdout, status } = runCli([script]);
    expect(status).toBe(0);
    expect(stdout).not.toContain('rect#r created');
  });
});
