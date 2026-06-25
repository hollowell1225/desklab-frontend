let fallbackSequence = 0;

function normalizePrefix(prefix) {
  const normalized = String(prefix || 'entity')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'entity';
}

export function createEntityId(prefix) {
  const uniquePart = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${(fallbackSequence += 1).toString(36)}`;
  return `${normalizePrefix(prefix)}-${uniquePart}`;
}
