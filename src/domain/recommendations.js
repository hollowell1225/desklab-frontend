import {
  analyzeProjectLayout,
  snapObjectToSupport,
  snapWallOutletToNearestWall,
} from './layout-analysis.js';
import { analyzeProjectWiring, buildPowerGraph, computeDevicePowerLoad } from './analysis.js';
import { calculatePositionDistance, evaluateConnectionLength, arePortTypesCompatible, isPortDirectionConsistent, inferCableType } from './connections.js';
import { validateAndConstrainObject } from './geometry.js';
import { findModelTemplate } from './catalog.js';

// Round a recommended cable length up to the centimetre so the applied value is
// never shorter than the computed recommendation (which would leave the slack
// warning unresolved).
function ceilLength(value) {
  return Math.ceil(value * 100) / 100;
}

// Deterministic display order so the UI and tests see a stable list.
const SUGGESTION_ORDER = {
  move_inside_room: 0,
  drop_to_support: 1,
  snap_outlet_to_wall: 2,
  auto_power_device: 3,
  auto_network_device: 4,
  auto_connect_display: 5,
  extend_cable: 6,
};

function compareSuggestions(first, second) {
  const rank = (SUGGESTION_ORDER[first.code] ?? 99) - (SUGGESTION_ORDER[second.code] ?? 99);
  if (rank !== 0) return rank;
  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0;
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
export function buildFreeImprovements(room, objects, connections = [], options = {}) {
  const suggestions = [];
  const objectsById = new Map(objects.map(object => [object.id, object]));
  const wiringIssues = Array.isArray(options.wiringIssues)
    ? options.wiringIssues
    : analyzeProjectWiring(objects, connections);

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

  for (const issue of wiringIssues) {
    if (issue.code === 'unpowered_input') {
      const [, objectId, portId] = issue.id.split(':');
      const object = objectsById.get(objectId);
      const port = object?.ports?.find(p => p.id === portId);
      if (object && port) {
        let bestSource = null;
        let minDistance = Number.MAX_VALUE;

        for (const candidate of objects) {
          if (candidate.id === object.id) continue;
          for (const candidatePort of candidate.ports || []) {
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
  for (const object of objects) {
    const isDistributor = ['router', 'switch', 'modem'].includes(object.type) || ['router', 'switch', 'modem'].includes(object.modelId);
    if (isDistributor) continue;

    for (const port of object.ports || []) {
      if (port.type !== 'ethernet') continue;
      
      const isOccupied = occupiedPorts.get(object.id)?.has(port.id);
      if (isOccupied) continue;

      let bestDistributor = null;
      let minDistance = Number.MAX_VALUE;

      for (const candidate of objects) {
        if (candidate.id === object.id) continue;
        const candidateIsDistributor = ['router', 'switch'].includes(candidate.type) || ['router', 'switch'].includes(candidate.modelId);
        if (!candidateIsDistributor) continue;

        for (const candidatePort of candidate.ports || []) {
          if (candidatePort.type !== 'ethernet') continue;
          if (candidatePort.id === 'wan' || candidatePort.name?.toLowerCase().includes('wan')) continue;

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
    for (const port of object.ports || []) {
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
        const isDisplay = candidate.modelId?.startsWith('monitor')
          || candidate.type === 'monitor'
          || candidate.modelId?.startsWith('ultrawide');
        if (!isDisplay) continue;

        for (const candidatePort of candidate.ports || []) {
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
export function buildPurchaseSuggestions(objects, connections = [], options = {}) {
  const suggestions = [];
  const seen = new Set();
  const objectsById = new Map(objects.map(object => [object.id, object]));
  const ups = findModelTemplate({ modelId: 'ups' });
  const wiringIssues = Array.isArray(options.wiringIssues)
    ? options.wiringIssues
    : analyzeProjectWiring(objects, connections);
  const powerGraph = options.powerGraph || buildPowerGraph(objects, connections);

  // 1. Calculate occupied ports per object
  const occupiedPorts = new Map();
  for (const connection of connections) {
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

  // 3. 加购交换机：仅统计未连接网口的设备，与路由器空闲 LAN 口比较
  const hasSwitch = objects.some(obj => obj.modelId === 'switch' || obj.type === 'switch');
  if (!hasSwitch) {
    const isNetworkDistributor = (obj) =>
      obj.modelId === 'router' || obj.type === 'router'
      || obj.modelId === 'modem' || obj.type === 'modem'
      || obj.modelId === 'switch' || obj.type === 'switch';
    const unconnectedEthernetDevices = objects.filter(obj => {
      if (isNetworkDistributor(obj)) return false;
      const ethPorts = (obj.ports || []).filter(p => p.type === 'ethernet');
      if (ethPorts.length === 0) return false;
      const occupied = occupiedPorts.get(obj.id) || new Set();
      return ethPorts.some(p => !occupied.has(p.id));
    });

    const router = objects.find(obj => obj.modelId === 'router' || obj.type === 'router');
    let availableLanPorts = 0;
    let occupiedLanCount = 0;
    if (router) {
      const lanPorts = (router.ports || []).filter(p => p.type === 'ethernet' && p.id.includes('lan'));
      if (lanPorts.length > 0) {
        availableLanPorts = lanPorts.length;
        const routerOccupied = occupiedPorts.get(router.id) || new Set();
        occupiedLanCount = lanPorts.filter(p => routerOccupied.has(p.id)).length;
      }
    }
    const freeLanPorts = Math.max(0, availableLanPorts - occupiedLanCount);

    if (unconnectedEthernetDevices.length > freeLanPorts) {
      const key = 'buy-switch';
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({
          id: key,
          code: 'buy_switch',
          title: '考虑加购网络交换机',
          description: `检测到 ${unconnectedEthernetDevices.length} 个未联网的以太网设备，路由器仅剩 ${freeLanPorts} 个空闲 LAN 口。建议加购网络交换机以扩展网络端口。`,
          product: { category: 'network', modelId: 'switch' },
        });
      }
    }
  }

  // 4. New recommendation: buy power strip if an existing power strip is fully occupied
  for (const object of objects) {
    const isPowerStrip = object?.modelId === 'power-strip' || object?.type === 'power_strip';
    if (isPowerStrip) {
      const acOutputs = (object.ports || []).filter(p => p.type === 'ac_output');
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
    const template = findModelTemplate(object);
    const maxLoad = object.maxLoad ?? template?.maxLoad ?? 0;
    if (maxLoad > 0) {
      const currentLoad = computeDevicePowerLoad(object.id, objects, connections, powerGraph);
      if (currentLoad > maxLoad) {
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
    const [, objectId] = issue.id.split(':');
    const object = objectsById.get(objectId);
    if (!object) continue;

    // Skip objects that can supply power — their own unpowered input is valid
    // (wall outlets, power strips, UPS, adapters — they need external power too,
    // but they are infrastructure, not endpoint devices).
    const hasOutputPort = (object.ports || []).some(
      p => p.direction === 'output'
        && (p.type === 'ac_output' || p.type === 'dc_output')
    );
    if (hasOutputPort) continue;

    const port = object.ports?.find(p => issue.id.endsWith(`:${p.id}`));
    if (!port) continue;

    // Check if there's a nearby power source with a free compatible port
    let hasNearbySource = false;
    for (const candidate of objects) {
      if (candidate.id === object.id) continue;
      for (const candidatePort of candidate.ports || []) {
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
    return {
      ...project,
      objects: (project.objects || []).map(object =>
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
    return {
      ...project,
      connections: (project.connections || []).map(connection =>
        connection.id === patch.connectionId
          ? { ...connection, length: patch.length }
          : connection),
    };
  }

  if (patch.newConnection) {
    return {
      ...project,
      connections: [
        ...(project.connections || []),
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

/**
 * Project-shaped facade: derive every recommendation for a project in one call.
 * Returns { freeImprovements, purchases, total } so the UI can render a panel
 * and badge without orchestrating the individual builders.
 */
export function buildRecommendations(project = {}, options = {}) {
  const { room, objects = [], connections = [] } = project;
  const wiringIssues = Array.isArray(options.wiringIssues)
    ? options.wiringIssues
    : analyzeProjectWiring(objects, connections);
  const powerGraph = options.powerGraph || buildPowerGraph(objects, connections);
  const freeImprovements = room
    ? buildFreeImprovements(room, objects, connections, { wiringIssues })
    : [];
  const purchases = buildPurchaseSuggestions(objects, connections, { wiringIssues, powerGraph });
  return {
    freeImprovements,
    purchases,
    total: freeImprovements.length + purchases.length,
  };
}
