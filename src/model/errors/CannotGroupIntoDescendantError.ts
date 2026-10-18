import { DomainError } from './DomainError.js';

export class CannotGroupIntoDescendantError extends DomainError {
  constructor(readonly id: string) {
    super(`cannot group a container into its own descendant: ${id}`);
  }
}
