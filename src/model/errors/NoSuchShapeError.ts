import { DomainError } from './DomainError.js';

export class NoSuchShapeError extends DomainError {
  constructor(readonly id: string) {
    super(`no such shape: ${id}`);
  }
}
