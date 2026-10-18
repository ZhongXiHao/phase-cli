import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';

export class BackHandler extends CliHandler {
  constructor() {
    super('back', 'back <id>', 'send to back among siblings', 1);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    return [editor.back(args[0] as string)];
  }
}
