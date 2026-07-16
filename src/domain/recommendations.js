import {
  analyzeProjectLayout,
  snapObjectToSupport,
  snapWallOutletToNearestWall,
} from './layout-analysis.js';
import { analyzeProjectWiring, buildPowerGraph, computeDevicePowerLoad, getEffectiveMaxLoad, classifyPowerLoad } from './analysis.js';
import { calculatePositionDistance, evaluateConnectionLength, arePortsCompatible, arePortTypesCompatible, isPortDirectionConsistent, inferCableType } from './connections.js';
import { validateAndConstrainObject } from './geometry.js';
import { findModelTemplate } from './catalog.js';
import { getPortRecords } from './port-collections.js';
import { getRecordItems } from './record-collections.js';

// Round a recommended cable length up to the centimetre so the applied value is
// never shorter than the computed recommendation (which would leave the slack
// warning unresolved).
function ceilLength(value) {
  return Math.ceil(value * 100) / 100;
}

function hasSameOwnValues(current, next) {
  const currentKeys = Object.keys(current || {});
  const nextKeys = Object.keys(next || {});
  return currentKeys.length === nextKeys.length
    && nextKeys.every(key => current?.[key] === next?.[key]);
}

// Deterministic display order so the UI and tests see a stable list.
const SUGGESTION_ORDER = {
  move_inside_room: 0,
  drop_to_support: 1,
  snap_outlet_to_wall: 2,
  auto_power_device: 3,
  auto_uplink_switch: 4,
  auto_network_device: 5,
  auto_connect_display: 6,
  extend_cable: 7,
};

function compareSuggestions(first, second) {
  const rank = (SUGGESTION_ORDER[first.code] ?? 99) - (SUGGESTION_ORDER[second.code] ?? 99);
  if (rank !== 0) return rank;
  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0;
}

function getInvalidConnectionIds(wiringIssues) {
  return new Set(wiringIssues.flatMap(issue => issue?.invalidConnectionIds || []));
}

function resolveUnpoweredInput(issue, objectsById) {
  const objectId = issue?.objectIds?.[0];
  if (typeof objectId !== 'string' || objectId.trim() === '') return null;
  const object = objectsById.get(objectId);
  if (!object) return null;
  const port = getPortRecords(object).find(candidate =>
    typeof candidate.id === 'string'
      && issue.id === `unpowered:${objectId}:${candidate.id}`
  );
  return port ? { object, port } : null;
}

function isWanPort(port) {
  return String(port.id).toLowerCase() === 'wan'
    || (typeof port.name === 'string' && port.name.toLowerCase().includes('wan'));
}

function hasPowerInput(object) {
  return getPortRecords(object).some(port =>
    ['ac_input', 'dc_input'].includes(port.type)
  );
}

function getPoweredObjectIds(objects, powerGraph) {
  const poweredObjectIds = new Set(objects
    .filter(object => !hasPowerInput(object))
    .map(object => object.id));
  const pending = [...poweredObjectIds];

  while (pending.length > 0) {
    const objectId = pending.pop();
    for (const childId of powerGraph.childrenBySource.get(objectId) || []) {
      if (poweredObjectIds.has(childId)) continue;
      poweredObjectIds.add(childId);
      pending.push(childId);
    }
  }

  return poweredObjectIds;
}

function requiresPowerButIsUnpowered(object, poweredObjectIds) {
  return hasPowerInput(object) && !poweredObjectIds.has(object.id);
}

function getRouterReachableObjectIds(objects, connections, invalidConnectionIds, poweredObjectIds) {
  const objectIds = new Set(objects.map(object => object.id));
  const isNetworkForwarder = object => object.modelId === 'router' || object.type === 'router'
    || object.modelId === 'switch' || object.type === 'switch';
  const reachable = new Set(objects
    .filter(object => (object.modelId === 'router' || object.type === 'router')
      && !requiresPowerButIsUnpowered(object, poweredObjectIds))
    .map(object => object.id));
  const forwarderIds = new Set(objects
    .filter(object => isNetworkForwarder(object) && !requiresPowerButIsUnpowered(object, poweredObjectIds))
    .map(object => object.id));
  const neighbors = new Map();

  for (const connection of connections) {
    if (connection.cableType !== 'ethernet' || invalidConnectionIds.has(connection.id)) continue;
    if (!objectIds.has(connection.fromObjectId) || !objectIds.has(connection.toObjectId)) continue;
    for (const [from, to] of [[connection.fromObjectId, connection.toObjectId], [connection.toObjectId, connection.fromObjectId]]) {
      let adjacent = neighbors.get(from);
      if (!adjacent) {
        adjacent = new Set();
        neighbors.set(from, adjacent);
      }
      adjacent.add(to);
    }
  }

  const pending = [...reachable];
  while (pending.length > 0) {
    const objectId = pending.pop();
    for (const neighborId of neighbors.get(objectId) || []) {
      if (reachable.has(neighborId) || !forwarderIds.has(neighborId)) continue;
      reachable.add(neighborId);
      pending.push(neighborId);
    }
  }

  return reachable;
}

/**
 * Compose detected layout/wiring issues into actionable "free improvement"
 * suggestions — changes the user can apply without buying anything. Each
 * suggestion carries a concrete `patch` the caller can apply directly.
 *
 * Returns an array of:
 *   { id, code, title, description, objectIds?, connectionIds?, patch }
 * where patch is { objectId, position, rotation? } for layout fixes or
 * { connectionId, length } or { newConnection } for cabling fixes.
 */
export function buildFreeImprovements(room, rawObjects, rawConnections = [], options = {}) {
  const objects = getRecordItems(rawObjects);
  const connections = getRecordItems(rawConnections);
  const suggestions = [];
  const objectsById = new Map(objects.map(object => [object.id, object]));
  const wiringIssues = Array.isArray(options.wiringIssues)
    ? options.wiringIssues
    : analyzeProjectWiring(objects, connections);
  const powerGraph = options.powerGraph || buildPowerGraph(objects, connections);
  const invalidConnectionIds = getInvalidConnectionIds(wiringIssues);

  for (const issue of analyzeProjectLayout(room, objects)) {
    if (issue.code === 'floating_object') {
      const object = objectsById.get(issue.objectIds[0]);
      const fixed = object && snapObjectToSupport(room, object, objects);
      if (fixed) {
        suggestions.push({
          id: `drop-to-support:${object.id}`,
          code: 'drop_to_support',
          title: `${object.name} 落到下方支撑面`,
          description: '将悬空物体下移到最近的支撑面或地板，无需购买任何物品。',
          objectIds: [object.id],
          patch: { objectId: object.id, position: fixed.position },
        });
      }
    } else if (issue.code === 'out_of_bounds') {
      const object = objectsById.get(issue.objectIds[0]);
      const constrained = object && validateAndConstrainObject(object, room);
      if (constrained && constrained.valid) {
        suggestions.push({
          id: `move-inside:${object.id}`,
          code: 'move_inside_room',
          title: `${object.name} 移回房间边界内`,
          description: '将超出房间边界的物体移动到最近的合法位置，无需购买任何物品。',
          objectIds: [object.id],
          patch: { objectId: object.id, position: constrained.object.position },
        });
      }
    } else if (issue.code === 'outlet_off_wall') {
      const object = objectsById.get(issue.objectIds[0]);
      const fixed = object && snapWallOutletToNearestWall(room, object);
      if (fixed) {
        suggestions.push({
          id: `snap-outlet:${object.id}`,
          code: 'snap_outlet_to_wall',
          title: `${object.name} 贴到最近的墙面`,
          description: '将墙壁插座移动并朝向最近的墙面，使外部供电布线估算更准确。',
          objectIds: [object.id],
          patch: { objectId: object.id, position: fixed.position, rotation: fixed.rotation },
        });
      }
    }
  }

  // Calculate occupied ports to find free ones
  const occupiedPorts = new Map();
  for (const connection of connections) {
    if (invalidConnectionIds.has(connection.id)) continue;
    if (connection.fromObjectId && connection.fromPortId && connection.toObjectId && connection.toPortId) {
      let fromPorts = occupiedPorts.get(connection.fromObjectId);
      if (!fromPorts) {
        fromPorts = new Set();
        occupiedPorts.set(connection.fromObjectId, fromPorts);
      }
      fromPorts.add(connection.fromPortId);

      let toPorts = occupiedPorts.get(connection.toObjectId);
      if (!toPorts) {
        toPorts = new Set();
        occupiedPorts.set(connection.toObjectId, toPorts);
      }
      toPorts.add(connection.toPortId);
    }
  }
  const poweredObjectIds = getPoweredObjectIds(objects, powerGraph);

  for (const issue of wiringIssues) {
    if (issue.code === 'unpowered_input') {
      const endpoint = resolveUnpoweredInput(issue, objectsById);
      const object = endpoint?.object;
      const port = endpoint?.port;
      if (object && port && isPortDirectionConsistent(port)) {
        let bestSource = null;
        let minDistance = Number.MAX_VALUE;

        for (const candidate of objects) {
          if (candidate.id === object.id) continue;
          if (requiresPowerButIsUnpowered(candidate, poweredObjectIds)) continue;
          for (const candidatePort of getPortRecords(candidate)) {
            const hasFromDir = candidatePort.direction === 'output' || candidatePort.direction === 'bidirectional';
            if (hasFromDir &&
                isPortDirectionConsistent(candidatePort) &&
                !(occupiedPorts.get(candidate.id)?.has(candidatePort.id)) &&
                arePortTypesCompatible(candidatePort.type, port.type)) {

              const dist = calculatePositionDistance(object.position, candidate.position);
              if (dist !== null && dist < minDistance) {
                minDistance = dist;
                bestSource = { device: candidate, port: candidatePort, distance: dist };
              }
            }
          }
        }

        if (bestSource) {
          const length = ceilLength(Math.max(1.5, bestSource.distance * 1.1 + 0.3));
          const cableType = inferCableType(bestSource.port, port);
          suggestions.push({
            id: `auto-power:${object.id}:${port.id}`,
            code: 'auto_power_device',
            title: `为”${object.name}”连接电源`,
            description: `检测到”${object.name}”的电源接口”${port.name}”未连接。可自动使用一根 ${length}m 的电源线连接到附近的”${bestSource.device.name}”的空闲插孔”${bestSource.port.name}”。`,
            objectIds: [bestSource.device.id, object.id],
            patch: {
              newConnection: {
                id: `c-auto-power-${object.id}-${port.id}`,
                name: `${object.name}电源线`,
                cableType,
                length,
                fromObjectId: bestSource.device.id,
                fromPortId: bestSource.port.id,
                toObjectId: object.id,
                toPortId: port.id,
              }
            }
          });
          
          let localPorts = occupiedPorts.get(bestSource.device.id);
          if (!localPorts) {
            localPorts = new Set();
            occupiedPorts.set(bestSource.device.id, localPorts);
          }
          localPorts.add(bestSource.port.id);
        }
      }
    } else if (issue.code === 'short_cable' || issue.code === 'low_cable_slack') {
      const connectionId = issue.connectionIds[0];
      const connection = connections.find(candidate => candidate.id === connectionId);
      const status = connection && evaluateConnectionLength(connection, objects);
      if (!status) continue;
      const length = ceilLength(status.recommendedLength);
      if (length <= connection.length) continue;
      suggestions.push({
        id: `extend-cable:${connectionId}`,
        code: 'extend_cable',
        title: `线材“${connection.name}”延长到约 ${length}m`,
        description: '增加线材长度以满足直连距离与 10% 插拔/绕行余量，属于免费布线调整建议。',
        connectionIds: [connectionId],
        patch: { connectionId, length },
      });
    }
  }

  // 3. 自动连接网络 (auto_network_device)
  const routerReachableObjectIds = getRouterReachableObjectIds(objects, connections, invalidConnectionIds, poweredObjectIds);
  const unconnectedNetworkEndpointCount = objects.reduce((count, object) => {
    const isDistributor = ['router', 'switch', 'modem'].includes(object.type) || ['router', 'switch', 'modem'].includes(object.modelId);
    if (isDistributor) return count;
    return count + getPortRecords(object).filter(port =>
      port.type === 'ethernet'
      && (port.direction === 'input' || port.direction === 'bidirectional')
      && isPortDirectionConsistent(port)
      && !occupiedPorts.get(object.id)?.has(port.id)
    ).length;
  }, 0);
  const freeRouterLanPortCount = objects.reduce((count, router) => {
    if (!(router.modelId === 'router' || router.type === 'router') || requiresPowerButIsUnpowered(router, poweredObjectIds)) return count;
    return count + getPortRecords(router).filter(port =>
      port.type === 'ethernet'
      && String(port.id).toLowerCase().includes('lan')
      && (port.direction === 'output' || port.direction === 'bidirectional')
      && isPortDirectionConsistent(port)
      && !occupiedPorts.get(router.id)?.has(port.id)
    ).length;
  }, 0);

  for (const switchDevice of objects) {
    const isSwitch = switchDevice.modelId === 'switch' || switchDevice.type === 'switch';
    if (freeRouterLanPortCount <= unconnectedNetworkEndpointCount
      || !isSwitch
      || routerReachableObjectIds.has(switchDevice.id)
      || requiresPowerButIsUnpowered(switchDevice, poweredObjectIds)) continue;

    let bestUplink = null;
    for (const router of objects) {
      const isRouter = router.modelId === 'router' || router.type === 'router';
      if (!isRouter || requiresPowerButIsUnpowered(router, poweredObjectIds)) continue;
      for (const routerPort of getPortRecords(router)) {
        if (routerPort.type !== 'ethernet' || !String(routerPort.id).toLowerCase().includes('lan')) continue;
        if (!(routerPort.direction === 'output' || routerPort.direction === 'bidirectional') || !isPortDirectionConsistent(routerPort)) continue;
        if (occupiedPorts.get(router.id)?.has(routerPort.id)) continue;
        for (const switchPort of getPortRecords(switchDevice)) {
          if (switchPort.type !== 'ethernet'
            || isWanPort(switchPort)
            || !(switchPort.direction === 'input' || switchPort.direction === 'bidirectional')
            || !isPortDirectionConsistent(switchPort)) continue;
          if (occupiedPorts.get(switchDevice.id)?.has(switchPort.id)) continue;
          const distance = calculatePositionDistance(router.position, switchDevice.position);
          if (distance === null) continue;
          if (!bestUplink || distance < bestUplink.distance) bestUplink = { router, routerPort, switchPort, distance };
        }
      }
    }

    if (!bestUplink) continue;
    const length = ceilLength(Math.max(1.0, bestUplink.distance * 1.1 + 0.3));
    suggestions.push({
      id: `auto-uplink:${bestUplink.router.id}:${bestUplink.routerPort.id}:${switchDevice.id}:${bestUplink.switchPort.id}`,
      code: 'auto_uplink_switch',
      title: `将“${switchDevice.name}”上联到“${bestUplink.router.name}”`,
      description: `使用一根 ${length}m 网线连接路由器空闲 LAN 口和交换机端口，使交换机可以为下游设备提供网络。`,
      objectIds: [bestUplink.router.id, switchDevice.id],
      patch: { newConnection: {
        id: `c-auto-uplink-${bestUplink.router.id}-${bestUplink.routerPort.id}-${switchDevice.id}-${bestUplink.switchPort.id}`,
        name: `${switchDevice.name}上联网线`, cableType: 'ethernet', length,
        fromObjectId: bestUplink.router.id, fromPortId: bestUplink.routerPort.id,
        toObjectId: switchDevice.id, toPortId: bestUplink.switchPort.id,
      } },
    });
    for (const [objectId, portId] of [[bestUplink.router.id, bestUplink.routerPort.id], [switchDevice.id, bestUplink.switchPort.id]]) {
      let ports = occupiedPorts.get(objectId);
      if (!ports) { ports = new Set(); occupiedPorts.set(objectId, ports); }
      ports.add(portId);
    }
  }

  for (const object of objects) {
    const isDistributor = ['router', 'switch', 'modem'].includes(object.type) || ['router', 'switch', 'modem'].includes(object.modelId);
    if (isDistributor) continue;

    for (const port of getPortRecords(object)) {
      if (port.type !== 'ethernet') continue;
      const canReceiveNetwork = port.direction === 'input' || port.direction === 'bidirectional';
      if (!canReceiveNetwork || !isPortDirectionConsistent(port)) continue;
      
      const isOccupied = occupiedPorts.get(object.id)?.has(port.id);
      if (isOccupied) continue;

      let bestDistributor = null;
      let minDistance = Number.MAX_VALUE;

      for (const candidate of objects) {
        if (candidate.id === object.id) continue;
        const candidateIsDistributor = ['router', 'switch'].includes(candidate.type) || ['router', 'switch'].includes(candidate.modelId);
        if (!candidateIsDistributor || !routerReachableObjectIds.has(candidate.id)) continue;

        for (const candidatePort of getPortRecords(candidate)) {
          if (candidatePort.type !== 'ethernet') continue;
          if (isWanPort(candidatePort)) continue;
          const canProvideNetwork = candidatePort.direction === 'output' || candidatePort.direction === 'bidirectional';
          if (!canProvideNetwork || !isPortDirectionConsistent(candidatePort)) continue;

          const isPortOccupied = occupiedPorts.get(candidate.id)?.has(candidatePort.id);
          if (isPortOccupied) continue;

          const dist = calculatePositionDistance(object.position, candidate.position);
          if (dist !== null && dist < minDistance) {
            minDistance = dist;
            bestDistributor = { device: candidate, port: candidatePort, distance: dist };
          }
        }
      }

      if (bestDistributor) {
        const length = ceilLength(Math.max(1.0, bestDistributor.distance * 1.1 + 0.3));
        suggestions.push({
          id: `auto-network:${object.id}:${port.id}`,
          code: 'auto_network_device',
          title: `为“${object.name}”连接网络`,
          description: `检测到“${object.name}”的网口“${port.name}”未连网。可自动使用一根 ${length}m 的以太网线连接到附近的“${bestDistributor.device.name}”的空闲端口“${bestDistributor.port.name}”。`,
          objectIds: [bestDistributor.device.id, object.id],
          patch: {
            newConnection: {
              id: `c-auto-network-${object.id}-${port.id}`,
              name: `${object.name}网线`,
              cableType: 'ethernet',
              length,
              fromObjectId: bestDistributor.device.id,
              fromPortId: bestDistributor.port.id,
              toObjectId: object.id,
              toPortId: port.id,
            }
          }
        });

        let localPorts = occupiedPorts.get(bestDistributor.device.id);
        if (!localPorts) {
          localPorts = new Set();
          occupiedPorts.set(bestDistributor.device.id, localPorts);
        }
        localPorts.add(bestDistributor.port.id);
      }
    }
  }

  // 4. 自动连接显示器 (auto_connect_display)
  const DISPLAY_PORT_TYPES = new Set(['hdmi', 'displayport', 'usb_c']);
  for (const object of objects) {
    for (const port of getPortRecords(object)) {
      if (!DISPLAY_PORT_TYPES.has(port.type)) continue;
      const isOutput = port.direction === 'output' || port.direction === 'bidirectional';
      if (!isOutput) continue;

      const isOccupied = occupiedPorts.get(object.id)?.has(port.id);
      if (isOccupied) continue;

      // Find nearest display with a matching input port
      let bestDisplay = null;
      let minDistance = Number.MAX_VALUE;

      for (const candidate of objects) {
        if (candidate.id === object.id) continue;
        const modelId = typeof candidate.modelId === 'string' ? candidate.modelId : '';
        const isDisplay = modelId.startsWith('monitor')
          || candidate.type === 'monitor'
          || modelId.startsWith('ultrawide');
        if (!isDisplay) continue;

        for (const candidatePort of getPortRecords(candidate)) {
          if (candidatePort.type !== port.type) continue;
          const isInput = candidatePort.direction === 'input' || candidatePort.direction === 'bidirectional';
          if (!isInput) continue;

          const isPortOccupied = occupiedPorts.get(candidate.id)?.has(candidatePort.id);
          if (isPortOccupied) continue;

          const dist = calculatePositionDistance(object.position, candidate.position);
          if (dist !== null && dist < minDistance) {
            minDistance = dist;
            bestDisplay = { device: candidate, port: candidatePort, distance: dist };
          }
        }
      }

      if (bestDisplay) {
        const cableType = inferCableType(port, bestDisplay.port);
        const typeLabel = { hdmi: 'HDMI', displayport: 'DP', usb_c: 'USB-C' }[port.type] || port.type;
        const length = ceilLength(Math.max(1.0, bestDisplay.distance * 1.1 + 0.3));
        suggestions.push({
          id: `auto-display:${object.id}:${port.id}`,
          code: 'auto_connect_display',
          title: `为"${object.name}"连接显示器`,
          description: `检测到"${object.name}"的${typeLabel}输出未连接。可自动使用一根 ${length}m 的${typeLabel}线连接到附近的"${bestDisplay.device.name}"。`,
          objectIds: [object.id, bestDisplay.device.id],
          patch: {
            newConnection: {
              id: `c-auto-display-${object.id}-${port.id}`,
              name: `${object.name}${typeLabel}线`,
              cableType,
              length,
              fromObjectId: object.id,
              fromPortId: port.id,
              toObjectId: bestDisplay.device.id,
              toPortId: bestDisplay.port.id,
            }
          }
        });

        let localPorts = occupiedPorts.get(bestDisplay.device.id);
        if (!localPorts) {
          localPorts = new Set();
          occupiedPorts.set(bestDisplay.device.id, localPorts);
        }
        localPorts.add(bestDisplay.port.id);
      }
    }
  }

  return suggestions.sort(compareSuggestions);
}

/**
 * Derive paid purchase recommendations from hazards that cannot be resolved by
 * rearranging existing items. Currently maps daisy-chained power strips to a
 * suggestion to add a dedicated power source (referenced from the catalog).
 * Returns suggestions with a `product` { category, modelId } pointer, deduped
 * per device pair.
 */
export function buildPurchaseSuggestions(rawObjects, rawConnections = [], options = {}) {
  const objects = getRecordItems(rawObjects);
  const connections = getRecordItems(rawConnections);
  const suggestions = [];
  const seen = new Set();
  const objectsById = new Map(objects.map(object => [object.id, object]));
  const ups = findModelTemplate({ modelId: 'ups' });
  const wiringIssues = Array.isArray(options.wiringIssues)
    ? options.wiringIssues
    : analyzeProjectWiring(objects, connections);
  const powerGraph = options.powerGraph || buildPowerGraph(objects, connections);
  const invalidConnectionIds = getInvalidConnectionIds(wiringIssues);

  // 1. Calculate occupied ports per object
  const occupiedPorts = new Map();
  for (const connection of connections) {
    if (invalidConnectionIds.has(connection.id)) continue;
    if (connection.fromObjectId && connection.fromPortId && connection.toObjectId && connection.toPortId) {
      let fromPorts = occupiedPorts.get(connection.fromObjectId);
      if (!fromPorts) {
        fromPorts = new Set();
        occupiedPorts.set(connection.fromObjectId, fromPorts);
      }
      fromPorts.add(connection.fromPortId);

      let toPorts = occupiedPorts.get(connection.toObjectId);
      if (!toPorts) {
        toPorts = new Set();
        occupiedPorts.set(connection.toObjectId, toPorts);
      }
      toPorts.add(connection.toPortId);
    }
  }
  const poweredObjectIds = getPoweredObjectIds(objects, powerGraph);

  // 2. Original cable warning/short check
  for (const issue of wiringIssues) {
    if (issue.code === 'power_strip_chain') {
      const key = [...issue.objectIds].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push({
        id: `buy-power-source:${key}`,
        code: 'buy_power_source',
        title: `考虑加购 ${ups?.displayName || 'UPS'} 替代插排串联`,
        description: '插排串联可能导致过载或接触点发热。建议改接墙壁插座，或加购 UPS / 独立电源分担负载。',
        objectIds: [...issue.objectIds],
        product: { category: 'power', modelId: 'ups' },
      });
    } else if (issue.code === 'short_cable' || issue.code === 'low_cable_slack') {
      const connectionId = issue.connectionIds[0];
      const connection = connections.find(candidate => candidate.id === connectionId);
      const status = connection && evaluateConnectionLength(connection, objects);
      if (!status) continue;
      const length = ceilLength(status.recommendedLength);
      if (length <= connection.length) continue;

      const key = `buy-cable:${connectionId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const typeMap = {
        power: '电源线',
        hdmi: 'HDMI 线',
        usb_c: 'USB-C 线',
        ethernet: '网线',
        displayport: 'DisplayPort 线',
        other: '连接线',
      };
      const typeName = typeMap[connection.cableType] || '连接线';

      suggestions.push({
        id: key,
        code: 'buy_cable',
        title: `加购约 ${length}m 的 ${typeName}`,
        description: `现有线材“${connection.name}”长度不足，建议加购一根 ${length}m 的新线材替换以防受力拉扯。`,
        connectionIds: [connectionId],
        product: { category: 'cable', modelId: connection.cableType, length },
      });
    }
  }

  // 3. 加购交换机：比较未联网设备与实际可用于下游设备的网络端口容量
  {
    const isNetworkDistributor = (obj) =>
      obj.modelId === 'router' || obj.type === 'router'
      || obj.modelId === 'modem' || obj.type === 'modem'
      || obj.modelId === 'switch' || obj.type === 'switch';
    const unconnectedEthernetDevices = objects.filter(obj => {
      if (isNetworkDistributor(obj)) return false;
      const ethPorts = getPortRecords(obj).filter(p =>
        p.type === 'ethernet'
        && (p.direction === 'input' || p.direction === 'bidirectional')
        && isPortDirectionConsistent(p)
      );
      if (ethPorts.length === 0) return false;
      const occupied = occupiedPorts.get(obj.id) || new Set();
      return ethPorts.some(p => !occupied.has(p.id));
    });

    const { availableLanPorts, occupiedLanCount } = objects
      .filter(obj => (obj.modelId === 'router' || obj.type === 'router')
        && !requiresPowerButIsUnpowered(obj, poweredObjectIds))
      .reduce((capacity, router) => {
        const lanPorts = getPortRecords(router).filter(p =>
          p.type === 'ethernet'
          && String(p.id).toLowerCase().includes('lan')
          && (p.direction === 'output' || p.direction === 'bidirectional')
          && isPortDirectionConsistent(p)
        );
        const routerOccupied = occupiedPorts.get(router.id) || new Set();
        return {
          availableLanPorts: capacity.availableLanPorts + lanPorts.length,
          occupiedLanCount: capacity.occupiedLanCount + lanPorts.filter(p => routerOccupied.has(p.id)).length,
        };
      }, { availableLanPorts: 0, occupiedLanCount: 0 });
    const freeLanPorts = Math.max(0, availableLanPorts - occupiedLanCount);
    const routerReachableObjectIds = getRouterReachableObjectIds(objects, connections, invalidConnectionIds, poweredObjectIds);
    const freeSwitchPorts = objects
      .filter(obj => (obj.modelId === 'switch' || obj.type === 'switch') && routerReachableObjectIds.has(obj.id))
      .reduce((count, switchDevice) => count + getPortRecords(switchDevice).filter(port =>
        port.type === 'ethernet'
        && !isWanPort(port)
        && (port.direction === 'output' || port.direction === 'bidirectional')
        && isPortDirectionConsistent(port)
        && !occupiedPorts.get(switchDevice.id)?.has(port.id)
      ).length, 0);

    if (unconnectedEthernetDevices.length > freeLanPorts + freeSwitchPorts) {
      const key = 'buy-switch';
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({
          id: key,
          code: 'buy_switch',
          title: '考虑加购网络交换机',
          description: `检测到 ${unconnectedEthernetDevices.length} 个未联网的以太网设备，路由器仅剩 ${freeLanPorts} 个空闲 LAN 口。建议加购网络交换机以扩展网络端口。`,
          product: { category: 'network', modelId: 'switch' },
          requiresLanPortMigration: freeLanPorts === 0,
        });
      }
    }
  }

  // 4. New recommendation: buy power strip if an existing power strip is fully occupied
  for (const object of objects) {
    const isPowerStrip = object?.modelId === 'power-strip' || object?.type === 'power_strip';
    if (isPowerStrip) {
      const acOutputs = getPortRecords(object).filter(p =>
        p.type === 'ac_output' && isPortDirectionConsistent(p)
      );
      if (acOutputs.length > 0) {
        const occupied = occupiedPorts.get(object.id) || new Set();
        const allOccupied = acOutputs.every(p => occupied.has(p.id));
        if (allOccupied) {
          const key = `buy-power-strip:${object.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            suggestions.push({
              id: key,
              code: 'buy_power_strip',
              title: `考虑为“${object.name}”加购新插排`,
              description: `插排“${object.name}”的插孔已被全部占满。建议加购一个新插排以扩展电源接口。`,
              objectIds: [object.id],
              product: { category: 'power', modelId: 'power-strip' },
            });
          }
        }
      }
    }
  }

  // 5. 电源过载购买建议
  for (const object of objects) {
    const maxLoad = getEffectiveMaxLoad(object);
    if (maxLoad > 0) {
      const currentLoad = computeDevicePowerLoad(object.id, objects, connections, powerGraph);
      if (classifyPowerLoad(currentLoad, maxLoad) === 'overload') {
        const key = `buy-ups-overload:${object.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          suggestions.push({
            id: key,
            code: 'buy_ups_overload',
            title: `为过载的“${object.name}”加购 UPS 或分流`,
            description: `电源“${object.name}”的外部总负载已达 ${currentLoad}W，超出其安全承载上限 ${maxLoad}W。建议加购一台额定功率更高的 UPS，或加购插排将部分电器改接至其他独立插座。`,
            objectIds: [object.id],
            product: { category: 'power', modelId: 'ups' },
          });
        }
      }
    }
  }

  // 6. 无电源可接时建议加购
  for (const issue of wiringIssues) {
    if (issue.code !== 'unpowered_input') continue;
    const endpoint = resolveUnpoweredInput(issue, objectsById);
    if (!endpoint) continue;
    const { object, port } = endpoint;

    // Skip objects that can supply power — their own unpowered input is valid
    // (wall outlets, power strips, UPS, adapters — they need external power too,
    // but they are infrastructure, not endpoint devices).
    const hasOutputPort = getPortRecords(object).some(
      p => p.direction === 'output'
        && (p.type === 'ac_output' || p.type === 'dc_output')
    );
    if (hasOutputPort) continue;

    if (!isPortDirectionConsistent(port)) continue;

    // Check if there's a nearby power source with a free compatible port
    let hasNearbySource = false;
    for (const candidate of objects) {
      if (candidate.id === object.id) continue;
      if (requiresPowerButIsUnpowered(candidate, poweredObjectIds)) continue;
      for (const candidatePort of getPortRecords(candidate)) {
        const hasFromDir = candidatePort.direction === 'output' || candidatePort.direction === 'bidirectional';
        if (hasFromDir &&
            isPortDirectionConsistent(candidatePort) &&
            !(occupiedPorts.get(candidate.id)?.has(candidatePort.id)) &&
            arePortTypesCompatible(candidatePort.type, port.type)) {
          hasNearbySource = true;
          break;
        }
      }
      if (hasNearbySource) break;
    }

    if (!hasNearbySource) {
      const key = `buy-power-unpowered:${object.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        const modelId = port.type === 'ac_input' ? 'power-strip' : 'ups';
        const productName = modelId === 'power-strip' ? '插排' : 'UPS';
        suggestions.push({
          id: key,
          code: 'buy_power_for_unpowered',
          title: `为”${object.name}”加购${productName}`,
          description: `设备”${object.name}”的电源输入未连接，且附近没有可用的空闲电源端口。建议加购${productName}以扩展供电能力。`,
          objectIds: [object.id],
          product: { category: 'power', modelId },
        });
      }
    }
  }

  return suggestions;
}

/**
 * Apply a single suggestion's patch to a project, returning a new project object
 * (inputs are not mutated). Object patches replace position/rotation; connection
 * patches replace length. Unknown targets are returned unchanged.
 */
export function applyImprovement(project, suggestion) {
  const patch = suggestion?.patch;
  if (!patch) return project;

  if (patch.objectId) {
    const objects = project.objects || [];
    const targetObject = objects.find(object => object.id === patch.objectId);
    if (!targetObject) return project;
    const nextPosition = patch.position ? patch.position : targetObject.position;
    const nextRotation = patch.rotation ? patch.rotation : targetObject.rotation;
    if (hasSameOwnValues(targetObject.position, nextPosition)
      && hasSameOwnValues(targetObject.rotation, nextRotation)) {
      return project;
    }
    return {
      ...project,
      objects: objects.map(object =>
        object.id === patch.objectId
          ? {
              ...object,
              position: patch.position ? { ...patch.position } : object.position,
              rotation: patch.rotation ? { ...patch.rotation } : object.rotation,
            }
          : object),
    };
  }

  if (patch.connectionId) {
    const connections = project.connections || [];
    const targetConnection = connections.find(connection => connection.id === patch.connectionId);
    if (!targetConnection || targetConnection.length === patch.length) return project;
    return {
      ...project,
      connections: connections.map(connection =>
        connection.id === patch.connectionId
          ? { ...connection, length: patch.length }
          : connection),
    };
  }

  if (patch.newConnection) {
    const connections = project.connections || [];
    const objectsById = new Map((project.objects || []).map(object => [object.id, object]));
    const fromObject = objectsById.get(patch.newConnection.fromObjectId);
    const toObject = objectsById.get(patch.newConnection.toObjectId);
    const fromPort = getPortRecords(fromObject).find(port => port.id === patch.newConnection.fromPortId);
    const toPort = getPortRecords(toObject).find(port => port.id === patch.newConnection.toPortId);
    if (!fromObject
      || !toObject
      || !arePortsCompatible(fromPort, toPort)
      || patch.newConnection.cableType !== inferCableType(fromPort, toPort)) {
      return project;
    }
    if (connections.some(connection => connection.id === patch.newConnection.id)) {
      return project;
    }
    const proposedPortRefs = [
      [patch.newConnection.fromObjectId, patch.newConnection.fromPortId],
      [patch.newConnection.toObjectId, patch.newConnection.toPortId],
    ].filter(([, portId]) => portId !== undefined && portId !== null);
    const hasOccupiedPort = proposedPortRefs.some(([objectId, portId]) =>
      connections.some(connection =>
        (connection.fromObjectId === objectId && connection.fromPortId === portId)
        || (connection.toObjectId === objectId && connection.toPortId === portId))
    );
    if (hasOccupiedPort) return project;
    return {
      ...project,
      connections: [
        ...connections,
        { ...patch.newConnection },
      ],
    };
  }

  return project;
}

/**
 * Apply every suggestion in order, threading the project through each patch.
 * Useful for an "apply all" action; returns a new project (inputs unchanged).
 */
export function applyAllImprovements(project, suggestions) {
  return suggestions.reduce((current, suggestion) => applyImprovement(current, suggestion), project);
}

function getSuggestionApplicationKey(suggestion) {
  return `${suggestion.id}:${JSON.stringify(suggestion.patch)}`;
}

/**
 * Repeatedly recompute and apply free improvements until no new suggestion is
 * available. This allows prerequisite fixes (for example, powering a switch)
 * to unlock a subsequent safe wiring suggestion in one user action.
 */
export function applyAllAvailableImprovements(project) {
  if (!project?.room) return project;

  let current = project;
  const appliedSuggestionKeys = new Set();
  while (true) {
    const suggestions = buildFreeImprovements(
      current.room,
      current.objects || [],
      current.connections || []
    ).filter(suggestion => !appliedSuggestionKeys.has(getSuggestionApplicationKey(suggestion)));
    if (suggestions.length === 0) return current;

    for (const suggestion of suggestions) appliedSuggestionKeys.add(getSuggestionApplicationKey(suggestion));
    current = applyAllImprovements(current, suggestions);
  }
}

/**
 * Project-shaped facade: derive every recommendation for a project in one call.
 * Returns { freeImprovements, purchases, total } so the UI can render a panel
 * and badge without orchestrating the individual builders.
 */
export function buildRecommendations(project = {}, options = {}) {
  const { room, objects: rawObjects, connections: rawConnections } = project || {};
  const objects = getRecordItems(rawObjects);
  const connections = getRecordItems(rawConnections);
  const wiringIssues = Array.isArray(options.wiringIssues)
    ? options.wiringIssues
    : analyzeProjectWiring(objects, connections);
  const powerGraph = options.powerGraph || buildPowerGraph(objects, connections);
  const freeImprovements = room
    ? buildFreeImprovements(room, objects, connections, { wiringIssues, powerGraph })
    : [];
  const purchases = buildPurchaseSuggestions(objects, connections, { wiringIssues, powerGraph });
  return {
    freeImprovements,
    purchases,
    total: freeImprovements.length + purchases.length,
  };
}
