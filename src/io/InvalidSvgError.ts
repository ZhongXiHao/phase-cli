import { DomainError } from '../model/errors/DomainError.js';

export class InvalidSvgError extends DomainError {
  constructor(reason: string) {
    super(`invalid svg: ${reason}`);
  }
}
