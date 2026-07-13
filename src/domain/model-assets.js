const GENERIC_MONITOR_ASSET = Object.freeze({
  id: 'generic-monitor',
  category: 'display',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_POWER_STRIP_ASSET = Object.freeze({
  id: 'generic-power-strip',
  category: 'power',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_ROUTER_ASSET = Object.freeze({
  id: 'generic-router',
  category: 'network',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_SWITCH_ASSET = Object.freeze({
  id: 'generic-switch',
  category: 'network',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_UPS_ASSET = Object.freeze({
  id: 'generic-ups',
  category: 'power',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_DESKTOP_PC_ASSET = Object.freeze({
  id: 'generic-desktop-pc',
  category: 'computer',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_MINI_PC_ASSET = Object.freeze({
  id: 'generic-mini-pc',
  category: 'computer',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_POWER_ADAPTER_ASSET = Object.freeze({
  id: 'generic-power-adapter',
  category: 'power',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_WALL_OUTLET_ASSET = Object.freeze({
  id: 'generic-wall-outlet',
  category: 'power',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_LAPTOP_ASSET = Object.freeze({
  id: 'generic-laptop',
  category: 'computer',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_NAS_2BAY_ASSET = Object.freeze({
  id: 'generic-nas-2bay',
  category: 'network',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_MODEM_ASSET = Object.freeze({
  id: 'generic-modem',
  category: 'network',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_ALL_IN_ONE_ASSET = Object.freeze({
  id: 'generic-all-in-one',
  category: 'computer',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_OFFICE_DESK_ASSET = Object.freeze({
  id: 'generic-office-desk',
  category: 'furniture',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_GAMING_DESK_ASSET = Object.freeze({
  id: 'generic-gaming-desk',
  category: 'furniture',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_STANDING_DESK_ASSET = Object.freeze({
  id: 'generic-standing-desk',
  category: 'furniture',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_MODEL_ASSET_BY_MODEL_ID = Object.freeze({
  'monitor-24': GENERIC_MONITOR_ASSET,
  'monitor-27': GENERIC_MONITOR_ASSET,
  'ultrawide-monitor': GENERIC_MONITOR_ASSET,
  'power-strip': GENERIC_POWER_STRIP_ASSET,
  router: GENERIC_ROUTER_ASSET,
  switch: GENERIC_SWITCH_ASSET,
  ups: GENERIC_UPS_ASSET,
  'desktop-pc': GENERIC_DESKTOP_PC_ASSET,
  'mini-pc': GENERIC_MINI_PC_ASSET,
  'power-adapter': GENERIC_POWER_ADAPTER_ASSET,
  'wall-outlet': GENERIC_WALL_OUTLET_ASSET,
  'laptop-15': GENERIC_LAPTOP_ASSET,
  'nas-2bay': GENERIC_NAS_2BAY_ASSET,
  modem: GENERIC_MODEM_ASSET,
  'all-in-one': GENERIC_ALL_IN_ONE_ASSET,
  'office-desk': GENERIC_OFFICE_DESK_ASSET,
  'gaming-desk': GENERIC_GAMING_DESK_ASSET,
  'standing-desk': GENERIC_STANDING_DESK_ASSET,
});

export function getGenericModelAsset(modelId) {
  return GENERIC_MODEL_ASSET_BY_MODEL_ID[modelId] || null;
}

export function hasGenericModelAsset(modelId) {
  return Boolean(getGenericModelAsset(modelId));
}
