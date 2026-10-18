import type { Editor } from '../../app/Editor.js';
import { CliHandler } from '../CliHandler.js';
import { TreeRenderer } from '../TreeRenderer.js';

export class TreeHandler extends CliHandler {
  private readonly renderer = new TreeRenderer();

  constructor() {
    super('tree', 'tree [id]', 'show the structure tree (whole document, or the subtree of <id>)', 0, 1);
  }

  protected execute(args: readonly string[], editor: Editor): string[] {
    return args.length === 0
      ? this.renderer.renderDocument(editor.documentView())
      : this.renderer.renderSubtree(editor.shapeView(args[0] as string));
  }
}
