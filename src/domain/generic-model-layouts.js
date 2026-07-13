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

const GENERIC_STANDING_DESK_LAYOUT = Object.freeze({
  tops: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 1 }),
  ]),
  columns: Object.freeze([
    Object.freeze({ x: -0.3, z: 0, width: 0.1, depth: 0.1 }),
    Object.freeze({ x: 0.3, z: 0, width: 0.1, depth: 0.1 }),
  ]),
  sleeves: Object.freeze([
    Object.freeze({ x: -0.3, z: 0, width: 0.128, depth: 0.128 }),
    Object.freeze({ x: 0.3, z: 0, width: 0.128, depth: 0.128 }),
  ]),
  feet: Object.freeze([
    Object.freeze({ x: -0.3, z: 0, width: 0.24, depth: 0.76 }),
    Object.freeze({ x: 0.3, z: 0, width: 0.24, depth: 0.76 }),
  ]),
  crossbars: Object.freeze([
    Object.freeze({ x: 0, z: -0.34, width: 0.58, depth: 0.1 }),
  ]),
  controlPanels: Object.freeze([
    Object.freeze({ x: 0.32, z: 0.38, width: 0.12, depth: 0.08 }),
  ]),
});

const GENERIC_OFFICE_DESK_LAYOUT = Object.freeze({
  tops: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 1 }),
  ]),
  legs: Object.freeze([
    Object.freeze({ x: -0.42, z: -0.38, width: 0.09, depth: 0.09 }),
    Object.freeze({ x: -0.42, z: 0.38, width: 0.09, depth: 0.09 }),
    Object.freeze({ x: 0.42, z: -0.38, width: 0.09, depth: 0.09 }),
    Object.freeze({ x: 0.42, z: 0.38, width: 0.09, depth: 0.09 }),
  ]),
  cableTrays: Object.freeze([
    Object.freeze({ x: 0, z: -0.42, width: 0.62, depth: 0.08 }),
  ]),
});

const GENERIC_GAMING_DESK_LAYOUT = Object.freeze({
  tops: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 1 }),
  ]),
  legs: Object.freeze([
    Object.freeze({ x: -0.38, z: 0, width: 0.1, depth: 0.1, rotation: -0.1 }),
    Object.freeze({ x: 0.38, z: 0, width: 0.1, depth: 0.1, rotation: 0.1 }),
  ]),
  crossbars: Object.freeze([
    Object.freeze({ x: 0, z: -0.28, width: 0.72, depth: 0.1 }),
  ]),
  shelves: Object.freeze([
    Object.freeze({ x: 0, z: -0.32, width: 0.48, depth: 0.22 }),
  ]),
});

const GENERIC_MONITOR_LAYOUT = Object.freeze({
  panels: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 0.45 }),
  ]),
  screens: Object.freeze([
    Object.freeze({ x: 0, z: 0.24, width: 0.82, depth: 0.12 }),
  ]),
  rearHousings: Object.freeze([
    Object.freeze({ x: 0, z: -0.33, width: 0.52, depth: 0.24 }),
  ]),
  stands: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 0.12, depth: 0.52 }),
  ]),
  bases: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 0.42, depth: 0.92 }),
  ]),
});

const GENERIC_DESKTOP_PC_LAYOUT = Object.freeze({
  bodies: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 1 }),
  ]),
  frontPanels: Object.freeze([
    Object.freeze({ x: 0, z: 0.48, width: 0.82, depth: 0.04 }),
  ]),
  fanVents: Object.freeze([
    Object.freeze({ x: 0, z: 0.475, width: 0.44, depth: 0.05 }),
  ]),
  powerButtons: Object.freeze([
    Object.freeze({ x: -0.24, z: 0.475, width: 0.14, depth: 0.05 }),
  ]),
  statusLights: Object.freeze([
    Object.freeze({ x: -0.24, z: 0.487, width: 0.044, depth: 0.022 }),
  ]),
  frontPorts: Object.freeze([
    Object.freeze({ x: 0.18, z: 0.475, width: 0.16, depth: 0.05 }),
    Object.freeze({ x: 0.18, z: 0.475, width: 0.16, depth: 0.05 }),
  ]),
});

const GENERIC_MINI_PC_LAYOUT = Object.freeze({
  bodies: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 1 }),
  ]),
  topVents: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 0.56, depth: 0.56 }),
  ]),
  powerButtons: Object.freeze([
    Object.freeze({ x: -0.3, z: 0.48, width: 0.08666666666666667, depth: 0.04 }),
  ]),
  statusLights: Object.freeze([
    Object.freeze({ x: -0.3, z: 0.484, width: 0.023333333333333334, depth: 0.023333333333333334 }),
  ]),
  frontPorts: Object.freeze([
    Object.freeze({ x: 0.03, z: 0.48, width: 0.18, depth: 0.04 }),
    Object.freeze({ x: 0.3, z: 0.48, width: 0.18, depth: 0.04 }),
  ]),
});

const GENERIC_POWER_ADAPTER_LAYOUT = Object.freeze({
  bodies: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 1 }),
  ]),
  labels: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 0.58, depth: 0.52 }),
  ]),
  acPins: Object.freeze([
    Object.freeze({ x: -0.22, z: 0.32, width: 0.12, depth: 0.36 }),
    Object.freeze({ x: 0.22, z: 0.32, width: 0.12, depth: 0.36 }),
  ]),
  dcStrainReliefs: Object.freeze([
    Object.freeze({ x: 0, z: -0.38, width: 0.138, depth: 0.24 }),
  ]),
});

const GENERIC_WALL_OUTLET_LAYOUT = Object.freeze({
  bodies: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 1 }),
  ]),
  faceplates: Object.freeze([
    Object.freeze({ x: 0, z: 0.47, width: 0.82, depth: 0.06 }),
  ]),
  slots: Object.freeze([
    Object.freeze({ x: -0.14, z: 0.48, width: 0.08, depth: 0.04 }),
    Object.freeze({ x: 0.14, z: 0.48, width: 0.08, depth: 0.04 }),
    Object.freeze({ x: -0.14, z: 0.48, width: 0.08, depth: 0.04 }),
    Object.freeze({ x: 0.14, z: 0.48, width: 0.08, depth: 0.04 }),
  ]),
  fasteners: Object.freeze([
    Object.freeze({ x: 0, z: 0.48, width: 0.07, depth: 0.04 }),
  ]),
});

const GENERIC_NAS_LAYOUT = Object.freeze({
  bodies: Object.freeze([
    Object.freeze({ x: 0, z: 0, width: 1, depth: 1 }),
  ]),
  frontPanels: Object.freeze([
    Object.freeze({ x: 0, z: 0.47, width: 0.88, depth: 0.06 }),
  ]),
  driveBays: Object.freeze([
    Object.freeze({ x: -0.23, z: 0.445, width: 0.34, depth: 0.05 }),
    Object.freeze({ x: 0.23, z: 0.445, width: 0.34, depth: 0.05 }),
  ]),
  driveHandles: Object.freeze([
    Object.freeze({ x: -0.23, z: 0.485, width: 0.18, depth: 0.025 }),
    Object.freeze({ x: 0.23, z: 0.485, width: 0.18, depth: 0.025 }),
  ]),
  statusLights: Object.freeze([
    Object.freeze({ x: -0.27, z: 0.48, width: 0.07, depth: 0.03652173913043478 }),
    Object.freeze({ x: -0.12, z: 0.48, width: 0.07, depth: 0.03652173913043478 }),
  ]),
});

const GENERIC_MODEL_LAYOUT_BY_MODEL_ID = Object.freeze({
  'l-desk': GENERIC_L_DESK_LAYOUT,
  'standing-desk': GENERIC_STANDING_DESK_LAYOUT,
  'office-desk': GENERIC_OFFICE_DESK_LAYOUT,
  'gaming-desk': GENERIC_GAMING_DESK_LAYOUT,
  'monitor-24': GENERIC_MONITOR_LAYOUT,
  'monitor-27': GENERIC_MONITOR_LAYOUT,
  'ultrawide-monitor': GENERIC_MONITOR_LAYOUT,
  'desktop-pc': GENERIC_DESKTOP_PC_LAYOUT,
  'mini-pc': GENERIC_MINI_PC_LAYOUT,
  'power-adapter': GENERIC_POWER_ADAPTER_LAYOUT,
  'wall-outlet': GENERIC_WALL_OUTLET_LAYOUT,
  'nas-2bay': GENERIC_NAS_LAYOUT,
});

export function getGenericModelLayout(modelId) {
  return GENERIC_MODEL_LAYOUT_BY_MODEL_ID[modelId] || null;
}

export function isGenericModelLayoutWithinBounds(modelId) {
  const layout = getGenericModelLayout(modelId);
  if (!layout) return false;

  return Object.values(layout).flat().every(part => (
    Math.abs(part.x) + part.width / 2 <= 0.5
    && Math.abs(part.z) + part.depth / 2 <= 0.5
  ));
}
