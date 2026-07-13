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
    description: '先将路由器 LAN 口接到交换机上联口，再将待联网设备接到交换机。',
    actionLabel: '打开连接面板',
  }),
});

export function getPurchaseGuidance(modelId) {
  return PURCHASE_GUIDANCE[modelId] ?? null;
}
