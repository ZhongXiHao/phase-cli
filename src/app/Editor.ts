import { AddToCommand } from '../commands/AddToCommand.js';
import type { Command } from '../commands/Command.js';
import { CreateShapeCommand } from '../commands/CreateShapeCommand.js';
import { DeleteShapeCommand } from '../commands/DeleteShapeCommand.js';
import { GroupCommand } from '../commands/GroupCommand.js';
import { History } from '../commands/History.js';
import { MoveCommand } from '../commands/MoveCommand.js';
import { ScaleCommand } from '../commands/ScaleCommand.js';
import { SetAttributeCommand } from '../commands/SetAttributeCommand.js';
import { UngroupCommand } from '../commands/UngroupCommand.js';
import { ZOrderCommand } from '../commands/ZOrderCommand.js';
import type { FileSystem } from '../io/FileSystem.js';
import { SvgParser } from '../io/SvgParser.js';
import { SvgSerializer } from '../io/SvgSerializer.js';
import { Document } from '../model/Document.js';
import type { DocumentView } from '../model/DocumentView.js';
import { NumberCodec } from '../model/NumberCodec.js';
import { ShapeFactory } from '../model/shape/ShapeFactory.js';
import type { ShapeView } from '../model/shape/ShapeView.js';
import { NoDocumentError } from './NoDocumentError.js';
import { NoFilePathError } from './NoFilePathError.js';
import { UndoNotAllowedError } from './UndoNotAllowedError.js';

/**
 * 一个编辑会话的门面：持有当前文档、撤销历史，以及"io 命令之后禁止 undo"的栏位。
 * 只返回结果摘要字符串或只读视图，不打印、不解析命令行 —— 换 GUI / agent 时可原样复用。
 */
export class Editor {
  private document: Document | null = null;
  private readonly history = new History();
  private undoBlockedByIo = false;
  /** 当前文档最近一次 read / save 的路径；`save` 不带参数时写回这里。 */
  private currentPath: string | null = null;
  private readonly parser: SvgParser;
  private readonly serializer = new SvgSerializer();

  constructor(
    private readonly fileSystem: FileSystem,
    private readonly factory: ShapeFactory = ShapeFactory.withBuiltIns(),
  ) {
    this.parser = new SvgParser(factory);
  }

  // ---- 文档类（执行后 undo/redo 禁止） ----

  /** 新建空画布并作为当前文档。 */
  init(width: number = 800, height: number = 600): string {
    this.document = new Document(width, height);
    this.currentPath = null;
    this.afterIoCommand();
    return `canvas ${NumberCodec.format(width)}x${NumberCodec.format(height)} created`;
  }

  /** 读入 SVG 文件作为当前文档；返回警告行（缺 id 补全等）加一行结果摘要。读入失败时当前文档保持不变。 */
  read(path: string): string[] {
    const { document, warnings } = this.parser.parse(this.fileSystem.readText(path));
    this.document = document;
    this.currentPath = path;
    this.afterIoCommand();
    return [...warnings, `read ${path} (${document.elementCount()} elements)`];
  }

  /** 保存当前文档；省略路径时写回读入 / 上次保存的路径。 */
  save(path?: string): string {
    const document = this.requireDocument();
    const target = path ?? this.currentPath;
    if (target === null) {
      throw new NoFilePathError();
    }
    this.fileSystem.writeText(target, this.serializer.serialize(document));
    this.currentPath = target;
    this.afterIoCommand();
    return `saved to ${target} (${document.elementCount()} elements)`;
  }

  /** 无参数：显示画布尺寸；带参数：修改尺寸。 */
  canvas(size?: { width: number; height: number }): string {
    const document = this.requireDocument();
    if (size === undefined) {
      return `canvas ${Editor.dimensions(document)}`;
    }
    document.resize(size.width, size.height);
    this.afterIoCommand();
    return `canvas resized to ${Editor.dimensions(document)}`;
  }

  // ---- 图形编辑类（可 undo/redo） ----

  createShape(type: string, id: string, args: readonly string[], containerId?: string): string {
    const document = this.requireDocument();
    return this.edit(new CreateShapeCommand(document, this.factory, type, id, args, containerId));
  }

  delete(id: string): string {
    return this.edit(new DeleteShapeCommand(this.requireDocument(), id));
  }

  move(id: string, dx: number, dy: number): string {
    return this.edit(new MoveCommand(this.requireDocument(), id, dx, dy));
  }

  scale(id: string, factor: number): string {
    return this.edit(new ScaleCommand(this.requireDocument(), id, factor));
  }

  set(id: string, attribute: string, value: string): string {
    return this.edit(new SetAttributeCommand(this.requireDocument(), id, attribute, value));
  }

  group(newId: string, ids: readonly string[]): string {
    return this.edit(new GroupCommand(this.requireDocument(), newId, ids));
  }

  ungroup(id: string): string {
    return this.edit(new UngroupCommand(this.requireDocument(), id));
  }

  addTo(containerId: string, id: string): string {
    return this.edit(new AddToCommand(this.requireDocument(), containerId, id));
  }

  front(id: string): string {
    return this.edit(ZOrderCommand.front(this.requireDocument(), id));
  }

  back(id: string): string {
    return this.edit(ZOrderCommand.back(this.requireDocument(), id));
  }

  // ---- 撤销重做 ----

  undo(): string {
    this.requireDocument();
    this.requireUndoAllowed();
    return this.history.undo();
  }

  redo(): string {
    this.requireDocument();
    this.requireUndoAllowed();
    return this.history.redo();
  }

  // ---- 显示类（只读视图，不进入 undo 栈） ----

  documentView(): DocumentView {
    return this.requireDocument();
  }

  shapeView(id: string): ShapeView {
    return this.requireDocument().find(id);
  }

  // ---- 内部 ----

  /** 执行一条编辑命令；成功后解除 io 之后的 undo 禁令（失败不解除）。 */
  private edit(command: Command): string {
    this.requireDocument();
    const message = this.history.run(command);
    this.undoBlockedByIo = false;
    return message;
  }

  /** io 命令成功后：旧历史作废，直到下一次编辑命令之前禁止 undo/redo。 */
  private afterIoCommand(): void {
    this.history.clear();
    this.undoBlockedByIo = true;
  }

  private requireDocument(): Document {
    if (this.document === null) {
      throw new NoDocumentError();
    }
    return this.document;
  }

  private requireUndoAllowed(): void {
    if (this.undoBlockedByIo) {
      throw new UndoNotAllowedError();
    }
  }

  private static dimensions(document: Document): string {
    return `${NumberCodec.format(document.width)}x${NumberCodec.format(document.height)}`;
  }
}
