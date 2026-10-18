import { describe, expect, it } from 'vitest';
import { Document } from '../../src/model/Document.js';
import { Group } from '../../src/model/Group.js';
import { Rect } from '../../src/model/Rect.js';
import { ShapeFactory } from '../../src/model/ShapeFactory.js';
import { IdAlreadyExistsError } from '../../src/model/errors/IdAlreadyExistsError.js';
import { InvalidArgumentsError } from '../../src/model/errors/InvalidArgumentsError.js';
import { InvalidCanvasSizeError } from '../../src/model/errors/InvalidCanvasSizeError.js';
import { InvalidNumberError } from '../../src/model/errors/InvalidNumberError.js';
import { NoSuchContainerError } from '../../src/model/errors/NoSuchContainerError.js';
import { NoSuchShapeError } from '../../src/model/errors/NoSuchShapeError.js';
import { NotAContainerError } from '../../src/model/errors/NotAContainerError.js';
import { UnknownShapeTypeError } from '../../src/model/errors/UnknownShapeTypeError.js';

describe('Document', () => {
  function sample(): Document {
    const doc = new Document(800, 600);
    const markers = new Group('markers');
    doc.root.insertChild(new Rect('bg', 0, 0, 800, 600));
    doc.root.insertChild(markers);
    markers.insertChild(new Rect('box', 200, 80, 60, 60));
    return doc;
  }

  it('defaults to 800x600', () => {
    const doc = new Document();
    expect([doc.width, doc.height]).toEqual([800, 600]);
  });

  it('find searches nested shapes, never the canvas root', () => {
    const doc = sample();
    expect(doc.find('box').id).toBe('box');
    expect(doc.find('markers').isContainer).toBe(true);
    expect(() => doc.find('svg')).toThrow(NoSuchShapeError);
    expect(() => doc.find('r9')).toThrow('no such shape: r9');
  });

  it('is case sensitive', () => {
    expect(() => sample().find('BG')).toThrow(NoSuchShapeError);
  });

  it('findContainer distinguishes missing from not-a-container', () => {
    const doc = sample();
    expect(doc.findContainer('markers').id).toBe('markers');
    expect(() => doc.findContainer('node9')).toThrow(new NoSuchContainerError('node9'));
    expect(() => doc.findContainer('bg')).toThrow(new NotAContainerError('bg'));
    expect(() => doc.findContainer('bg')).toThrow('not a container: bg');
  });

  it('assertIdFree rejects duplicates anywhere in the tree', () => {
    const doc = sample();
    expect(() => doc.assertIdFree('box')).toThrow(IdAlreadyExistsError);
    expect(() => doc.assertIdFree('box')).toThrow('id already exists: box');
    expect(() => doc.assertIdFree('fresh')).not.toThrow();
  });

  it('elementCount excludes the svg root and counts containers', () => {
    expect(sample().elementCount()).toBe(3);
  });

  it('allShapes is pre-order', () => {
    expect(sample().allShapes().map((s) => s.id)).toEqual(['bg', 'markers', 'box']);
  });

  it('isTopLevel', () => {
    const doc = sample();
    expect(doc.isTopLevel(doc.find('markers'))).toBe(true);
    expect(doc.isTopLevel(doc.find('box'))).toBe(false);
  });

  it('resize validates', () => {
    const doc = sample();
    doc.resize(400, 300);
    expect([doc.width, doc.height]).toEqual([400, 300]);
    expect(() => doc.resize(0, 10)).toThrow(InvalidCanvasSizeError);
    expect(() => doc.resize(10, -1)).toThrow(InvalidCanvasSizeError);
    expect([doc.width, doc.height]).toEqual([400, 300]);
  });

  it('root presents as `svg`', () => {
    const doc = sample();
    expect(doc.root.label()).toBe('svg');
    expect(doc.root.canUngroup()).toBe(false);
    expect(doc.find('bg').parent?.label()).toBe('svg');
  });
});

describe('ShapeFactory', () => {
  const factory = ShapeFactory.withBuiltIns();

  it('creates each built-in type from CLI positional arguments', () => {
    expect(factory.create('rect', 'r1', ['10', '20', '100', '50', '#eee']).attributes()).toEqual([
      ['id', 'r1'],
      ['x', '10'],
      ['y', '20'],
      ['width', '100'],
      ['height', '50'],
      ['fill', '#eee'],
    ]);
    expect(factory.create('circle', 'c1', ['100', '100', '20', 'red']).describe()).toBe('cx=100 cy=100 r=20 fill=red');
    expect(factory.create('ellipse', 'e1', ['1', '2', '3', '4']).describe()).toBe('cx=1 cy=2 rx=3 ry=4');
    expect(factory.create('line', 'l1', ['0', '0', '5', '5', 'black']).stroke).toBe('black');
    expect(factory.create('text', 't1', ['20', '40', 'My Diagram']).textContent()).toBe('My Diagram');
    expect(factory.create('g', 'scene', []).isContainer).toBe(true);
  });

  it('optional trailing parameter may be omitted', () => {
    expect(factory.create('rect', 'r', ['0', '0', '1', '1']).fill).toBeUndefined();
  });

  it('wrong argument count reports usage', () => {
    expect(() => factory.create('rect', 'r', ['0', '0', '1'])).toThrow(InvalidArgumentsError);
    expect(() => factory.create('rect', 'r', ['0', '0', '1'])).toThrow('usage: create rect <id> <x> <y> <w> <h> [fill]');
    expect(() => factory.create('rect', 'r', ['0', '0', '1', '1', 'red', 'extra'])).toThrow(InvalidArgumentsError);
    expect(() => factory.create('g', 'g', ['x'])).toThrow('usage: create g <id>');
  });

  it('non-numeric coordinate is rejected', () => {
    expect(() => factory.create('circle', 'c', ['a', '0', '1'])).toThrow(InvalidNumberError);
  });

  it('unknown type', () => {
    expect(() => factory.create('hexagon', 'h', [])).toThrow(UnknownShapeTypeError);
    expect(() => factory.create('hexagon', 'h', [])).toThrow('unknown shape type: hexagon (is the plugin loaded?)');
    expect(() => factory.create('box', 'b', [])).toThrow('unknown shape type: box');
  });

  it('creates from SVG attributes; missing numbers default to 0, style attributes are read', () => {
    const attrs = new Map([
      ['width', '10'],
      ['height', '5'],
      ['fill', '#fff'],
      ['stroke-width', '2'],
    ]);
    const rect = factory.createFromAttributes('rect', 'r', attrs);
    expect(rect.describe()).toBe('x=0 y=0 w=10 h=5 fill=#fff');
    expect(rect.strokeWidth).toBe(2);
    const g = factory.createFromAttributes('g', 'g1', new Map([['transform', 'translate(1,2)']]));
    expect(g.attributes()).toEqual([
      ['id', 'g1'],
      ['transform', 'translate(1,2)'],
    ]);
  });

  it('register is the extension point and rejects duplicates', () => {
    const custom = ShapeFactory.withBuiltIns();
    expect(custom.has('rect')).toBe(true);
    expect(custom.has('box')).toBe(false);
    expect(() => custom.register(Group.spec())).toThrow('already registered');
  });
});

describe('Document construction', () => {
  it('rejects a non-positive canvas size', () => {
    expect(() => new Document(0, 600)).toThrow(InvalidCanvasSizeError);
    expect(() => new Document(800, -1)).toThrow('canvas size must be positive');
  });
});
