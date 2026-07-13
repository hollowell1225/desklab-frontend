export const MAX_PROJECT_IMPORT_BYTES = 5 * 1024 * 1024;

export function getProjectImportByteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

export function assertProjectImportSize(byteLength) {
  if (byteLength > MAX_PROJECT_IMPORT_BYTES) {
    throw new Error('导入文件不能超过 5MB');
  }
}
