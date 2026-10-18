import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';

export class SaveHandler extends CliHandler {
  constructor() {
    super('save', 'save [file.svg]', 'save the document (no argument: back to the path it was read from)', 0, 1);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    return [editor.save(args[0])];
  }
}
