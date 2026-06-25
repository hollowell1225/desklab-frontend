export function formatNumericInputValue(value, decimals = 3) {
  if (value === undefined || value === null) return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return String(parseFloat(number.toFixed(decimals)));
}

function isFiniteBound(value) {
  return Number.isFinite(value);
}

export function parseLiveNumericInput(value, { min, max } = {}) {
  const text = String(value ?? '');
  if (text.trim() === '' || text === '-') return null;

  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  if (isFiniteBound(min) && number < min) return null;
  if (isFiniteBound(max) && number > max) return null;
  return number;
}

export function commitNumericInput(value, { min, max } = {}) {
  const text = String(value ?? '');
  let number = Number(text);
  if (!Number.isFinite(number)) number = 0;
  if (isFiniteBound(min)) number = Math.max(min, number);
  if (isFiniteBound(max)) number = Math.min(max, number);
  return number;
}
