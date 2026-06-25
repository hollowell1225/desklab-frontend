export const DEVICE_CATALOG = [
  {
    category: 'furniture', categoryName: '家具',
    models: [
      { type: 'office-desk', modelId: 'office-desk', displayName: '办公桌', shape: 'rect', assetUrl: null, defaultScale: { x: 1.4, y: 0.7, z: 0.75 }, color: '#1e88e5' },
      { type: 'gaming-desk', modelId: 'gaming-desk', displayName: '电竞桌', shape: 'rect', assetUrl: null, defaultScale: { x: 1.6, y: 0.8, z: 0.75 }, color: '#3949ab' },
      { type: 'standing-desk', modelId: 'standing-desk', displayName: '升降桌', shape: 'rect', assetUrl: null, defaultScale: { x: 1.2, y: 0.6, z: 0.75 }, color: '#00acc1' },
      { type: 'l-desk', modelId: 'l-desk', displayName: 'L 型桌', shape: 'rect', assetUrl: null, defaultScale: { x: 1.8, y: 1.2, z: 0.75 }, color: '#43a047' },
    ],
  },
  {
    category: 'computer', categoryName: '电脑',
    models: [
      { type: 'desktop-pc', modelId: 'desktop-pc', displayName: '台式主机', shape: 'rect', assetUrl: null, defaultScale: { x: 0.25, y: 0.5, z: 0.5 }, color: '#424242', wattage: 350, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, { id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' }, { id: 'dp-out', name: 'DP 输出', type: 'displayport', direction: 'output' }, { id: 'eth-1', name: '网口', type: 'ethernet', direction: 'bidirectional' }] },
      { type: 'laptop', modelId: 'laptop-15', displayName: '15 英寸笔记本', shape: 'rect', assetUrl: null, defaultScale: { x: 0.36, y: 0.28, z: 0.22 }, color: '#607d8b', wattage: 65, ports: [{ id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input' }, { id: 'usb-c', name: 'USB-C', type: 'usb_c', direction: 'bidirectional' }, { id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' }] },
      { type: 'mini-pc', modelId: 'mini-pc', displayName: '迷你主机', shape: 'rect', assetUrl: null, defaultScale: { x: 0.15, y: 0.15, z: 0.05 }, color: '#37474f', wattage: 45, ports: [{ id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input' }, { id: 'hdmi-out', name: 'HDMI 输出', type: 'hdmi', direction: 'output' }, { id: 'eth-1', name: '网口', type: 'ethernet', direction: 'bidirectional' }] },
      { type: 'all-in-one', modelId: 'all-in-one', displayName: '一体机', shape: 'rect', assetUrl: null, defaultScale: { x: 0.55, y: 0.2, z: 0.45 }, color: '#cfd8dc', wattage: 120, ports: [{ id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input' }, { id: 'eth-1', name: '网口', type: 'ethernet', direction: 'bidirectional' }] },
    ],
  },
  {
    category: 'display', categoryName: '显示设备',
    models: [
      { type: 'monitor', modelId: 'monitor-24', displayName: '24 英寸显示器', shape: 'rect', assetUrl: null, defaultScale: { x: 0.54, y: 0.05, z: 0.32 }, color: '#212121', wattage: 30, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, { id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' }, { id: 'dp-in', name: 'DP 输入', type: 'displayport', direction: 'input' }] },
      { type: 'monitor', modelId: 'monitor-27', displayName: '27 英寸显示器', shape: 'rect', assetUrl: null, defaultScale: { x: 0.62, y: 0.06, z: 0.37 }, color: '#111111', wattage: 45, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, { id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' }, { id: 'dp-in', name: 'DP 输入', type: 'displayport', direction: 'input' }] },
      { type: 'monitor', modelId: 'ultrawide-monitor', displayName: '带鱼屏显示器', shape: 'rect', assetUrl: null, defaultScale: { x: 0.82, y: 0.1, z: 0.36 }, color: '#000000', wattage: 60, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, { id: 'hdmi-in', name: 'HDMI 输入', type: 'hdmi', direction: 'input' }, { id: 'dp-in', name: 'DP 输入', type: 'displayport', direction: 'input' }] },
    ],
  },
  {
    category: 'network', categoryName: '网络',
    models: [
      { type: 'router', modelId: 'router', displayName: '路由器', shape: 'rect', assetUrl: null, defaultScale: { x: 0.35, y: 0.25, z: 0.08 }, color: '#4caf50', wattage: 12, ports: [{ id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input' }, { id: 'wan', name: 'WAN 口', type: 'ethernet', direction: 'bidirectional' }, { id: 'lan-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }, { id: 'lan-2', name: 'LAN 2', type: 'ethernet', direction: 'bidirectional' }, { id: 'lan-3', name: 'LAN 3', type: 'ethernet', direction: 'bidirectional' }] },
      { type: 'switch', modelId: 'switch', displayName: '交换机', shape: 'rect', assetUrl: null, defaultScale: { x: 0.6, y: 0.25, z: 0.08 }, color: '#00bcd4', wattage: 10, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, ...Array(8).fill(0).map((_, i) => ({ id: `eth-${i + 1}`, name: `Port ${i + 1}`, type: 'ethernet', direction: 'bidirectional' }))] },
      { type: 'nas', modelId: 'nas-2bay', displayName: '双盘位 NAS', shape: 'rect', assetUrl: null, defaultScale: { x: 0.12, y: 0.23, z: 0.17 }, color: '#9c27b0', wattage: 30, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, { id: 'eth-1', name: 'LAN 1', type: 'ethernet', direction: 'bidirectional' }, { id: 'eth-2', name: 'LAN 2', type: 'ethernet', direction: 'bidirectional' }] },
      { type: 'modem', modelId: 'modem', displayName: '光猫', shape: 'rect', assetUrl: null, defaultScale: { x: 0.15, y: 0.12, z: 0.04 }, color: '#8d6e63', wattage: 8, ports: [{ id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input' }, { id: 'eth-1', name: 'LAN', type: 'ethernet', direction: 'bidirectional' }] },
    ],
  },
  {
    category: 'power', categoryName: '电源',
    models: [
      { type: 'power_strip', modelId: 'power-strip', displayName: '插排', shape: 'rect', assetUrl: null, defaultScale: { x: 0.8, y: 0.08, z: 0.05 }, color: '#f44336', maxLoad: 2500, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, ...Array(6).fill(0).map((_, i) => ({ id: `ac-out-${i + 1}`, name: `插孔 ${i + 1}`, type: 'ac_output', direction: 'output' }))] },
      { type: 'outlet', modelId: 'wall-outlet', displayName: '墙壁插座', shape: 'rect', assetUrl: null, defaultScale: { x: 0.08, y: 0.02, z: 0.08 }, color: '#ffeb3b', maxLoad: 3500, ports: [{ id: 'ac-out-1', name: '插座 1', type: 'ac_output', direction: 'output' }, { id: 'ac-out-2', name: '插座 2', type: 'ac_output', direction: 'output' }] },
      { type: 'ups', modelId: 'ups', displayName: 'UPS', shape: 'rect', assetUrl: null, defaultScale: { x: 0.15, y: 0.35, z: 0.22 }, color: '#ff9800', wattage: 15, maxLoad: 1000, ports: [{ id: 'ac-in', name: '电源输入', type: 'ac_input', direction: 'input' }, ...Array(4).fill(0).map((_, i) => ({ id: `ac-out-${i + 1}`, name: `输出 ${i + 1}`, type: 'ac_output', direction: 'output' }))] },
      { type: 'power-adapter', modelId: 'power-adapter', displayName: '电源适配器', shape: 'rect', assetUrl: null, defaultScale: { x: 0.1, y: 0.05, z: 0.03 }, color: '#263238', wattage: 5, maxLoad: 150, ports: [{ id: 'ac-in', name: 'AC 插头', type: 'ac_input', direction: 'input' }, { id: 'dc-out', name: 'DC 输出', type: 'dc_output', direction: 'output' }] },
    ],
  },
];

const LEGACY_MODEL_BY_TYPE = {
  table: { category: 'furniture', modelId: 'office-desk' },
  monitor: { category: 'display', modelId: 'monitor-24' },
  pc: { category: 'computer', modelId: 'desktop-pc' },
  nas: { category: 'network', modelId: 'nas-2bay' },
  router: { category: 'network', modelId: 'router' },
  switch: { category: 'network', modelId: 'switch' },
  ups: { category: 'power', modelId: 'ups' },
  power_strip: { category: 'power', modelId: 'power-strip' },
  outlet: { category: 'power', modelId: 'wall-outlet' },
};

export function getLegacyModelInfo(type) {
  return LEGACY_MODEL_BY_TYPE[type] || { category: 'unknown', modelId: 'unknown' };
}

export function findModelTemplate({ category, modelId, type } = {}) {
  const allModels = DEVICE_CATALOG.flatMap(candidate => candidate.models);
  const preferredModels = category
    ? DEVICE_CATALOG.filter(candidate => candidate.category === category)
      .flatMap(candidate => candidate.models)
    : allModels;
  return allModels.find(model => model.modelId === modelId)
    || preferredModels.find(model => model.type === type)
    || allModels.find(model => model.type === type)
    || null;
}

export function getModelDefaultScale(category, modelId) {
  return findModelTemplate({ category, modelId })?.defaultScale || null;
}

export function getDefaultPortAnchor(port, index, ports, modelId) {
  const spread = ports.length > 1 ? -0.4 + (0.8 * index) / (ports.length - 1) : 0;
  if (modelId === 'wall-outlet' && port.type === 'ac_output') {
    return { x: 0, y: -0.5, z: spread };
  }
  if (modelId === 'power-strip' && port.type === 'ac_output') {
    return { x: spread, y: 0, z: 0.5 };
  }
  if (modelId === 'laptop-15' && port.type === 'usb_c') {
    return { x: 0.5, y: 0, z: 0 };
  }
  if (modelId === 'power-adapter' && port.type === 'dc_output') {
    return { x: 0, y: -0.5, z: 0 };
  }
  return {
    x: spread,
    y: 0.5,
    z: port.type === 'ac_input' || port.type === 'dc_input' ? -0.25 : 0,
  };
}

export function withPortAnchors(ports, modelId) {
  return ports.map((port, index) => ({
    ...port,
    anchor: port.anchor || getDefaultPortAnchor(port, index, ports, modelId),
  }));
}

export function hydrateProjectObjects(objects) {
  return objects.map(object => {
    const template = findModelTemplate(object);
    const ports = (!object.ports || object.ports.length === 0) && template?.ports?.length
      ? JSON.parse(JSON.stringify(template.ports))
      : (object.ports || []);
    return {
      ...object,
      assetUrl: template ? template.assetUrl : object.assetUrl,
      ports: withPortAnchors(ports, object.modelId || template?.modelId),
    };
  });
}
