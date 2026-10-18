import { DomainError } from '../model/errors/DomainError.js';

export class UndoNotAllowedError extends DomainError {
  constructor() {
    super('undo not allowed after io command');
  }
}
