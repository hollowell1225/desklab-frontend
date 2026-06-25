import test from 'node:test';
import assert from 'node:assert/strict';

import { placeCatalogObject } from '../src/domain/placement.js';
import { DEVICE_CATALOG } from '../src/domain/catalog.js';
import { isPortDirectionConsistent } from '../src/domain/connections.js';

const isNonBlankString = (value) => typeof value === 'string' && value.trim().length > 0;
const VALID_PORT_DIRECTIONS = new Set(['input', 'output', 'bidirectional']);

const officeDesk = {
  type: 'office-desk',
  modelId: 'office-desk',
  displayName: '办公桌',
  shape: 'rect',
  assetUrl: null,
  defaultScale: { x: 1.4, y: 0.7, z: 0.75 },
  color: '#1e88e5',
};

test('rejects a catalog object that cannot fit inside the room', () => {
  const result = placeCatalogObject({
    modelTemplate: officeDesk,
    categoryId: 'furniture',
    room: { length: 0.1, width: 0.1, height: 0.1 },
    id: 'desk-1',
  });

  assert.equal(result.valid, false);
  assert.equal(result.object, null);
  assert.match(result.reason, /房间/);
});

test('creates a constrained catalog object with independent port data', () => {
  const template = {
    ...officeDesk,
    ports: [{ id: 'power-in', name: '电源', type: 'ac_input', direction: 'input' }],
  };
  const result = placeCatalogObject({
    modelTemplate: template,
    categoryId: 'furniture',
    room: { length: 5, width: 4, height: 3 },
    id: 'desk-2',
  });

  assert.equal(result.valid, true);
  assert.equal(result.object.id, 'desk-2');
  assert.deepEqual(result.object.position, { x: 0, y: 0, z: 0.375 });
  assert.equal(result.object.ports[0].anchor.y, 0.5);

  result.object.ports[0].name = '已修改';
  assert.equal(template.ports[0].name, '电源');
});

test('every catalog template places into a structurally valid object', () => {
  const room = { length: 100, width: 100, height: 100 };

  for (const category of DEVICE_CATALOG) {
    for (const model of category.models) {
      const result = placeCatalogObject({ modelTemplate: model, categoryId: category.category, room });
      assert.equal(result.valid, true, `${model.modelId} should place validly`);

      const object = result.object;
      assert.ok(isNonBlankString(object.id), `${model.modelId} id`);
      assert.ok(isNonBlankString(object.type), `${model.modelId} type`);
      assert.ok(isNonBlankString(object.name), `${model.modelId} name`);
      assert.ok(isNonBlankString(object.shape), `${model.modelId} shape`);
      for (const axis of ['x', 'y', 'z']) {
        assert.ok(Number.isFinite(object.position[axis]), `${model.modelId} position.${axis}`);
        assert.ok(Number.isFinite(object.scale[axis]) && object.scale[axis] > 0, `${model.modelId} scale.${axis}`);
        assert.ok(Number.isFinite(object.rotation[axis]), `${model.modelId} rotation.${axis}`);
      }

      const portIds = object.ports.map(port => port.id);
      assert.equal(new Set(portIds).size, portIds.length, `${model.modelId} duplicate port id`);
      for (const port of object.ports) {
        assert.ok(VALID_PORT_DIRECTIONS.has(port.direction), `${model.modelId}.${port.id} direction`);
        assert.ok(isPortDirectionConsistent(port), `${model.modelId}.${port.id} direction consistency`);
        for (const axis of ['x', 'y', 'z']) {
          assert.ok(
            port.anchor[axis] >= -0.5 && port.anchor[axis] <= 0.5,
            `${model.modelId}.${port.id} anchor.${axis} normalized`
          );
        }
      }
    }
  }
});

test('generates a unique id when callers create objects without supplying one', () => {
  const ids = Array.from({ length: 25 }, () => placeCatalogObject({
    modelTemplate: officeDesk,
    categoryId: 'furniture',
    room: { length: 5, width: 4, height: 3 },
  }).object.id);

  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => id.startsWith('office-desk-')));
});
