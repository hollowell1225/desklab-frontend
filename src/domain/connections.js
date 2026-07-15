import { getPortRecords } from './port-collections.js';

export const CABLE_SERVICE_LOOP_FACTOR = 1.1;
export const CABLE_TYPE_VALUES = ['power', 'hdmi', 'usb_c', 'ethernet', 'displayport', 'other'];

const POWER_PORT_TYPES = new Set(['ac_input', 'ac_output', 'dc_input', 'dc_output']);

export function parsePositiveCableLength(value) {
  const length = Number(value);
  return Number.isFinite(length) && length > 0 ? length : null;
}

export function shouldResetConnectionDraftForSelection(draft, selectedObjectId) {
  return Boolean(draft?.fromObjectId
    && selectedObjectId
    && draft.fromObjectId !== selectedObjectId);
}

export function requiredPowerPortDirection(type) {
  if (type === 'ac_input' || type === 'dc_input') return 'input';
  if (type === 'ac_output' || type === 'dc_output') return 'output';
  return null;
}

export function isPortDirectionConsistent(port) {
  if (!port) return false;
  const requiredDirection = requiredPowerPortDirection(port.type);
  return !requiredDirection || port.direction === requiredDirection;
}

export function arePortTypesCompatible(fromType, toType) {
  if (fromType === toType) return true;
  if (fromType === 'ac_output' && toType === 'ac_input') return true;
  if (fromType === 'dc_output' && toType === 'dc_input') return true;
  return false;
}

export function arePortsCompatible(fromPort, toPort) {
  if (!fromPort || !toPort) return false;
  if (!isPortDirectionConsistent(fromPort) || !isPortDirectionConsistent(toPort)) return false;
  const sourceDirectionValid = fromPort.direction === 'output' || fromPort.direction === 'bidirectional';
  const targetDirectionValid = toPort.direction === 'input' || toPort.direction === 'bidirectional';
  return sourceDirectionValid
    && targetDirectionValid
    && arePortTypesCompatible(fromPort.type, toPort.type);
}

export function inferCableType(fromPort, toPort) {
  if (!fromPort || !toPort) return 'other';
  if (POWER_PORT_TYPES.has(fromPort.type) && POWER_PORT_TYPES.has(toPort.type)) return 'power';
  if (fromPort.type === toPort.type && CABLE_TYPE_VALUES.includes(fromPort.type)) {
    return fromPort.type;
  }
  return 'other';
}

const isFinitePosition = (position) =>
  position && ['x', 'y', 'z'].every(axis => Number.isFinite(position[axis]));

export function calculatePositionDistance(fromPosition, toPosition) {
  if (!isFinitePosition(fromPosition) || !isFinitePosition(toPosition)) return null;
  const dx = toPosition.x - fromPosition.x;
  const dy = toPosition.y - fromPosition.y;
  const dz = toPosition.z - fromPosition.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function getPortWorldPosition(object, portId) {
  if (!isFinitePosition(object?.position)) return null;
  const port = getPortRecords(object).find(candidate => candidate.id === portId);
  const anchor = port?.anchor;
  const hasAnchor = anchor && ['x', 'y', 'z'].every(axis =>
    Number.isFinite(anchor[axis]) && anchor[axis] >= -0.5 && anchor[axis] <= 0.5
  );
  if (!hasAnchor) return { ...object.position };

  const scale = object.scale;
  if (!scale || !['x', 'y', 'z'].every(axis => Number.isFinite(scale[axis]) && scale[axis] > 0)) {
    return { ...object.position };
  }

  const radians = (Number.isFinite(object.rotation?.z) ? object.rotation.z : 0) * Math.PI / 180;
  const localX = anchor.x * scale.x;
  const localY = anchor.y * scale.y;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: object.position.x + localX * cosine - localY * sine,
    y: object.position.y + localX * sine + localY * cosine,
    z: object.position.z + anchor.z * scale.z,
  };
}

export function getConnectionEndpoints(connection, objects, objectById = null) {
  const fromObject = objectById?.get(connection.fromObjectId)
    || objects.find(object => object.id === connection.fromObjectId);
  const toObject = objectById?.get(connection.toObjectId)
    || objects.find(object => object.id === connection.toObjectId);
  if (!fromObject || !toObject) return null;
  const from = getPortWorldPosition(fromObject, connection.fromPortId);
  const to = getPortWorldPosition(toObject, connection.toPortId);
  return from && to ? { from, to } : null;
}

export function evaluateConnectionLength(connection, objects, knownEndpoints = null) {
  const endpoints = knownEndpoints || getConnectionEndpoints(connection, objects);
  const distance = calculatePositionDistance(endpoints?.from, endpoints?.to);
  const cableLength = Number(connection.length);

  if (distance === null || !Number.isFinite(cableLength) || cableLength <= 0) {
    return null;
  }

  const slack = cableLength - distance;
  const recommendedLength = distance * CABLE_SERVICE_LOOP_FACTOR;
  const recommendedSlack = cableLength - recommendedLength;
  return {
    distance,
    cableLength,
    slack,
    sufficient: slack >= -0.001,
    recommendedLength,
    recommendedSlack,
    hasRecommendedSlack: recommendedSlack >= -0.001,
  };
}

export function buildEthernetTopology(selectedObj, objects, connections) {
  if (!selectedObj || !selectedObj.ports) return [];

  const ethernetPorts = selectedObj.ports.filter(p => p.type === 'ethernet');
  if (ethernetPorts.length === 0) return [];

  return ethernetPorts.map(port => {
    const activeConn = connections.find(c =>
      (c.fromObjectId === selectedObj.id && c.fromPortId === port.id) ||
      (c.toObjectId === selectedObj.id && c.toPortId === port.id)
    );

    if (!activeConn) {
      return {
        portId: port.id,
        portName: port.name,
        status: 'idle',
        connection: null,
        connectedDevice: null,
        connectedPort: null,
      };
    }

    const isFrom = activeConn.fromObjectId === selectedObj.id;
    const otherObjId = isFrom ? activeConn.toObjectId : activeConn.fromObjectId;
    const otherPortId = isFrom ? activeConn.toPortId : activeConn.fromPortId;

    const otherObj = objects.find(o => o.id === otherObjId);
    const otherPort = otherObj?.ports?.find(op => op.id === otherPortId);

    return {
      portId: port.id,
      portName: port.name,
      status: 'connected',
      connection: activeConn,
      connectedDevice: otherObj ? {
        id: otherObj.id,
        name: otherObj.name,
        type: otherObj.type,
        modelId: otherObj.modelId,
      } : null,
      connectedPort: otherPort ? {
        id: otherPort.id,
        name: otherPort.name,
      } : null,
    };
  });
}
