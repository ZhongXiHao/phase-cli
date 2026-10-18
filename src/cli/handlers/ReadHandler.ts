import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';

export class ReadHandler extends CliHandler {
  constructor() {
    super('read', 'read <file.svg>', 'load an SVG file as the current document', 1);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    return editor.read(args[0] as string);
  }
}
