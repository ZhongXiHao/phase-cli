import type { Editor } from '../../app/Editor.js';
import { NumberCodec } from '../../model/NumberCodec.js';
import { CliHandler } from '../CliHandler.js';

export class InitHandler extends CliHandler {
  constructor() {
    super('init', 'init [w] [h]', 'new empty canvas (default 800x600)', 0, 2);
  }

  /** 宽高要么都给要么都不给。 */
  protected override acceptsArgCount(count: number): boolean {
    return count === 0 || count === 2;
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    if (args.length === 0) {
      return [editor.init()];
    }
    return [editor.init(NumberCodec.parse(args[0] as string), NumberCodec.parse(args[1] as string))];
  }
}
