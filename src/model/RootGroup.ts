import { Group } from './Group.js';

/** 画布根（`<svg>` 本身）：一个特殊的容器，不参与按 id 查找，也不能被 ungroup。 */
export class RootGroup extends Group {
  constructor() {
    super('svg');
  }

  override get kind(): string {
    return 'svg';
  }

  override label(): string {
    return 'svg';
  }

  override canUngroup(): boolean {
    return false;
  }
}
