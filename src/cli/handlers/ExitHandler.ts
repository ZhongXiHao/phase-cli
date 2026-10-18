import { CliHandler } from '../CliHandler.js';

export class ExitHandler extends CliHandler {
  constructor(private readonly onExit: () => void) {
    super('exit', 'exit', 'leave the editor (Ctrl+D also works)', 0);
  }

  protected execute(): string[] {
    this.onExit();
    return [];
  }
}
