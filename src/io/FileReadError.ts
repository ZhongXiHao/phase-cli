import { DomainError } from '../model/errors/DomainError.js';

export class FileReadError extends DomainError {
  constructor(readonly path: string) {
    super(`cannot read file: ${path}`);
  }
}
