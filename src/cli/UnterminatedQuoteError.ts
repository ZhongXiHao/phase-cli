import { DomainError } from '../model/errors/DomainError.js';

export class UnterminatedQuoteError extends DomainError {
  constructor() {
    super('unterminated quote');
  }
}
