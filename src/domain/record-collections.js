export function getRecordItems(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(item =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
  );
}
