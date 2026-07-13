import test from 'node:test';
import assert from 'node:assert/strict';

import { isGenericModelLayoutWithinBounds } from '../src/domain/generic-model-layouts.js';

test('generic l-desk layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('l-desk'), true);
});
