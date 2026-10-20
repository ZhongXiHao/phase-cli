import type { ShapeView } from './shape/ShapeView.js';

export interface DocumentView {
  readonly width: number;
  readonly height: number;
  readonly root: ShapeView;
}
