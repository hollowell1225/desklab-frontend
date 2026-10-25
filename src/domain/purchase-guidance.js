const PURCHASE_GUIDANCE = Object.freeze({
  'power-strip': Object.freeze({
    title: '下一步：开始布线',
    description: '先将现有供电源接到插排输入端，再将需要分流的设备接到插排输出端。',
    actionLabel: '打开连接面板',
  }),
  'power-adapter': Object.freeze({
    title: '下一步：开始布线',
    description: '先将电源适配器插到插排或墙壁插座，再将适配器的 DC 输出接到设备的电源输入。',
    actionLabel: '打开连接面板',
  }),
});

export function getPurchaseGuidance(modelId) {
  return PURCHASE_GUIDANCE[modelId] ?? null;
}
