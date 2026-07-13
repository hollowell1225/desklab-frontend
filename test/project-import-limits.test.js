import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertProjectImportSize,
  getProjectImportByteLength,
  MAX_PROJECT_IMPORT_BYTES,
} from '../src/domain/project-import-limits.js';

test('measures clipboard project text as UTF-8 bytes', () => {
  assert.equal(getProjectImportByteLength('桌面'), 6);
});

test('accepts project imports at the byte limit and rejects larger ones', () => {
  assert.doesNotThrow(() => assertProjectImportSize(MAX_PROJECT_IMPORT_BYTES));
  assert.throws(
    () => assertProjectImportSize(MAX_PROJECT_IMPORT_BYTES + 1),
    /导入文件不能超过 5MB/
  );
});
