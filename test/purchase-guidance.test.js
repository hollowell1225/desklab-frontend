import test from 'node:test';
import assert from 'node:assert/strict';

import { getPurchaseGuidance } from '../src/domain/purchase-guidance.js';

test('provides a safe, actionable next step for recommended hardware', () => {
  const expected = {
    ups: '先将墙壁插座接到 UPS 输入端，再将关键设备接到 UPS 输出端。',
    'power-strip': '先将现有供电源接到插排输入端，再将需要分流的设备接到插排输出端。',
    switch: '先将路由器 LAN 口接到交换机上联口，再将待联网设备接到交换机。',
  };

  for (const [modelId, description] of Object.entries(expected)) {
    assert.deepEqual(getPurchaseGuidance(modelId), {
      title: '下一步：开始布线',
      description,
      actionLabel: '打开连接面板',
    });
  }
});

test('does not invent a wiring plan for unknown hardware', () => {
  assert.equal(getPurchaseGuidance('router'), null);
  assert.equal(getPurchaseGuidance(null), null);
});
