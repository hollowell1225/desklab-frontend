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

test('power strip resolves to the generic in-house power asset', () => {
  const asset = getGenericModelAsset('power-strip');

  assert.equal(asset.id, 'generic-power-strip');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'power');
});

test('router resolves to the generic in-house network asset', () => {
  const asset = getGenericModelAsset('router');

  assert.equal(asset.id, 'generic-router');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'network');
});

test('switch resolves to the generic in-house network asset', () => {
  const asset = getGenericModelAsset('switch');

  assert.equal(asset.id, 'generic-switch');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'network');
});

test('ups resolves to the generic in-house power asset', () => {
  const asset = getGenericModelAsset('ups');

  assert.equal(asset.id, 'generic-ups');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'power');
});

test('desktop pc resolves to the generic in-house computer asset', () => {
  const asset = getGenericModelAsset('desktop-pc');

  assert.equal(asset.id, 'generic-desktop-pc');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'computer');
});

test('mini pc resolves to the generic in-house computer asset', () => {
  const asset = getGenericModelAsset('mini-pc');

  assert.equal(asset.id, 'generic-mini-pc');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'computer');
});

test('power adapter resolves to the generic in-house power asset', () => {
  const asset = getGenericModelAsset('power-adapter');

  assert.equal(asset.id, 'generic-power-adapter');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'power');
});

test('wall outlet resolves to the generic in-house power asset', () => {
  const asset = getGenericModelAsset('wall-outlet');

  assert.equal(asset.id, 'generic-wall-outlet');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'power');
});

test('laptop resolves to the generic in-house computer asset', () => {
  const asset = getGenericModelAsset('laptop-15');

  assert.equal(asset.id, 'generic-laptop');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'computer');
});

test('two-bay nas resolves to the generic in-house network asset', () => {
  const asset = getGenericModelAsset('nas-2bay');

  assert.equal(asset.id, 'generic-nas-2bay');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'network');
});

test('modem resolves to the generic in-house network asset', () => {
  const asset = getGenericModelAsset('modem');

  assert.equal(asset.id, 'generic-modem');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'network');
});

test('all-in-one resolves to the generic in-house computer asset', () => {
  const asset = getGenericModelAsset('all-in-one');

  assert.equal(asset.id, 'generic-all-in-one');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'computer');
});

test('office desk resolves to the generic in-house furniture asset', () => {
  const asset = getGenericModelAsset('office-desk');

  assert.equal(asset.id, 'generic-office-desk');
  assert.equal(asset.source, 'in-house-generated');
  assert.equal(asset.license, 'DeskLab-owned');
  assert.equal(asset.category, 'furniture');
});

test('unknown or externally loaded models keep the fallback rendering path', () => {
  assert.equal(getGenericModelAsset('missing-model'), null);
  assert.equal(hasGenericModelAsset('missing-model'), false);
  assert.equal(hasGenericModelAsset('monitor-24'), true);
});
