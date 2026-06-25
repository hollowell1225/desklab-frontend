import assert from 'node:assert/strict';
import test from 'node:test';

import {
  commitNumericInput,
  formatNumericInputValue,
  parseLiveNumericInput,
} from '../src/domain/property-numbers.js';

test('formats finite numeric property values without noisy trailing decimals', () => {
  assert.equal(formatNumericInputValue(12.3456, 2), '12.35');
  assert.equal(formatNumericInputValue(12, 3), '12');
  assert.equal(formatNumericInputValue(null, 3), '');
  assert.equal(formatNumericInputValue(Number.NaN, 3), '');
});

test('accepts live numeric edits only inside configured bounds', () => {
  assert.equal(parseLiveNumericInput('42.5'), 42.5);
  assert.equal(parseLiveNumericInput('-2.5'), -2.5);
  assert.equal(parseLiveNumericInput('0', { min: 0 }), 0);
  assert.equal(parseLiveNumericInput('360', { min: 0, max: 360 }), 360);

  assert.equal(parseLiveNumericInput('', { min: 0 }), null);
  assert.equal(parseLiveNumericInput('-', { min: 0 }), null);
  assert.equal(parseLiveNumericInput('-1', { min: 0 }), null);
  assert.equal(parseLiveNumericInput('361', { min: 0, max: 360 }), null);
  assert.equal(parseLiveNumericInput('1e', { min: 0 }), null);
});

test('commits numeric edits by clamping to configured bounds', () => {
  assert.equal(commitNumericInput('-5', { min: 0 }), 0);
  assert.equal(commitNumericInput('400', { min: 0, max: 360 }), 360);
  assert.equal(commitNumericInput('', { min: 0.05 }), 0.05);
  assert.equal(commitNumericInput('2.5'), 2.5);
});
