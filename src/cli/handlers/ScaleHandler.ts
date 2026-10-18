import type { Editor } from '../../app/Editor.js';
import { NumberCodec } from '../../model/NumberCodec.js';
import { CliHandler } from '../CliHandler.js';

export class ScaleHandler extends CliHandler {
  constructor() {
    super('scale', 'scale <id> <factor>', 'scale position and size by factor (> 0); recursive for containers', 2);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    const [id, factor] = args as [string, string];
    return [editor.scale(id, NumberCodec.parse(factor))];
  }
}
