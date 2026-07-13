import test from 'node:test';
import assert from 'node:assert/strict';

import { isGenericModelLayoutWithinBounds } from '../src/domain/generic-model-layouts.js';

test('generic l-desk layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('l-desk'), true);
});

test('generic standing desk layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('standing-desk'), true);
});

test('generic office desk layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('office-desk'), true);
});
