import test from 'node:test';
import assert from 'node:assert/strict';

import { createEntityId } from '../src/domain/identifiers.js';

test('creates collision-resistant ids with a stable entity prefix', () => {
  const ids = Array.from({ length: 50 }, () => createEntityId('connection'));

  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => id.startsWith('connection-')));
});

test('normalizes unsafe prefix characters', () => {
  const id = createEntityId('Desk / Item');

  assert.match(id, /^desk-item-/);
});
