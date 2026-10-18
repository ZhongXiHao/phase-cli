import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';

export class CreateHandler extends CliHandler {
  constructor() {
    super(
      'create',
      'create <type> <id> [params…] [in <containerId>]',
      'create a shape: rect | circle | ellipse | line | text | g',
      2,
      Number.POSITIVE_INFINITY,
    );
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    const [type, id, ...rest] = args as [string, string, ...string[]];
    // 尾缀 `in <containerId>`：倒数第二个 token 恰为 `in`
    const hasContainer = rest.length >= 2 && rest[rest.length - 2] === 'in';
    const params = hasContainer ? rest.slice(0, -2) : rest;
    const containerId = hasContainer ? rest[rest.length - 1] : undefined;
    return [editor.createShape(type, id, params, containerId)];
  }
}
