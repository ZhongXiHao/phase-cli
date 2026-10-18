import { describe, expect, it } from 'vitest';
import { Circle } from '../../src/model/Circle.js';
import { Ellipse } from '../../src/model/Ellipse.js';
import { Group } from '../../src/model/Group.js';
import { Line } from '../../src/model/Line.js';
import { Rect } from '../../src/model/Rect.js';
import { Text } from '../../src/model/Text.js';
import { InvalidNumberError } from '../../src/model/errors/InvalidNumberError.js';
import { InvalidScaleFactorError } from '../../src/model/errors/InvalidScaleFactorError.js';
import { NotAContainerError } from '../../src/model/errors/NotAContainerError.js';
import { UnknownAttributeError } from '../../src/model/errors/UnknownAttributeError.js';

describe('leaf shapes', () => {
  it('rect: translate, scale (position and size), describe', () => {
    const r = new Rect('r1', 10, 20, 100, 50, { fill: '#eee' });
    r.translate(5, -5);
    expect([r.x, r.y]).toEqual([15, 15]);
    r.scale(2);
    expect([r.x, r.y, r.width, r.height]).toEqual([30, 30, 200, 100]);
    expect(r.describe()).toBe('x=30 y=30 w=200 h=100 fill=#eee');
  });

  it('describe omits fill when unset', () => {
    expect(new Rect('r', 0, 0, 1, 2).describe()).toBe('x=0 y=0 w=1 h=2');
    expect(new Circle('c', 100, 100, 20, { fill: 'red' }).describe()).toBe('cx=100 cy=100 r=20 fill=red');
    expect(new Ellipse('e', 1, 2, 3, 4).describe()).toBe('cx=1 cy=2 rx=3 ry=4');
  });

  it('line describes endpoints only; text describes position and content', () => {
    expect(new Line('l', 280, 130, 520, 130, { stroke: 'black' }).describe()).toBe('(280,130) -> (520,130)');
    expect(new Text('t', 20, 40, 'My Diagram').describe()).toBe('(20,40) "My Diagram"');
  });

  it('scale only touches geometry, not stroke-width', () => {
    const c = new Circle('c', 10, 10, 5, { strokeWidth: 2 });
    c.scale(3);
    expect([c.cx, c.cy, c.r, c.strokeWidth]).toEqual([30, 30, 15, 2]);
  });

  it('rejects non-positive scale factors before changing anything', () => {
    const r = new Rect('r', 1, 1, 1, 1);
    expect(() => r.scale(0)).toThrow(InvalidScaleFactorError);
    expect(() => r.scale(-2)).toThrow('scale factor must be positive');
    expect(() => r.scale(Number.NaN)).toThrow(InvalidScaleFactorError);
    expect([r.x, r.y, r.width, r.height]).toEqual([1, 1, 1, 1]);
  });

  it('setAttribute: whitelist per type, plus fill/stroke/stroke-width', () => {
    const r = new Rect('r', 0, 0, 1, 1);
    r.setAttribute('width', '42.5');
    r.setAttribute('fill', 'blue');
    r.setAttribute('stroke', 'red');
    r.setAttribute('stroke-width', '3');
    expect([r.width, r.fill, r.stroke, r.strokeWidth]).toEqual([42.5, 'blue', 'red', 3]);
    expect(() => r.setAttribute('r', '5')).toThrow(new UnknownAttributeError('r'));
    expect(() => r.setAttribute('bogus', '5')).toThrow('unknown attribute: bogus');
  });

  it('setAttribute: invalid value changes nothing', () => {
    const r = new Rect('r', 0, 0, 1, 1);
    expect(() => r.setAttribute('x', 'abc')).toThrow(InvalidNumberError);
    expect(() => r.setAttribute('stroke-width', 'thick')).toThrow(InvalidNumberError);
    expect(() => r.setAttribute('fill', '')).toThrow('invalid value for fill');
    expect(r.x).toBe(0);
    expect(r.strokeWidth).toBeUndefined();
    expect(r.fill).toBeUndefined();
  });

  it('text: "text" attribute sets content and shows in textContent/details', () => {
    const t = new Text('t', 1, 2, 'a');
    t.setAttribute('text', 'b c');
    expect(t.content).toBe('b c');
    expect(t.textContent()).toBe('b c');
    t.setAttribute('fill', 'red');
    expect(t.details()).toEqual(['x=1 y=2', 'text="b c"', 'fill=red']);
    expect(new Rect('r', 0, 0, 1, 1).textContent()).toBeNull();
  });

  it('attributes(): id first, then geometry, then style, SVG names', () => {
    const r = new Rect('r1', 10, 20, 100, 50, { fill: '#eee', stroke: 'black', strokeWidth: 2 });
    expect(r.attributes()).toEqual([
      ['id', 'r1'],
      ['x', '10'],
      ['y', '20'],
      ['width', '100'],
      ['height', '50'],
      ['fill', '#eee'],
      ['stroke', 'black'],
      ['stroke-width', '2'],
    ]);
  });

  it('details(): geometry line then style line (matches `show` sample)', () => {
    expect(new Circle('c1', 100, 100, 20, { fill: 'red' }).details()).toEqual(['cx=100 cy=100 r=20', 'fill=red']);
    expect(new Circle('c1', 100, 100, 20).details()).toEqual(['cx=100 cy=100 r=20']);
  });

  it('number formatting hides float noise and negative zero', () => {
    const r = new Rect('r', 0.1, 0.2, 1, 1);
    r.translate(0.2, 0.1);
    expect(r.describe()).toBe('x=0.3 y=0.3 w=1 h=1');
    const z = new Rect('z', -0, 0, 1, 1);
    expect(z.describe()).toBe('x=0 y=0 w=1 h=1');
  });

  it('leaf is not a container', () => {
    const r = new Rect('r', 0, 0, 1, 1);
    expect(r.isContainer).toBe(false);
    expect(r.children()).toEqual([]);
    expect(() => r.insertChild(new Rect('x', 0, 0, 1, 1))).toThrow(NotAContainerError);
    expect(() => r.removeChild(new Rect('x', 0, 0, 1, 1))).toThrow('not a container: r');
    expect(r.canUngroup()).toBe(false);
  });

  it('exact undo: capture/restore gives bit-identical numbers (no 1/f drift)', () => {
    const r = new Rect('r', 0.1, 0.7, 3, 9, { fill: 'red' });
    const before = r.captureState();
    r.scale(0.3);
    r.translate(0.1, 0.2);
    r.setAttribute('fill', 'blue');
    r.setAttribute('stroke-width', '4');
    r.restoreState(before);
    expect([r.x, r.y, r.width, r.height]).toEqual([0.1, 0.7, 3, 9]);
    expect(r.fill).toBe('red');
    expect(r.strokeWidth).toBeUndefined();
  });

  it('restore brings back text content', () => {
    const t = new Text('t', 1, 2, 'old');
    const before = t.captureState();
    t.setAttribute('text', 'new');
    t.restoreState(before);
    expect(t.content).toBe('old');
  });
});

describe('Group (Composite)', () => {
  function sample(): { g: Group; inner: Group; r: Rect; c: Circle; l: Line } {
    const g = new Group('g');
    const inner = new Group('inner');
    const r = new Rect('r', 0, 0, 10, 10);
    const c = new Circle('c', 5, 5, 2);
    const l = new Line('l', 1, 1, 2, 2);
    g.insertChild(r);
    g.insertChild(inner);
    inner.insertChild(c);
    inner.insertChild(l);
    return { g, inner, r, c, l };
  }

  it('maintains parent links and order', () => {
    const { g, inner, r, c } = sample();
    expect(g.children()).toEqual([r, inner]);
    expect(r.parent).toBe(g);
    expect(c.parent).toBe(inner);
    expect(g.indexOf(inner)).toBe(1);
    g.insertChild(new Rect('first', 0, 0, 1, 1), 0);
    expect(g.children().map((s) => s.id)).toEqual(['first', 'r', 'inner']);
  });

  it('removeChild returns the old index and clears the parent', () => {
    const { g, r } = sample();
    expect(g.removeChild(r)).toBe(0);
    expect(r.parent).toBeNull();
    expect(g.children().map((s) => s.id)).toEqual(['inner']);
  });

  it('translate recurses into all descendants', () => {
    const { g, r, c, l } = sample();
    g.translate(10, 100);
    expect([r.x, r.y]).toEqual([10, 100]);
    expect([c.cx, c.cy]).toEqual([15, 105]);
    expect([l.x1, l.y1, l.x2, l.y2]).toEqual([11, 101, 12, 102]);
  });

  it('scale recurses into all descendants', () => {
    const { g, r, c } = sample();
    g.scale(2);
    expect([r.width, r.height]).toEqual([20, 20]);
    expect([c.cx, c.r]).toEqual([10, 4]);
  });

  it('invalid scale factor on a group changes nothing', () => {
    const { g, r } = sample();
    expect(() => g.scale(-1)).toThrow(InvalidScaleFactorError);
    expect(r.width).toBe(10);
  });

  it('style attributes propagate to every descendant; others are unknown', () => {
    const { g, r, c } = sample();
    g.setAttribute('fill', 'green');
    expect([r.fill, c.fill]).toEqual(['green', 'green']);
    expect(() => g.setAttribute('x', '1')).toThrow('unknown attribute: x');
    expect(() => g.setAttribute('stroke-width', 'abc')).toThrow(InvalidNumberError);
    expect(c.strokeWidth).toBeUndefined();
  });

  it('empty group still validates attribute names and values', () => {
    const g = new Group('g');
    expect(() => g.setAttribute('x', '1')).toThrow(UnknownAttributeError);
    expect(() => g.setAttribute('stroke-width', 'abc')).toThrow(InvalidNumberError);
  });

  it('captureState/restoreState round-trips the whole subtree', () => {
    const { g, r, c } = sample();
    const before = g.captureState();
    g.scale(0.37);
    g.translate(3, 4);
    g.setAttribute('fill', 'red');
    g.restoreState(before);
    expect([r.x, r.width, c.cx, c.r]).toEqual([0, 10, 5, 2]);
    expect([r.fill, c.fill]).toEqual([undefined, undefined]);
  });

  it('isDescendantOf', () => {
    const { g, inner, r, c } = sample();
    expect(c.isDescendantOf(g)).toBe(true);
    expect(c.isDescendantOf(inner)).toBe(true);
    expect(r.isDescendantOf(inner)).toBe(false);
    expect(g.isDescendantOf(g)).toBe(false);
  });

  it('rejects inserting a child that already has a parent', () => {
    const { g, c } = sample();
    expect(() => g.insertChild(c)).toThrow();
  });

  it('is a container, can be ungrouped, preserves transform as pass-through attribute', () => {
    const g = new Group('g', 'translate(60,40)');
    expect(g.isContainer).toBe(true);
    expect(g.canUngroup()).toBe(true);
    expect(g.attributes()).toEqual([
      ['id', 'g'],
      ['transform', 'translate(60,40)'],
    ]);
    g.translate(5, 5);
    expect(g.transform).toBe('translate(60,40)');
    expect(g.label()).toBe('g#g');
    expect(g.describe()).toBe('');
  });
});
