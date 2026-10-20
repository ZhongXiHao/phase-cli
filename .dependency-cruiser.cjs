/**
 * 依赖方向规则，对应 doc/README.md 1.3 节。
 * 允许：main → 全部；cli → app（及 model 只读部分）；app → model/commands/io；commands → model；io → model。
 * model 内部：errors ← NumberCodec ← shape ← Document（单向）。
 */
const layer = (from, forbidden) => ({
  name: `${from}-must-not-depend-on-${forbidden.join('-')}`,
  severity: 'error',
  comment: `src/${from} 不得依赖 ${forbidden.map((m) => `src/${m}`).join('、')}（见 doc/README.md 1.3）`,
  from: { path: `^src/${from}/` },
  to: { path: `^src/(${forbidden.join('|')})/` },
});

module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', comment: '禁止循环依赖', from: {}, to: { circular: true } },
    layer('model', ['commands', 'io', 'app', 'cli']),
    layer('commands', ['io', 'app', 'cli']),
    layer('io', ['commands', 'app', 'cli']),
    layer('app', ['cli']),
    layer('cli', ['commands', 'io']),
    {
      name: 'cli-reads-model-through-views',
      severity: 'error',
      comment: 'cli 只能使用 model 的只读视图、错误类型与 NumberCodec（见 doc/README.md 1.3）',
      from: { path: '^src/cli/' },
      to: { path: '^src/model/', pathNot: '^src/model/(shape/ShapeView|DocumentView|NumberCodec|errors/)' },
    },
    // model 内部分层，依赖只能单向：errors ← NumberCodec ← shape ← Document（见 doc/README.md 1.3）
    {
      name: 'model-errors-are-leaf',
      severity: 'error',
      comment: 'model/errors 不得依赖 model 里 errors 之外的任何东西',
      from: { path: '^src/model/errors/' },
      to: { path: '^src/model/', pathNot: '^src/model/errors/' },
    },
    {
      name: 'model-numbercodec-below-shape',
      severity: 'error',
      comment: 'NumberCodec 只能依赖 model/errors，不得依赖 shape 或 Document',
      from: { path: '^src/model/NumberCodec\\.ts$' },
      to: { path: '^src/model/(shape/|Document)' },
    },
    {
      name: 'model-shape-is-self-contained',
      severity: 'error',
      comment: 'model/shape 自成一体：不得依赖 Document / DocumentView',
      from: { path: '^src/model/shape/' },
      to: { path: '^src/model/Document' },
    },
    {
      name: 'model-no-third-party',
      severity: 'error',
      comment: 'model 仅依赖语言标准库',
      from: { path: '^src/model/' },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'only-io-uses-xml-lib',
      severity: 'error',
      comment: 'XML 库细节关在 io 内',
      from: { pathNot: '^src/io/' },
      to: { path: 'node_modules/@xmldom' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
