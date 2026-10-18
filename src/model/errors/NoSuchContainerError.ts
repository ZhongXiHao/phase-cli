import { DomainError } from './DomainError.js';

export class NoSuchContainerError extends DomainError {
  constructor(readonly id: string) {
    super(`no such container: ${id}`);
  }
}
