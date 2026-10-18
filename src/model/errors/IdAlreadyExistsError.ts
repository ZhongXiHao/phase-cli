import { DomainError } from './DomainError.js';

export class IdAlreadyExistsError extends DomainError {
  constructor(readonly id: string) {
    super(`id already exists: ${id}`);
  }
}
