import { Readable } from 'node:stream';
import { Editor } from './app/Editor.js';
import { Repl } from './cli/Repl.js';
import { NodeFileSystem } from './io/NodeFileSystem.js';

/**
 * 组合根：装配 Editor 与 Repl，并决定输入来源。
 *   npm run cli                  交互式
 *   npm run cli -- script.txt    回放脚本文件（每行一条命令，# 开头为注释）
 *   <命令> | npm run cli         管道输入
 */
async function main(): Promise<void> {
  const fileSystem = new NodeFileSystem();
  const scriptPath = process.argv[2];

  // 脚本文件经由与 `read` 相同的文件系统读入：读不到时得到统一的 `cannot read file`，而不是流错误的堆栈
  const input = scriptPath === undefined ? process.stdin : Readable.from([fileSystem.readText(scriptPath)]);
  const interactive = scriptPath === undefined && process.stdin.isTTY === true;

  const repl = new Repl(new Editor(fileSystem), input, process.stdout, { echoInput: !interactive, interactive });
  await repl.run();
}

main().catch((error: unknown) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
