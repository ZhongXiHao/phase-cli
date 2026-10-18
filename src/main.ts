import { createInterface } from 'node:readline';

// 骨架占位：Repl / Editor 在后续步骤中接入，这里只保证 `npm run cli` 能跑通。
console.log("svg-editor 0.1 — type 'help' for commands");

const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'svg> ' });
rl.prompt();
rl.on('line', (line) => {
  if (line.trim() === 'exit') {
    rl.close();
    return;
  }
  rl.prompt();
});
