import { describe, expect, it } from 'vitest';
import { Circle } from '../../src/model/shape/Circle.js';
import { Ellipse } from '../../src/model/shape/Ellipse.js';
import { Line } from '../../src/model/shape/Line.js';
import { Rect } from '../../src/model/shape/Rect.js';
import type { Shape } from '../../src/model/shape/Shape.js';
import { Text } from '../../src/model/shape/Text.js';

/**
 * 每种叶子图形走同一套检查：几何属性白名单、translate、scale、anchor、状态快照。
 * `geometry` 列出所有可 set 的几何属性及其初始值。
 */
interface Case {
  readonly name: string;
  readonly make: () => Shape;
  readonly geometry: Record<string, number>;
  /** translate(10, 20) 之后应该变化的属性 → 新值 */
  readonly afterTranslate: Record<string, number>;
  /** scale(2) 之后的全部几何属性 */
  readonly afterScale: Record<string, number>;
  readonly anchor: [number, number];
}

const CASES: Case[] = [
  {
    name: 'rect',
    make: () => new Rect('s', 1, 2, 3, 4),
    geometry: { x: 1, y: 2, width: 3, height: 4 },
    afterTranslate: { x: 11, y: 22 },
    afterScale: { x: 2, y: 4, width: 6, height: 8 },
    anchor: [1, 2],
  },
  {
    name: 'circle',
    make: () => new Circle('s', 1, 2, 3),
    geometry: { cx: 1, cy: 2, r: 3 },
    afterTranslate: { cx: 11, cy: 22 },
    afterScale: { cx: 2, cy: 4, r: 6 },
    anchor: [1, 2],
  },
  {
    name: 'ellipse',
    make: () => new Ellipse('s', 1, 2, 3, 4),
    geometry: { cx: 1, cy: 2, rx: 3, ry: 4 },
    afterTranslate: { cx: 11, cy: 22 },
    afterScale: { cx: 2, cy: 4, rx: 6, ry: 8 },
    anchor: [1, 2],
  },
  {
    name: 'line',
    make: () => new Line('s', 1, 2, 3, 4),
    geometry: { x1: 1, y1: 2, x2: 3, y2: 4 },
    afterTranslate: { x1: 11, y1: 22, x2: 13, y2: 24 },
    afterScale: { x1: 2, y1: 4, x2: 6, y2: 8 },
    anchor: [1, 2],
  },
  {
    name: 'text',
    make: () => new Text('s', 1, 2, 'hi'),
    geometry: { x: 1, y: 2 },
    afterTranslate: { x: 11, y: 22 },
    afterScale: { x: 2, y: 4 },
    anchor: [1, 2],
  },
];

/** 读出某个几何属性的当前值（经由公开的 attributes()，不依赖具体类的 getter）。 */
function read(shape: Shape): Record<string, number> {
  const values: Record<string, number> = {};
  for (const [name, value] of shape.attributes()) {
    if (name !== 'id' && !['fill', 'stroke', 'stroke-width'].includes(name)) {
      values[name] = Number(value);
    }
  }
  return values;
}

describe.each(CASES)('$name', ({ make, geometry, afterTranslate, afterScale, anchor }) => {
  it('exposes exactly its geometry attributes, in order, after id', () => {
    const shape = make();
    expect(shape.attributes().map(([name]) => name)).toEqual(['id', ...Object.keys(geometry)]);
    expect(read(shape)).toEqual(geometry);
  });

  it('every geometry attribute can be set; others are unknown', () => {
    for (const name of Object.keys(geometry)) {
      const shape = make();
      shape.setAttribute(name, '42.5');
      expect(read(shape)[name], name).toBe(42.5);
      expect(() => shape.setAttribute(name, 'abc'), name).toThrow('invalid number: abc');
      expect(read(shape)[name], `${name} unchanged after bad value`).toBe(42.5);
    }
    expect(() => make().setAttribute('nope', '1')).toThrow('unknown attribute: nope');
  });

  it('translate shifts position only', () => {
    const shape = make();
    shape.translate(10, 20);
    expect(read(shape)).toEqual({ ...geometry, ...afterTranslate });
  });

  it('scale multiplies every geometry attribute', () => {
    const shape = make();
    shape.scale(2);
    expect(read(shape)).toEqual(afterScale);
  });

  it('anchor is the reference point reported by move', () => {
    expect(make().anchor()).toEqual(anchor);
  });

  it('captureState / restoreState bring back geometry and style exactly', () => {
    const shape = make();
    const before = shape.captureState();
    shape.translate(0.1, 0.3);
    shape.scale(0.7);
    shape.setAttribute('fill', 'red');
    shape.setAttribute('stroke', 'blue');
    shape.setAttribute('stroke-width', '9');
    shape.restoreState(before);
    expect(read(shape)).toEqual(geometry);
    expect([shape.fill, shape.stroke, shape.strokeWidth]).toEqual([undefined, undefined, undefined]);
  });

  it('is a leaf: not a container, parent starts null', () => {
    const shape = make();
    expect(shape.isContainer).toBe(false);
    expect(shape.parent).toBeNull();
    expect(shape.label()).toBe(`${shape.kind}#s`);
  });
});

describe('details() per type matches the spec `show` layout', () => {
  it('rect / ellipse / line use SVG attribute names, one geometry line then one style line', () => {
    expect(new Rect('r', 1, 2, 3, 4, { fill: '#eee' }).details()).toEqual(['x=1 y=2 width=3 height=4', 'fill=#eee']);
    expect(new Ellipse('e', 1, 2, 3, 4).details()).toEqual(['cx=1 cy=2 rx=3 ry=4']);
    expect(new Line('l', 0, 0, 5, 5, { stroke: 'black', strokeWidth: 2 }).details()).toEqual([
      'x1=0 y1=0 x2=5 y2=5',
      'stroke=black stroke-width=2',
    ]);
  });
});
