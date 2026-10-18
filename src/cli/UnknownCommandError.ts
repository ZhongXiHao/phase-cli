import { DomainError } from '../model/errors/DomainError.js';

export class UnknownCommandError extends DomainError {
  constructor(readonly commandName: string) {
    super(`unknown command: ${commandName} (type 'help' for commands)`);
  }
}
