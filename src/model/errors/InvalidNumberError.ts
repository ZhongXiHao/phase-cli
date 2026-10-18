import { DomainError } from './DomainError.js';

export class InvalidNumberError extends DomainError {
  constructor(readonly raw: string) {
    super(`invalid number: ${raw}`);
  }
}
