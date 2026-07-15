export function getPortRecords(object) {
  if (!Array.isArray(object?.ports)) return [];
  return object.ports.filter(port =>
    port !== null && typeof port === 'object' && !Array.isArray(port)
  );
}
