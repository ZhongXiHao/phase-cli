import { DomainError } from './DomainError.js';

export class InvalidValueError extends DomainError {
  constructor(attribute: string, raw: string) {
    super(`invalid value for ${attribute}: ${raw}`);
  }
}
