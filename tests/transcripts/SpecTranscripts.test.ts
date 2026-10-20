import { Readable, Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { Editor } from '../../src/app/Editor.js';
import { Interpreter } from '../../src/cli/Interpreter.js';
import { Repl } from '../../src/cli/Repl.js';
import { InMemoryFileSystem } from '../support/InMemoryFileSystem.js';

/**
 * 规范第 6 节与 6.1 节两个完整会话的回放测试。
 * 每个会话是一个有序步骤表：[输入, ...期望输出行]，顺序、命令、输出都与规范一致。
 * 同一张表用两种方式验证：
 *   1. Interpreter：逐步断言输出；
 *   2. Repl：整份会话作为输入，断言完整输出文本（含横幅、`svg> ` 提示符、回显的命令）。
 */
type Step = readonly [input: string, ...expected: string[]];

const BANNER = "svg-editor 0.1 — type 'help' for commands";

/** 规范 6 节里 `read` 用的外部文件。 */
const OTHER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">imported</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <circle id="c2" cx="5" cy="5" r="2"/>
  </g>
  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>
</svg>
`;

// ---------------------------------------------------------------------------
// 规范第 6 节：典型会话（逐字照抄规范的命令与输出）
// ---------------------------------------------------------------------------
const SECTION_6: Step[] = [
  ['init 800 600', 'canvas 800x600 created'],
  ['create rect bg 0 0 800 600 #ffffff', 'rect#bg created'],
  ['create text title 20 40 "My Diagram"', 'text#title created'],
  ['create circle c1 100 100 20 red', 'circle#c1 created'],
  ['create rect box 200 80 60 60 #3366ff', 'rect#box created'],

  ['group markers c1 box', 'g#markers created with 2 children'],
  [
    'tree',
    'svg (800x600)',
    '├── rect#bg        x=0 y=0 w=800 h=600 fill=#ffffff',
    '├── text#title     (20,40) "My Diagram"',
    '└── g#markers',
    '    ├── circle#c1  cx=100 cy=100 r=20 fill=red',
    '    └── rect#box   x=200 y=80 w=60 h=60 fill=#3366ff',
  ],

  ['move c1 30 0', 'circle#c1 moved to (130,100)'],
  ['undo', 'circle#c1 moved back to (100,100)'],
  ['redo', 'circle#c1 moved to (130,100)'],

  ['set title text "My Diagram v2"', 'text#title updated: text="My Diagram v2"'],
  ['undo', 'text#title updated: text="My Diagram"'],

  ['group bad c1 markers', 'error: cannot group a container into its own descendant: markers'],
  ['delete box', 'rect#box deleted'],
  ['undo', 'rect#box restored into g#markers'],

  ['save demo.svg', 'saved to demo.svg (5 elements)'],
  ['undo', 'error: undo not allowed after io command'],

  ['read other.svg', 'warning: assigned id rect1 to unnamed <rect>', 'read other.svg (7 elements)'],
  [
    'tree',
    'svg (400x300)',
    '├── rect#rect1     x=0 y=0 w=400 h=300 fill=#ffffff',
    '├── text#t1        (10,290) "imported"',
    '├── circle#c1      cx=50 cy=50 r=10',
    '├── g#g1',
    '│   ├── rect#r2    x=0 y=0 w=10 h=10',
    '│   └── circle#c2  cx=5 cy=5 r=2',
    '└── ellipse#e1     cx=1 cy=2 rx=3 ry=4',
  ],
];

// ---------------------------------------------------------------------------
// 规范 6.1 节：两节点流程图，版本 A（`in` 子句自顶向下构建）
//
// 命令与回显逐字照抄规范。唯一的例外是 `tree` 的**列对齐**：规范该示例里
// 同级各行的间距不一致（rect#process 后 5 个空格、text#process-label 后 1 个），
// 与规范 5.1 节和 other.svg 示例采用的"全树统一对齐"不能同时成立。
// 因此 `tree` 这一步在 SPEC_6_1_TREE_LITERAL 里保存规范的原文，
// 比较时只忽略"标签与属性之间的空格个数"，其余（连线字符、缩进、标签、属性内容）逐字相同。
// ---------------------------------------------------------------------------
const SPEC_6_1_TREE_LITERAL = [
  'svg (800x600)',
  '└── g#flowchart',
  '    ├── g#node1',
  '    │   ├── rect#start       x=120 y=100 w=160 h=60 fill=#4a90d9',
  '    │   └── text#start-label (155,135) "开始"',
  '    ├── g#node2',
  '    │   ├── rect#process     x=520 y=100 w=160 h=60 fill=#f5a623',
  '    │   └── text#process-label (545,135) "处理数据"',
  '    └── line#arrow1          (280,130) -> (520,130)',
];

/** 实现的实际输出（全树统一对齐）。 */
const SECTION_6_1_TREE_ACTUAL = [
  'svg (800x600)',
  '└── g#flowchart',
  '    ├── g#node1',
  '    │   ├── rect#start          x=120 y=100 w=160 h=60 fill=#4a90d9',
  '    │   └── text#start-label    (155,135) "开始"',
  '    ├── g#node2',
  '    │   ├── rect#process        x=520 y=100 w=160 h=60 fill=#f5a623',
  '    │   └── text#process-label  (545,135) "处理数据"',
  '    └── line#arrow1             (280,130) -> (520,130)',
];

const SECTION_6_1: Step[] = [
  ['init 800 600', 'canvas 800x600 created'],

  ['# 先建容器骨架，再往里放图形：每一步都显式表达归属'],
  ['create g flowchart', 'g#flowchart created'],
  ['create g node1 in flowchart', 'g#node1 created in g#flowchart'],
  ['create rect start 120 100 160 60 #4a90d9 in node1', 'rect#start created in g#node1'],
  ['create text start-label 155 135 "开始" in node1', 'text#start-label created in g#node1'],

  ['create g node2 in flowchart', 'g#node2 created in g#flowchart'],
  ['create rect process 520 100 160 60 #f5a623 in node2', 'rect#process created in g#node2'],
  ['create text process-label 545 135 "处理数据" in node2', 'text#process-label created in g#node2'],

  ['# 连接线挂在流程图容器下'],
  ['create line arrow1 280 130 520 130 black in flowchart', 'line#arrow1 created in g#flowchart'],

  ['tree', ...SECTION_6_1_TREE_ACTUAL],

  ['# 容器移动：整个节点 2 下移 100，文字随行（容器的价值所在）'],
  ['move node2 0 100', 'g#node2 moved by (0,100)'],
  ['undo', 'g#node2 moved back by (0,-100)'],

  ['# 改节点内容：只动组内 text'],
  ['set process-label text "处理数据 v2"', 'text#process-label updated: text="处理数据 v2"'],

  ['save flowchart.svg', 'saved to flowchart.svg (8 elements)'],
];

// ---------------------------------------------------------------------------
// 驱动
// ---------------------------------------------------------------------------
function newFileSystem(): InMemoryFileSystem {
  return new InMemoryFileSystem({ 'other.svg': OTHER_SVG });
}

/** 以规范的排版生成期望的完整会话文本：横幅、空行、`svg> 命令`、输出，末尾一个空提示符。 */
function expectedRepl(steps: readonly Step[]): string {
  const lines = [BANNER, ''];
  for (const [input, ...expected] of steps) {
    lines.push(`svg> ${input}`, ...expected);
  }
  lines.push('svg> ', '');
  return lines.join('\n');
}

async function runThroughRepl(steps: readonly Step[], fs: InMemoryFileSystem): Promise<string> {
  let out = '';
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      out += String(chunk);
      callback();
    },
  });
  const script = steps.map(([input]) => input).join('\n') + '\n';
  await new Repl(new Editor(fs), Readable.from([script]), sink, { echoInput: true, interactive: false }).run();
  return out;
}

describe.each([
  ['spec section 6', SECTION_6],
  ['spec section 6.1 (version A)', SECTION_6_1],
])('%s', (_name, steps) => {
  it('Interpreter: every step produces exactly the expected output', () => {
    const interpreter = new Interpreter(new Editor(newFileSystem()));
    steps.forEach(([input, ...expected], index) => {
      expect(interpreter.run(input), `step ${index + 1}: ${input}`).toEqual(expected);
    });
  });

  it('Repl: the whole session reads exactly like the spec transcript', async () => {
    expect(await runThroughRepl(steps, newFileSystem())).toBe(expectedRepl(steps));
  });
});

describe('spec section 6: side effects', () => {
  it('demo.svg was written with the five elements as they were before `save`', async () => {
    const fs = newFileSystem();
    const interpreter = new Interpreter(new Editor(fs));
    SECTION_6.forEach(([input]) => interpreter.run(input));
    expect(fs.files.get('demo.svg')).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">',
        '  <rect id="bg" x="0" y="0" width="800" height="600" fill="#ffffff"/>',
        '  <text id="title" x="20" y="40">My Diagram</text>',
        '  <g id="markers">',
        '    <circle id="c1" cx="130" cy="100" r="20" fill="red"/>',
        '    <rect id="box" x="200" y="80" width="60" height="60" fill="#3366ff"/>',
        '  </g>',
        '</svg>',
        '',
      ].join('\n'),
    );
  });
});

describe('spec section 6.1: side effects and the tree literal', () => {
  it('flowchart.svg has the final structure (node2 text updated, move undone)', () => {
    const fs = newFileSystem();
    const interpreter = new Interpreter(new Editor(fs));
    SECTION_6_1.forEach(([input]) => interpreter.run(input));
    expect(fs.files.get('flowchart.svg')).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">',
        '  <g id="flowchart">',
        '    <g id="node1">',
        '      <rect id="start" x="120" y="100" width="160" height="60" fill="#4a90d9"/>',
        '      <text id="start-label" x="155" y="135">开始</text>',
        '    </g>',
        '    <g id="node2">',
        '      <rect id="process" x="520" y="100" width="160" height="60" fill="#f5a623"/>',
        '      <text id="process-label" x="545" y="135">处理数据 v2</text>',
        '    </g>',
        '    <line id="arrow1" x1="280" y1="130" x2="520" y2="130" stroke="black"/>',
        '  </g>',
        '</svg>',
        '',
      ].join('\n'),
    );
  });

  it('our tree equals the spec literal in everything except the spacing between label and attributes', () => {
    // 只折叠"标签与属性之间"的空格（前一个字符既不是空白也不是连线字符），缩进与连线保持逐字比较
    const ignoreAlignment = (line: string): string => line.replace(/(?<=[^\s─│├└]) {2,}(?=\S)/g, ' ');
    expect(SECTION_6_1_TREE_ACTUAL.map(ignoreAlignment)).toEqual(SPEC_6_1_TREE_LITERAL.map(ignoreAlignment));
  });
});
