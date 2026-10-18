import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';

export class SetHandler extends CliHandler {
  constructor() {
    super('set', 'set <id> <attr> <value>', 'set fill | stroke | stroke-width | a geometry attribute | text', 3);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    const [id, attribute, value] = args as [string, string, string];
    return [editor.set(id, attribute, value)];
  }
}
