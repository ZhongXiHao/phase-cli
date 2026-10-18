import { DomainError } from '../model/errors/DomainError.js';

export class NoDocumentError extends DomainError {
  constructor() {
    super("no document. use 'init' or 'read' first");
  }
}
