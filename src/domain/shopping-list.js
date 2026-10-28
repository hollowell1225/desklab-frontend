import { findModelTemplate } from './catalog.js';
import { CABLE_TYPE_NAMES } from './connections.js';

// Purchases that fix a problem only together with rewiring (unchaining strips,
// moving devices to another outlet) are alternatives, not must-buys.
const OPTIONAL_PURCHASE_CODES = new Set(['fix_power_strip_chain', 'split_overloaded_power']);

function describeProduct(product) {
  if (product?.category === 'cable') {
    const typeName = CABLE_TYPE_NAMES[product.modelId];
    return typeName && Number.isFinite(product.length) ? `${product.length}m ${typeName}` : null;
  }
  return findModelTemplate({ modelId: product?.modelId })?.displayName ?? null;
}

/**
 * Merge purchase suggestions into a shopping list with quantities (a
 * suggestion may name its own quantity, such as how many strips are needed).
 * Returns { items: [{ key, name, quantity, optional }], text } where text is
 * ready to paste into a note or chat.
 */
export function buildShoppingList(purchases) {
  const items = [];
  const byKey = new Map();
  for (const purchase of Array.isArray(purchases) ? purchases : []) {
    const name = describeProduct(purchase?.product);
    if (!name) continue;
    const optional = OPTIONAL_PURCHASE_CODES.has(purchase.code);
    const quantity = Number.isInteger(purchase.product.quantity) && purchase.product.quantity > 0
      ? purchase.product.quantity
      : 1;
    const key = `${optional ? 'optional' : 'required'}:${name}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity += quantity;
      continue;
    }
    const item = { key, name, quantity, optional };
    byKey.set(key, item);
    items.push(item);
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
