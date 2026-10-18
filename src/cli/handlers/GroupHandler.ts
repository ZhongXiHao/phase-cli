import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';

export class GroupHandler extends CliHandler {
  constructor() {
    super('group', 'group <newGid> <id1> <id2>…', 'wrap existing shapes into a new container', 2, Number.POSITIVE_INFINITY);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    const [newId, ...ids] = args as [string, ...string[]];
    return [editor.group(newId, ids)];
  }
}
