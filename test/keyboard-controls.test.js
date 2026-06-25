import test from 'node:test';
import assert from 'node:assert/strict';

import { getObjectKeyboardUpdate } from '../src/domain/keyboard-controls.js';

const object = {
  position: { x: 1, y: 2, z: 3 },
  rotation: { x: 0, y: 0, z: 45 },
};

test('modifier shortcuts never move or rotate the selected object', () => {
  assert.equal(getObjectKeyboardUpdate(object, {
    key: 'Control',
    code: 'ControlLeft',
    ctrlKey: true,
  }), null);
  assert.equal(getObjectKeyboardUpdate(object, {
    key: 'z',
    code: 'KeyZ',
    ctrlKey: true,
  }), null);
});

test('Space and Shift+Space move vertically in opposite directions', () => {
  assert.deepEqual(getObjectKeyboardUpdate(object, {
    key: ' ',
    code: 'Space',
    shiftKey: false,
  }), { position: { x: 1, y: 2, z: 3.1 } });
  assert.deepEqual(getObjectKeyboardUpdate(object, {
    key: ' ',
    code: 'Space',
    shiftKey: true,
  }), { position: { x: 1, y: 2, z: 2.9 } });
});

test('direction and rotation shortcuts keep their existing behavior', () => {
  assert.deepEqual(getObjectKeyboardUpdate(object, {
    key: 'ArrowLeft',
    code: 'ArrowLeft',
  }), { position: { x: 1.1, y: 2, z: 3 } });
  assert.deepEqual(getObjectKeyboardUpdate(object, {
    key: 'e',
    code: 'KeyE',
  }), { rotation: { z: 30 } });
});
