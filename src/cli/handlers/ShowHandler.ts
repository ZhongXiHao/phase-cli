import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';
import { ShowRenderer } from '../ShowRenderer.js';

export class ShowHandler extends CliHandler {
  private readonly renderer = new ShowRenderer();

  constructor() {
    super('show', 'show <id>', 'show the attributes of one shape', 1);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    return this.renderer.render(editor.shapeView(args[0] as string));
  }
}
