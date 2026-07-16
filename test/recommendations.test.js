import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyAllAvailableImprovements,
  applyAllImprovements,
  applyImprovement,
  buildFreeImprovements,
  buildPurchaseSuggestions,
  buildRecommendations,
} from '../src/domain/recommendations.js';
import { analyzeProjectLayout } from '../src/domain/layout-analysis.js';
import { analyzeProjectWiring, buildPowerGraph } from '../src/domain/analysis.js';
import { evaluateConnectionLength } from '../src/domain/connections.js';
import { findModelTemplate } from '../src/domain/catalog.js';
import { placeCatalogObject } from '../src/domain/placement.js';

const room = { length: 5, width: 4, height: 3 };
const object = (id, overrides = {}) => ({
  id,
  name: id,
  type: 'device',
  position: { x: 0, y: 0, z: 0.5 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  ...overrides,
});

const applyObjectPatch = (objects, patch) => objects.map(item =>
  item.id === patch.objectId
    ? { ...item, position: patch.position ?? item.position, rotation: patch.rotation ?? item.rotation }
    : item
);

test('suggests dropping a floating object and the fix clears the warning', () => {
  const floating = object('floating', { position: { x: 1.5, y: 0, z: 1.5 }, scale: { x: 0.2, y: 0.2, z: 0.2 } });
  const objects = [floating];

  const suggestions = buildFreeImprovements(room, objects, []);
  const drop = suggestions.find(item => item.code === 'drop_to_support');
  assert.ok(drop, 'expected a drop_to_support suggestion');
  assert.deepEqual(drop.objectIds, ['floating']);

  const fixed = applyObjectPatch(objects, drop.patch);
  assert.equal(
    analyzeProjectLayout(room, fixed).some(issue => issue.id === 'floating:floating'),
    false
  );
});

test('suggests moving an out-of-bounds object back inside and the fix clears the warning', () => {
  const stray = object('stray', { position: { x: 10, y: 0, z: 0.5 }, scale: { x: 1, y: 1, z: 1 } });
  const objects = [stray];

  const suggestions = buildFreeImprovements(room, objects, []);
  const move = suggestions.find(item => item.code === 'move_inside_room');
  assert.ok(move, 'expected a move_inside_room suggestion');

  const fixed = applyObjectPatch(objects, move.patch);
  assert.equal(
    analyzeProjectLayout(room, fixed).some(issue => issue.id === 'out-of-bounds:stray'),
    false
  );
});

test('suggests snapping a stray wall outlet and the fix clears the warning', () => {
  const outlet = object('outlet', {
    type: 'outlet',
    modelId: 'wall-outlet',
    scale: { x: 0.08, y: 0.02, z: 0.08 },
    position: { x: 0, y: 0, z: 1 },
    ports: [{ id: 'ac-out', name: 'AC', type: 'ac_output', direction: 'output', anchor: { x: 0, y: -0.5, z: 0 } }],
  });
  const objects = [outlet];

  const suggestions = buildFreeImprovements(room, objects, []);
  const snap = suggestions.find(item => item.code === 'snap_outlet_to_wall');
  assert.ok(snap, 'expected a snap_outlet_to_wall suggestion');

  const fixed = applyObjectPatch(objects, snap.patch);
  assert.equal(
    analyzeProjectLayout(room, fixed).some(issue => issue.code === 'outlet_off_wall'),
    false
  );
});

test('suggests extending a short cable and the fix satisfies both slack checks', () => {
  const objects = [
    object('source', { position: { x: 0, y: 0, z: 0.1 }, ports: [{ id: 'out', name: 'out', type: 'dc_output', direction: 'output' }] }),
    object('target', { position: { x: 3, y: 0, z: 0.1 }, ports: [{ id: 'in', name: 'in', type: 'dc_input', direction: 'input' }] }),
  ];
  const connections = [{
    id: 'c1', name: '电源线', cableType: 'power', length: 1,
    fromObjectId: 'source', fromPortId: 'out', toObjectId: 'target', toPortId: 'in',
  }];

  const suggestions = buildFreeImprovements(room, objects, connections);
  const extend = suggestions.find(item => item.code === 'extend_cable');
  assert.ok(extend, 'expected an extend_cable suggestion');
  assert.ok(extend.patch.length > connections[0].length);

  const fixedConnections = connections.map(c =>
    c.id === extend.patch.connectionId ? { ...c, length: extend.patch.length } : c
  );
  const status = evaluateConnectionLength(fixedConnections[0], objects);
  assert.equal(status.sufficient, true);
  assert.equal(status.hasRecommendedSlack, true);
  assert.equal(
    analyzeProjectWiring(objects, fixedConnections).some(issue =>
      issue.code === 'short_cable' || issue.code === 'low_cable_slack'),
    false
  );
});

test('is safe to call on empty or malformed mid-edit state', () => {
  // The UI calls this on live state, so it must never throw and must offer no
  // fix for issues that have none (invalid geometry / missing fields).
  assert.deepEqual(buildFreeImprovements(room, [], []), []);
  assert.deepEqual(
    buildFreeImprovements(room, [{
      id: 'x', name: 'x', type: 'd',
      position: { x: Number.NaN, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
    }], []),
    []
  );
  assert.deepEqual(buildFreeImprovements(room, [{ id: 'y', name: 'y' }], []), []);
});

test('does not throw when a port-bearing object is missing its position', () => {
  // analyzeProjectLayout flags such an object as invalid_geometry but keeps going,
  // so a position-less device with ports can still reach the nearest-source loops.
  // Those loops must tolerate it instead of crashing the recommendation panel.
  const source = object('source', {
    type: 'power_strip', modelId: 'power-strip',
    position: { x: 0, y: 0, z: 0.1 },
    ports: [{ id: 'out', name: 'out', type: 'ac_output', direction: 'output' }],
  });
  const noPositionPowered = { id: 'np', name: 'np', type: 'device', ports: [{ id: 'in', name: 'in', type: 'ac_input', direction: 'input' }] };
  const noPositionNet = { id: 'nn', name: 'nn', type: 'device', ports: [{ id: 'eth', name: 'eth', type: 'ethernet', direction: 'bidirectional' }] };
  const switchDev = object('sw', {
    type: 'switch', modelId: 'switch',
    position: { x: 1, y: 0, z: 0.1 },
    ports: [{ id: 'p1', name: 'Port 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const monitor = object('mon', {
    type: 'monitor', modelId: 'monitor-24',
    position: { x: 1, y: 0, z: 1 },
    ports: [{ id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' }],
  });
  const noPositionDisplay = { id: 'nd', name: 'nd', type: 'device', ports: [{ id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' }] };
  const objects = [source, noPositionPowered, switchDev, noPositionNet, monitor, noPositionDisplay];

  assert.doesNotThrow(() => buildFreeImprovements(room, objects, []));
  assert.doesNotThrow(() => buildPurchaseSuggestions(objects, []));

  // Objects with no usable position must not produce auto-connection suggestions.
  const free = buildFreeImprovements(room, objects, []);
  assert.equal(free.some(s => s.objectIds?.includes('np') || s.objectIds?.includes('nn') || s.objectIds?.includes('nd')), false);
});

test('produces a working fix for a real catalog wall outlet placed off-wall', () => {
  // Integration across catalog -> placement -> recommendations -> analysis.
  const outletTemplate = findModelTemplate({ modelId: 'wall-outlet' });
  const placed = placeCatalogObject({ modelTemplate: outletTemplate, categoryId: 'power', room, id: 'outlet' });
  assert.equal(placed.valid, true);

  const suggestions = buildFreeImprovements(room, [placed.object], []);
  const snap = suggestions.find(item => item.code === 'snap_outlet_to_wall');
  assert.ok(snap, 'expected a snap_outlet_to_wall suggestion for a real wall outlet');

  const next = applyImprovement({ room, objects: [placed.object], connections: [] }, snap);
  assert.equal(
    analyzeProjectLayout(room, next.objects).some(issue => issue.code === 'outlet_off_wall'),
    false
  );
});

test('returns no suggestions for a clean project', () => {
  const objects = [object('grounded', { position: { x: 0, y: 0, z: 0.5 }, scale: { x: 1, y: 1, z: 1 } })];
  assert.deepEqual(buildFreeImprovements(room, objects, []), []);
});

test('recommends a power source purchase for daisy-chained strips, deduped per pair', () => {
  const strip = (id, x) => object(id, {
    type: 'power_strip',
    modelId: 'power-strip',
    position: { x, y: 0, z: 0.1 },
    ports: [
      { id: 'in', name: 'in', type: 'ac_input', direction: 'input' },
      { id: 'out', name: 'out', type: 'ac_output', direction: 'output' },
    ],
  });
  const objects = [strip('a', -1), strip('b', 1)];
  // Mutual chain raises two power_strip_chain issues for the same pair.
  const connections = [
    { id: 'ab', name: 'ab', cableType: 'power', length: 3, fromObjectId: 'a', fromPortId: 'out', toObjectId: 'b', toPortId: 'in' },
    { id: 'ba', name: 'ba', cableType: 'power', length: 3, fromObjectId: 'b', fromPortId: 'out', toObjectId: 'a', toPortId: 'in' },
  ];

  const purchases = buildPurchaseSuggestions(objects, connections);
  const powerSourcePurchases = purchases.filter(item => item.code === 'buy_power_source');
  assert.equal(powerSourcePurchases.length, 1, 'one deduped purchase suggestion per strip pair');
  assert.equal(powerSourcePurchases[0].code, 'buy_power_source');
  assert.deepEqual(powerSourcePurchases[0].product, { category: 'power', modelId: 'ups' });
  assert.deepEqual([...powerSourcePurchases[0].objectIds].sort(), ['a', 'b']);

  // The referenced product must resolve to a real catalog item, or the UI would
  // surface a purchase recommendation pointing at a non-existent device.
  const template = findModelTemplate(powerSourcePurchases[0].product);
  assert.ok(template, 'purchase product must resolve in the catalog');
  assert.equal(template.modelId, powerSourcePurchases[0].product.modelId);

  assert.deepEqual(buildPurchaseSuggestions([], []), []);
});

test('recommends a cable purchase for short cable or low slack', () => {
  const objects = [
    object('source', { position: { x: 0, y: 0, z: 0.1 }, ports: [{ id: 'out', name: 'out', type: 'dc_output', direction: 'output' }] }),
    object('target', { position: { x: 3, y: 0, z: 0.1 }, ports: [{ id: 'in', name: 'in', type: 'dc_input', direction: 'input' }] }),
  ];
  const connections = [{
    id: 'c1', name: '电源线', cableType: 'power', length: 1,
    fromObjectId: 'source', fromPortId: 'out', toObjectId: 'target', toPortId: 'in',
  }];

  const purchases = buildPurchaseSuggestions(objects, connections);
  const buyCable = purchases.find(item => item.code === 'buy_cable');
  assert.ok(buyCable, 'expected a buy_cable purchase suggestion');
  assert.equal(buyCable.product.category, 'cable');
  assert.equal(buyCable.product.modelId, 'power');
  assert.ok(buyCable.product.length > 1);
  assert.equal(buyCable.connectionIds[0], 'c1');
});

test('recommends a switch purchase when ethernet endpoints exceed router LAN ports', () => {
  const router = object('router-1', {
    modelId: 'router',
    ports: [
      { id: 'wan', name: 'WAN', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-2', name: 'LAN 2', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-3', name: 'LAN 3', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const pc = (id) => object(id, {
    modelId: 'desktop-pc',
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'bidirectional' }],
  });
  // 4 ethernet endpoint devices (exceeding router's 3 LAN ports)
  const objects = [router, pc('pc1'), pc('pc2'), pc('pc3'), pc('pc4')];

  const purchases = buildPurchaseSuggestions(objects, []);
  const buySwitch = purchases.find(item => item.code === 'buy_switch');
  assert.ok(buySwitch, 'expected a buy_switch purchase suggestion');
  assert.equal(buySwitch.product.category, 'network');
  assert.equal(buySwitch.product.modelId, 'switch');

  // A switch with no usable ports cannot satisfy the missing capacity.
  const objectsWithSwitch = [...objects, object('switch-1', { modelId: 'switch' })];
  const purchasesWithSwitch = buildPurchaseSuggestions(objectsWithSwitch, []);
  assert.equal(purchasesWithSwitch.some(item => item.code === 'buy_switch'), true);
});

test('does not recommend a switch for an output-only ethernet device port', () => {
  const device = object('uplink-only', {
    ports: [{ id: 'uplink', name: 'Uplink', type: 'ethernet', direction: 'output' }],
  });

  const purchases = buildPurchaseSuggestions([device], []);
  assert.equal(purchases.some(item => item.code === 'buy_switch'), false);
});

test('recognizes custom router LAN port ids regardless of case', () => {
  const router = object('router-1', {
    modelId: 'router',
    ports: [{ id: 'LAN-1', name: 'LAN 1', type: 'ethernet', direction: 'output' }],
  });
  const device = object('pc-1', {
    ports: [{ id: 'eth-1', name: 'Ethernet', type: 'ethernet', direction: 'input' }],
  });

  const purchases = buildPurchaseSuggestions([router, device], []);
  assert.equal(purchases.some(item => item.code === 'buy_switch'), false);
});

test('does not recommend a switch when all ethernet devices are already connected to the router', () => {
  const router = object('router-1', {
    modelId: 'router',
    ports: [
      { id: 'wan', name: 'WAN', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-2', name: 'LAN 2', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-3', name: 'LAN 3', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const pc = (id) => object(id, {
    modelId: 'desktop-pc',
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'bidirectional' }],
  });
  // 3 PCs, all connected to the router's 3 LAN ports → no switch needed
  const objects = [router, pc('pc1'), pc('pc2'), pc('pc3')];
  const connections = [
    { id: 'c1', name: 'c1', cableType: 'ethernet', length: 1, fromObjectId: 'router-1', fromPortId: 'lan-1', toObjectId: 'pc1', toPortId: 'eth-1' },
    { id: 'c2', name: 'c2', cableType: 'ethernet', length: 1, fromObjectId: 'router-1', fromPortId: 'lan-2', toObjectId: 'pc2', toPortId: 'eth-1' },
    { id: 'c3', name: 'c3', cableType: 'ethernet', length: 1, fromObjectId: 'router-1', fromPortId: 'lan-3', toObjectId: 'pc3', toPortId: 'eth-1' },
  ];

  const purchases = buildPurchaseSuggestions(objects, connections);
  assert.equal(purchases.some(item => item.code === 'buy_switch'), false,
    'should not recommend a switch when all ethernet devices are already connected');
});

test('recommends a switch when unconnected ethernet devices exceed available LAN ports', () => {
  const router = object('router-1', {
    modelId: 'router',
    ports: [
      { id: 'wan', name: 'WAN', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-2', name: 'LAN 2', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-3', name: 'LAN 3', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const pc = (id) => object(id, {
    modelId: 'desktop-pc',
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'bidirectional' }],
  });
  // 4 PCs, 2 already connected, 2 unconnected. Free LAN: 1. 2 > 1 → buy switch.
  const objects = [router, pc('pc1'), pc('pc2'), pc('pc3'), pc('pc4')];
  const connections = [
    { id: 'c1', name: 'c1', cableType: 'ethernet', length: 1, fromObjectId: 'router-1', fromPortId: 'lan-1', toObjectId: 'pc1', toPortId: 'eth-1' },
    { id: 'c2', name: 'c2', cableType: 'ethernet', length: 1, fromObjectId: 'router-1', fromPortId: 'lan-2', toObjectId: 'pc2', toPortId: 'eth-1' },
  ];

  const purchases = buildPurchaseSuggestions(objects, connections);
  const buySwitch = purchases.find(item => item.code === 'buy_switch');
  assert.ok(buySwitch, 'should recommend a switch when unconnected devices exceed free LAN ports');
});

test('does not recommend a switch when another router has free LAN capacity', () => {
  const router = (id) => object(id, {
    modelId: 'router',
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const pc = (id) => object(id, {
    modelId: 'desktop-pc',
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'bidirectional' }],
  });
  const firstRouter = router('router-1');
  const secondRouter = router('router-2');
  const connected = pc('connected');
  const unconnected = pc('unconnected');
  const connections = [{
    id: 'router-connected', name: 'Router connection', cableType: 'ethernet', length: 1,
    fromObjectId: 'router-1', fromPortId: 'lan-1', toObjectId: 'connected', toPortId: 'eth-1',
  }];

  const purchases = buildPurchaseSuggestions([firstRouter, secondRouter, connected, unconnected], connections);

  assert.equal(purchases.some(item => item.code === 'buy_switch'), false,
    'all router LAN capacity should be counted before recommending a switch');
});

test('recommends a switch when a reachable switch only has a WAN port free', () => {
  const router = object('router-1', {
    modelId: 'router',
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const switchDevice = object('switch-1', {
    modelId: 'switch',
    ports: [
      { id: 'uplink', name: 'Uplink', type: 'ethernet', direction: 'bidirectional' },
      { id: 'wan', name: 'WAN', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const unconnected = object('unconnected', {
    modelId: 'desktop-pc',
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'bidirectional' }],
  });
  const connections = [{
    id: 'router-switch', name: 'Router switch uplink', cableType: 'ethernet', length: 1,
    fromObjectId: 'router-1', fromPortId: 'lan-1', toObjectId: 'switch-1', toPortId: 'uplink',
  }];

  const purchases = buildPurchaseSuggestions([router, switchDevice, unconnected], connections);

  assert.ok(purchases.some(item => item.code === 'buy_switch'),
    'a WAN port cannot provide the downstream capacity used to suppress a switch purchase');
});

test('recommends a switch when a reachable switch is unpowered', () => {
  const router = object('router-1', {
    modelId: 'router',
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const switchDevice = object('switch-1', {
    modelId: 'switch',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'eth-1', name: 'Port 1', type: 'ethernet', direction: 'bidirectional' },
      { id: 'eth-2', name: 'Port 2', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const unconnected = object('unconnected', {
    modelId: 'desktop-pc',
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'bidirectional' }],
  });
  const connections = [{
    id: 'router-switch', name: 'Router switch uplink', cableType: 'ethernet', length: 1,
    fromObjectId: 'router-1', fromPortId: 'lan-1', toObjectId: 'switch-1', toPortId: 'eth-1',
  }];

  const purchases = buildPurchaseSuggestions([router, switchDevice, unconnected], connections);

  assert.ok(purchases.some(item => item.code === 'buy_switch'),
    'an unpowered switch cannot provide the downstream capacity used to suppress a switch purchase');
});

test('marks a switch purchase as requiring LAN migration when the router is full', () => {
  const router = object('router-1', {
    modelId: 'router',
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const pc = (id) => object(id, {
    modelId: 'desktop-pc',
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'bidirectional' }],
  });
  const connected = pc('connected');
  const unconnected = pc('unconnected');
  const connections = [{
    id: 'router-connected', name: 'Router connection', cableType: 'ethernet', length: 1,
    fromObjectId: 'router-1', fromPortId: 'lan-1', toObjectId: 'connected', toPortId: 'eth-1',
  }];

  const purchases = buildPurchaseSuggestions([router, connected, unconnected], connections);
  const buySwitch = purchases.find(item => item.code === 'buy_switch');

  assert.ok(buySwitch, 'a full router with another endpoint still needs a switch');
  assert.equal(buySwitch.requiresLanPortMigration, true);
});

test('recommends a power strip purchase when a power strip is fully occupied', () => {
  const strip = object('strip-1', {
    type: 'power_strip',
    modelId: 'power-strip',
    ports: [
      { id: 'ac-in', name: 'in', type: 'ac_input', direction: 'input' },
      { id: 'ac-out-1', name: 'out 1', type: 'ac_output', direction: 'output' },
      { id: 'ac-out-2', name: 'out 2', type: 'ac_output', direction: 'output' },
    ],
  });
  const pc = (id) => object(id, {
    ports: [{ id: 'ac-in', name: 'in', type: 'ac_input', direction: 'input' }],
  });
  const objects = [strip, pc('pc1'), pc('pc2')];
  // Occupy all ac_output ports of the strip (ac-out-1 and ac-out-2)
  const connections = [
    { id: 'c1', name: 'p1', cableType: 'power', length: 1, fromObjectId: 'strip-1', fromPortId: 'ac-out-1', toObjectId: 'pc1', toPortId: 'ac-in' },
    { id: 'c2', name: 'p2', cableType: 'power', length: 1, fromObjectId: 'strip-1', fromPortId: 'ac-out-2', toObjectId: 'pc2', toPortId: 'ac-in' },
  ];

  const purchases = buildPurchaseSuggestions(objects, connections);
  const buyStrip = purchases.find(item => item.code === 'buy_power_strip');
  assert.ok(buyStrip, 'expected a buy_power_strip purchase suggestion');
  assert.equal(buyStrip.product.category, 'power');
  assert.equal(buyStrip.product.modelId, 'power-strip');
  assert.deepEqual(buyStrip.objectIds, ['strip-1']);

  // Verify it doesn't recommend if the strip has vacant ac_output ports
  const vacantConnections = [
    { id: 'c1', name: 'p1', cableType: 'power', length: 1, fromObjectId: 'strip-1', fromPortId: 'ac-out-1', toObjectId: 'pc1', toPortId: 'ac-in' },
  ];
  const purchasesVacant = buildPurchaseSuggestions(objects, vacantConnections);
  assert.equal(purchasesVacant.some(item => item.code === 'buy_power_strip'), false);
});

test('does not count directionally invalid AC outputs as occupied strip capacity', () => {
  const strip = object('strip-1', {
    type: 'power_strip',
    modelId: 'power-strip',
    ports: [{ id: 'ac-out-1', name: 'AC OUT 1', type: 'ac_output', direction: 'input' }],
  });
  const device = object('device-1', {
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const connections = [{
    id: 'invalid-power', name: 'Invalid power', cableType: 'power', length: 1,
    fromObjectId: 'strip-1', fromPortId: 'ac-out-1', toObjectId: 'device-1', toPortId: 'ac-in',
  }];

  const purchases = buildPurchaseSuggestions([strip, device], connections);
  assert.equal(purchases.some(item => item.code === 'buy_power_strip'), false);
});

test('suggests powering an unpowered device and the fix creates a valid connection', () => {
  // 1. Create a powered power strip with a vacant ac_output
  const strip = object('strip1', {
    type: 'power_strip',
    modelId: 'power-strip',
    ports: [
      { id: 'ac-in', name: 'in', type: 'ac_input', direction: 'input' },
      { id: 'ac-out-1', name: 'out 1', type: 'ac_output', direction: 'output' },
    ]
  });
  const outlet = object('outlet', {
    type: 'outlet', modelId: 'wall-outlet',
    ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
  });
  // 2. Create a desktop PC with an unpowered ac_input
  const pc = object('pc1', {
    modelId: 'desktop-pc',
    position: { x: 1, y: 1, z: 0.5 },
    ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }]
  });
  const objects = [outlet, strip, pc];
  const connections = [{
    id: 'outlet-strip', name: 'Outlet strip power', cableType: 'power', length: 1,
    fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'strip1', toPortId: 'ac-in',
  }];

  const suggestions = buildFreeImprovements(room, objects, connections);
  const autoPower = suggestions.find(item => item.code === 'auto_power_device');
  assert.ok(autoPower, 'expected an auto_power_device suggestion');
  assert.equal(autoPower.patch.newConnection.fromObjectId, 'strip1');
  assert.equal(autoPower.patch.newConnection.toObjectId, 'pc1');

  // Apply the patch
  const project = { room, objects, connections };
  const next = applyImprovement(project, autoPower);
  assert.equal(next.connections.length, 2);
  assert.equal(next.connections.at(-1).fromObjectId, 'strip1');
  assert.equal(next.connections.at(-1).toObjectId, 'pc1');

  // Verify the unpowered warning is resolved for pc1
  const issues = analyzeProjectWiring(next.objects, next.connections);
  assert.equal(issues.some(issue => issue.code === 'unpowered_input' && issue.objectIds.includes('pc1')), false);
});

test('auto_power_device infers cable type correctly for dc_input devices', () => {
  // Power adapter with dc_output → laptop with dc_input should infer cableType 'power'
  const adapter = object('adapter', {
    type: 'power-adapter',
    modelId: 'power-adapter',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'dc-out', name: 'DC OUT', type: 'dc_output', direction: 'output' },
    ],
  });
  const laptop = object('laptop', {
    type: 'laptop',
    modelId: 'laptop-15',
    position: { x: 1, y: 1, z: 0.5 },
    ports: [{ id: 'dc-in', name: 'DC IN', type: 'dc_input', direction: 'input' }],
  });
  const outlet = object('outlet', {
    type: 'outlet', modelId: 'wall-outlet',
    ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
  });
  const objects = [outlet, adapter, laptop];
  const connections = [{
    id: 'outlet-adapter', name: 'Outlet adapter power', cableType: 'power', length: 1,
    fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'adapter', toPortId: 'ac-in',
  }];

  const suggestions = buildFreeImprovements(room, objects, connections);
  const autoPower = suggestions.find(item => item.code === 'auto_power_device');
  assert.ok(autoPower, 'expected an auto_power_device suggestion for dc_input device');
  assert.equal(autoPower.patch.newConnection.cableType, 'power',
    'dc_output → dc_input should infer cableType power, not other');
});

test('does not suggest auto_power_device when no power source has a free compatible port', () => {
  // A single unpowered device with no nearby power source → no suggestion
  const device = object('lonely-device', {
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const objects = [device];

  const suggestions = buildFreeImprovements(room, objects, []);
  const autoPower = suggestions.find(item => item.code === 'auto_power_device');
  assert.equal(autoPower, undefined, 'should not suggest auto_power_device without a power source');
});

test('does not use an unpowered power strip as a supply source', () => {
  const strip = object('strip', {
    type: 'power_strip', modelId: 'power-strip',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' },
    ],
  });
  const pc = object('pc', {
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });

  const free = buildFreeImprovements(room, [strip, pc], []);
  const purchases = buildPurchaseSuggestions([strip, pc], []);

  assert.equal(free.some(item => item.code === 'auto_power_device'), false,
    'a strip without an upstream power connection cannot safely power another device');
  assert.ok(purchases.some(item => item.code === 'buy_power_for_unpowered' && item.objectIds.includes('pc')),
    'an unpowered strip must not suppress the PC power recommendation');
});

test('does not use a power strip fed only by an unpowered upstream strip', () => {
  const upstreamStrip = object('upstream', {
    type: 'power_strip', modelId: 'power-strip',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' },
    ],
  });
  const downstreamStrip = object('downstream', {
    type: 'power_strip', modelId: 'power-strip',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' },
    ],
  });
  const pc = object('pc', {
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const connections = [{
    id: 'strip-chain', name: 'Strip chain', cableType: 'power', length: 1,
    fromObjectId: 'upstream', fromPortId: 'ac-out', toObjectId: 'downstream', toPortId: 'ac-in',
  }];

  const free = buildFreeImprovements(room, [upstreamStrip, downstreamStrip, pc], connections);
  const purchases = buildPurchaseSuggestions([upstreamStrip, downstreamStrip, pc], connections);

  assert.equal(free.some(item => item.code === 'auto_power_device'), false,
    'a downstream strip is unavailable until its upstream supply reaches a root source');
  assert.ok(purchases.some(item => item.code === 'buy_power_for_unpowered' && item.objectIds.includes('pc')),
    'a dead power chain must not suppress the PC power recommendation');
});

test('does not recommend power fixes for a directionally invalid power input', () => {
  const source = object('source', {
    type: 'power_strip',
    modelId: 'power-strip',
    position: { x: 0, y: 0, z: 0.1 },
    ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
  });
  const device = object('device', {
    position: { x: 1, y: 0, z: 0.1 },
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'output' }],
  });

  const free = buildFreeImprovements(room, [source, device], []);
  const purchases = buildPurchaseSuggestions([device], []);
  assert.equal(free.some(item => item.code === 'auto_power_device'), false);
  assert.equal(purchases.some(item => item.code === 'buy_power_for_unpowered'), false);
});

test('does not use a source with an invalidly directed power input', () => {
  const invalidSource = object('invalid-source', {
    type: 'power_strip', modelId: 'power-strip',
    position: { x: 0, y: 0, z: 0.1 },
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'output' },
      { id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' },
    ],
  });
  const pc = object('pc', {
    position: { x: 1, y: 0, z: 0.1 },
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });

  const free = buildFreeImprovements(room, [invalidSource, pc], []);
  const purchases = buildPurchaseSuggestions([invalidSource, pc], []);

  assert.equal(free.some(item => item.code === 'auto_power_device'), false,
    'a malformed power source must not be treated as an independent root');
  assert.ok(purchases.some(item => item.code === 'buy_power_for_unpowered' && item.objectIds.includes('pc')),
    'a malformed source must not suppress the PC power recommendation');
});

test('ignores invalid connection occupancy when recommending power fixes', () => {
  const source = object('source', {
    type: 'power_strip',
    modelId: 'power-strip',
    position: { x: 0, y: 0, z: 0.1 },
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' },
    ],
  });
  const device = object('device', {
    position: { x: 1, y: 0, z: 0.1 },
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const outlet = object('outlet', {
    type: 'outlet', modelId: 'wall-outlet',
    ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
  });
  const connections = [
    {
      id: 'outlet-source', name: 'Outlet source power', cableType: 'power', length: 1,
      fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'source', toPortId: 'ac-in',
    },
    {
      id: 'invalid-self', name: 'Invalid self link', cableType: 'power', length: 1,
      fromObjectId: 'source', fromPortId: 'ac-out', toObjectId: 'source', toPortId: 'ac-in',
    },
  ];

  const recommendations = buildRecommendations({ room, objects: [outlet, source, device], connections });
  const autoPower = recommendations.freeImprovements.find(item => item.code === 'auto_power_device');

  assert.ok(autoPower, 'invalid links must not consume the available source port');
  assert.equal(autoPower.patch.newConnection.fromObjectId, 'source');
  assert.equal(autoPower.patch.newConnection.toObjectId, 'device');
  assert.equal(
    recommendations.purchases.some(item => item.code === 'buy_power_for_unpowered'),
    false,
    'a valid nearby source must prevent a false purchase recommendation'
  );
});

test('auto_power_device with real catalog power-adapter and laptop clears unpowered warning', () => {
  const outlet = placeCatalogObject({
    modelTemplate: findModelTemplate({ modelId: 'wall-outlet' }),
    categoryId: 'power',
    room,
    id: 'outlet',
  }).object;
  const adapter = placeCatalogObject({
    modelTemplate: findModelTemplate({ modelId: 'power-adapter' }),
    categoryId: 'power',
    room,
    id: 'adapter',
  }).object;
  const laptop = placeCatalogObject({
    modelTemplate: findModelTemplate({ modelId: 'laptop-15' }),
    categoryId: 'computer',
    room,
    id: 'laptop',
    position: { x: 1, y: 0, z: 0 },
  }).object;
  const objects = [outlet, adapter, laptop];
  const connections = [{
    id: 'outlet-adapter', name: 'Outlet adapter power', cableType: 'power', length: 1,
    fromObjectId: 'outlet', fromPortId: 'ac-out-1', toObjectId: 'adapter', toPortId: 'ac-in',
  }];

  const suggestions = buildFreeImprovements(room, objects, connections);
  const autoPower = suggestions.find(item => item.code === 'auto_power_device');
  assert.ok(autoPower, 'expected auto_power_device for unpowered laptop near adapter');
  assert.equal(autoPower.patch.newConnection.cableType, 'power',
    'dc_output from adapter → dc_input on laptop should be power cable');
  assert.equal(autoPower.patch.newConnection.fromObjectId, 'adapter');
  assert.equal(autoPower.patch.newConnection.toObjectId, 'laptop');

  // Apply and verify the warning is cleared
  const project = { room, objects, connections };
  const next = applyImprovement(project, autoPower);
  const issues = analyzeProjectWiring(next.objects, next.connections);
  assert.equal(issues.some(issue => issue.code === 'unpowered_input' && issue.objectIds.includes('laptop')), false,
    'unpowered warning should be cleared after auto-connecting laptop');
});

test('applyImprovement applies a layout patch without mutating the input', () => {
  const floating = object('floating', { position: { x: 1.5, y: 0, z: 1.5 }, scale: { x: 0.2, y: 0.2, z: 0.2 } });
  const project = { room, objects: [floating], connections: [] };

  const [drop] = buildFreeImprovements(room, project.objects, project.connections);
  const next = applyImprovement(project, drop);

  assert.notEqual(next, project);
  assert.equal(project.objects[0].position.z, 1.5, 'original project must be untouched');
  assert.deepEqual(next.objects[0].position, drop.patch.position);
  assert.equal(
    analyzeProjectLayout(next.room, next.objects).some(issue => issue.id === 'floating:floating'),
    false
  );
});

test('applyImprovement applies a cable patch and leaves objects untouched', () => {
  const objects = [
    object('source', { position: { x: 0, y: 0, z: 0.1 }, ports: [{ id: 'out', name: 'out', type: 'dc_output', direction: 'output' }] }),
    object('target', { position: { x: 3, y: 0, z: 0.1 }, ports: [{ id: 'in', name: 'in', type: 'dc_input', direction: 'input' }] }),
  ];
  const project = {
    room,
    objects,
    connections: [{
      id: 'c1', name: '电源线', cableType: 'power', length: 1,
      fromObjectId: 'source', fromPortId: 'out', toObjectId: 'target', toPortId: 'in',
    }],
  };

  const extend = buildFreeImprovements(room, project.objects, project.connections)
    .find(item => item.code === 'extend_cable');
  const next = applyImprovement(project, extend);

  assert.equal(next.connections[0].length, extend.patch.length);
  assert.equal(next.objects, project.objects, 'objects array is reused when only a cable changes');
  assert.equal(project.connections[0].length, 1, 'original project must be untouched');
});

test('applyImprovement returns the project unchanged for an empty patch', () => {
  const project = { room, objects: [], connections: [] };
  assert.equal(applyImprovement(project, {}), project);
  assert.equal(applyImprovement(project, undefined), project);
});

test('applyImprovement ignores patches for deleted objects and connections', () => {
  const project = {
    room,
    objects: [object('desk')],
    connections: [{ id: 'existing', length: 1 }],
  };

  assert.equal(applyImprovement(project, {
    patch: { objectId: 'deleted-object', position: { x: 1, y: 0, z: 1 } },
  }), project, 'a stale layout patch must be a no-op');
  assert.equal(applyImprovement(project, {
    patch: { connectionId: 'deleted-connection', length: 2 },
  }), project, 'a stale cable patch must be a no-op');
});

test('applyImprovement does not allocate state for already-applied patches', () => {
  const project = {
    room,
    objects: [object('desk', { position: { x: 1, y: 0, z: 0.5 }, rotation: { x: 0, y: 0, z: 0 } })],
    connections: [{ id: 'existing', length: 2 }],
  };

  assert.equal(applyImprovement(project, {
    patch: { objectId: 'desk', position: { x: 1, y: 0, z: 0.5 }, rotation: { x: 0, y: 0, z: 0 } },
  }), project, 'a repeated layout patch must be a no-op');
  assert.equal(applyImprovement(project, {
    patch: { connectionId: 'existing', length: 2 },
  }), project, 'a repeated cable patch must be a no-op');
});

test('applyImprovement does not append an automatic connection twice', () => {
  const project = {
    room,
    objects: [
      object('outlet', { ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }] }),
      object('pc', { ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }] }),
    ],
    connections: [],
  };
  const suggestion = {
    patch: {
      newConnection: {
        id: 'c-auto-power-pc-ac-in', name: 'PC power', cableType: 'power', length: 1.5,
        fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'pc', toPortId: 'ac-in',
      },
    },
  };

  const once = applyImprovement(project, suggestion);
  const twice = applyImprovement(once, suggestion);

  assert.equal(once.connections.length, 1);
  assert.equal(twice, once, 'reapplying a stale automatic connection must be a no-op');
});

test('applyImprovement does not use a port claimed by a newer connection', () => {
  const project = {
    room,
    objects: [
      object('outlet', { ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }] }),
      object('monitor', { ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }] }),
      object('pc', { ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }] }),
    ],
    connections: [{
      id: 'newer-connection', name: 'Newer connection', cableType: 'power', length: 1,
      fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'monitor', toPortId: 'ac-in',
    }],
  };
  const staleSuggestion = {
    patch: {
      newConnection: {
        id: 'c-auto-power-pc-ac-in', name: 'PC power', cableType: 'power', length: 1.5,
        fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'pc', toPortId: 'ac-in',
      },
    },
  };

  assert.equal(applyImprovement(project, staleSuggestion), project,
    'a stale automatic connection must not create duplicate physical-port occupancy');
});

test('applyImprovement does not create a connection to a deleted endpoint', () => {
  const project = {
    room,
    objects: [object('outlet', {
      ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
    })],
    connections: [],
  };
  const staleSuggestion = {
    patch: {
      newConnection: {
        id: 'c-auto-power-pc-ac-in', name: 'PC power', cableType: 'power', length: 1.5,
        fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'pc', toPortId: 'ac-in',
      },
    },
  };

  assert.equal(applyImprovement(project, staleSuggestion), project,
    'a stale connection must not reintroduce a reference to a deleted device');
});

test('applyImprovement does not create a connection through a deleted port', () => {
  const project = {
    room,
    objects: [
      object('outlet', { ports: [] }),
      object('pc', { ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }] }),
    ],
    connections: [],
  };
  const staleSuggestion = {
    patch: {
      newConnection: {
        id: 'c-auto-power-pc-ac-in', name: 'PC power', cableType: 'power', length: 1.5,
        fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'pc', toPortId: 'ac-in',
      },
    },
  };

  assert.equal(applyImprovement(project, staleSuggestion), project,
    'a stale connection must not reference a port that no longer exists');
});

test('buildRecommendations aggregates free and purchase suggestions with a total', () => {
  const strip = (id, x) => object(id, {
    type: 'power_strip', modelId: 'power-strip',
    position: { x, y: 0, z: 0.1 },
    ports: [
      { id: 'in', name: 'in', type: 'ac_input', direction: 'input' },
      { id: 'out', name: 'out', type: 'ac_output', direction: 'output' },
    ],
  });
  const project = {
    room,
    objects: [
      object('floating', { position: { x: 1.5, y: 0, z: 1.5 }, scale: { x: 0.2, y: 0.2, z: 0.2 } }),
      strip('a', -1),
      strip('b', 1),
    ],
    connections: [
      { id: 'ab', name: 'ab', cableType: 'power', length: 3, fromObjectId: 'a', fromPortId: 'out', toObjectId: 'b', toPortId: 'in' },
    ],
  };

  const result = buildRecommendations(project);
  assert.ok(result.freeImprovements.some(item => item.code === 'drop_to_support'));
  assert.ok(result.purchases.some(item => item.code === 'buy_power_source'));
  assert.equal(result.total, result.freeImprovements.length + result.purchases.length);

  assert.deepEqual(buildRecommendations({}), { freeImprovements: [], purchases: [], total: 0 });
  assert.deepEqual(buildRecommendations({ objects: null, connections: null }), {
    freeImprovements: [], purchases: [], total: 0,
  });
  assert.deepEqual(buildRecommendations(null), { freeImprovements: [], purchases: [], total: 0 });
});

test('buildRecommendations facade tolerates malformed-but-valid project data', () => {
  // App.jsx calls buildRecommendations on every render with live state, which can
  // briefly include a port-bearing object without a position or with a string
  // wattage (neither is rejected by isProjectObject). The facade must not throw.
  const project = {
    room,
    objects: [
      object('strip', {
        type: 'power_strip', modelId: 'power-strip', maxLoad: '2500',
        position: { x: 0, y: 0, z: 0.1 },
        ports: [{ id: 'out', name: 'out', type: 'ac_output', direction: 'output' }],
      }),
      object('heater', {
        wattage: '900',
        position: { x: 1, y: 0, z: 0.1 },
        ports: [{ id: 'in', name: 'in', type: 'ac_input', direction: 'input' }],
      }),
      { id: 'noPos', name: 'noPos', type: 'device', ports: [{ id: 'in', name: 'in', type: 'ac_input', direction: 'input' }] },
    ],
    connections: [
      { id: 'c', name: 'c', cableType: 'power', length: 2, fromObjectId: 'strip', fromPortId: 'out', toObjectId: 'heater', toPortId: 'in' },
    ],
  };

  let result;
  assert.doesNotThrow(() => { result = buildRecommendations(project); });
  assert.equal(typeof result.total, 'number');
});

test('buildRecommendations ignores malformed live port collections and entries', () => {
  assert.deepEqual(buildRecommendations({
    objects: [
      object('bad-collection', { ports: {} }),
      object('bad-entry', { ports: [null] }),
    ],
    connections: [],
  }), {
    freeImprovements: [],
    purchases: [],
    total: 0,
  });
});

test('live recommendations tolerate non-string port names already diagnosed by wiring analysis', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: -1.5, y: 0, z: 0.5 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const switchDevice = object('switch', {
    type: 'switch',
    modelId: 'switch',
    position: { x: 1.5, y: 0, z: 0.5 },
    ports: [{ id: 'eth-1', name: 42, type: 'ethernet', direction: 'bidirectional' }],
  });
  const objects = [router, switchDevice];
  const wiringIssues = analyzeProjectWiring(objects, []);

  const recommendations = buildRecommendations(
    { room, objects, connections: [] },
    { wiringIssues }
  );

  assert.deepEqual({
    portNameIssues: wiringIssues
      .filter(issue => issue.code === 'invalid_port_name_definition')
      .map(({ code, severity, objectIds }) => ({ code, severity, objectIds })),
    freeCodes: recommendations.freeImprovements.map(item => item.code),
    purchaseCodes: recommendations.purchases.map(item => item.code),
    total: recommendations.total,
  }, {
    portNameIssues: [{
      code: 'invalid_port_name_definition',
      severity: 'error',
      objectIds: ['switch'],
    }],
    freeCodes: ['auto_uplink_switch'],
    purchaseCodes: [],
    total: 1,
  });
});

test('live insight APIs ignore non-record entries without hiding valid suggestions', () => {
  const floating = object('floating', {
    position: { x: 1.5, y: 0, z: 1.5 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
  });
  const grounded = object('grounded', { position: { x: -1.5, y: 0, z: 0.5 } });
  const arrayObject = Object.assign([], object('array-floating', {
    position: { x: 0, y: 1, z: 1.5 },
    scale: { x: 0.2, y: 0.2, z: 0.2 },
  }));
  const arrayConnection = Object.assign([], {
    id: 'array-connection',
    name: 'array-connection',
    cableType: 'other',
    length: 1,
    fromObjectId: 'grounded',
    toObjectId: 'floating',
  });
  const objects = [floating, grounded, null, undefined, 42, 'draft', arrayObject];
  const connections = [null, undefined, 42, 'draft', arrayConnection];

  const wiringIssues = analyzeProjectWiring(objects, connections);
  const powerGraph = buildPowerGraph(objects, connections);
  const recommendations = buildRecommendations({ room, objects, connections }, { wiringIssues });

  assert.deepEqual({
    wiringCodes: wiringIssues.map(issue => issue.code),
    powerObjectIds: [...powerGraph.objectById.keys()],
    layoutCodes: analyzeProjectLayout(room, objects).map(issue => issue.code),
    freeCodes: buildFreeImprovements(room, objects, connections).map(item => item.code),
    purchaseCodes: buildPurchaseSuggestions(objects, connections).map(item => item.code),
    facadeFreeCodes: recommendations.freeImprovements.map(item => item.code),
    facadePurchaseCodes: recommendations.purchases.map(item => item.code),
    facadeTotal: recommendations.total,
  }, {
    wiringCodes: [],
    powerObjectIds: ['floating', 'grounded'],
    layoutCodes: ['floating_object'],
    freeCodes: ['drop_to_support'],
    purchaseCodes: [],
    facadeFreeCodes: ['drop_to_support'],
    facadePurchaseCodes: [],
    facadeTotal: 1,
  });
});

test('recommendation builders can reuse precomputed wiring issues', () => {
  const source = object('source', {
    type: 'outlet',
    modelId: 'wall-outlet',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'out', name: 'OUT', type: 'ac_output', direction: 'output' }],
  });
  const device = object('device', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'in', name: 'IN', type: 'ac_input', direction: 'input' }],
  });
  const objects = [source, device];

  const computed = buildFreeImprovements(room, objects, []);
  const reusedEmpty = buildFreeImprovements(room, objects, [], { wiringIssues: [] });
  const reusedByFacade = buildRecommendations({ room, objects, connections: [] }, { wiringIssues: [] });

  assert.equal(computed.some(item => item.code === 'auto_power_device'), true);
  assert.equal(reusedEmpty.some(item => item.code === 'auto_power_device'), false);
  assert.equal(reusedByFacade.freeImprovements.some(item => item.code === 'auto_power_device'), false);
});

test('suggestions come in a stable, deterministic order', () => {
  const objects = [
    object('floating', { position: { x: 1.5, y: 0, z: 1.5 }, scale: { x: 0.2, y: 0.2, z: 0.2 } }),
    object('stray', { position: { x: 10, y: 0, z: 0.5 } }),
  ];

  const codes = buildFreeImprovements(room, objects, []).map(item => item.code);
  const sorted = [...codes].sort();
  // move_inside_room (rank 0) must precede drop_to_support (rank 1).
  assert.deepEqual(codes, ['move_inside_room', 'drop_to_support']);
  // And the order must be independent of input object order.
  const reversed = buildFreeImprovements(room, [...objects].reverse(), []).map(item => item.code);
  assert.deepEqual(reversed, codes);
  assert.notDeepEqual(codes, sorted); // guards against accidental alphabetic sort
});

test('applyAllImprovements resolves every reported issue at once', () => {
  const objects = [
    object('floating', { position: { x: 1.5, y: 0, z: 1.5 }, scale: { x: 0.2, y: 0.2, z: 0.2 } }),
    object('stray', { position: { x: 10, y: 0, z: 0.5 } }),
  ];
  const project = { room, objects, connections: [] };

  const suggestions = buildFreeImprovements(room, project.objects, project.connections);
  const next = applyAllImprovements(project, suggestions);

  assert.equal(buildFreeImprovements(next.room, next.objects, next.connections).length, 0);
  assert.equal(project.objects[0].position.z, 1.5, 'original project must be untouched');
});

test('applyAllAvailableImprovements follows newly unlocked switch uplinks', () => {
  const outlet = object('outlet', {
    type: 'outlet', modelId: 'wall-outlet',
    ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
  });
  const router = object('router', {
    type: 'router', modelId: 'router',
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const switchDevice = object('switch', {
    type: 'switch', modelId: 'switch',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'eth-1', name: 'Port 1', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const project = { room, objects: [outlet, router, switchDevice], connections: [] };

  assert.equal(buildFreeImprovements(room, project.objects, project.connections)
    .some(item => item.code === 'auto_uplink_switch'), false,
  'the initial pass must power the switch before it can suggest an uplink');

  const next = applyAllAvailableImprovements(project);

  assert.equal(next.connections.some(connection => connection.cableType === 'power'), true);
  assert.equal(next.connections.some(connection =>
    connection.cableType === 'ethernet'
    && connection.fromObjectId === 'router'
    && connection.toObjectId === 'switch'
  ), true, 'the follow-up pass should uplink the newly powered switch');
  assert.equal(buildFreeImprovements(next.room, next.objects, next.connections).length, 0);
});

test('applyAllAvailableImprovements reapplies a cable fix after an outlet snap changes its length', () => {
  const outlet = object('outlet', {
    type: 'outlet', modelId: 'wall-outlet',
    position: { x: 0, y: 0, z: 1 },
    scale: { x: 0.08, y: 0.02, z: 0.08 },
    ports: [{ id: 'ac-out', name: 'AC', type: 'ac_output', direction: 'output', anchor: { x: 0, y: -0.5, z: 0 } }],
  });
  const device = object('device', {
    position: { x: 0, y: 0.5, z: 0.5 },
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const project = {
    room,
    objects: [outlet, device],
    connections: [{
      id: 'c1', name: 'power', cableType: 'power', length: 0.2,
      fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'device', toPortId: 'ac-in',
    }],
  };

  const next = applyAllAvailableImprovements(project);

  assert.equal(buildFreeImprovements(next.room, next.objects, next.connections)
    .some(item => item.code === 'extend_cable'), false,
  'the cable must be extended again after the outlet snap changes its required length');
  assert.ok(next.connections[0].length > 2,
    'the final cable length should satisfy the larger post-snap distance');
});

test('suggests networking an unconnected ethernet device and the fix creates a valid connection', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: 0, y: 0, z: 0.1 },
    ports: [
      { id: 'wan', name: 'WAN', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-2', name: 'LAN 2', type: 'ethernet', direction: 'bidirectional' }
    ]
  });

  const pc = object('pc', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 2, y: 0, z: 0.1 },
    ports: [
      { id: 'eth-1', name: '网口', type: 'ethernet', direction: 'bidirectional' }
    ]
  });

  const objects = [router, pc];

  const suggestions1 = buildFreeImprovements(room, objects, []);
  const connect1 = suggestions1.find(item => item.code === 'auto_network_device');
  assert.ok(connect1, 'expected an auto_network_device suggestion');
  assert.deepEqual(connect1.objectIds, ['router', 'pc']);
  assert.equal(connect1.patch.newConnection.fromObjectId, 'router');
  assert.equal(connect1.patch.newConnection.fromPortId, 'lan-1');
  assert.equal(connect1.patch.newConnection.toObjectId, 'pc');
  assert.equal(connect1.patch.newConnection.toPortId, 'eth-1');
  assert.equal(connect1.patch.newConnection.cableType, 'ethernet');

  const project = { room, objects, connections: [] };
  const next = applyImprovement(project, connect1);
  assert.equal(next.connections.length, 1);

  const suggestions2 = buildFreeImprovements(room, next.objects, next.connections);
  const connect2 = suggestions2.find(item => item.code === 'auto_network_device');
  assert.equal(connect2, undefined, 'recommendation should disappear after connection is applied');
});

test('does not use an unpowered router as an automatic network source', () => {
  const adapter = object('adapter', {
    type: 'power-adapter', modelId: 'power-adapter',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'dc-out', name: 'DC OUT', type: 'dc_output', direction: 'output' },
    ],
  });
  const router = object('router', {
    type: 'router', modelId: 'router',
    ports: [
      { id: 'dc-in', name: 'DC IN', type: 'dc_input', direction: 'input' },
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const pc = object('pc', {
    modelId: 'desktop-pc',
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'bidirectional' }],
  });
  const connections = [{
    id: 'adapter-router', name: 'Adapter router power', cableType: 'power', length: 1,
    fromObjectId: 'adapter', fromPortId: 'dc-out', toObjectId: 'router', toPortId: 'dc-in',
  }];

  const suggestions = buildFreeImprovements(room, [adapter, router, pc], connections);

  assert.equal(suggestions.some(item => item.code === 'auto_network_device'), false,
    'a router must have a power path to a root source before it can provide network access');
});

test('does not connect a device through a switch that lacks a router uplink', () => {
  const router = object('router', {
    type: 'router', modelId: 'router', position: { x: 5, y: 0, z: 0.2 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const disconnectedSwitch = object('switch', {
    type: 'switch', modelId: 'switch', position: { x: 0, y: 0, z: 0.2 },
    ports: [{ id: 'eth-1', name: 'Port 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const pc = object('pc', {
    position: { x: 0.2, y: 0, z: 0.2 },
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'input' }],
  });

  const suggestions = buildFreeImprovements(room, [router, disconnectedSwitch, pc], []);
  const connect = suggestions.find(item => item.code === 'auto_network_device');

  assert.ok(connect, 'the reachable router remains a valid network source');
  assert.equal(connect.patch.newConnection.fromObjectId, 'router');
  assert.equal(connect.patch.newConnection.fromPortId, 'lan-1');
});

test('does not treat an ordinary dual-port device as a switch uplink', () => {
  const router = object('router', {
    type: 'router', modelId: 'router', position: { x: 5, y: 0, z: 0.2 },
    ports: [
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-2', name: 'LAN 2', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const dualPortPc = object('dual-port-pc', {
    position: { x: 3, y: 0, z: 0.2 },
    ports: [
      { id: 'eth-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' },
      { id: 'eth-2', name: 'LAN 2', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const switchDevice = object('switch', {
    type: 'switch', modelId: 'switch', position: { x: 0, y: 0, z: 0.2 },
    ports: [
      { id: 'eth-1', name: 'Port 1', type: 'ethernet', direction: 'bidirectional' },
      { id: 'eth-2', name: 'Port 2', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const target = object('target', {
    position: { x: 0.2, y: 0, z: 0.2 },
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'input' }],
  });
  const connections = [
    { id: 'router-pc', name: 'Router PC link', cableType: 'ethernet', length: 1, fromObjectId: 'router', fromPortId: 'lan-1', toObjectId: 'dual-port-pc', toPortId: 'eth-1' },
    { id: 'pc-switch', name: 'PC switch link', cableType: 'ethernet', length: 1, fromObjectId: 'dual-port-pc', fromPortId: 'eth-2', toObjectId: 'switch', toPortId: 'eth-1' },
  ];

  const suggestions = buildFreeImprovements(room, [router, dualPortPc, switchDevice, target], connections);
  const connect = suggestions.find(item => item.code === 'auto_network_device' && item.objectIds.includes('target'));

  assert.ok(connect, 'the spare router LAN port remains a valid network source');
  assert.equal(connect.patch.newConnection.fromObjectId, 'router');
  assert.equal(connect.patch.newConnection.fromPortId, 'lan-2');
});

test('uses a switch after it is validly uplinked to a router', () => {
  const router = object('router', {
    type: 'router', modelId: 'router', position: { x: 5, y: 0, z: 0.2 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const switchDevice = object('switch', {
    type: 'switch', modelId: 'switch', position: { x: 0, y: 0, z: 0.2 },
    ports: [
      { id: 'eth-1', name: 'Port 1', type: 'ethernet', direction: 'bidirectional' },
      { id: 'eth-2', name: 'Port 2', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const target = object('target', {
    position: { x: 0.2, y: 0, z: 0.2 },
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'input' }],
  });
  const connections = [{
    id: 'router-switch', name: 'Router switch uplink', cableType: 'ethernet', length: 1,
    fromObjectId: 'router', fromPortId: 'lan-1', toObjectId: 'switch', toPortId: 'eth-1',
  }];

  const suggestions = buildFreeImprovements(room, [router, switchDevice, target], connections);
  const connect = suggestions.find(item => item.code === 'auto_network_device');

  assert.ok(connect, 'the uplinked switch is available to downstream devices');
  assert.equal(connect.patch.newConnection.fromObjectId, 'switch');
  assert.equal(connect.patch.newConnection.fromPortId, 'eth-2');
});

test('suggests uplinking an unconnected switch through a free router LAN port', () => {
  const router = object('router', {
    type: 'router', modelId: 'router', position: { x: 2, y: 0, z: 0.2 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const switchDevice = object('switch', {
    type: 'switch', modelId: 'switch', position: { x: 0, y: 0, z: 0.2 },
    ports: [{ id: 'eth-1', name: 'Port 1', type: 'ethernet', direction: 'bidirectional' }],
  });

  const suggestion = buildFreeImprovements(room, [router, switchDevice], [])
    .find(item => item.code === 'auto_uplink_switch');

  assert.ok(suggestion);
  assert.equal(suggestion.patch.newConnection.fromObjectId, 'router');
  assert.equal(suggestion.patch.newConnection.toObjectId, 'switch');
});

test('does not uplink a switch through an output-only ethernet port', () => {
  const router = object('router', {
    type: 'router', modelId: 'router',
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const switchDevice = object('switch', {
    type: 'switch', modelId: 'switch',
    ports: [{ id: 'eth-out', name: 'Output', type: 'ethernet', direction: 'output' }],
  });

  assert.equal(
    buildFreeImprovements(room, [router, switchDevice], []).some(item => item.code === 'auto_uplink_switch'),
    false
  );
});

test('does not uplink a switch through its WAN port', () => {
  const router = object('router', {
    type: 'router', modelId: 'router',
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const switchDevice = object('switch', {
    type: 'switch', modelId: 'switch',
    ports: [{ id: 'wan', name: 'WAN', type: 'ethernet', direction: 'bidirectional' }],
  });

  assert.equal(
    buildFreeImprovements(room, [router, switchDevice], []).some(item => item.code === 'auto_uplink_switch'),
    false,
    'a WAN port cannot provide the downstream network capacity promised by an uplink'
  );
});

test('recognizes custom switch WAN port ids regardless of case', () => {
  const router = object('router', {
    type: 'router', modelId: 'router',
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const switchDevice = object('switch', {
    type: 'switch', modelId: 'switch',
    ports: [{ id: 'WAN', name: 'Internet', type: 'ethernet', direction: 'bidirectional' }],
  });

  assert.equal(
    buildFreeImprovements(room, [router, switchDevice], []).some(item => item.code === 'auto_uplink_switch'),
    false,
    'an uppercase WAN id must not be treated as downstream switch capacity'
  );
});

test('does not uplink a switch before its power input is connected', () => {
  const router = object('router', {
    type: 'router', modelId: 'router',
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const switchDevice = object('switch', {
    type: 'switch', modelId: 'switch',
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'eth-1', name: 'Port 1', type: 'ethernet', direction: 'bidirectional' },
    ],
  });

  const suggestions = buildFreeImprovements(room, [router, switchDevice], []);

  assert.equal(suggestions.some(item => item.code === 'auto_uplink_switch'), false,
    'a switch must be powered before an uplink can deliver network access');
});

test('keeps a switch uplink suggestion when router capacity also covers an endpoint', () => {
  const router = object('router', {
    type: 'router', modelId: 'router', position: { x: 2, y: 0, z: 0.2 },
    ports: [
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' },
      { id: 'lan-2', name: 'LAN 2', type: 'ethernet', direction: 'bidirectional' },
    ],
  });
  const switchDevice = object('switch', {
    type: 'switch', modelId: 'switch', position: { x: 0, y: 0, z: 0.2 },
    ports: [{ id: 'eth-1', name: 'Port 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const pc = object('pc', {
    ports: [{ id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'input' }],
  });

  const suggestions = buildFreeImprovements(room, [router, switchDevice, pc], []);
  assert.ok(suggestions.some(item => item.code === 'auto_uplink_switch'));
  assert.ok(suggestions.some(item => item.code === 'auto_network_device'));
});

test('does not suggest networking an ethernet output-only device port', () => {
  const router = object('router', {
    type: 'router',
    modelId: 'router',
    position: { x: 0, y: 0, z: 0.1 },
    ports: [{ id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }],
  });
  const device = object('uplink-only', {
    position: { x: 1, y: 0, z: 0.1 },
    ports: [{ id: 'uplink', name: 'Uplink', type: 'ethernet', direction: 'output' }],
  });

  const suggestions = buildFreeImprovements(room, [router, device], []);
  assert.equal(suggestions.some(item => item.code === 'auto_network_device'), false);
});

test('suggests purchasing a UPS/power split when a power hub is overloaded', () => {
  const ups = object('my-ups', {
    type: 'ups',
    modelId: 'ups',
    maxLoad: 500,
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' },
      { id: 'ac-out-1', name: 'AC OUT 1', type: 'ac_output', direction: 'output' },
      { id: 'ac-out-2', name: 'AC OUT 2', type: 'ac_output', direction: 'output' },
    ]
  });

  const pc = object('my-pc', {
    type: 'desktop-pc',
    wattage: 350,
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }
    ]
  });

  const monitor = object('my-monitor', {
    type: 'monitor',
    wattage: 200,
    ports: [
      { id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }
    ]
  });

  const objects = [ups, pc, monitor];

  const connections = [
    { id: 'c1', name: 'c1', cableType: 'power', length: 1, fromObjectId: 'my-ups', fromPortId: 'ac-out-1', toObjectId: 'my-pc', toPortId: 'ac-in' },
    { id: 'c2', name: 'c2', cableType: 'power', length: 1, fromObjectId: 'my-ups', fromPortId: 'ac-out-2', toObjectId: 'my-monitor', toPortId: 'ac-in' }
  ];

  const suggestions = buildPurchaseSuggestions(objects, connections);
  const overloadSuggest = suggestions.find(item => item.code === 'buy_ups_overload');
  assert.ok(overloadSuggest, 'expected a buy_ups_overload purchase suggestion');
  assert.deepEqual(overloadSuggest.objectIds, ['my-ups']);
  assert.equal(overloadSuggest.product.category, 'power');
  assert.equal(overloadSuggest.product.modelId, 'ups');
});

test('App power safety falls back to catalog maxLoad only for unusable live overrides', () => {
  const cases = [
    { label: 'missing', includeOverride: false, expected: true },
    { label: 'null', maxLoad: null, expected: true },
    { label: 'zero', maxLoad: 0, expected: false },
    { label: 'negative', maxLoad: -1, expected: true },
    { label: 'NaN', maxLoad: Number.NaN, expected: true },
    { label: 'blank string', maxLoad: '   ', expected: true },
    { label: 'numeric string', maxLoad: '2500', expected: false },
    { label: 'nonnumeric string', maxLoad: 'oops', expected: true },
  ];

  const actual = cases.map(({
    label,
    includeOverride = true,
    maxLoad,
  }) => {
    const ups = object('catalog-ups', {
      type: 'ups',
      modelId: 'ups',
      ports: [{ id: 'out', name: 'OUT', type: 'ac_output', direction: 'output' }],
      ...(includeOverride ? { maxLoad } : {}),
    });
    const load = object('heavy-load', {
      wattage: 1200,
      ports: [{ id: 'in', name: 'IN', type: 'ac_input', direction: 'input' }],
    });
    const objects = [ups, load];
    const connections = [{
      id: 'power',
      name: 'Power',
      cableType: 'power',
      length: 1,
      fromObjectId: 'catalog-ups',
      fromPortId: 'out',
      toObjectId: 'heavy-load',
      toPortId: 'in',
    }];
    const wiringIssues = analyzeProjectWiring(objects, connections);
    const recommendations = buildRecommendations(
      { room, objects, connections },
      { wiringIssues }
    );

    return {
      label,
      wiringOverload: wiringIssues.some(issue => issue.code === 'power_overload'),
      purchaseOverload: recommendations.purchases.some(
        item => item.code === 'buy_ups_overload'
      ),
    };
  });

  assert.deepEqual(actual, cases.map(({ label, expected }) => ({
    label,
    wiringOverload: expected,
    purchaseOverload: expected,
  })));
});

test('recommends buying a power source when an unpowered device has no nearby free port', () => {
  // A single unpowered PC with no power source at all → should recommend buying a UPS
  const pc = object('lonely-pc', {
    modelId: 'desktop-pc',
    wattage: 350,
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const objects = [pc];

  const purchases = buildPurchaseSuggestions(objects, []);
  const buyPower = purchases.find(item => item.code === 'buy_power_for_unpowered');
  assert.ok(buyPower, 'expected a buy_power_for_unpowered suggestion when no power source exists');
  assert.ok(buyPower.objectIds.includes('lonely-pc'));
  assert.equal(buyPower.product.category, 'power');
  assert.ok(['ups', 'power-strip'].includes(buyPower.product.modelId));
});

test('recommends buying a power source when nearest source ports are all occupied', () => {
  // A wall outlet exists but both ports are occupied; an unpowered PC needs power
  const outlet = object('outlet-1', {
    type: 'outlet',
    modelId: 'wall-outlet',
    ports: [
      { id: 'ac-out-1', name: 'Out 1', type: 'ac_output', direction: 'output' },
      { id: 'ac-out-2', name: 'Out 2', type: 'ac_output', direction: 'output' },
    ],
  });
  const pc = object('lonely-pc', {
    modelId: 'desktop-pc',
    wattage: 350,
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const load1 = object('load1', {
    wattage: 100,
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const load2 = object('load2', {
    wattage: 100,
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const objects = [outlet, pc, load1, load2];
  // Both outlet ports occupied
  const connections = [
    { id: 'c1', name: 'c1', cableType: 'power', length: 1, fromObjectId: 'outlet-1', fromPortId: 'ac-out-1', toObjectId: 'load1', toPortId: 'ac-in' },
    { id: 'c2', name: 'c2', cableType: 'power', length: 1, fromObjectId: 'outlet-1', fromPortId: 'ac-out-2', toObjectId: 'load2', toPortId: 'ac-in' },
  ];

  const purchases = buildPurchaseSuggestions(objects, connections);
  const buyPower = purchases.find(item => item.code === 'buy_power_for_unpowered');
  assert.ok(buyPower, 'expected a buy_power_for_unpowered suggestion when power ports are all occupied');
  assert.ok(buyPower.objectIds.includes('lonely-pc'));
});

test('does not suggest buying power when unpowered device has a nearby free port', () => {
  // When a free port exists, auto_power_device (free) handles it — no purchase needed
  const strip = object('strip1', {
    type: 'power_strip',
    modelId: 'power-strip',
    ports: [
      { id: 'ac-in', name: 'in', type: 'ac_input', direction: 'input' },
      { id: 'ac-out-1', name: 'out 1', type: 'ac_output', direction: 'output' },
    ],
  });
  const pc = object('pc1', {
    modelId: 'desktop-pc',
    wattage: 350,
    ports: [{ id: 'ac-in', name: 'AC IN', type: 'ac_input', direction: 'input' }],
  });
  const outlet = object('outlet', {
    type: 'outlet', modelId: 'wall-outlet',
    ports: [{ id: 'ac-out', name: 'AC OUT', type: 'ac_output', direction: 'output' }],
  });
  const objects = [outlet, strip, pc];
  const connections = [{
    id: 'outlet-strip', name: 'Outlet strip power', cableType: 'power', length: 1,
    fromObjectId: 'outlet', fromPortId: 'ac-out', toObjectId: 'strip1', toPortId: 'ac-in',
  }];

  const purchases = buildPurchaseSuggestions(objects, connections);
  assert.equal(purchases.some(item => item.code === 'buy_power_for_unpowered'), false,
    'should not recommend buying power when free port is available nearby');
});

test('suggests connecting an unconnected HDMI output to a nearby monitor', () => {
  const pc = object('pc', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-out', name: 'HDMI OUT', type: 'hdmi', direction: 'output' }],
  });
  const monitor = object('monitor1', {
    type: 'monitor',
    modelId: 'monitor-24',
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-in', name: 'HDMI IN', type: 'hdmi', direction: 'input' }],
  });
  const objects = [pc, monitor];

  const suggestions = buildFreeImprovements(room, objects, []);
  const connect = suggestions.find(item => item.code === 'auto_connect_display');
  assert.ok(connect, 'expected an auto_connect_display suggestion');
  assert.equal(connect.patch.newConnection.fromObjectId, 'pc');
  assert.equal(connect.patch.newConnection.fromPortId, 'hdmi-out');
  assert.equal(connect.patch.newConnection.toObjectId, 'monitor1');
  assert.equal(connect.patch.newConnection.toPortId, 'hdmi-in');
  assert.equal(connect.patch.newConnection.cableType, 'hdmi');

  // Apply and verify
  const project = { room, objects, connections: [] };
  const next = applyImprovement(project, connect);
  assert.equal(next.connections.length, 1);

  const suggestions2 = buildFreeImprovements(room, next.objects, next.connections);
  assert.equal(suggestions2.some(item => item.code === 'auto_connect_display'), false,
    'suggestion should disappear after connection is applied');
});

test('does not suggest display connection when monitor HDMI input is occupied', () => {
  const pc = object('pc', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-out', name: 'HDMI OUT', type: 'hdmi', direction: 'output' }],
  });
  const monitor = object('monitor1', {
    type: 'monitor',
    modelId: 'monitor-24',
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-in', name: 'HDMI IN', type: 'hdmi', direction: 'input' }],
  });
  const otherPc = object('pc2', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 2, y: 0, z: 0.5 },
    ports: [{ id: 'hdmi-out', name: 'HDMI OUT', type: 'hdmi', direction: 'output' }],
  });
  const objects = [pc, monitor, otherPc];
  // Monitor's HDMI-in is already used by otherPc
  const connections = [
    { id: 'existing', name: 'existing', cableType: 'hdmi', length: 1,
      fromObjectId: 'pc2', fromPortId: 'hdmi-out', toObjectId: 'monitor1', toPortId: 'hdmi-in' },
  ];

  const suggestions = buildFreeImprovements(room, objects, connections);
  assert.equal(suggestions.some(item => item.code === 'auto_connect_display'), false,
    'should not suggest when monitor input is already occupied');
});

test('suggests connecting DisplayPort output to nearby monitor with DP input', () => {
  const pc = object('pc', {
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [
      { id: 'dp-out', name: 'DP OUT', type: 'displayport', direction: 'output' },
      { id: 'hdmi-out', name: 'HDMI OUT', type: 'hdmi', direction: 'output' },
    ],
  });
  const monitor = object('monitor1', {
    type: 'monitor',
    modelId: 'monitor-24',
    position: { x: 1, y: 0, z: 0.5 },
    ports: [
      { id: 'dp-in', name: 'DP IN', type: 'displayport', direction: 'input' },
      { id: 'hdmi-in', name: 'HDMI IN', type: 'hdmi', direction: 'input' },
    ],
  });
  const objects = [pc, monitor];

  const suggestions = buildFreeImprovements(room, objects, []);
  const displaySuggestions = suggestions.filter(item => item.code === 'auto_connect_display');
  assert.equal(displaySuggestions.length, 2, 'should suggest both HDMI and DP connections');
  assert.equal(displaySuggestions[0].patch.newConnection.cableType, 'displayport');
  assert.equal(displaySuggestions[1].patch.newConnection.cableType, 'hdmi');
});

test('suggests connecting USB-C display output to nearby monitor with USB-C input', () => {
  const laptop = object('laptop', {
    type: 'laptop',
    modelId: 'laptop-15',
    position: { x: 0, y: 0, z: 0.5 },
    ports: [{ id: 'usb-c', name: 'USB-C', type: 'usb_c', direction: 'bidirectional' }],
  });
  const monitor = object('monitor1', {
    type: 'monitor',
    modelId: 'monitor-27',
    position: { x: 1, y: 0, z: 0.5 },
    ports: [{ id: 'usb-c-in', name: 'USB-C IN', type: 'usb_c', direction: 'input' }],
  });
  const objects = [laptop, monitor];

  const suggestions = buildFreeImprovements(room, objects, []);
  const connect = suggestions.find(item => item.code === 'auto_connect_display');
  assert.ok(connect, 'expected an auto_connect_display suggestion');
  assert.equal(connect.patch.newConnection.fromObjectId, 'laptop');
  assert.equal(connect.patch.newConnection.fromPortId, 'usb-c');
  assert.equal(connect.patch.newConnection.toObjectId, 'monitor1');
  assert.equal(connect.patch.newConnection.toPortId, 'usb-c-in');
  assert.equal(connect.patch.newConnection.cableType, 'usb_c');

  const project = { room, objects, connections: [] };
  const next = applyImprovement(project, connect);
  assert.equal(next.connections.length, 1);

  const suggestions2 = buildFreeImprovements(room, next.objects, next.connections);
  assert.equal(suggestions2.some(item => item.code === 'auto_connect_display'), false,
    'suggestion should disappear after USB-C display connection is applied');
});
