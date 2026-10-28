import { DEVICE_CATALOG, findModelTemplate, withPortAnchors } from './catalog.js';
import { evaluateConnectionLength, inferCableType } from './connections.js';

// Turns a short device list ("a desktop, two 27-inch monitors, a router") into
// a placed and fully wired desk. Templates use it today; an LLM that turns a
// sentence into the same device list can reuse it later. Wiring is planned
// deliberately rather than with the greedy free-improvement engine so that,
// for example, two monitors are fed by two different PC outputs.

export const STANDARD_CABLE_LENGTHS = Object.freeze([0.5, 1, 1.5, 1.8, 2, 3, 5, 10]);

const DEFAULT_ROOM = Object.freeze({ length: 4, width: 3.5, height: 2.7 });
const DESK_MODEL_ID = 'office-desk';
const WALL_GAP = 0.15; // space behind the desk for the strip and adapters
const SIDE_GAP = 0.05;
const MONITOR_GAP = 0.04;
const MAX_MONITORS = 3;

// Devices a user can ask for, with how many fit one desk.
export const DESK_SCENE_DEVICE_LIMITS = Object.freeze({
  'desktop-pc': 1,
  'laptop-15': 1,
  'monitor-24': MAX_MONITORS,
  'monitor-27': MAX_MONITORS,
  'ultrawide-monitor': 2,
  router: 1,
});
const MONITOR_MODEL_IDS = new Set(['monitor-24', 'monitor-27', 'ultrawide-monitor']);

// Desk sizes a home user plausibly has, in metres.
export const DESK_SIZE_LIMITS = Object.freeze({
  length: Object.freeze({ min: 0.8, max: 3 }),
  depth: Object.freeze({ min: 0.5, max: 1.2 }),
});

function createObject(modelId, id, name, position, rotationZ = 0, scale = null) {
  const template = findModelTemplate({ modelId });
  const objectScale = scale ? { ...scale } : { ...template.defaultScale };
  return {
    id,
    category: findCategory(modelId),
    type: template.type,
    modelId: template.modelId,
    name,
    shape: template.shape,
    assetUrl: template.assetUrl,
    position: { ...position },
    rotation: { x: 0, y: 0, z: rotationZ },
    scale: objectScale,
    color: template.color,
    ports: withPortAnchors(template.ports ? structuredClone(template.ports) : [], template.modelId),
  };
}

function findCategory(modelId) {
  return DEVICE_CATALOG.find(category => category.models.some(model => model.modelId === modelId))?.category;
}

function standardCableLength(minimumLength) {
  return STANDARD_CABLE_LENGTHS.find(length => length >= minimumLength - 1e-9)
    ?? Math.ceil(minimumLength);
}

function sanitizeDevices(devices, notes) {
  const counts = new Map();
  for (const entry of Array.isArray(devices) ? devices : []) {
    const modelId = entry?.modelId;
    const count = Number.isInteger(entry?.count) ? entry.count : 0;
    if (count <= 0) continue;
    if (!Object.hasOwn(DESK_SCENE_DEVICE_LIMITS, modelId) || !findModelTemplate({ modelId })) {
      notes.push(`暂不支持的设备“${String(modelId)}”，已跳过。`);
      continue;
    }
    counts.set(modelId, (counts.get(modelId) || 0) + count);
  }
  for (const [modelId, count] of counts) {
    const limit = DESK_SCENE_DEVICE_LIMITS[modelId];
    if (count > limit) {
      notes.push(`${findModelTemplate({ modelId }).displayName}最多放 ${limit} 台，已按 ${limit} 台生成。`);
      counts.set(modelId, limit);
    }
  }
  return counts;
}

function resolveDeskSize(requested, fallback, limits, label, notes) {
  if (!Number.isFinite(requested) || requested <= 0) return fallback;
  const clamped = Math.min(limits.max, Math.max(limits.min, requested));
  if (clamped !== requested) {
    notes.push(`书桌${label}按 ${clamped}m 生成（支持 ${limits.min}–${limits.max}m）。`);
  }
  return clamped;
}

function numberedName(displayName, index, total) {
  return total > 1 ? `${displayName} ${index + 1}` : displayName;
}

/**
 * Build a ready-to-use desk scene.
 *
 * @param {object} options
 * @param {{modelId: string, count: number}[]} options.devices
 * @param {{length?: number, depth?: number}} [options.desk]
 * @returns {{room, objects, connections, notes: string[]}}
 */
export function buildDeskScene({ devices = [], desk = {} } = {}) {
  const notes = [];
  const counts = sanitizeDevices(devices, notes);
  const deskTemplate = findModelTemplate({ modelId: DESK_MODEL_ID });
  const deskScale = {
    x: resolveDeskSize(desk.length, deskTemplate.defaultScale.x, DESK_SIZE_LIMITS.length, '长度', notes),
    y: resolveDeskSize(desk.depth, deskTemplate.defaultScale.y, DESK_SIZE_LIMITS.depth, '深度', notes),
    z: deskTemplate.defaultScale.z,
  };

  const pcTemplate = findModelTemplate({ modelId: 'desktop-pc' });
  const routerTemplate = findModelTemplate({ modelId: 'router' });
  const room = {
    ...DEFAULT_ROOM,
    length: Math.max(DEFAULT_ROOM.length,
      deskScale.x + 2 * (SIDE_GAP + Math.max(pcTemplate.defaultScale.x, routerTemplate.defaultScale.x)) + 0.4),
  };

  const deskBackY = room.width / 2 - WALL_GAP;
  const deskY = deskBackY - deskScale.y / 2;
  const deskFrontY = deskBackY - deskScale.y;
  const deskTop = deskScale.z;
  const objects = [];
  const deskObject = createObject(DESK_MODEL_ID, 'desk', deskTemplate.displayName,
    { x: 0, y: deskY, z: deskTop / 2 }, 0, deskScale);
  objects.push(deskObject);

  // Monitors: side by side along the back of the desk, screens toward the user.
  const requestedMonitors = [...MONITOR_MODEL_IDS].flatMap(modelId =>
    Array.from({ length: counts.get(modelId) || 0 }, (_, index) => ({ modelId, index, total: counts.get(modelId) })));
  const monitorLimited = requestedMonitors.slice(0, MAX_MONITORS);
  if (requestedMonitors.length > MAX_MONITORS) {
    notes.push(`一张桌子最多放 ${MAX_MONITORS} 台显示器，已按 ${MAX_MONITORS} 台生成。`);
  }
  const usableWidth = deskScale.x - 0.1;
  const placedMonitors = [];
  let usedWidth = 0;
  for (const monitor of monitorLimited) {
    const width = findModelTemplate({ modelId: monitor.modelId }).defaultScale.x;
    const nextWidth = usedWidth + (placedMonitors.length > 0 ? MONITOR_GAP : 0) + width;
    if (nextWidth > usableWidth + 1e-9) break;
    usedWidth = nextWidth;
    placedMonitors.push({ ...monitor, width });
  }
  if (placedMonitors.length < monitorLimited.length) {
    notes.push(`桌面宽度 ${deskScale.x}m 放不下 ${monitorLimited.length} 台显示器，已放入 ${placedMonitors.length} 台。`);
  }
  let cursorX = -usedWidth / 2;
  const monitorObjects = placedMonitors.map(monitor => {
    const template = findModelTemplate({ modelId: monitor.modelId });
    const x = cursorX + monitor.width / 2;
    cursorX += monitor.width + MONITOR_GAP;
    return createObject(monitor.modelId, `${monitor.modelId}-${monitor.index + 1}`,
      numberedName(template.displayName, monitor.index, monitor.total),
      { x, y: deskBackY - 0.15, z: deskTop + template.defaultScale.z / 2 }, 180);
  });
  objects.push(...monitorObjects);

  let laptop = null;
  if (counts.get('laptop-15')) {
    const template = findModelTemplate({ modelId: 'laptop-15' });
    const size = template.defaultScale;
    const position = monitorObjects.length > 0
      ? { x: deskScale.x / 2 - size.x / 2 - 0.08, y: deskFrontY + size.y / 2 + 0.08 }
      : { x: 0, y: deskY };
    laptop = createObject('laptop-15', 'laptop', template.displayName,
      { ...position, z: deskTop + size.z / 2 }, 180);
    objects.push(laptop);
  }

  let pc = null;
  if (counts.get('desktop-pc')) {
    const size = pcTemplate.defaultScale;
    pc = createObject('desktop-pc', 'desktop-pc', pcTemplate.displayName,
      { x: deskScale.x / 2 + SIDE_GAP + size.x / 2, y: deskY, z: size.z / 2 }, 180);
    objects.push(pc);
  }

  let router = null;
  if (counts.get('router')) {
    const size = routerTemplate.defaultScale;
    router = createObject('router', 'router', routerTemplate.displayName,
      { x: -(deskScale.x / 2 + SIDE_GAP + size.x / 2), y: room.width / 2 - 0.02 - size.y / 2, z: size.z / 2 });
    objects.push(router);
  }

  // Power: wall outlet -> strip behind the desk -> every AC device; one adapter per DC device.
  const stripTemplate = findModelTemplate({ modelId: 'power-strip' });
  const strip = createObject('power-strip', 'power-strip', stripTemplate.displayName, {
    x: 0,
    y: room.width / 2 - 0.01 - stripTemplate.defaultScale.y / 2,
    z: stripTemplate.defaultScale.z / 2,
  });
  const outletTemplate = findModelTemplate({ modelId: 'wall-outlet' });
  const outlet = createObject('wall-outlet', 'wall-outlet', outletTemplate.displayName, {
    x: -(stripTemplate.defaultScale.x / 2 + 0.15),
    y: room.width / 2 - outletTemplate.defaultScale.y / 2,
    z: 0.3,
  });
  objects.push(strip, outlet);

  const adapterTemplate = findModelTemplate({ modelId: 'power-adapter' });
  const dcDevices = [laptop, router].filter(Boolean);
  const adapters = dcDevices.map((device, index) => {
    const adapter = createObject('power-adapter', `power-adapter-${device.id}`, `${device.name}电源适配器`, {
      x: stripTemplate.defaultScale.x / 2 + 0.08 + adapterTemplate.defaultScale.x / 2 + index * (adapterTemplate.defaultScale.x + 0.05),
      y: room.width / 2 - 0.01 - adapterTemplate.defaultScale.y / 2,
      z: adapterTemplate.defaultScale.z / 2,
    });
    return { adapter, device };
  });
  objects.push(...adapters.map(entry => entry.adapter));

  const connections = [];
  const connect = (from, fromPortId, to, toPortId, name) => {
    const fromPort = from.ports.find(port => port.id === fromPortId);
    const toPort = to.ports.find(port => port.id === toPortId);
    const probe = { fromObjectId: from.id, fromPortId, toObjectId: to.id, toPortId, length: 1 };
    const { recommendedLength } = evaluateConnectionLength(probe, objects);
    connections.push({
      id: `c-${from.id}-${fromPortId}-${to.id}-${toPortId}`,
      name,
      cableType: inferCableType(fromPort, toPort),
      length: standardCableLength(recommendedLength),
      fromObjectId: from.id,
      fromPortId,
      toObjectId: to.id,
      toPortId,
    });
  };

  connect(outlet, 'ac-out-1', strip, 'ac-in', `${strip.name}电源线`);
  const acLoads = [pc, ...monitorObjects, ...adapters.map(entry => entry.adapter)].filter(Boolean);
  const freeAcOutputs = [
    ...strip.ports.filter(port => port.type === 'ac_output').map(port => [strip, port.id]),
    [outlet, 'ac-out-2'],
  ];
  for (const load of acLoads) {
    const next = freeAcOutputs.shift();
    if (!next) {
      notes.push(`插孔不够，“${load.name}”暂未接电，可以再加一个插排。`);
      continue;
    }
    const [source, portId] = next;
    connect(source, portId, load, 'ac-in', `${load.name}电源线`);
  }
  for (const { adapter, device } of adapters) {
    connect(adapter, 'dc-out', device, 'dc-in', `${device.name}电源线`);
  }

  // Displays: each video output feeds a different monitor where possible.
  const usedMonitorInputs = new Set();
  const fedMonitors = new Set();
  const videoOutputs = [
    ...(pc ? [[pc, 'dp-out', 'displayport'], [pc, 'hdmi-out', 'hdmi']] : []),
    ...(laptop ? [[laptop, 'hdmi-out', 'hdmi']] : []),
  ];
  for (const [source, outputId, portType] of videoOutputs) {
    const candidates = monitorObjects
      .map(monitor => ({ monitor, input: monitor.ports.find(port => port.type === portType && port.direction === 'input') }))
      .filter(({ monitor, input }) => input && !usedMonitorInputs.has(`${monitor.id}:${input.id}`)
        && !connections.some(connection => connection.fromObjectId === source.id && connection.toObjectId === monitor.id));
    const choice = candidates.find(({ monitor }) => !fedMonitors.has(monitor.id)) || candidates[0];
    if (!choice) continue;
    usedMonitorInputs.add(`${choice.monitor.id}:${choice.input.id}`);
    fedMonitors.add(choice.monitor.id);
    const label = portType === 'displayport' ? 'DP' : 'HDMI';
    connect(source, outputId, choice.monitor, choice.input.id, `${source.name}到${choice.monitor.name}的${label}线`);
  }
  if (videoOutputs.length > 0) {
    for (const monitor of monitorObjects.filter(candidate => !fedMonitors.has(candidate.id))) {
      notes.push(`“${monitor.name}”暂时没有可用的视频输出，可能需要显卡上更多的接口。`);
    }
  }

  if (router && pc) {
    connect(router, 'lan-1', pc, 'eth-1', `${pc.name}网线`);
  }

  // Frame the desk from the user's side. Camera poses use Three.js axes
  // (y is height, z is the room's y axis), matching saved project cameras.
  const camera = {
    position: { x: 0, y: deskTop + 1.4, z: deskY - (deskScale.x + 1.4) },
    target: { x: 0, y: deskTop, z: deskY },
  };

  return { room, objects, connections, camera, notes };
}
