import { DomainError } from '../model/errors/DomainError.js';

export class NoFilePathError extends DomainError {
  constructor() {
    super("no file path. use 'save <file.svg>'");
  }
}
