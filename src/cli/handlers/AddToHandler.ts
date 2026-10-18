import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';

export class AddToHandler extends CliHandler {
  constructor() {
    super('addto', 'addto <gid> <id>', 'move an existing shape into a container (as last child)', 2);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    const [containerId, id] = args as [string, string];
    return [editor.addTo(containerId, id)];
  }
}
