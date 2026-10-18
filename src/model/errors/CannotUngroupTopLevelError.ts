import { DomainError } from './DomainError.js';

export class CannotUngroupTopLevelError extends DomainError {
  constructor(readonly id: string) {
    super(`cannot ungroup top-level container: ${id}`);
  }
}
