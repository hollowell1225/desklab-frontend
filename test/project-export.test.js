import test from 'node:test';
import assert from 'node:assert/strict';

import { createProjectExport } from '../src/domain/project-export.js';

test('packages a recovery draft as a timestamped JSON download without changing it', () => {
  const project = {
    room: { length: 5, width: 4, height: 3 },
    objects: [{ id: 'desk-1', name: '未保存桌面' }],
    connections: [],
    camera: null,
  };

  const exported = createProjectExport(project, {
    prefix: 'desklab-recovery',
    now: new Date('2026-06-22T12:34:56.789Z'),
  });

  assert.equal(exported.filename, 'desklab-recovery-2026-06-22T12-34-56-789Z.json');
  assert.equal(exported.mediaType, 'application/json');
  assert.deepEqual(JSON.parse(exported.contents), project);
  assert.match(exported.contents, /\n {2}"room"/);
});
