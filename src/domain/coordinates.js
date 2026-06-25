export function toThreePosition(position) {
  return [position.x, position.z, position.y];
}

export function toThreeZRotation(rotationZDegrees = 0) {
  const degrees = Number.isFinite(rotationZDegrees) ? rotationZDegrees : 0;
  return [0, -degrees * Math.PI / 180, 0];
}
