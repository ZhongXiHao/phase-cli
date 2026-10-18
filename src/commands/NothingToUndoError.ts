import { DomainError } from '../model/errors/DomainError.js';

export class NothingToUndoError extends DomainError {
  constructor() {
    super('nothing to undo');
  }
}
