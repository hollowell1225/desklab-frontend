export function getObjectKeyboardUpdate(object, event, step = 0.1) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;

  const position = object?.position;
  if (!position) return null;
  const { x, y, z } = position;
  if (event.key === 'ArrowLeft') return { position: { x: x + step, y, z } };
  if (event.key === 'ArrowRight') return { position: { x: x - step, y, z } };
  if (event.key === 'ArrowUp') return { position: { x, y: y + step, z } };
  if (event.key === 'ArrowDown') return { position: { x, y: y - step, z } };
  if (event.code === 'Space') {
    return { position: { x, y, z: z + (event.shiftKey ? -step : step) } };
  }

  const key = event.key.toLowerCase();
  const rotationZ = object.rotation?.z || 0;
  if (key === 'q') return { rotation: { z: (rotationZ + 15) % 360 } };
  if (key === 'e') return { rotation: { z: (rotationZ - 15 + 360) % 360 } };
  return null;
}
