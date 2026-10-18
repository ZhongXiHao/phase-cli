import { DomainError } from './DomainError.js';

export class NotAContainerError extends DomainError {
  constructor(readonly id: string) {
    super(`not a container: ${id}`);
  }
}
