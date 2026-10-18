import { DomainError } from './DomainError.js';

export class UnknownAttributeError extends DomainError {
  constructor(readonly attribute: string) {
    super(`unknown attribute: ${attribute}`);
  }
}
