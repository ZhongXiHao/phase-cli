import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';

export class DeleteHandler extends CliHandler {
  constructor() {
    super('delete', 'delete <id>', 'delete a shape (a container with all its descendants)', 1);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    return [editor.delete(args[0] as string)];
  }
}
