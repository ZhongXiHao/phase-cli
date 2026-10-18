# SVG Editor（CLI）— Lab1 Phase 1

> 状态：**架构方案草案 v0.1**（实现前）。"过程记录 / 一致性自查 / 质量保证手段"三节在实现过程中逐步填写。

## 1. 架构方案

### 1.1 模块划分

技术栈：TypeScript（strict）+ Node 22，运行 `npm run cli`；测试用 vitest；XML 解析用 `@xmldom/xmldom`；依赖检查用 `dependency-cruiser`。

```text
src/
├── model/      领域模型：图形层次（Composite）、文档、领域错误
├── commands/   可撤销的编辑命令（Command 模式）+ 撤销/重做历史
├── io/         SVG 序列化 / 解析、文件系统抽象
├── app/        应用层门面 Editor：会话状态 + 用例入口
├── cli/        命令行外壳：REPL、分词、命令分发、输出渲染
└── main.ts     组合根（Composition Root）：装配各模块
tests/          单元测试 + 会话回放（transcript）测试
doc/README.md   本文档
```

| 模块 | 职责 | 主要类（一类一文件，文件名 = 类名） |
|---|---|---|
| **model** | 表达"文档里有什么"。图形层次、父子关系、id 唯一性、几何变换（move/scale）、属性白名单校验、状态快照（Memento）。**不认识 SVG 文本、不认识命令行、不输出任何文字** | `Shape`（抽象基类）、`Rect` `Circle` `Ellipse` `Line` `Text`、`Group`、`RootGroup`（画布根）、`Document`、`ShapeFactory`、`ShapeSpec`（类型创建说明书）、`ShapeAttributes`、`ShapeState`（Memento）、`NumberCodec`、`StyleInit`、`ShapeView` / `DocumentView`（只读接口）、`DomainError` 及 `errors/` 下的各子类 |
| **commands** | 表达"一次可撤销的编辑"。每条编辑命令一个类，自带 `execute / undo`；`History` 管理撤销栈与重做栈 | `Command`（接口）、`CreateShapeCommand` `DeleteShapeCommand` `MoveCommand` `ScaleCommand` `SetAttributeCommand` `GroupCommand` `UngroupCommand` `AddToCommand` `ZOrderCommand`（`front()` / `back()` 两个静态工厂）、`History`、`NothingToUndoError` `NothingToRedoError` |
| **io** | 表达"文档与外部世界的转换"：Document ⇄ SVG 文本；文件读写经接口隔离，测试时可换成内存实现 | `SvgSerializer`、`SvgParser`、`ParseResult`、`FileSystem`（接口）、`NodeFileSystem`、`FileReadError` `FileWriteError` `InvalidSvgError` |
| **app** | 表达"一个编辑会话"：持有当前 Document、History、读入路径、"io 命令后禁止 undo"的栏位；对外提供与界面无关的用例方法（`createShape` `move` `undo` `save`…）。**不打印、不解析命令行**，换 GUI / agent 时可原样复用 | `Editor` |
| **cli** | 表达"文本交互"：读一行、分词（引号、`#` 注释）、查表分发到处理器、把结果渲染为文字（`error:` 前缀、tree、show、help） | `Repl`（只管 I/O 循环）、`Interpreter`（一行文本 → 输出行，含统一错误处理）、`Tokenizer`、`CommandTable`、`CliHandler`（抽象基类）及 `handlers/` 下每条用户命令一个处理器、`TreeRenderer`、`ShowRenderer` |

#### 组件图

```plantuml
@startuml
skinparam componentStyle rectangle
package "src" {
  [cli]      as cli
  [app]      as app
  [commands] as commands
  [io]       as io
  [model]    as model
  [main]     as main
}
main --> cli
main --> app
main --> io
cli --> app
cli ..> model : <<read-only>>\nShapeView / DomainError
app --> commands
app --> io
app --> model
commands --> model
io --> model
@enduml
```

#### 核心类关系（model + commands）

```plantuml
@startuml
interface ShapeView {
  +id: string
  +kind: string
  +parent: ShapeView | null
  +children(): ShapeView[]
  +attributes(): [string,string][]
  +describe(): string
}
abstract class Shape {
  +translate(dx, dy)
  +scale(f)
  +setAttribute(name, value)
  +captureState(): Memento
  +restoreState(m)
}
class Group {
  -childList: Shape[]
  +insertChild(s, index)
  +removeChild(s)
  +translate() / scale()  <<递归>>
}
Shape <|-- Rect
Shape <|-- Circle
Shape <|-- Ellipse
Shape <|-- Line
Shape <|-- Text
Shape <|-- Group
ShapeView <|.. Shape
Group o-- "0..*" Shape
class Document { canvas; root: Group; find(id) }
Document *-- Group
class ShapeFactory { create(type, id, attrs) }

interface Command {
  +execute(): string
  +undo(): string
}
Command <|.. CreateShapeCommand
Command <|.. DeleteShapeCommand
Command <|.. MoveCommand
Command <|.. ScaleCommand
Command <|.. SetAttributeCommand
Command <|.. GroupCommand
Command <|.. UngroupCommand
Command <|.. AddToCommand
Command <|.. ZOrderCommand
class History { undoStack; redoStack; run(cmd); undo(); redo() }
History o-- Command
Command ..> Document
@enduml
```

### 1.2 设计模式的选择与落地

| 模式 | 解决什么问题 | 在代码里怎么落地 |
|---|---|---|
| **Command**（必选） | 编辑可撤销 / 重做；一条命令 = 一个 undo 单元 | `Command` 接口：`execute()` / `undo()` 各返回一行结果摘要（如 `circle#c1 moved back to (100,100)`）。每条编辑命令一个类，构造时只保存参数，`execute` 时记录还原所需信息。`History.run(cmd)` 执行成功后入栈并清空 redo 栈；执行抛错则**不入栈**。`group g1 a b c` 是一个 `GroupCommand`，内部记录所有成员原来的（父容器, 下标），一次 undo 全部还原。显示类命令不是 Command，不经过 History |
| **Composite** | 容器与叶子统一操作 | `Shape` 为统一抽象，采用**透明式 Composite**：`children / insertChild / removeChild / indexOf / canUngroup` 直接声明在 `Shape` 上，叶子调用子节点管理方法抛 `not a container`；`Group` 持有 `Shape[]`，其 `translate/scale/setAttribute` 递归转发给子节点。**调用方不写 `if (isGroup)` 也不做类型断言**，命令类只面向 `Shape` 编程。选透明式而非安全式，是因为安全式要求 `Shape` 引用 `Group` 类型，两者互相 import 会形成循环依赖，被依赖检查拒绝 |
| **Memento** | 让 move/scale/set 的 undo 精确还原 | `Shape.captureState()` 返回不透明快照，`restoreState()` 还原；`Group` 的快照递归包含子孙。**不用"反向操作"**：`scale 0.3` 再 `scale 1/0.3` 会有浮点误差，快照则逐位精确 |
| **Factory（简单工厂 + 注册表）** | 类型名 → 图形类；CLI 与 SVG 读入共用同一创建路径 | `ShapeFactory.create(type, id, attrs)`，`attrs` 的键直接用 SVG 属性名（`x y width height fill`…），CLI 位置参数按类型的参数表映射成属性名，`SvgParser` 则直接传 XML 属性 |
| **Facade** | 隔离界面与内核 | `Editor` 是 cli 唯一能调用的入口 |
| **Template Method** | 去重处理器里的参数个数校验、错误转文字 | `CliHandler.run()` 先校验参数个数，再调子类 `execute()`，捕获 `DomainError` 统一加 `error:` 前缀 |

**被明确放弃的方案：Visitor**。序列化和 tree 显示看似适合 Visitor，但 Visitor 要求接口里列出所有具体图形（`visitRect…`），后续插件化阶段新增 `box` 时每个 Visitor 都要改，违背"内核新增代码为 0"。改用：`Shape.kind`（标签名）+ `Shape.attributes()`（有序的属性键值对）+ `Shape.describe()`（tree 内联的几何摘要，如 `x=0 y=0 w=800 h=600 fill=#ffffff`）+ `Group.children()`。`SvgSerializer` 与 `TreeRenderer` 只靠这几个多态方法遍历，不需要认识任何具体图形类。

**按名字分派的两处（作业允许，且须标注为待重构）**

| # | 位置 | 现状 | 待重构方向 |
|---|---|---|---|
| 1 | `cli/CommandTable`：命令名 → 处理器 | `Map<string, CliHandler>` 注册表，不使用 `switch` | 插件阶段改为可注册（`CommandProvider`） |
| 2 | `model/ShapeFactory`：类型名 → 图形类 | `Map<string, ShapeCreator>` 注册表，提供 `register()` | 插件阶段改为 `ShapeProvider` 接口，由插件注册 `box` |

除这两处外，代码中**不得出现按类型名 / 标签名的 `switch` 或 `if-else` 链**，也不得出现 `instanceof` 分派。

### 1.3 依赖方向规则

依赖只能向下，**禁止环**：

```text
main ──► cli ──► app ──► commands ──► model
  │                │                    ▲
  │                └──► io ─────────────┘
  └────────────────────────────────────►(装配)
```

| 模块 | 允许依赖 | 禁止依赖 | 理由 |
|---|---|---|---|
| `model` | 仅语言标准库 | 其余所有模块、任何第三方库 | 领域核心必须可独立理解、独立测试；它不应知道 SVG 文本、命令行或撤销机制 |
| `commands` | `model` | `io` `app` `cli` | 命令只操作文档对象；不碰文件、不碰界面。保证"一个命令"能在无 IO 的单元测试里跑 |
| `io` | `model`、`@xmldom/xmldom` | `commands` `app` `cli` | 序列化只关心 Document ⇄ 文本；格式变化不应波及编辑逻辑 |
| `app` | `model` `commands` `io` | `cli` | 门面不得反向依赖界面，否则换 GUI / agent 时无法复用；`app` 不打印任何文字 |
| `cli` | `app`，以及 `model` 中的 **只读** 部分（`ShapeView`、`DocumentView`、`NumberCodec`、`errors/`） | `commands` `io` | cli 只和门面说话。只读约束由类型保证：`app` 向 cli 返回的是 `ShapeView`，没有任何变更方法 |
| `main` | 所有模块 | — | 组合根，唯一允许认识全部实现类的地方（注入 `NodeFileSystem`、`process.stdin/stdout`） |

补充规则：
1. **`model` 内部**：`Group` 的子节点变更方法（`insertChild / removeChild`）只允许 `commands` 调用，`cli` 看不到（`ShapeView` 不含它们）。
2. **副作用边界**：只有 `io/NodeFileSystem` 与 `cli/Repl` 触碰真实的 fs / stdio，其余模块纯内存，便于测试。
3. **cli 对 model 的访问面是白名单**：`dependency-cruiser` 规则 `cli-reads-model-through-views` 只允许 cli 引用 `ShapeView`、`DocumentView`、`NumberCodec` 与 `errors/`，引用 `Shape`、`Group`、`Document` 等任何可变类型即报错。
4. **执行方式**：用 `dependency-cruiser` 配置上述规则并纳入 `npm test`，违反即视为"待处理项"。

### 1.4 关键设计决策（实现层面）

1. **失败不改状态**：每个 `Command.execute()` 分两段：先**完整校验所有前置条件**（id 是否存在 / 是否重复、目标是否是容器、是否把容器放进自己的子孙、因子是否为正…），全部通过后才开始修改。抛出的 `DomainError` 子类的 `message` 即规范里的错误文本，cli 只加前缀 `error: `。
2. **撤销栏位**：`Editor` 持有 `undoBlockedByIo: boolean`。`init` / `read` / `save` / `canvas <w> <h>` 四条 io 命令执行成功后，一律**清空 undo 与 redo 两个栈**，并置位 `true`；它们本身不入栈、不可被 undo。下一条**编辑命令**成功后复位，此后栈从空开始重新记录。置位时 `undo/redo` 抛 `undo not allowed after io command`。这样 io 命令之后既不能 undo，也不可能越过 io 命令撤销它之前的编辑，与规范 4.3 的字面要求完全一致。不提供 `--ignore-io` 之类的越界参数。**（已确认，见 v0.3）**
3. **id 查找**：`Document.find(id)` 遍历树（O(n)），**不维护 id 索引**——命令行规模下足够，且避免"索引与树不同步"的一类 bug。所有按 id 定位只经此一个入口。
4. **`group` 的落点**：新容器放在**第一个成员原父容器**中、第一个成员原来的位置；成员按文档顺序保持相对顺序。成员父容器不同时，其余成员被拉入第一个成员的父容器。**（已确认）**
5. **`addto` / `group` 的环检测**：目标容器若位于任何被移动图形的子树内，抛 `cannot group a container into its own descendant`。
6. **读入 SVG**：`<rect circle ellipse line text g>` 之外的元素（`path` `defs`…）**跳过并打印 `warning: skipped unsupported element <path>`**；`<g>` 上的 `transform` 作为不透明字符串原样保留并回写，不可通过 `set` 修改（`move/scale` 通过递归修改子节点坐标实现，不改写 `transform`）。
7. **数字输出**：整数不带小数点，浮点去掉累积误差与多余尾零，`-0` 输出为 `0`；统一由 `NumberCodec.format` 处理，解析由 `NumberCodec.parse` 处理（拒绝 `abc`、空串、`NaN`）。
8. **对容器 `set`**：只接受 `fill` / `stroke` / `stroke-width`，并递归设置到全部子孙（规范要求容器与叶子统一操作，但未定义几何属性如何作用于容器，故拒绝 `set g1 x 5`，报 `unknown attribute: x`）。先整体校验后赋值，保证失败不改状态。
9. **画布根是特殊容器**：`Document.root` 是 `RootGroup`（`kind=svg`），不参与 `find`，不能被 `ungroup`；因此用户可以创建 id 为 `svg` 的图形而不冲突。`Document.isTopLevel(shape)` 判断"是否根的直接子节点"，用于 `ungroup` 的 `cannot ungroup top-level container` 检查。
10. **图形创建说明书 `ShapeSpec`**：每个图形类提供静态 `spec()`，包含类型名、位置参数表和构造函数；CLI 的位置参数与 SVG 属性都先归一成"属性名 → 值"再交给同一个构造函数。缺省数值按 SVG 规则取 0。
11. **命令的可重做性与对象身份**：redo 就是对同一个 Command 对象再次 `execute()`。`CreateShapeCommand` / `GroupCommand` 首次执行时创建图形，之后复用同一个对象；`DeleteShapeCommand` 摘下的是原对象并原样放回。这样即使其他命令持有了图形引用，undo → redo 之后引用依然有效。所有命令每次 `execute` 都按 id 重新解析目标。
12. **精确还原靠快照**：`move` / `scale` / `set` 的 undo 都用 `captureState / restoreState`；对容器 `set`，每个子孙回到各自原来的值（不是统一的某个旧值）。
13. **undo 回显文本**（规范只给了 move 与 set 两种，其余为自拟）：`created`↔`removed`；`deleted`↔`restored into <父>`；`moved to (x,y)`↔`moved back to (x,y)`（容器用 `moved by` / `moved back by`）；`group`↔`removed (n children restored)`；`ungroup`↔`restored with n children`；`addto`↔`moved back into <原父>`；`front/back`↔`z-order restored`；`scale`↔`scale undone`。
14. **`group` 的 undo 顺序**：成员按原下标**升序**放回各自原父容器，可证明这样每次放回时前驱位置都未被扰动，从而逐位还原（`tests/commands` 里有交错下标的用例）。

### 1.5 变化点假设

| # | 我认为未来最可能变化的 | 我为它留了什么 | 没留什么、为什么 |
|---|---|---|---|
| 1 | **新增图形类型 / 复合图形 `box`（下一阶段确定会发生）** | ① `ShapeFactory` 注册表 + `register()`；② 序列化走 `kind + attributes()`，新类型不改 `SvgSerializer`；③ `Shape.setAttribute` 是虚方法，`box` 可重写成"传播给子部件"；④ `Shape.describe()` / `kind` 可重写成 `g#n1 (box)`；⑤ 创建参数以"属性名 → 值"传递，不写死位置参数 | 不做插件加载器、不做 `ShapeProvider` 接口——本阶段只有 6 个内置类型，提前抽象会猜错形状（YAGNI）。`ungroup` 拒绝复合图形的判断留给 `Shape.canUngroup()` 虚方法（`Group` 为 `true`，`RootGroup` 为 `false`，将来 `box` 重写为 `false`） |
| 2 | **新增输入通道（GUI / agent / 脚本）** | `Editor` 门面不依赖 cli、不输出文字；cli 的处理器只做"字符串 → 类型化参数 → 调 Editor" | 不做事件总线 / 观察者通知——暂无多视图同步需求 |
| 3 | **新增命令或撤销粒度变化**（如宏命令、命令合并） | `Command` 是接口，`History` 只依赖接口；新增命令 = 新增一个类 + 一个处理器 | 不预先做 `MacroCommand`——`group` 目前自己就是一个单元；出现"一次输入触发多条命令"时再引入 |
| 4 | **文件格式 / XML 库替换** | 所有 XML 细节关在 `io/` 内；fs 经 `FileSystem` 接口注入 | 不抽 `DocumentFormat` 接口——只有 SVG 一种格式，抽出来没有第二个实现可验证 |
| 5 | **输出格式变化**（tree 样式、show 字段、JSON 输出） | 渲染集中在 `cli/TreeRenderer`、`ShowRenderer`，图形只提供 `describe()` / `attributes()` 数据 | 不做可切换主题 / 多种输出格式 |
| 6 | **图形寻址方式**（id → 结构路径，如 `/canvas/g1/rect[2]`） | `Document.find(id)` 是唯一的定位入口 | 本阶段规范明确不要求，不预留路径解析器 |
| 7 | **`transform` 的完整支持** | 解析时保留 `<g transform>` 并回写（不丢数据） | 不支持编辑 / 叠加计算 transform——规范里 `move/scale` 定义为改坐标，支持矩阵会让所有几何方法复杂化 |

### 1.6 待确认的假设（规范未明确，当前采用的取值）

- 读入遇到不支持的**元素**（`path`、`defs`…）：整棵子树跳过，并打印 `warning: skipped unsupported element <path>`（见 1.4-6）。
- 读入时图形类型不认识的**属性**（如 `rx`、`font-size`、`text-anchor`、`opacity`）**静默丢弃**，因此对含这些属性的外部文件做 `read` → `save` 会丢失它们。规范没有要求保留，且为避免与规范 transcript 的警告行产生差异，没有为此打印警告。这是已知的有损往返。
- `create` 的位置参数与 `in` 子句：`in` 必须是最后两个 token（见 1.4-16）。

### 1.7 修订记录

| 版本 | 日期 | 变更 | 原因 |
|---|---|---|---|
| v0.1 | 2026-10-18 | 初稿 | — |
| v0.2 | 2026-10-18 | 确认 `save` 后保留 undo 栈（`save` 本身不入栈）；确认 `group` 落在第一个成员的位置 | 消除规范未明确处的歧义 |
| v0.3 | 2026-10-18 | 修订 v0.2：`init` / `read` / `save` / `canvas` 四条 io 命令一律清空 undo 与 redo 栈；曾讨论 `undo --ignore-io` 越界参数，决定不做 | 贴合规范 4.3 的字面要求，规则最简单，避免评测差异 |
| v0.4 | 2026-10-18 | 实现 `model/` 时修订：① Composite 由"安全式"改为"透明式"（子节点管理方法上移到 `Shape`）；② `canUngroup()` 由 `Group` 上移到 `Shape`；③ 新增 `RootGroup`、`ShapeSpec`、`ShapeAttributes`、`ShapeState`、`NumberCodec`、`DocumentView`；④ 新增 1.4 第 8–10 条 | ① 安全式需要 `Shape` 与 `Group` 互相引用，产生循环依赖；② 命令只持有 `Shape`，需要无需类型断言的入口；③④ 实现中暴露的必要抽象与规范未覆盖的取值 |
| v0.5 | 2026-10-18 | 实现 `commands/`：新增 `Shape.anchor()`（move 的回显需要区分叶子与容器）；新增 1.4 第 11–14 条；`ZOrderCommand` 用静态工厂 `front()` / `back()` | 规范的回显格式要求；redo 复用对象以保证引用有效 |
| v0.6 | 2026-10-18 | 实现 `app/` 与 `cli/`：新增 `Interpreter`；cli 对 model 的访问收紧为白名单（新增 dependency-cruiser 规则）；新增 1.4 第 15–18 条；`HelpHandler` 改为接收函数而非 `CommandTable` | 测试与依赖检查中发现的问题（见过程记录） |
| v0.7 | 2026-10-18 | 实现 `io/` 并接入 `read` / `save`：`Editor` 构造时注入 `FileSystem`；新增 1.4 第 19–22 条；1.6 补充"读入丢弃未知属性"这一已知局限；填写"一致性自查"与"质量保证手段" | 功能实现完成；测试发现 `xmldom` 会二次包装回调里抛出的异常，改为记录后统一抛出 |

15. **Repl 与 Interpreter 分离**：`Interpreter.run(line): string[]` 不碰 stdin/stdout，负责分词、分发、把 `DomainError` 转成 `error: …`，非领域错误以 `error: internal: …` 报告但不中断会话；`Repl` 只做读写循环。这样脚本回放测试直接驱动 Interpreter，I/O 层单独用内存流测试。
16. **`create` 的 `in` 子句**：处理器取"倒数第二个 token 恰为 `in`"作为尾缀，其余全部当位置参数。已知限制：若 text 内容恰好就是 `in` 且紧跟一个 id，会被误判为尾缀（需把内容放进引号并保证其不在倒数第二位）。
17. **tree 的列对齐**：所有带描述的行统一对齐，描述列 = 全树最长"前缀 + 标签"+ 2 空格。规范三份示例中有两份（第 5.1 节、`other.svg` 读入）符合此规则，6.1 节手绘的流程图示例对齐方式不同（按同级分组、间隔 1 空格），属示例自身不一致，以多数示例为准。
18. **运行方式**：`npm run cli` 交互；`npm run cli -- <脚本文件>` 回放脚本；管道输入亦可。非交互输入时，读到的行回显在提示符之后，输出即完整会话记录。额外提供 `exit` 命令（规范未要求），Ctrl+D 同样可退出。
19. **`read` / `save` 的原子性**：`read` 先读文件、解析成功后才替换当前文档；读不到、XML 非法、id 重复时当前文档与 undo 历史原样保留。`save` 先序列化、写成功后才记录路径并清栈；写失败时历史、undo 许可与默认路径都不变。
20. **默认保存路径**：`read <f>` 和 `save <f>` 成功后都把 `<f>` 记为当前路径，之后无参数 `save` 写回该路径；`init` 清除路径，此时无参数 `save` 报 `no file path. use 'save <file.svg>'`。
21. **元素计数**：`saved to … (N elements)` / `read … (N elements)` 的 N 是除 `<svg>` 根之外的元素总数（含 `<g>`），与规范示例（5、7、8）一致。
22. **读入时的 id 处理分两遍**：第一遍收集全部显式 id（同时检出重复 id），第二遍创建图形并给缺 id 的元素补 `标签名+序号`，因此补出的 id 不会与文件里后出现的显式 id 冲突（如无 id 的 `<rect>` 在文件里还有 `id="rect1"` 时，补成 `rect2`）。

## 2. 过程记录

_（实现过程中填写：AI 给出的建议 / 代码里发现的问题、如何确认与纠正。）_

* 讨论过 undo --ignore-io，因为规范 4.3 要求字面一致、避免扣分而放弃

* **依赖检查抓到我（AI）引入的循环依赖**：`HelpHandler` 为了列出全部命令引用了 `CommandTable`，而 `CommandTable` 又要构造 `HelpHandler`。`dependency-cruiser` 的 `no-circular` 规则报错后，改为 `HelpHandler` 只接收一个"返回处理器列表"的函数。同样的原因，model 层的 Composite 也从"安全式"改成了"透明式"（见 v0.4）。
* **测试发现 `exit` 之后仍执行后续行**：readline 关闭后会继续发出同一块输入里已缓冲的行，导致脚本里 `exit` 后面的命令仍被执行。在行处理函数开头加守卫修复，并留下回归测试。
* **我自己的测试假设错了**：长链 undo/redo 测试里对根级容器 `ungroup`，被规范规定的 `cannot ungroup top-level container` 拒绝。实现没错，错在测试，改为先 `addto` 进另一个容器。
* **规范示例之间互相矛盾**：`tree` 的列对齐在三份示例里不一致，无法同时满足，取多数（见 1.4-17）。
* **第三方库的行为与预期不符**：我（AI）最初假设在 `xmldom` 的 `onError` 回调里抛自己的 `InvalidSvgError` 即可；测试显示用户会看到 `error: internal: Reporting fatalError … caused InvalidSvgError`，因为库会把回调里抛出的异常再包一层，且致命错误它仍会自己抛 `ParseError`。动手前我用一段小脚本探测了库的真实行为（有效/无效输入各一组），最终改为"回调只记录第一个错误 + try/catch 捕获 `ParseError`，统一转成 `invalid svg: …`"。
* **覆盖率暴露了测试盲区**：第一次跑覆盖率总体 92%，但明细显示 `Ellipse` 只有 27%、`addto` / `back` 两个命令从未经过 CLI 测试——此前测试只覆盖了我顺手写的几个场景。补了按图形类型参数化的 `LeafShapes.test.ts`（五种叶子共用同一套检查）和 `Handlers.test.ts` 后升到 98%。
* **自查抓到的小违规**：用脚本检查"类名 = 文件名"，发现 `ReplOptions`、`ParseResult` 两个接口与类挤在同一文件，已拆出；`Repl` 里有一个赋值后从未使用的 `close` 字段（死代码），已删除。
* **又一次测试预期写错**：我断言 `create rect r 0 0 1 1 in` 应报用法错误，实际上 `rect` 有可选的 `fill`，`in` 被当作颜色值——实现符合 1.4-16 的约定，错的是预期。改为用没有多余可选参数的 `circle` 来验证"多出来的 `in` 触发用法错误"。

## 3. 一致性自查

> 状态：功能实现完成后的一次自查（截至修订记录 v0.7）。打 tag `final` 之前需要用同样的方法重新核对一遍。

### 3.1 模块划分：实际目录与方案是否一致？

**一致。** `src/` 下的五个模块目录（`model` `commands` `io` `app` `cli`）加 `main.ts` 与 1.1 完全对应，没有新增或遗漏的模块。方案之外的差异都只发生在模块**内部**，已逐条记入修订记录：

| 差异 | 记录 |
|---|---|
| `model` 的 Composite 改为透明式；新增 `RootGroup` `ShapeSpec` `ShapeAttributes` `ShapeState` `NumberCodec` `DocumentView` | v0.4 |
| `Shape` 新增 `anchor()`；`commands` 新增 `NothingToUndoError` `NothingToRedoError` | v0.5 |
| `cli` 新增 `Interpreter` `ReplOptions`；`HelpHandler` 改为接收函数 | v0.6 |
| `io` 新增 `ParseResult` `FileReadError` `FileWriteError` `InvalidSvgError`；`Editor` 新增 `fileSystem` 构造参数 | v0.7 |

约束"一类一文件、文件名 = 类名"也做了脚本检查：除两处接口与类同文件（已拆出）外，88 个源文件（含 main.ts）全部符合。

### 3.2 依赖方向：方案里的规则有没有被违反？

**没有。** 检查分两层：

1. **工具检查**：`npm run deps`（dependency-cruiser，规则见 `.dependency-cruiser.cjs`）报告 `no dependency violations found`（92 个模块、257 条依赖）。规则含：无环；`model` 不依赖任何其他模块与第三方库；`commands` / `io` 不依赖 `app` `cli`；`app` 不依赖 `cli`；`cli` 不依赖 `commands` `io`，且对 `model` 只能引用白名单；XML 库只能在 `io` 里用。我还故意写入一条 `model → cli` 的依赖，确认规则会报错，然后删除。
2. **抽样复核**（脚本统计各模块之间的 import 数量，与 1.3 对照）：

| 实际依赖 | 次数 | 方案允许？ |
|---|---|---|
| `commands → model` | 33 | ✔ |
| `io → model` | 11；`io → @xmldom` 1 | ✔ |
| `app → commands` / `io` / `model` | 11 / 3 / 8 | ✔ |
| `cli → app` | 22 | ✔ |
| `cli → model` | 12，仅涉及 `ShapeView` `DocumentView` `NumberCodec` `errors/DomainError` `errors/InvalidArgumentsError` | ✔（白名单内） |
| `main → app` `cli` `io` | 各 1 | ✔（组合根） |
| `model → *`、`commands → io/app/cli`、`io → commands/app/cli`、`app → cli`、`cli → commands/io` | 0 | — |

**过程中曾出现过的违反**：实现 `HelpHandler` 时我（AI）引入了 `CommandTable ⇄ HelpHandler` 的循环依赖，被 `no-circular` 规则当场拦下并修复，见"过程记录"。

### 3.3 规范禁令的自查

| 规范要求 | 检查方法 | 结果 |
|---|---|---|
| 禁止按类型名 `switch` / `instanceof` 分派 | `grep` 全部 `src/` | `switch` 仅出现在 5 个叶子图形的 `setOwnAttribute` 里，分派的是**属性名**（白名单校验），不是图形类型；`instanceof` 仅用于判断是否 `Error` / `DomainError`，没有按图形类型分派 |
| 按名字分派只允许两处，且标注待重构 | 代码审阅 | 仅 `cli/CommandTable`（命令名 → 处理器）与 `model/ShapeFactory`（类型名 → `ShapeSpec`），两处的注释与 1.2 节均标注"待重构" |
| 容器与叶子统一操作 | 测试 | `move` `scale` `set` `delete` 对 `g` 与叶子走同一条命令类，没有 `if (isGroup)`；`Handlers.test.ts` `EditCommands.test.ts` 覆盖 |
| 命令失败不改变任何状态 | 测试 | 所有命令的每个错误场景都比对"前后整棵树快照 + undo 深度"（`expectFailsWithoutChange`），另有 `read` / `save` 失败不改变文档与历史的用例 |

## 4. 质量保证手段

### 4.1 功能是否完整？

对照规范第 3 节命令总表逐条核对：`init` `read` `save` `canvas` `create`（六种类型 + `in` 子句）`delete` `move` `scale` `set` `group` `ungroup` `addto` `front` `back` `tree` `show` `help` `undo` `redo` 共 19 条命令全部实现，并各有测试。第 4.2 节错误信息表中的 11 种错误文本逐字有断言（`Interpreter.test.ts` 的 `it.each` 表）。第 4.4 节 `box` 属后续阶段，本阶段按规范报 `unknown shape type`，有测试。

**以规范的完整 transcript 作为验收标准**（逐行断言输出，不是"大致像"）：

| 来源 | 测试 | 说明 |
|---|---|---|
| 规范第 6 节完整会话（含 `save` / `read other.svg` / 补 id 警告） | `SessionWithIo.test.ts` | 17 步，输出与规范逐字一致 |
| 规范 6.1 流程图（`in` 子句，保存为 8 个元素） | `Interpreter.test.ts` `SessionWithIo.test.ts` | 唯一的差异是 `tree` 列对齐（见 1.4-17） |
| 规范 0.1 的最小 SVG | `SvgSerializer.test.ts` | 按规范所说的 5 条命令生成，与规范给出的文本**逐字节**相同 |
| 规范 0.1 的 `transform` 示例、`other.svg` | `SvgParser.test.ts` | 读入后的树与规范一致 |

### 4.2 对代码质量的信心来自哪里？

| 手段 | 做法 | 结果（截至 v0.7） |
|---|---|---|
| **自动化测试** | `vitest`；`npm test` | 15 个测试文件、214 个用例，全部通过 |
| **覆盖率** | `npm run coverage`（v8） | 语句 98.2%、分支 91.7%、函数 97.2%、行 98.2% |
| **类型检查** | `tsc --strict`，另开 `noUncheckedIndexedAccess` `noImplicitOverride` | 0 错误 |
| **架构约束** | `dependency-cruiser` 把 1.3 的依赖规则写成可执行配置 | 0 违反；曾拦下一次循环依赖 |
| **一键校验** | `npm run check` = 类型检查 + 依赖检查 + 测试 | 通过 |
| **端到端** | 用真实文件系统跑 `examples/` 下的脚本，再把生成的 SVG 读回 | 输出与规范一致，往返后文件逐字节相同（`SvgSerializer.test.ts` 的往返用例） |

测试的组织方式：
- **分层测**：`model` 测图形行为与精确还原；`commands` 测每条命令的"执行 / undo / redo / 失败不改状态"；`io` 测序列化与解析；`cli` 测分词、分发与 transcript；`Repl` 用内存流测 I/O 层。`FileSystem` 是接口，`cli` / `app` 的测试全部用内存实现，不碰磁盘。
- **性质类断言**：undo 到底应回到空文档、redo 到底应回到终态（长链用例）；`group` 成员下标交错时 undo 逐位还原；`scale 0.3` / `move 0.1 0.2` 之后 undo 后的数值与原值**逐位相同**（用快照而不是反向运算）；`save` → `read` → `save` 两次输出相同。
- **每次发现问题都补回归测试**（见"过程记录"）。

### 4.3 已知局限（如实列出）

- 交互式终端（TTY）下的行编辑 / 提示符行为只在管道与脚本输入下验证过，没有在真实终端里自动化测试。
- `tree` 的列对齐无法同时满足规范中互相矛盾的示例（见 1.4-17）。
- `read` → `save` 会静默丢弃图形类型不认识的属性（见 1.6）。
- undo / redo 的回显文本，除规范给出的 `move` 与 `set` 外，其余为自拟（见 1.4-13），若评测有逐字要求则可能不符。
- 覆盖率未覆盖的约 2% 主要是防御性分支（"状态值类型不符"之类的内部断言）。
