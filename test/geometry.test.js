import test from 'node:test';
import assert from 'node:assert/strict';

import {
  boundsOverlap,
  constrainProjectToRoom,
  getObjectBounds,
  getRotatedFootprint,
  horizontalFootprintsOverlap,
  objectsOverlap,
  validateAndConstrainObject,
} from '../src/domain/geometry.js';

const room = { length: 5, width: 4, height: 3 };
const makeObject = (overrides = {}) => ({
  id: 'desk',
  position: { x: 0, y: 0, z: 0.375 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1.4, y: 0.7, z: 0.75 },
  ...overrides,
});

test('rotated footprint swaps rectangular dimensions at 90 degrees', () => {
  assert.deepEqual(getRotatedFootprint({ x: 1.4, y: 0.7 }, 0), { sizeX: 1.4, sizeY: 0.7 });
  assert.deepEqual(getRotatedFootprint({ x: 1.4, y: 0.7 }, 90), { sizeX: 0.7, sizeY: 1.4 });
  assert.deepEqual(getRotatedFootprint({ x: 1.4, y: 0.7 }, 180), { sizeX: 1.4, sizeY: 0.7 });
});

test('boundary constraint uses the rotated footprint and preserves valid values', () => {
  const proposed = makeObject({
    position: { x: 99, y: 99, z: 99 },
    rotation: { x: 0, y: 0, z: 90 },
  });
  const result = validateAndConstrainObject(proposed, room);
  assert.equal(result.valid, true);
  assert.deepEqual(result.object.position, { x: 2.15, y: 1.3, z: 2.625 });
});

test('objects that merely touch are not overlapping', () => {
  const first = getObjectBounds(makeObject({ position: { x: 0, y: 0, z: 0.5 }, scale: { x: 1, y: 1, z: 1 } }));
  const touching = getObjectBounds(makeObject({ position: { x: 1, y: 0, z: 0.5 }, scale: { x: 1, y: 1, z: 1 } }));
  const intersecting = getObjectBounds(makeObject({ position: { x: 0.9, y: 0, z: 0.5 }, scale: { x: 1, y: 1, z: 1 } }));
  assert.equal(boundsOverlap(first, touching), false);
  assert.equal(boundsOverlap(first, intersecting), true);
});

test('rejects zero, negative, and non-finite object dimensions', () => {
  for (const invalidValue of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = validateAndConstrainObject(makeObject({
      scale: { x: invalidValue, y: 1, z: 1 },
    }), room);
    assert.equal(result.valid, false);
    assert.match(result.reason, /大于 0/);
  }
});

test('oriented footprints avoid false overlap warnings for separated rotated objects', () => {
  const first = makeObject({
    position: { x: 0, y: 0, z: 0.1 },
    rotation: { x: 0, y: 0, z: 45 },
    scale: { x: 2, y: 0.2, z: 0.2 },
  });
  const separated = makeObject({
    position: { x: -0.212132, y: 0.212132, z: 0.1 },
    rotation: { x: 0, y: 0, z: 45 },
    scale: { x: 2, y: 0.2, z: 0.2 },
  });
  const intersecting = {
    ...separated,
    position: { x: -0.070711, y: 0.070711, z: 0.1 },
  };

  assert.equal(boundsOverlap(getObjectBounds(first), getObjectBounds(separated)), true);
  assert.equal(horizontalFootprintsOverlap(first, separated), false);
  assert.equal(objectsOverlap(first, separated), false);
  assert.equal(objectsOverlap(first, intersecting), true);
});

test('overlap detection is symmetric regardless of argument order', () => {
  // The wiring/layout analyzers compare each object pair only once, so overlap
  // must not depend on argument order even for differently sized, rotated objects.
  const wide = makeObject({
    position: { x: 0, y: 0, z: 0.1 },
    rotation: { x: 0, y: 0, z: 20 },
    scale: { x: 2, y: 0.4, z: 0.4 },
  });
  const cases = [
    makeObject({ position: { x: 0.3, y: 0.1, z: 0.1 }, rotation: { x: 0, y: 0, z: 70 }, scale: { x: 1, y: 1, z: 0.4 } }),
    makeObject({ position: { x: 2.5, y: 0, z: 0.1 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 0.5, y: 0.5, z: 0.4 } }),
    makeObject({ position: { x: 0, y: 0, z: 5 }, rotation: { x: 0, y: 0, z: 70 }, scale: { x: 1, y: 1, z: 0.4 } }),
  ];

  for (const other of cases) {
    assert.equal(
      objectsOverlap(wide, other),
      objectsOverlap(other, wide),
      `overlap asymmetry for ${JSON.stringify(other.position)}`
    );
    assert.equal(horizontalFootprintsOverlap(wide, other), horizontalFootprintsOverlap(other, wide));
  }
});

test('atomically validates room dimensions and constrains all objects', () => {
  const desk = makeObject({
    name: 'Desk',
    position: { x: 99, y: 99, z: 0.375 },
  });
  const result = constrainProjectToRoom(room, [desk]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.room, room);
  assert.deepEqual(result.objects[0].position, { x: 1.8, y: 1.65, z: 0.375 });

  for (const invalidRoom of [
    { length: 0, width: 4, height: 3 },
    { length: 5, width: Number.NaN, height: 3 },
    { length: 5, width: 4, height: -1 },
  ]) {
    assert.equal(constrainProjectToRoom(invalidRoom, [desk]).valid, false);
  }
});

test('rejects a room resize without returning partially moved objects', () => {
  const result = constrainProjectToRoom(
    { length: 1, width: 1, height: 1 },
    [makeObject({ name: 'Large desk', scale: { x: 1.4, y: 0.7, z: 0.75 } })]
  );
  assert.equal(result.valid, false);
  assert.match(result.reason, /Large desk无法放入新房间/);
  assert.equal(result.room, null);
  assert.equal(result.objects, null);
});
