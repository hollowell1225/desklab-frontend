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

test('generic gaming desk layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('gaming-desk'), true);
});

test('generic monitor layouts remain inside their catalog footprints', () => {
  for (const modelId of ['monitor-24', 'monitor-27', 'ultrawide-monitor']) {
    assert.equal(isGenericModelLayoutWithinBounds(modelId), true);
  }
});

test('generic desktop PC layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('desktop-pc'), true);
});

test('generic mini PC layout remains inside its catalog footprint', () => {
  assert.equal(isGenericModelLayoutWithinBounds('mini-pc'), true);
});
