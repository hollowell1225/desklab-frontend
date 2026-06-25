import test from 'node:test';
import assert from 'node:assert/strict';

import {
  captureCameraSnapshot,
  createCameraPoseSynchronizer,
} from '../src/domain/camera-snapshot.js';

test('preserves the loaded camera when live canvas controls are unavailable', () => {
  const fallback = {
    position: { x: 1, y: 5, z: -6 },
    target: { x: 0, y: 1.5, z: 0 },
  };

  const snapshot = captureCameraSnapshot(null, null, fallback);
  assert.deepEqual(snapshot, fallback);
  assert.notEqual(snapshot, fallback);
  assert.notEqual(snapshot.position, fallback.position);
  assert.notEqual(snapshot.target, fallback.target);
});

test('prefers finite live camera values over the loaded fallback', () => {
  const snapshot = captureCameraSnapshot(
    { position: { x: 2, y: 6, z: -7 } },
    { target: { x: 1, y: 2, z: 3 } },
    {
      position: { x: 0, y: 5, z: -6 },
      target: { x: 0, y: 1.5, z: 0 },
    }
  );

  assert.deepEqual(snapshot, {
    position: { x: 2, y: 6, z: -7 },
    target: { x: 1, y: 2, z: 3 },
  });
});

test('room changes do not overwrite a camera pose the user has moved', () => {
  const cameraPosition = createMutableVector();
  const controlsTarget = createMutableVector();
  const camera = { position: cameraPosition };
  const controls = { target: controlsTarget, update() {} };
  const loadedCamera = {
    position: { x: 1, y: 5, z: -6 },
    target: { x: 0, y: 1.5, z: 0 },
  };
  const synchronizer = createCameraPoseSynchronizer();

  synchronizer.sync({
    cameraConfig: loadedCamera,
    room: { length: 5, width: 4, height: 3 },
    camera,
    controls,
  });
  cameraPosition.set(8, 7, -9);
  controlsTarget.set(2, 1, 3);

  synchronizer.sync({
    cameraConfig: loadedCamera,
    room: { length: 8, width: 6, height: 4 },
    camera,
    controls,
  });

  assert.deepEqual(vectorValues(cameraPosition), { x: 8, y: 7, z: -9 });
  assert.deepEqual(vectorValues(controlsTarget), { x: 2, y: 1, z: 3 });
});

const vectorValues = vector => ({ x: vector.x, y: vector.y, z: vector.z });

function createMutableVector() {
  return {
    x: 0,
    y: 0,
    z: 0,
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    },
  };
}
