import test from 'node:test';
import assert from 'node:assert/strict';

import { getGenericModelAsset, hasGenericModelAsset } from '../src/domain/model-assets.js';

test('monitor catalog models resolve to the generic in-house monitor asset', () => {
  for (const modelId of ['monitor-24', 'monitor-27', 'ultrawide-monitor']) {
    const asset = getGenericModelAsset(modelId);

    assert.equal(asset.id, 'generic-monitor');
    assert.equal(asset.source, 'in-house-generated');
    assert.equal(asset.license, 'DeskLab-owned');
    assert.equal(asset.category, 'display');
  }
});

test('unknown or externally loaded models keep the fallback rendering path', () => {
  assert.equal(getGenericModelAsset('missing-model'), null);
  assert.equal(hasGenericModelAsset('missing-model'), false);
  assert.equal(hasGenericModelAsset('monitor-24'), true);
});
