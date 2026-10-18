import { DomainError } from './DomainError.js';

export class InvalidCanvasSizeError extends DomainError {
  constructor() {
    super('canvas size must be positive');
  }
}
