import test from 'node:test';
import assert from 'node:assert/strict';

import { buildShoppingList } from '../src/domain/shopping-list.js';
import { buildPurchaseSuggestions } from '../src/domain/recommendations.js';
import { STANDARD_CABLE_LENGTHS } from '../src/domain/connections.js';

const object = (id, overrides = {}) => ({
  id, name: id, type: 'device',
  position: { x: 0, y: 0, z: 0.5 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
  ...overrides,
});

test('cable purchases name a standard store length', () => {
  const objects = [
    object('pc', { position: { x: 0, y: 0, z: 0.1 }, ports: [{ id: 'hdmi', name: 'HDMI', type: 'hdmi', direction: 'output' }] }),
    object('screen', { position: { x: 2, y: 0, z: 0.1 }, ports: [{ id: 'hdmi', name: 'HDMI', type: 'hdmi', direction: 'input' }] }),
  ];
  const connections = [{
    id: 'c1', name: 'HDMI', cableType: 'hdmi', length: 1,
    fromObjectId: 'pc', fromPortId: 'hdmi', toObjectId: 'screen', toPortId: 'hdmi',
  }];
  const [buyCable] = buildPurchaseSuggestions(objects, connections).filter(item => item.code === 'buy_cable');
  assert.ok(STANDARD_CABLE_LENGTHS.includes(buyCable.product.length));
  assert.equal(buyCable.product.length, 3, '2m apart needs 2.2m, so buy a 3m cable');
  assert.equal(buyCable.title, '加购一根 3m HDMI 线');
});

test('the shopping list merges duplicates and keeps alternatives optional', () => {
  const list = buildShoppingList([
    { code: 'buy_cable', product: { category: 'cable', modelId: 'hdmi', length: 3 } },
    { code: 'buy_cable', product: { category: 'cable', modelId: 'hdmi', length: 3 } },
    { code: 'buy_cable', product: { category: 'cable', modelId: 'ethernet', length: 5 } },
    { code: 'buy_power_strip_for_outlets', product: { category: 'power', modelId: 'power-strip', quantity: 1 } },
    { code: 'split_overloaded_power', product: { category: 'power', modelId: 'power-strip' } },
    { code: 'fix_power_strip_chain', product: { category: 'power', modelId: 'power-strip' } },
  ]);

  assert.deepEqual(list.items.map(({ name, quantity, optional }) => ({ name, quantity, optional })), [
    { name: '3m HDMI 线', quantity: 2, optional: false },
    { name: '5m 网线', quantity: 1, optional: false },
    { name: '插排', quantity: 1, optional: false },
    { name: '插排', quantity: 2, optional: true },
  ]);
  assert.equal(list.text, [
    'DeskLab 购物清单',
    '- 3m HDMI 线 ×2',
    '- 5m 网线 ×1',
    '- 插排 ×1',
    '可选：',
    '- 插排 ×2（插孔不够或需要分流时）',
  ].join('\n'));
});

test('a suggestion that names a quantity is listed with that quantity', () => {
  const list = buildShoppingList([
    { code: 'buy_power_strip_for_outlets', product: { category: 'power', modelId: 'power-strip', quantity: 3 } },
  ]);
  assert.deepEqual(list.items.map(({ name, quantity }) => ({ name, quantity })), [{ name: '插排', quantity: 3 }]);
});

test('an empty purchase list gives an empty shopping list', () => {
  assert.deepEqual(buildShoppingList([]), { items: [], text: '' });
  assert.deepEqual(buildShoppingList(null), { items: [], text: '' });
});

test('unknown products are ignored rather than shown as raw ids', () => {
  const list = buildShoppingList([{ code: 'buy_power_strip_for_outlets', product: { category: 'power', modelId: 'ups' } }]);
  assert.deepEqual(list.items, []);
});
