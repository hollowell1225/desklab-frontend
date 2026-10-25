import test from 'node:test';
import assert from 'node:assert/strict';

import { getPurchaseGuidance } from '../src/domain/purchase-guidance.js';

test('provides a safe, actionable next step for recommended hardware', () => {
  const expected = {
    'power-strip': '先将现有供电源接到插排输入端，再将需要分流的设备接到插排输出端。',
    'power-adapter': '先将电源适配器插到插排或墙壁插座，再将适配器的 DC 输出接到设备的电源输入。',
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
  assert.equal(getPurchaseGuidance('ups'), null);
  assert.equal(getPurchaseGuidance('switch'), null);
  assert.equal(getPurchaseGuidance('switch', { requiresLanPortMigration: true }), null);
  assert.equal(getPurchaseGuidance(null), null);
});
