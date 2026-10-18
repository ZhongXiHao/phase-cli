import { CannotGroupIntoDescendantError } from '../model/errors/CannotGroupIntoDescendantError.js';
import { InvalidArgumentsError } from '../model/errors/InvalidArgumentsError.js';
import { Group } from '../model/Group.js';
import type { Document } from '../model/Document.js';
import type { Shape } from '../model/Shape.js';
import type { Command } from './Command.js';

interface Placement {
  readonly shape: Shape;
  readonly parent: Shape;
  readonly index: number;
}

/**
 * 新建容器并收入若干图形。新容器落在第一个成员（文档顺序）原来的父容器、原来的位置；
 * 成员按文档顺序保持相对顺序。整条命令是一个 undo 单元。
 */
export class GroupCommand implements Command {
  /** 首次 execute 时创建，redo 复用同一个对象。 */
  private group: Group | null = null;
  private placements: Placement[] = [];

  constructor(
    private readonly document: Document,
    private readonly newId: string,
    private readonly ids: readonly string[],
  ) {}

  execute(): string {
    if (this.ids.length === 0) {
      throw new InvalidArgumentsError('group <newGid> <id1> <id2>…');
    }
    const members = this.resolveMembers();
    this.document.assertIdFree(this.newId);
    GroupCommand.rejectContainerWithItsDescendant(members);

    const group = this.group ?? new Group(this.newId);
    const first = members[0] as Shape;
    const target = first.parent as Shape;
    const insertIndex = target.indexOf(first);
    const placements = members.map((shape) => {
      const parent = shape.parent as Shape;
      return { shape, parent, index: parent.indexOf(shape) };
    });

    for (const placement of placements) {
      placement.parent.removeChild(placement.shape);
    }
    target.insertChild(group, insertIndex);
    for (const member of members) {
      group.insertChild(member);
    }

    this.group = group;
    this.placements = placements;
    return `${group.label()} created with ${members.length} children`;
  }

  undo(): string {
    const group = this.group as Group;
    group.parent?.removeChild(group);
    for (const child of [...group.children()]) {
      group.removeChild(child);
    }
    // 按原下标升序放回：每次放回时，下标更小的成员都已就位，其余前驱未动。
    const ascending = [...this.placements].sort((a, b) => a.index - b.index);
    for (const { shape, parent, index } of ascending) {
      parent.insertChild(shape, index);
    }
    return `${group.label()} removed (${this.placements.length} children restored)`;
  }

  /** 去重并按文档顺序排列。 */
  private resolveMembers(): Shape[] {
    const unique = [...new Set(this.ids)].map((id) => this.document.find(id));
    const order = new Map(this.document.allShapes().map((shape, position) => [shape, position]));
    return unique.sort((a, b) => (order.get(a) as number) - (order.get(b) as number));
  }

  private static rejectContainerWithItsDescendant(members: readonly Shape[]): void {
    for (const ancestor of members) {
      if (members.some((other) => other.isDescendantOf(ancestor))) {
        throw new CannotGroupIntoDescendantError(ancestor.id);
      }
    }
  }
}
