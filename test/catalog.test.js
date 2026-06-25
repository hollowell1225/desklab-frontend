import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEVICE_CATALOG,
  findModelTemplate,
  getModelDefaultScale,
  hydrateProjectObjects,
  withPortAnchors,
} from '../src/domain/catalog.js';
import { isPortDirectionConsistent } from '../src/domain/connections.js';

const VALID_PORT_DIRECTIONS = new Set(['input', 'output', 'bidirectional']);
const isNonBlankString = (value) => typeof value === 'string' && value.trim().length > 0;

test('catalog model ids, dimensions, and per-model port ids are valid', () => {
  const categoryIds = new Set();
  const modelIds = new Set();

  for (const category of DEVICE_CATALOG) {
    assert.equal(categoryIds.has(category.category), false, `duplicate category ${category.category}`);
    categoryIds.add(category.category);
    for (const model of category.models) {
      assert.equal(modelIds.has(model.modelId), false, `duplicate model ${model.modelId}`);
      modelIds.add(model.modelId);
      for (const axis of ['x', 'y', 'z']) {
        assert.ok(Number.isFinite(model.defaultScale[axis]) && model.defaultScale[axis] > 0);
      }
      const portIds = (model.ports || []).map(port => port.id);
      assert.equal(new Set(portIds).size, portIds.length, `duplicate port id on ${model.modelId}`);
    }
  }
});

test('every catalog port has a valid, direction-consistent definition', () => {
  for (const category of DEVICE_CATALOG) {
    for (const model of category.models) {
      for (const port of model.ports || []) {
        const where = `${model.modelId}.${port.id}`;
        assert.ok(isNonBlankString(port.id), `${where} id must be a non-empty string`);
        assert.ok(isNonBlankString(port.name), `${where} name must be a non-empty string`);
        assert.ok(isNonBlankString(port.type), `${where} type must be a non-empty string`);
        assert.ok(
          VALID_PORT_DIRECTIONS.has(port.direction),
          `${where} direction "${port.direction}" is not valid`
        );
        assert.ok(
          isPortDirectionConsistent(port),
          `${where} power port direction must match its type`
        );
      }
    }
  }
});

test('generated port anchors stay normalized and preserve explicit anchors', () => {
  for (const category of DEVICE_CATALOG) {
    for (const model of category.models) {
      const ports = withPortAnchors(model.ports || [], model.modelId);
      for (const port of ports) {
        for (const axis of ['x', 'y', 'z']) {
          assert.ok(port.anchor[axis] >= -0.5 && port.anchor[axis] <= 0.5);
        }
      }
    }
  }

  const explicit = { x: 0.1, y: -0.2, z: 0.3 };
  const [port] = withPortAnchors([
    { id: 'custom', type: 'other', direction: 'bidirectional', anchor: explicit },
  ], 'custom-model');
  assert.equal(port.anchor, explicit);
});

test('no two ports on a model share a default anchor position', () => {
  // Cabling clarity depends on each port having a distinct world anchor; two ports
  // at the same point make connections visually ambiguous. Guards the port-anchor
  // accuracy the model-asset work relies on as the catalog grows.
  for (const category of DEVICE_CATALOG) {
    for (const model of category.models) {
      const ports = withPortAnchors(model.ports || [], model.modelId);
      const seen = new Map();
      for (const port of ports) {
        const key = ['x', 'y', 'z'].map(axis => port.anchor[axis].toFixed(4)).join(',');
        assert.equal(
          seen.has(key),
          false,
          `${model.modelId}: ports "${seen.get(key)}" and "${port.id}" share anchor ${key}`
        );
        seen.set(key, port.id);
      }
    }
  }
});

test('modelId matching wins over shared legacy type matching', () => {
  const template = findModelTemplate({ modelId: 'monitor-27', type: 'monitor' });
  assert.equal(template.modelId, 'monitor-27');
  const staleCategoryTemplate = findModelTemplate({ category: 'computer', modelId: 'monitor-27', type: 'monitor' });
  assert.equal(staleCategoryTemplate.modelId, 'monitor-27');
  assert.deepEqual(getModelDefaultScale('display', 'monitor-27'), { x: 0.62, y: 0.06, z: 0.37 });
});

test('project hydration adds current ports and anchors without overwriting custom anchors', () => {
  const customAnchor = { x: 0.2, y: 0.3, z: 0.4 };
  const hydrated = hydrateProjectObjects([
    { id: 'legacy', type: 'laptop', modelId: 'laptop-15', assetUrl: '/stale.glb' },
    {
      id: 'custom',
      type: 'laptop',
      modelId: 'laptop-15',
      ports: [{ id: 'custom-port', name: 'Custom', type: 'usb_c', direction: 'bidirectional', anchor: customAnchor }],
    },
  ]);

  assert.equal(hydrated[0].assetUrl, null);
  assert.ok(hydrated[0].ports.length > 0);
  assert.ok(hydrated[0].ports.every(port => port.anchor));
  assert.deepEqual(hydrated[1].ports[0].anchor, customAnchor);
});
