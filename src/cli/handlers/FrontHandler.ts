import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';

export class FrontHandler extends CliHandler {
  constructor() {
    super('front', 'front <id>', 'bring to front among siblings', 1);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    return [editor.front(args[0] as string)];
  }
}
