import { DomainError } from './DomainError.js';

export class CannotUngroupCompositeError extends DomainError {
  constructor(readonly id: string) {
    super(`cannot ungroup composite shape: ${id}`);
  }
}
