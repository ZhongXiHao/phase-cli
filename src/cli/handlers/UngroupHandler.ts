import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';

export class UngroupHandler extends CliHandler {
  constructor() {
    super('ungroup', 'ungroup <gid>', 'dissolve a container, lifting its children one level', 1);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    return [editor.ungroup(args[0] as string)];
  }
}
