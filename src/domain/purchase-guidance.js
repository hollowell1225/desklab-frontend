const PURCHASE_GUIDANCE = Object.freeze({
  ups: Object.freeze({
    title: '下一步：开始布线',
    description: '先将墙壁插座接到 UPS 输入端，再将关键设备接到 UPS 输出端。',
    actionLabel: '打开连接面板',
  }),
  'power-strip': Object.freeze({
    title: '下一步：开始布线',
    description: '先将现有供电源接到插排输入端，再将需要分流的设备接到插排输出端。',
    actionLabel: '打开连接面板',
  }),
  switch: Object.freeze({
    title: '下一步：开始布线',
    description: '先接通交换机电源，再将路由器 LAN 口接到交换机上联口，最后将待联网设备接到交换机。',
    actionLabel: '打开连接面板',
  }),
});

export function getPurchaseGuidance(modelId, options = {}) {
  if (modelId === 'switch' && options.requiresLanPortMigration) {
    return {
      ...PURCHASE_GUIDANCE.switch,
      description: '先接通交换机电源；再腾出一个可用于上联的路由器 LAN 口（可将普通终端迁移到交换机）；随后将该 LAN 口上联到交换机，最后连接其余设备。',
    };
  }
  return PURCHASE_GUIDANCE[modelId] ?? null;
}
