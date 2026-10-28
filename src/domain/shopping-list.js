import { findModelTemplate } from './catalog.js';
import { CABLE_TYPE_NAMES } from './connections.js';

// Purchases that fix a problem only together with rewiring (unchaining strips,
// moving devices to another outlet) are alternatives, not must-buys.
const OPTIONAL_PURCHASE_CODES = new Set(['fix_power_strip_chain', 'split_overloaded_power']);
const POWER_STRIP_MODEL_ID = 'power-strip';

function describeProduct(product) {
  if (product?.category === 'cable') {
    const typeName = CABLE_TYPE_NAMES[product.modelId];
    return typeName && Number.isFinite(product.length) ? `${product.length}m ${typeName}` : null;
  }
  return findModelTemplate({ modelId: product?.modelId })?.displayName ?? null;
}

function getStripOutletCount() {
  const strip = findModelTemplate({ modelId: POWER_STRIP_MODEL_ID });
  return Math.max(1, (strip?.ports || []).filter(port => port.type === 'ac_output').length);
}

/**
 * Merge purchase suggestions into a shopping list with quantities.
 * Each unpowered device gets its own strip suggestion, but one strip has
 * several outlets, so required strips are counted by outlets: enough for the
 * unpowered devices, and at least one per full strip.
 * Returns { items: [{ key, name, quantity, optional }], text } where text is
 * ready to paste into a note or chat.
 */
export function buildShoppingList(purchases) {
  const items = [];
  const byKey = new Map();
  let stripsForUnpoweredDevices = 0;
  let stripsForFullStrips = 0;

  const add = (key, name, optional, quantity = 1) => {
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity += quantity;
      return;
    }
    const item = { key, name, quantity, optional };
    byKey.set(key, item);
    items.push(item);
  };

  for (const purchase of Array.isArray(purchases) ? purchases : []) {
    const name = describeProduct(purchase?.product);
    if (!name) continue;
    const optional = OPTIONAL_PURCHASE_CODES.has(purchase.code);
    if (!optional && purchase.product.modelId === POWER_STRIP_MODEL_ID) {
      if (purchase.code === 'buy_power_for_unpowered') stripsForUnpoweredDevices += 1;
      else stripsForFullStrips += 1;
      // Reserve the strip's place in the list; its quantity is set below.
      add(`required:${name}`, name, false, 0);
      continue;
    }
    add(`${optional ? 'optional' : 'required'}:${name}`, name, optional);
  }

  const requiredStrip = byKey.get(`required:${describeProduct({ modelId: POWER_STRIP_MODEL_ID })}`);
  if (requiredStrip) {
    requiredStrip.quantity = Math.max(stripsForFullStrips,
      Math.ceil(stripsForUnpoweredDevices / getStripOutletCount()));
  }
  items.sort((first, second) => Number(first.optional) - Number(second.optional));

  if (items.length === 0) return { items, text: '' };
  const required = items.filter(item => !item.optional);
  const optional = items.filter(item => item.optional);
  const lines = ['DeskLab 购物清单', ...required.map(item => `- ${item.name} ×${item.quantity}`)];
  if (optional.length > 0) {
    lines.push('可选：', ...optional.map(item => `- ${item.name} ×${item.quantity}（插孔不够或需要分流时）`));
  }
  return { items, text: lines.join('\n') };
}
