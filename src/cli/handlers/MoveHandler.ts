import type { Editor } from '../../app/Editor.js';
import { NumberCodec } from '../../model/NumberCodec.js';
import { CliHandler } from '../CliHandler.js';

export class MoveHandler extends CliHandler {
  constructor() {
    super('move', 'move <id> <dx> <dy>', 'translate by (dx, dy); a container moves as a whole', 3);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    const [id, dx, dy] = args as [string, string, string];
    return [editor.move(id, NumberCodec.parse(dx), NumberCodec.parse(dy))];
  }
}
