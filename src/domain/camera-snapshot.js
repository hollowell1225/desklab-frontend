export function captureCameraSnapshot(camera, controls, fallback = null) {
  const live = camera && controls
    ? {
        position: {
          x: camera.position?.x,
          y: camera.position?.y,
          z: camera.position?.z,
        },
        target: {
          x: controls.target?.x,
          y: controls.target?.y,
          z: controls.target?.z,
        },
      }
    : null;

  if (isValidCamera(live)) return live;
  return isValidCamera(fallback) ? cloneCamera(fallback) : null;
}

export function createCameraPoseSynchronizer() {
  let lastCameraConfig = Symbol('unapplied-camera-config');
  let lastCamera = null;
  let lastControls = null;

  return {
    sync({ cameraConfig, room, camera, controls }) {
      if (cameraConfig === undefined || !camera || !controls) return false;
      if (cameraConfig === lastCameraConfig
        && camera === lastCamera
        && controls === lastControls) {
        return false;
      }
      const pose = cameraConfig || {
        position: { x: 0, y: room.height * 1.8, z: -room.width * 1.6 },
        target: { x: 0, y: room.height / 2, z: 0 },
      };
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      controls.target.set(pose.target.x, pose.target.y, pose.target.z);
      controls.update();
      lastCameraConfig = cameraConfig;
      lastCamera = camera;
      lastControls = controls;
      return true;
    },
  };
}

function isValidCamera(camera) {
  return isFiniteVector(camera?.position) && isFiniteVector(camera?.target);
}

function isFiniteVector(vector) {
  return vector && ['x', 'y', 'z'].every(axis => Number.isFinite(vector[axis]));
}

function cloneCamera(camera) {
  return {
    position: { ...camera.position },
    target: { ...camera.target },
  };
}
