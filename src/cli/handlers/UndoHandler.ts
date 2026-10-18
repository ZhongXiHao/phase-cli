import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';

export class UndoHandler extends CliHandler {
  constructor() {
    super('undo', 'undo', 'undo the last edit command', 0);
  }

  protected execute(_args: readonly string[], editor: Editor): string[] {
    return [editor.undo()];
  }
}
