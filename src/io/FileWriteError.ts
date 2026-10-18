import { DomainError } from '../model/errors/DomainError.js';

export class FileWriteError extends DomainError {
  constructor(readonly path: string) {
    super(`cannot write file: ${path}`);
  }
}
