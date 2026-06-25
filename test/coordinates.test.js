import test from 'node:test';
import assert from 'node:assert/strict';

import { toThreePosition, toThreeZRotation } from '../src/domain/coordinates.js';

test('maps DeskLab XYZ to Three.js XZY coordinates', () => {
  assert.deepEqual(toThreePosition({ x: 1, y: 2, z: 3 }), [1, 3, 2]);
});

test('reverses Z rotation sign after the handedness-changing XZY mapping', () => {
  assert.deepEqual(toThreeZRotation(90), [0, -Math.PI / 2, 0]);
  assert.deepEqual(toThreeZRotation(-45), [0, Math.PI / 4, 0]);
  assert.deepEqual(toThreeZRotation(Number.NaN), [0, -0, 0]);
});
