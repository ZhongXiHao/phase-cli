import { CannotUngroupCompositeError } from '../model/errors/CannotUngroupCompositeError.js';
import { CannotUngroupTopLevelError } from '../model/errors/CannotUngroupTopLevelError.js';
import { NotAContainerError } from '../model/errors/NotAContainerError.js';
import type { Document } from '../model/Document.js';
import type { Shape } from '../model/Shape.js';
import type { Command } from './Command.js';

/** 解散容器：子图形提升到容器原来的父级，占据容器原来的位置。 */
export class UngroupCommand implements Command {
  private done: { group: Shape; parent: Shape; index: number; children: Shape[] } | null = null;

  constructor(
    private readonly document: Document,
    private readonly id: string,
  ) {}

  execute(): string {
    const group = this.document.find(this.id);
    if (!group.isContainer) {
      throw new NotAContainerError(this.id);
    }
    if (!group.canUngroup()) {
      throw new CannotUngroupCompositeError(this.id);
    }
    if (this.document.isTopLevel(group)) {
      throw new CannotUngroupTopLevelError(this.id);
    }

    const parent = group.parent as Shape;
    const index = parent.indexOf(group);
    const children = [...group.children()];
    for (const child of children) {
      group.removeChild(child);
    }
    parent.removeChild(group);
    children.forEach((child, offset) => parent.insertChild(child, index + offset));

    this.done = { group, parent, index, children };
    return `${group.label()} ungrouped (${children.length} children moved to ${parent.label()})`;
  }

  undo(): string {
    const { group, parent, index, children } = this.done as NonNullable<typeof this.done>;
    for (const child of children) {
      parent.removeChild(child);
    }
    parent.insertChild(group, index);
    for (const child of children) {
      group.insertChild(child);
    }
    return `${group.label()} restored with ${children.length} children`;
  }
}
