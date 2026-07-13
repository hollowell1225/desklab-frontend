import {
  arePortTypesCompatible,
  evaluateConnectionLength,
  inferCableType,
  isPortDirectionConsistent,
} from './connections.js';
import { findModelTemplate } from './catalog.js';

const POWER_INPUT_TYPES = new Set(['ac_input', 'dc_input']);
const POWER_OUTPUT_TYPES = new Set(['ac_output', 'dc_output']);

// Coerce a stored wattage/maxLoad to a safe non-negative number. Imported or
// draft-restored data can carry these as strings (isProjectObject does not
// validate them), which would otherwise corrupt load arithmetic via string
// concatenation or produce misleading comparisons.
export function toPowerValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

// Fraction of maxLoad at/above which a power hub is flagged as "approaching limit".
export const POWER_WARNING_RATIO = 0.9;

// Classify a device's external power load against its safe maximum, coercing
// both values first. Returns 'overload' (strictly over the limit), 'warning'
// (at or above the warning ratio), or 'ok' (within limits, or no usable limit).
export function classifyPowerLoad(currentLoad, maxLoad) {
  const load = toPowerValue(currentLoad);
  const limit = toPowerValue(maxLoad);
  if (limit <= 0) return 'ok';
  if (load > limit) return 'overload';
  if (load > limit * POWER_WARNING_RATIO) return 'warning';
  return 'ok';
}

const getPort = (object, portId) => object?.ports?.find(port => port.id === portId);
const isPowerStrip = (object) =>
  object?.modelId === 'power-strip' || object?.type === 'power_strip';

function getOccupiedPort(occupiedPorts, objectId, portId) {
  return occupiedPorts.get(objectId)?.get(portId) || null;
}

function occupyPort(occupiedPorts, objectId, portId, connectionId) {
  let objectPorts = occupiedPorts.get(objectId);
  if (!objectPorts) {
    objectPorts = new Map();
    occupiedPorts.set(objectId, objectPorts);
  }
  objectPorts.set(portId, connectionId);
}

function findPowerCycle(edges) {
  const graph = new Map();
  for (const [fromId, toId] of edges) {
    if (!graph.has(fromId)) graph.set(fromId, []);
    graph.get(fromId).push(toId);
  }

  const visiting = new Set();
  const visited = new Set();

  const visit = (node) => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of graph.get(node) || []) {
      if (visit(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  return [...graph.keys()].some(visit);
}

function appendLengthIssues(issues, connection, objects) {
  const lengthStatus = evaluateConnectionLength(connection, objects);
  if (lengthStatus && !lengthStatus.sufficient) {
    issues.push({
      id: `short-cable:${connection.id}`,
      code: 'short_cable',
      severity: 'warning',
      title: `线材“${connection.name}”可能过短`,
      description: `线长 ${lengthStatus.cableLength.toFixed(2)}m，接口端点估算距离 ${lengthStatus.distance.toFixed(2)}m，差 ${Math.abs(lengthStatus.slack).toFixed(2)}m。`,
      connectionIds: [connection.id],
      objectIds: [connection.fromObjectId, connection.toObjectId],
    });
  } else if (lengthStatus && !lengthStatus.hasRecommendedSlack) {
    issues.push({
      id: `low-cable-slack:${connection.id}`,
      code: 'low_cable_slack',
      severity: 'warning',
      title: `线材“${connection.name}”维护余量较少`,
      description: `线长 ${lengthStatus.cableLength.toFixed(2)}m 可直连，但建议至少 ${lengthStatus.recommendedLength.toFixed(2)}m（含 10% 插拔与绕行余量）。`,
      connectionIds: [connection.id],
      objectIds: [connection.fromObjectId, connection.toObjectId],
    });
  }
}

export function buildPowerGraph(objects, connections) {
  const objectById = new Map(objects.map(object => [object.id, object]));
  const powerEdges = [];
  const occupiedPorts = new Map();

  for (const connection of connections) {
    const fromObj = objectById.get(connection.fromObjectId);
    const toObj = objectById.get(connection.toObjectId);
    if (!fromObj || !toObj) continue;
    const fromPort = getPort(fromObj, connection.fromPortId);
    const toPort = getPort(toObj, connection.toPortId);
    const sourceDirectionValid = fromPort?.direction === 'output' || fromPort?.direction === 'bidirectional';
    const targetDirectionValid = toPort?.direction === 'input' || toPort?.direction === 'bidirectional';
    const isValidPowerConnection = fromPort
      && toPort
      && POWER_OUTPUT_TYPES.has(fromPort.type)
      && POWER_INPUT_TYPES.has(toPort.type)
      && isPortDirectionConsistent(fromPort)
      && isPortDirectionConsistent(toPort)
      && sourceDirectionValid
      && targetDirectionValid
      && arePortTypesCompatible(fromPort.type, toPort.type)
      && connection.cableType === inferCableType(fromPort, toPort);
    if (!isValidPowerConnection) continue;

    const endpointRefs = [
      [connection.fromObjectId, connection.fromPortId],
      [connection.toObjectId, connection.toPortId],
    ];
    if (endpointRefs.some(([objectId, portId]) => getOccupiedPort(occupiedPorts, objectId, portId))) {
      continue;
    }
    endpointRefs.forEach(([objectId, portId]) => {
      occupyPort(occupiedPorts, objectId, portId, connection.id);
    });
    powerEdges.push([connection.fromObjectId, connection.toObjectId]);
  }

  const childrenBySource = new Map();
  for (const [fromId, toId] of powerEdges) {
    let children = childrenBySource.get(fromId);
    if (!children) {
      children = [];
      childrenBySource.set(fromId, children);
    }
    children.push(toId);
  }

  return {
    objectById,
    childrenBySource,
    hasCycle: findPowerCycle(powerEdges),
  };
}

export function analyzeProjectWiring(objects, connections) {
  const issues = [];
  const objectById = new Map(objects.map(object => [object.id, object]));
  const occupiedPorts = new Map();
  const powerEdges = [];

  for (const connection of connections) {
    const fromObject = objectById.get(connection.fromObjectId);
    const toObject = objectById.get(connection.toObjectId);
    const existingObjectIds = [connection.fromObjectId, connection.toObjectId]
      .filter(objectId => objectById.has(objectId));
    if (!fromObject || !toObject) {
      issues.push({
        id: `dangling-object:${connection.id}`,
        code: 'dangling_connection_object',
        severity: 'error',
        title: `连接“${connection.name}”引用了不存在的设备`,
        description: '连接端点设备已被删除或导入数据不完整。请删除该连接后重新创建。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: existingObjectIds,
      });
      continue;
    }

    if (connection.fromObjectId === connection.toObjectId) {
      issues.push({
        id: `self-connection:${connection.id}`,
        code: 'self_connection',
        severity: 'error',
        title: `连接“${connection.name}”不能连接同一设备`,
        description: '连接的起点和终点必须是不同设备。请删除该连接后重新创建。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId],
      });
      continue;
    }

    const hasFromPort = Boolean(connection.fromPortId);
    const hasToPort = Boolean(connection.toPortId);
    if (!hasFromPort && !hasToPort) {
      appendLengthIssues(issues, connection, objects);
      issues.push({
        id: `legacy-connection:${connection.id}`,
        code: 'legacy_connection',
        severity: 'info',
        title: `连接“${connection.name}”未绑定具体端口`,
        description: '该连接仍可显示和保存，但无法进行完整的端口方向与占用检查。',
        connectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    if (hasFromPort !== hasToPort) {
      issues.push({
        id: `partial-port-binding:${connection.id}`,
        code: 'partial_port_binding',
        severity: 'error',
        title: `连接“${connection.name}”只绑定了一端端口`,
        description: '端口级连接必须同时指定起点和终点端口。请删除该连接后重新创建。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    const fromPort = getPort(fromObject, connection.fromPortId);
    const toPort = getPort(toObject, connection.toPortId);
    if (!fromPort || !toPort) {
      issues.push({
        id: `missing-port:${connection.id}`,
        code: 'missing_connection_port',
        severity: 'error',
        title: `连接“${connection.name}”引用了不存在的端口`,
        description: '设备型号或端口定义可能已更新。请删除该连接后重新选择端口。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    const sourceDirectionValid = fromPort.direction === 'output' || fromPort.direction === 'bidirectional';
    const targetDirectionValid = toPort.direction === 'input' || toPort.direction === 'bidirectional';
    if (!isPortDirectionConsistent(fromPort) || !isPortDirectionConsistent(toPort)) {
      issues.push({
        id: `power-port-direction:${connection.id}`,
        code: 'invalid_power_port_direction',
        severity: 'error',
        title: `连接“${connection.name}”使用了方向定义错误的电源端口`,
        description: 'AC/DC 输入端口只能作为输入，AC/DC 输出端口只能作为输出。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }
    if (!sourceDirectionValid || !targetDirectionValid) {
      issues.push({
        id: `invalid-direction:${connection.id}`,
        code: 'invalid_port_direction',
        severity: 'error',
        title: `连接“${connection.name}”的端口方向错误`,
        description: '起点必须是输出或双向端口，终点必须是输入或双向端口。',
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    if (!arePortTypesCompatible(fromPort.type, toPort.type)) {
      issues.push({
        id: `incompatible-ports:${connection.id}`,
        code: 'incompatible_port_types',
        severity: 'error',
        title: `连接“${connection.name}”的端口类型不兼容`,
        description: `${fromPort.type} 不能连接到 ${toPort.type}。`,
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    const expectedCableType = inferCableType(fromPort, toPort);
    if (connection.cableType !== expectedCableType) {
      issues.push({
        id: `cable-type:${connection.id}`,
        code: 'cable_type_mismatch',
        severity: 'error',
        title: `连接“${connection.name}”的线材类型不匹配`,
        description: `当前记录为 ${connection.cableType}，所选端口需要 ${expectedCableType}。`,
        connectionIds: [connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }

    const endpointRefs = [
      [connection.fromObjectId, connection.fromPortId],
      [connection.toObjectId, connection.toPortId],
    ];
    const conflictingConnectionId = endpointRefs
      .map(([objectId, portId]) => getOccupiedPort(occupiedPorts, objectId, portId))
      .find(Boolean);
    if (conflictingConnectionId) {
      issues.push({
        id: `port-overbooked:${connection.id}`,
        code: 'port_overbooked',
        severity: 'error',
        title: `连接“${connection.name}”重复占用了端口`,
        description: `同一物理端口已被连接“${conflictingConnectionId}”占用。`,
        connectionIds: [conflictingConnectionId, connection.id],
        invalidConnectionIds: [connection.id],
        objectIds: [connection.fromObjectId, connection.toObjectId],
      });
      continue;
    }
    endpointRefs.forEach(([objectId, portId]) => {
      occupyPort(occupiedPorts, objectId, portId, connection.id);
    });
    appendLengthIssues(issues, connection, objects);

    const isPowerConnection = POWER_OUTPUT_TYPES.has(fromPort?.type) && POWER_INPUT_TYPES.has(toPort?.type);
    if (!isPowerConnection) continue;

    powerEdges.push([connection.fromObjectId, connection.toObjectId]);
    if (isPowerStrip(fromObject) && isPowerStrip(toObject)) {
      issues.push({
        id: `power-strip-chain:${connection.id}`,
        code: 'power_strip_chain',
        severity: 'error',
        title: '检测到插排串联',
        description: `${fromObject.name} 连接到 ${toObject.name}。插排串联可能导致过载或接触点发热，建议直接接墙壁插座或合适的 UPS。`,
        connectionIds: [connection.id],
        objectIds: [fromObject.id, toObject.id],
      });
    }
  }

  if (findPowerCycle(powerEdges)) {
    issues.push({
      id: 'power-cycle',
      code: 'power_cycle',
      severity: 'error',
      title: '检测到电源连接环路',
      description: '电源设备之间形成了循环连接。请断开环路并确认每条电源线的实际方向。',
      connectionIds: [],
      objectIds: [],
    });
  }

  for (const object of objects) {
    for (const port of object.ports || []) {
      if (!isPortDirectionConsistent(port)) {
        issues.push({
          id: `invalid-power-port:${object.id}:${port.id}`,
          code: 'invalid_power_port_definition',
          severity: 'error',
          title: `${object.name} 的电源端口方向定义错误`,
          description: `端口“${port.name}”的类型为 ${port.type}，但方向记录为 ${port.direction}。`,
          connectionIds: [],
          objectIds: [object.id],
        });
      }
      if (!POWER_INPUT_TYPES.has(port.type)) continue;
      if (getOccupiedPort(occupiedPorts, object.id, port.id)) continue;
      issues.push({
        id: `unpowered:${object.id}:${port.id}`,
        code: 'unpowered_input',
        severity: 'warning',
        title: `${object.name} 的电源输入未连接`,
        description: `端口“${port.name}”当前没有电源连接。若设备无需供电，可忽略此提示。`,
        connectionIds: [],
        objectIds: [object.id],
      });
    }
  }

  // --- 4. 电源功耗负载与过载分析 ---
  const powerGraph = {
    objectById,
    childrenBySource: new Map(),
    hasCycle: findPowerCycle(powerEdges),
  };
  for (const [fromId, toId] of powerEdges) {
    let children = powerGraph.childrenBySource.get(fromId);
    if (!children) {
      children = [];
      powerGraph.childrenBySource.set(fromId, children);
    }
    children.push(toId);
  }

  for (const object of objects) {
    const template = findModelTemplate(object);
    const maxLoad = toPowerValue(object.maxLoad ?? template?.maxLoad);
    if (maxLoad > 0) {
      const currentLoad = computeDevicePowerLoad(object.id, objects, connections, powerGraph);
      const loadStatus = classifyPowerLoad(currentLoad, maxLoad);
      if (loadStatus === 'overload') {
        issues.push({
          id: `power-overload:${object.id}`,
          code: 'power_overload',
          severity: 'error',
          title: `设备”${object.name}”电源负载超标`,
          description: `当前外接总负载为 ${currentLoad}W，已超出其安全承载功率 ${maxLoad}W。请减少接在该设备上的电器或改接其他插排。`,
          connectionIds: [],
          objectIds: [object.id],
        });
      } else if (loadStatus === 'warning') {
        issues.push({
          id: `power-warning:${object.id}`,
          code: 'power_warning',
          severity: 'warning',
          title: `设备”${object.name}”电源负载接近上限`,
          description: `当前外接总负载为 ${currentLoad}W，已达到其安全承载功率 ${maxLoad}W 的 90% 以上。请注意用电安全。`,
          connectionIds: [],
          objectIds: [object.id],
        });
      }
    }
  }

  const order = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function summarizeWiringIssues(issues) {
  return issues.reduce((summary, issue) => {
    summary[issue.severity] += 1;
    return summary;
  }, { error: 0, warning: 0, info: 0 });
}

export function getInvalidConnectionIds(issues) {
  return [...new Set(issues.flatMap(issue => issue.invalidConnectionIds || []))];
}

export function computeDevicePowerLoad(deviceId, objects, connections, existingPowerGraph = null) {
  const graph = existingPowerGraph || buildPowerGraph(objects, connections);
  const { objectById, childrenBySource, hasCycle } = graph;

  if (hasCycle) {
    return 0;
  }

  const loadCache = new Map();
  function getLoad(id) {
    if (loadCache.has(id)) return loadCache.get(id);
    let sum = 0;
    const children = childrenBySource.get(id) || [];
    for (const childId of children) {
      const childObj = objectById.get(childId);
      if (childObj) {
        const template = findModelTemplate(childObj);
        const childSelfWattage = toPowerValue(childObj.wattage ?? template?.wattage);
        sum += getLoad(childId) + childSelfWattage;
      }
    }
    loadCache.set(id, sum);
    return sum;
  }

  return getLoad(deviceId);
}
