import type { Editor } from '../../app/Editor.js';
import { NumberCodec } from '../../model/NumberCodec.js';
import { CliHandler } from '../CliHandler.js';

export class CanvasHandler extends CliHandler {
  constructor() {
    super('canvas', 'canvas [w] [h]', 'show canvas size, or resize it', 0, 2);
  }

  protected override acceptsArgCount(count: number): boolean {
    return count === 0 || count === 2;
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    if (args.length === 0) {
      return [editor.canvas()];
    }
    const width = NumberCodec.parse(args[0] as string);
    const height = NumberCodec.parse(args[1] as string);
    return [editor.canvas({ width, height })];
  }
}
