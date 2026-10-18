import { DomainError } from './DomainError.js';

export class InvalidArgumentsError extends DomainError {
  constructor(usage: string) {
    super(`usage: ${usage}`);
  }
}
