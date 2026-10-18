import { DomainError } from './DomainError.js';

export class UnknownShapeTypeError extends DomainError {
  constructor(readonly type: string) {
    super(`unknown shape type: ${type} (is the plugin loaded?)`);
  }
}
