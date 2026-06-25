import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyAllImprovements,
  applyImprovement,
  buildFreeImprovements,
  buildPurchaseSuggestions,
  buildRecommendations,
} from '../src/domain/recommendations.js';
import { analyzeProjectLayout } from '../src/domain/layout-analysis.js';
import { analyzeProjectWiring } from '../src/domain/analysis.js';
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

  // Verify it doesn't recommend if a switch already exists
  const objectsWithSwitch = [...objects, object('switch-1', { modelId: 'switch' })];
  const purchasesWithSwitch = buildPurchaseSuggestions(objectsWithSwitch, []);
  assert.equal(purchasesWithSwitch.some(item => item.code === 'buy_switch'), false);
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
    { id: 'c1', name: 'p1', cableType: 'power', fromObjectId: 'strip-1', fromPortId: 'ac-out-1', toObjectId: 'pc1', toPortId: 'ac-in' },
    { id: 'c2', name: 'p2', cableType: 'power', fromObjectId: 'strip-1', fromPortId: 'ac-out-2', toObjectId: 'pc2', toPortId: 'ac-in' },
  ];

  const purchases = buildPurchaseSuggestions(objects, connections);
  const buyStrip = purchases.find(item => item.code === 'buy_power_strip');
  assert.ok(buyStrip, 'expected a buy_power_strip purchase suggestion');
  assert.equal(buyStrip.product.category, 'power');
  assert.equal(buyStrip.product.modelId, 'power-strip');
  assert.deepEqual(buyStrip.objectIds, ['strip-1']);

  // Verify it doesn't recommend if the strip has vacant ac_output ports
  const vacantConnections = [
    { id: 'c1', name: 'p1', cableType: 'power', fromObjectId: 'strip-1', fromPortId: 'ac-out-1', toObjectId: 'pc1', toPortId: 'ac-in' },
  ];
  const purchasesVacant = buildPurchaseSuggestions(objects, vacantConnections);
  assert.equal(purchasesVacant.some(item => item.code === 'buy_power_strip'), false);
});

test('suggests powering an unpowered device and the fix creates a valid connection', () => {
  // 1. Create a power strip with a vacant ac_output
  const strip = object('strip1', {
    type: 'power_strip',
    modelId: 'power-strip',
    ports: [
      { id: 'ac-in', name: 'in', type: 'ac_input', direction: 'input' },
      { id: 'ac-out-1', name: 'out 1', type: 'ac_output', direction: 'output' },
    ]
  });
  // 2. Create a desktop PC with an unpowered ac_input
  const pc = object('pc1', {
    modelId: 'desktop-pc',
    position: { x: 1, y: 1, z: 0.5 },
    ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }]
  });
  const objects = [strip, pc];

  const suggestions = buildFreeImprovements(room, objects, []);
  const autoPower = suggestions.find(item => item.code === 'auto_power_device');
  assert.ok(autoPower, 'expected an auto_power_device suggestion');
  assert.equal(autoPower.patch.newConnection.fromObjectId, 'strip1');
  assert.equal(autoPower.patch.newConnection.toObjectId, 'pc1');

  // Apply the patch
  const project = { room, objects, connections: [] };
  const next = applyImprovement(project, autoPower);
  assert.equal(next.connections.length, 1);
  assert.equal(next.connections[0].fromObjectId, 'strip1');
  assert.equal(next.connections[0].toObjectId, 'pc1');

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
  const objects = [adapter, laptop];

  const suggestions = buildFreeImprovements(room, objects, []);
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

test('auto_power_device with real catalog power-adapter and laptop clears unpowered warning', () => {
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
  const objects = [adapter, laptop];

  const suggestions = buildFreeImprovements(room, objects, []);
  const autoPower = suggestions.find(item => item.code === 'auto_power_device');
  assert.ok(autoPower, 'expected auto_power_device for unpowered laptop near adapter');
  assert.equal(autoPower.patch.newConnection.cableType, 'power',
    'dc_output from adapter → dc_input on laptop should be power cable');
  assert.equal(autoPower.patch.newConnection.fromObjectId, 'adapter');
  assert.equal(autoPower.patch.newConnection.toObjectId, 'laptop');

  // Apply and verify the warning is cleared
  const project = { room, objects, connections: [] };
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
    { id: 'c1', name: 'c1', cableType: 'power', fromObjectId: 'my-ups', fromPortId: 'ac-out-1', toObjectId: 'my-pc', toPortId: 'ac-in' },
    { id: 'c2', name: 'c2', cableType: 'power', fromObjectId: 'my-ups', fromPortId: 'ac-out-2', toObjectId: 'my-monitor', toPortId: 'ac-in' }
  ];

  const suggestions = buildPurchaseSuggestions(objects, connections);
  const overloadSuggest = suggestions.find(item => item.code === 'buy_ups_overload');
  assert.ok(overloadSuggest, 'expected a buy_ups_overload purchase suggestion');
  assert.deepEqual(overloadSuggest.objectIds, ['my-ups']);
  assert.equal(overloadSuggest.product.category, 'power');
  assert.equal(overloadSuggest.product.modelId, 'ups');
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
  const objects = [strip, pc];

  const purchases = buildPurchaseSuggestions(objects, []);
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
