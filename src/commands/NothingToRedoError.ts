import { DomainError } from '../model/errors/DomainError.js';

export class NothingToRedoError extends DomainError {
  constructor() {
    super('nothing to redo');
  }
}
