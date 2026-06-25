import { arePortsCompatible, inferCableType, isPortDirectionConsistent, CABLE_TYPE_VALUES } from './connections.js';

const VALID_CABLE_TYPES = new Set(CABLE_TYPE_VALUES);
const VALID_PORT_DIRECTIONS = new Set(['input', 'output', 'bidirectional']);

export function isProjectEnvelope(project, { requireStoredFields = false } = {}) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) return false;
  if (!isRoomShape(project.room)) return false;
  if (!Array.isArray(project.objects)) return false;
  if (!project.objects.every(isProjectObject)) return false;
  if (!hasUniqueIds(project.objects)) return false;

  const validConnections = project.connections === undefined
    || project.connections === null
    || (
      Array.isArray(project.connections)
      && project.connections.every(isProjectConnection)
      && hasUniqueIds(project.connections)
      && hasValidConnectionObjectReferences(project.objects, project.connections)
    );
  if (!validConnections) return false;

  if (project.camera !== undefined && project.camera !== null) {
    if (!isProjectCamera(project.camera)) return false;
  }

  if (requireStoredFields) {
    if (project.id !== 'default') return false;
    if (typeof project.updatedAt !== 'string' || Number.isNaN(Date.parse(project.updatedAt))) return false;
  }

  return true;
}

function isRoomShape(room) {
  return room !== null
    && typeof room === 'object'
    && !Array.isArray(room)
    && ['length', 'width', 'height'].every(dimension =>
      Number.isFinite(room[dimension]) && room[dimension] > 0
    );
}

function isProjectObject(object) {
  return object !== null
    && typeof object === 'object'
    && !Array.isArray(object)
    && isNonBlankString(object.id)
    && isNonBlankString(object.type)
    && typeof object.name === 'string'
    && isNonBlankString(object.shape)
    && isVector3(object.position)
    && isVector3(object.rotation)
    && isVector3(object.scale, { positive: true })
    && isOptionalNonBlankString(object.category)
    && isOptionalNonBlankString(object.modelId)
    && isOptionalString(object.assetUrl)
    && isOptionalString(object.color)
    && (
      object.ports === undefined
      || object.ports === null
      || (
        Array.isArray(object.ports)
        && object.ports.every(isProjectPort)
        && hasUniqueIds(object.ports)
      )
    );
}

function isProjectPort(port) {
  return port !== null
    && typeof port === 'object'
    && !Array.isArray(port)
    && isNonBlankString(port.id)
    && isNonBlankString(port.name)
    && isNonBlankString(port.type)
    && VALID_PORT_DIRECTIONS.has(port.direction)
    && isPortDirectionConsistent(port)
    && (
      port.anchor === undefined
      || port.anchor === null
      || isNormalizedVector3(port.anchor)
    );
}

function isProjectConnection(connection) {
  if (
    connection === null
    || typeof connection !== 'object'
    || Array.isArray(connection)
    || !isNonBlankString(connection.id)
    || !isNonBlankString(connection.fromObjectId)
    || !isNonBlankString(connection.toObjectId)
    || !VALID_CABLE_TYPES.has(connection.cableType)
    || !Number.isFinite(connection.length)
    || connection.length <= 0
    || !isNonBlankString(connection.name)
  ) {
    return false;
  }

  const hasFromPort = connection.fromPortId !== undefined && connection.fromPortId !== null;
  const hasToPort = connection.toPortId !== undefined && connection.toPortId !== null;
  if (hasFromPort !== hasToPort) return false;
  if (hasFromPort && !isNonBlankString(connection.fromPortId)) return false;
  if (hasToPort && !isNonBlankString(connection.toPortId)) return false;
  return true;
}

function hasValidConnectionObjectReferences(objects, connections) {
  const objectsById = new Map(objects.map(object => [object.id, object]));
  const occupiedPorts = new Map();
  return connections.every(connection => {
    const fromObject = objectsById.get(connection.fromObjectId);
    const toObject = objectsById.get(connection.toObjectId);
    if (!fromObject || !toObject || fromObject.id === toObject.id) return false;

    const usesPorts = connection.fromPortId !== undefined && connection.fromPortId !== null;
    if (!usesPorts) return true;

    const fromPort = findPort(fromObject, connection.fromPortId);
    const toPort = findPort(toObject, connection.toPortId);
    return fromPort
      && toPort
      && arePortsCompatible(fromPort, toPort)
      && connection.cableType === inferCableType(fromPort, toPort)
      && occupyPort(occupiedPorts, fromObject.id, fromPort.id)
      && occupyPort(occupiedPorts, toObject.id, toPort.id);
  });
}

function occupyPort(occupiedPorts, objectId, portId) {
  let objectPorts = occupiedPorts.get(objectId);
  if (!objectPorts) {
    objectPorts = new Set();
    occupiedPorts.set(objectId, objectPorts);
  }
  if (objectPorts.has(portId)) return false;
  objectPorts.add(portId);
  return true;
}

function findPort(object, portId) {
  return Array.isArray(object.ports)
    ? object.ports.find(port => port.id === portId)
    : null;
}

function isProjectCamera(camera) {
  return camera !== null
    && typeof camera === 'object'
    && !Array.isArray(camera)
    && isVector3(camera.position)
    && isVector3(camera.target);
}

function isNormalizedVector3(value) {
  return isVector3(value)
    && ['x', 'y', 'z'].every(axis => value[axis] >= -0.5 && value[axis] <= 0.5);
}

function isVector3(value, { positive = false } = {}) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && ['x', 'y', 'z'].every(axis =>
      Number.isFinite(value[axis]) && (!positive || value[axis] > 0)
    );
}

function isNonBlankString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalNonBlankString(value) {
  return value === undefined || value === null || isNonBlankString(value);
}

function isOptionalString(value) {
  return value === undefined || value === null || typeof value === 'string';
}

function hasUniqueIds(items) {
  const seenIds = new Set();
  for (const item of items) {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
  }
  return true;
}
