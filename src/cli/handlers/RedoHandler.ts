import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';

export class RedoHandler extends CliHandler {
  constructor() {
    super('redo', 'redo', 'redo the last undone edit command', 0);
  }

  protected execute(_args: readonly string[], editor: Editor): string[] {
    return [editor.redo()];
  }
}
