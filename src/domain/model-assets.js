const GENERIC_MONITOR_ASSET = Object.freeze({
  id: 'generic-monitor',
  category: 'display',
  source: 'in-house-generated',
  license: 'DeskLab-owned',
});

const GENERIC_MODEL_ASSET_BY_MODEL_ID = Object.freeze({
  'monitor-24': GENERIC_MONITOR_ASSET,
  'monitor-27': GENERIC_MONITOR_ASSET,
  'ultrawide-monitor': GENERIC_MONITOR_ASSET,
});

export function getGenericModelAsset(modelId) {
  return GENERIC_MODEL_ASSET_BY_MODEL_ID[modelId] || null;
}

export function hasGenericModelAsset(modelId) {
  return Boolean(getGenericModelAsset(modelId));
}
