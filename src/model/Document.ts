import { IdAlreadyExistsError } from './errors/IdAlreadyExistsError.js';
import { InvalidCanvasSizeError } from './errors/InvalidCanvasSizeError.js';
import { NoSuchContainerError } from './errors/NoSuchContainerError.js';
import { NoSuchShapeError } from './errors/NoSuchShapeError.js';
import { NotAContainerError } from './errors/NotAContainerError.js';
import { RootGroup } from './RootGroup.js';
import type { DocumentView } from './DocumentView.js';
import type { Shape } from './Shape.js';

/** 一份 SVG 文档：画布尺寸 + 图形树。所有按 id 的定位都经过 find 系列方法这唯一入口。 */
export class Document implements DocumentView {
  readonly root = new RootGroup();

  constructor(
    private _width: number = 800,
    private _height: number = 600,
  ) {}

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  resize(width: number, height: number): void {
    if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height)) {
      throw new InvalidCanvasSizeError();
    }
    this._width = width;
    this._height = height;
  }

  /** 先序遍历全部图形（不含画布根）。 */
  allShapes(): Shape[] {
    const result: Shape[] = [];
    const visit = (shape: Shape): void => {
      result.push(shape);
      shape.children().forEach(visit);
    };
    this.root.children().forEach(visit);
    return result;
  }

  elementCount(): number {
    return this.allShapes().length;
  }

  tryFind(id: string): Shape | undefined {
    return this.allShapes().find((shape) => shape.id === id);
  }

  find(id: string): Shape {
    const shape = this.tryFind(id);
    if (shape === undefined) {
      throw new NoSuchShapeError(id);
    }
    return shape;
  }

  /** `in <containerId>` 与 `addto` 的目标：必须存在且是容器。 */
  findContainer(id: string): Shape {
    const shape = this.tryFind(id);
    if (shape === undefined) {
      throw new NoSuchContainerError(id);
    }
    if (!shape.isContainer) {
      throw new NotAContainerError(id);
    }
    return shape;
  }

  assertIdFree(id: string): void {
    if (this.tryFind(id) !== undefined) {
      throw new IdAlreadyExistsError(id);
    }
  }

  isTopLevel(shape: Shape): boolean {
    return shape.parent === this.root;
  }
}
