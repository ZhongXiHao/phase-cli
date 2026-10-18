import { DomainError } from './DomainError.js';

export class InvalidScaleFactorError extends DomainError {
  constructor() {
    super('scale factor must be positive');
  }
}
