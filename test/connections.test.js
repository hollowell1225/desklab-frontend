import test from 'node:test';
import assert from 'node:assert/strict';

import {
  arePortsCompatible,
  arePortTypesCompatible,
  calculatePositionDistance,
  evaluateConnectionLength,
  getConnectionEndpoints,
  getPortWorldPosition,
  inferCableType,
  isPortDirectionConsistent,
  parsePositiveCableLength,
  requiredPowerPortDirection,
  shouldResetConnectionDraftForSelection,
  buildEthernetTopology,
} from '../src/domain/connections.js';
import { toThreePosition, toThreeZRotation } from '../src/domain/coordinates.js';

test('infers the formal cable type from both endpoint ports', () => {
  assert.equal(inferCableType({ type: 'hdmi' }, { type: 'hdmi' }), 'hdmi');
  assert.equal(inferCableType({ type: 'usb_c' }, { type: 'usb_c' }), 'usb_c');
  assert.equal(inferCableType({ type: 'ac_output' }, { type: 'ac_input' }), 'power');
  assert.equal(inferCableType({ type: 'dc_output' }, { type: 'dc_input' }), 'power');
  assert.equal(inferCableType({ type: 'custom' }, { type: 'custom' }), 'other');
});

test('checks direction and type compatibility together', () => {
  assert.equal(
    arePortsCompatible(
      { type: 'hdmi', direction: 'output' },
      { type: 'hdmi', direction: 'input' }
    ),
    true
  );
  assert.equal(
    arePortsCompatible(
      { type: 'hdmi', direction: 'input' },
      { type: 'hdmi', direction: 'input' }
    ),
    false
  );
  assert.equal(
    arePortsCompatible(
      { type: 'hdmi', direction: 'output' },
      { type: 'ethernet', direction: 'input' }
    ),
    false
  );
});

test('power port type and direction cannot contradict each other', () => {
  assert.equal(requiredPowerPortDirection('ac_input'), 'input');
  assert.equal(requiredPowerPortDirection('dc_output'), 'output');
  assert.equal(requiredPowerPortDirection('hdmi'), null);
  assert.equal(isPortDirectionConsistent({ type: 'ac_input', direction: 'input' }), true);
  assert.equal(isPortDirectionConsistent({ type: 'ac_input', direction: 'output' }), false);
  assert.equal(arePortTypesCompatible('ac_input', 'ac_output'), false);
  assert.equal(arePortTypesCompatible('ac_output', 'ac_input'), true);
  assert.equal(
    arePortsCompatible(
      { type: 'ac_input', direction: 'output' },
      { type: 'ac_output', direction: 'input' }
    ),
    false
  );
});

test('calculates 3D distance in business XYZ coordinates', () => {
  assert.equal(
    calculatePositionDistance(
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 4, z: 12 }
    ),
    13
  );
});

test('reports cable slack and sufficiency', () => {
  const objects = [
    { id: 'a', position: { x: 0, y: 0, z: 0 } },
    { id: 'b', position: { x: 0, y: 3, z: 4 } },
  ];

  assert.deepEqual(
    evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'b', length: 6 }, objects),
    {
      distance: 5,
      cableLength: 6,
      slack: 1,
      sufficient: true,
      recommendedLength: 5.5,
      recommendedSlack: 0.5,
      hasRecommendedSlack: true,
    }
  );
  assert.equal(
    evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'b', length: 4.5 }, objects)?.sufficient,
    false
  );
  assert.equal(evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'b', length: 5.2 }, objects)?.hasRecommendedSlack, false);

  // Applying the recommended length must itself satisfy both slack checks, so the
  // "increase cable length" suggestion always resolves the warning it raised.
  const recommended = evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'b', length: 5.2 }, objects).recommendedLength;
  const applied = evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'b', length: recommended }, objects);
  assert.equal(applied.sufficient, true);
  assert.equal(applied.hasRecommendedSlack, true);
});

test('returns null for missing endpoints or invalid lengths', () => {
  const objects = [{ id: 'a', position: { x: 0, y: 0, z: 0 } }];
  assert.equal(evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'missing', length: 1 }, objects), null);
  assert.equal(evaluateConnectionLength({ fromObjectId: 'a', toObjectId: 'a', length: 0 }, objects), null);
});

test('accepts only finite positive cable lengths from editor input', () => {
  assert.equal(parsePositiveCableLength('2.5'), 2.5);
  assert.equal(parsePositiveCableLength('1e309'), null);
  assert.equal(parsePositiveCableLength(Infinity), null);
  assert.equal(parsePositiveCableLength(0), null);
  assert.equal(parsePositiveCableLength(-1), null);
});

test('resets an in-progress connection draft when the selected source device changes', () => {
  assert.equal(
    shouldResetConnectionDraftForSelection({ fromObjectId: 'device-a', fromPortId: 'out' }, 'device-b'),
    true
  );
  assert.equal(
    shouldResetConnectionDraftForSelection({ fromObjectId: 'device-a', fromPortId: 'out' }, 'device-a'),
    false
  );
  assert.equal(
    shouldResetConnectionDraftForSelection({ fromPortId: 'legacy-draft-without-source' }, 'device-b'),
    false
  );
});

test('transforms normalized local port anchors with scale and Z rotation', () => {
  const device = {
    id: 'device',
    position: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 0, z: 90 },
    scale: { x: 2, y: 4, z: 6 },
    ports: [{
      id: 'port',
      anchor: { x: 0.5, y: 0, z: 0.5 },
    }],
  };

  const position = getPortWorldPosition(device, 'port');
  assert.ok(Math.abs(position.x - 1) < 1e-10);
  assert.ok(Math.abs(position.y - 3) < 1e-10);
  assert.equal(position.z, 6);
});

test('rendered marker rotation matches the business-space port endpoint', () => {
  const device = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { z: 90 },
    scale: { x: 2, y: 1, z: 1 },
    ports: [{ id: 'right', anchor: { x: 0.5, y: 0, z: 0 } }],
  };
  const businessEndpoint = getPortWorldPosition(device, 'right');
  assert.deepEqual(toThreePosition(businessEndpoint).map(value => Math.round(value)), [0, 0, 1]);

  const [, threeYRotation] = toThreeZRotation(device.rotation.z);
  const localX = device.ports[0].anchor.x * device.scale.x;
  const renderedMarker = [
    localX * Math.cos(threeYRotation),
    0,
    -localX * Math.sin(threeYRotation),
  ];
  assert.deepEqual(renderedMarker.map(value => Math.round(value)), [0, 0, 1]);
});

test('uses port anchors for connection endpoints and cable distance', () => {
  const objects = [
    { id: 'a', position: { x: 0, y: 0, z: 0 }, rotation: { z: 0 }, scale: { x: 2, y: 1, z: 1 }, ports: [{ id: 'out', anchor: { x: 0.5, y: 0, z: 0 } }] },
    { id: 'b', position: { x: 5, y: 0, z: 0 }, rotation: { z: 0 }, scale: { x: 2, y: 1, z: 1 }, ports: [{ id: 'in', anchor: { x: -0.5, y: 0, z: 0 } }] },
  ];
  const connection = { fromObjectId: 'a', fromPortId: 'out', toObjectId: 'b', toPortId: 'in', length: 3 };
  assert.deepEqual(getConnectionEndpoints(connection, objects), {
    from: { x: 1, y: 0, z: 0 },
    to: { x: 4, y: 0, z: 0 },
  });
  assert.equal(evaluateConnectionLength(connection, objects)?.distance, 3);
  const objectById = new Map(objects.map(object => [object.id, object]));
  const indexedEndpoints = getConnectionEndpoints(connection, objects, objectById);
  assert.deepEqual(indexedEndpoints, {
    from: { x: 1, y: 0, z: 0 },
    to: { x: 4, y: 0, z: 0 },
  });
  assert.equal(evaluateConnectionLength(connection, objects, indexedEndpoints)?.distance, 3);
});

test('builds ethernet topology for a selected device', () => {
  const router = {
    id: 'router-1',
    name: '我的主路由器',
    type: 'router',
    modelId: 'router',
    ports: [
      { id: 'wan', name: 'WAN口', type: 'ethernet' },
      { id: 'lan-1', name: 'LAN 1', type: 'ethernet' },
      { id: 'lan-2', name: 'LAN 2', type: 'ethernet' },
      { id: 'ac-in', name: '电源', type: 'ac_input' }
    ]
  };
  const pc = {
    id: 'pc-1',
    name: '台式主机',
    type: 'desktop-pc',
    modelId: 'desktop-pc',
    ports: [
      { id: 'eth-1', name: '网口', type: 'ethernet' }
    ]
  };
  const objects = [router, pc];
  const connections = [
    {
      id: 'conn-1',
      fromObjectId: 'router-1',
      fromPortId: 'lan-1',
      toObjectId: 'pc-1',
      toPortId: 'eth-1',
      cableType: 'ethernet',
      length: 2
    }
  ];

  assert.deepEqual(buildEthernetTopology(null, objects, connections), []);
  assert.deepEqual(buildEthernetTopology({ id: 'empty' }, objects, connections), []);

  const routerTopo = buildEthernetTopology(router, objects, connections);
  assert.equal(routerTopo.length, 3);

  const wan = routerTopo.find(t => t.portId === 'wan');
  assert.equal(wan.status, 'idle');
  assert.equal(wan.connectedDevice, null);

  const lan1 = routerTopo.find(t => t.portId === 'lan-1');
  assert.equal(lan1.status, 'connected');
  assert.equal(lan1.connectedDevice.id, 'pc-1');
  assert.equal(lan1.connectedDevice.name, '台式主机');
  assert.equal(lan1.connectedDevice.type, 'desktop-pc');
  assert.equal(lan1.connectedPort.id, 'eth-1');
});
