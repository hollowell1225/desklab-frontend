const GENERIC_L_DESK_LAYOUT = Object.freeze({
  tops: Object.freeze([
    Object.freeze({ x: -0.1, z: -0.18, width: 0.76, depth: 0.58 }),
    Object.freeze({ x: 0.3, z: 0.14, width: 0.38, depth: 0.72 }),
  ]),
  legs: Object.freeze([
    Object.freeze({ x: -0.4, z: -0.4, width: 0.09, depth: 0.09 }),
    Object.freeze({ x: 0.08, z: -0.4, width: 0.09, depth: 0.09 }),
    Object.freeze({ x: 0.42, z: 0.39, width: 0.09, depth: 0.09 }),
    Object.freeze({ x: 0.16, z: 0.39, width: 0.09, depth: 0.09 }),
  ]),
  cableTrays: Object.freeze([
    Object.freeze({ x: -0.1, z: -0.43, width: 0.5472, depth: 0.08 }),
    Object.freeze({ x: 0.3, z: 0.45, width: 0.2736, depth: 0.07 }),
  ]),
});

const GENERIC_MODEL_LAYOUT_BY_MODEL_ID = Object.freeze({
  'l-desk': GENERIC_L_DESK_LAYOUT,
});

export function getGenericModelLayout(modelId) {
  return GENERIC_MODEL_LAYOUT_BY_MODEL_ID[modelId] || null;
}

export function isGenericModelLayoutWithinBounds(modelId) {
  const layout = getGenericModelLayout(modelId);
  if (!layout) return false;

  return [...layout.tops, ...layout.legs, ...layout.cableTrays].every(part => (
    Math.abs(part.x) + part.width / 2 <= 0.5
    && Math.abs(part.z) + part.depth / 2 <= 0.5
  ));
}
