import test from 'node:test';
import assert from 'node:assert/strict';

import { createProjectClient } from '../src/domain/project-client.js';

const project = {
  room: { length: 5, width: 4, height: 3 },
  objects: [],
};

const storedProject = {
  ...project,
  id: 'default',
  updatedAt: '2026-06-21T10:00:00.000Z',
};

const object = {
  id: 'desk-1',
  type: 'desk',
  name: 'Desk',
  shape: 'rect',
  position: { x: 0, y: 0, z: 0.4 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 0.6, z: 0.75 },
};

const secondObject = {
  ...object,
  id: 'desk-2',
  name: 'Second Desk',
};

const connection = {
  id: 'connection-1',
  fromObjectId: 'desk-1',
  toObjectId: 'desk-2',
  cableType: 'other',
  length: 1,
  name: 'Cable',
};

test('loads a project together with its concurrency version', async () => {
  const calls = [];
  const client = createProjectClient(async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify(storedProject), {
      status: 200,
      headers: { ETag: '"version-1"' },
    });
  });

  assert.deepEqual(await client.load(), {
    project: storedProject,
    version: '"version-1"',
  });
  assert.deepEqual(calls, [['/api/projects/default']]);
});

test('forwards an AbortSignal when loading a project', async () => {
  const calls = [];
  const controller = new AbortController();
  const client = createProjectClient(async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify(storedProject), {
      status: 200,
      headers: { ETag: '"version-1"' },
    });
  });

  await client.load({ signal: controller.signal });
  assert.deepEqual(calls, [[
    '/api/projects/default',
    { signal: controller.signal },
  ]]);
});

test('refuses to load when the concurrency version header is missing', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify(storedProject), {
    status: 200,
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应缺少 ETag/
  );
});

test('rejects a successful project response that is not a JSON object', async () => {
  const client = createProjectClient(async () => new Response('', { status: 200 }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应不是有效的 JSON 对象/
  );
});

test('rejects a successful response with an incomplete project payload', async () => {
  const client = createProjectClient(async () => new Response('{}', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load without server-managed fields', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify(project), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with malformed objects', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [{}],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with duplicate object ids', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [
      object,
      { ...object, name: 'Duplicate desk' },
    ],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with malformed optional object metadata', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [{
      ...object,
      category: '   ',
      modelId: 'standing-desk',
      assetUrl: 42,
      color: {},
    }],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with malformed object ports', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [{
      ...object,
      ports: [{}],
    }],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with duplicate object port ids', async () => {
  const port = { id: 'hdmi', name: 'HDMI', type: 'hdmi', direction: 'output' };
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [{
      ...object,
      ports: [port, { ...port, name: '备用 HDMI' }],
    }],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with malformed connections', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    connections: [{}],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('accepts a successful project load with null connections', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    connections: null,
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  const result = await client.load();
  assert.ok(result);
});

test('rejects a successful project load with duplicate connection ids', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [object, secondObject],
    connections: [
      connection,
      { ...connection, fromObjectId: 'desk-2', toObjectId: 'desk-1' },
    ],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with stale connection object references', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [object],
    connections: [{ ...connection, toObjectId: 'missing-desk' }],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with a self-referencing connection', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [object],
    connections: [{ ...connection, toObjectId: connection.fromObjectId }],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with stale connection port references', async () => {
  const sourcePort = { id: 'out', name: 'HDMI Out', type: 'hdmi', direction: 'output' };
  const targetPort = { id: 'in', name: 'HDMI In', type: 'hdmi', direction: 'input' };
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [
      { ...object, ports: [sourcePort] },
      { ...secondObject, ports: [targetPort] },
    ],
    connections: [{
      ...connection,
      cableType: 'hdmi',
      fromPortId: 'missing-out',
      toPortId: targetPort.id,
    }],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with invalid connection port direction', async () => {
  const sourcePort = { id: 'out', name: 'HDMI Out', type: 'hdmi', direction: 'input' };
  const targetPort = { id: 'in', name: 'HDMI In', type: 'hdmi', direction: 'input' };
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [
      { ...object, ports: [sourcePort] },
      { ...secondObject, ports: [targetPort] },
    ],
    connections: [{
      ...connection,
      cableType: 'hdmi',
      fromPortId: sourcePort.id,
      toPortId: targetPort.id,
    }],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with incompatible connection port types', async () => {
  const sourcePort = { id: 'out', name: 'HDMI Out', type: 'hdmi', direction: 'output' };
  const targetPort = { id: 'in', name: 'Ethernet In', type: 'ethernet', direction: 'input' };
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [
      { ...object, ports: [sourcePort] },
      { ...secondObject, ports: [targetPort] },
    ],
    connections: [{
      ...connection,
      cableType: 'hdmi',
      fromPortId: sourcePort.id,
      toPortId: targetPort.id,
    }],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with mismatched connection cable type', async () => {
  const sourcePort = { id: 'out', name: 'HDMI Out', type: 'hdmi', direction: 'output' };
  const targetPort = { id: 'in', name: 'HDMI In', type: 'hdmi', direction: 'input' };
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [
      { ...object, ports: [sourcePort] },
      { ...secondObject, ports: [targetPort] },
    ],
    connections: [{
      ...connection,
      cableType: 'power',
      fromPortId: sourcePort.id,
      toPortId: targetPort.id,
    }],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('accepts matching custom port types when the cable type is other', async () => {
  const sourcePort = { id: 'out', name: 'Custom Out', type: 'future_bus', direction: 'output' };
  const targetPort = { id: 'in', name: 'Custom In', type: 'future_bus', direction: 'input' };
  const projectWithCustomPorts = {
    ...storedProject,
    objects: [
      { ...object, ports: [sourcePort] },
      { ...secondObject, ports: [targetPort] },
    ],
    connections: [{
      ...connection,
      cableType: 'other',
      fromPortId: sourcePort.id,
      toPortId: targetPort.id,
    }],
  };
  const client = createProjectClient(async () => new Response(JSON.stringify(projectWithCustomPorts), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  assert.deepEqual(await client.load(), {
    project: projectWithCustomPorts,
    version: '"version-1"',
  });
});

test('rejects a successful project load with duplicate physical port occupancy', async () => {
  const sourcePort = { id: 'out', name: 'HDMI Out', type: 'hdmi', direction: 'output' };
  const firstTargetPort = { id: 'in-1', name: 'HDMI In 1', type: 'hdmi', direction: 'input' };
  const secondTargetPort = { id: 'in-2', name: 'HDMI In 2', type: 'hdmi', direction: 'input' };
  const thirdObject = {
    ...object,
    id: 'desk-3',
    name: 'Third Desk',
  };
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    objects: [
      { ...object, ports: [sourcePort] },
      { ...secondObject, ports: [firstTargetPort] },
      { ...thirdObject, ports: [secondTargetPort] },
    ],
    connections: [
      {
        ...connection,
        cableType: 'hdmi',
        fromPortId: sourcePort.id,
        toPortId: firstTargetPort.id,
      },
      {
        ...connection,
        id: 'connection-2',
        toObjectId: thirdObject.id,
        cableType: 'hdmi',
        fromPortId: sourcePort.id,
        toPortId: secondTargetPort.id,
      },
    ],
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('rejects a successful project load with malformed camera', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify({
    ...storedProject,
    camera: {},
  }), {
    status: 200,
    headers: { ETag: '"version-1"' },
  }));

  await assert.rejects(
    () => client.load(),
    /项目读取响应结构无效/
  );
});

test('saves with If-Match and returns the next concurrency version', async () => {
  const calls = [];
  const client = createProjectClient(async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify(storedProject), {
      status: 200,
      headers: { ETag: '"version-2"' },
    });
  });

  assert.deepEqual(await client.save(project, '"version-1"'), {
    project: storedProject,
    version: '"version-2"',
  });
  assert.deepEqual(calls, [[
    '/api/projects/default',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': '"version-1"',
      },
      body: JSON.stringify(project),
    },
  ]]);
});

test('refuses to send a save before the project version is loaded', async () => {
  const calls = [];
  const client = createProjectClient(async (...args) => {
    calls.push(args);
    throw new Error('request should not be sent');
  });

  await assert.rejects(
    () => client.save(project),
    /项目版本尚未加载/
  );
  assert.deepEqual(calls, []);
});

test('refuses a successful save that does not return the next concurrency version', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify(storedProject), {
    status: 200,
  }));

  await assert.rejects(
    () => client.save(project, '"version-1"'),
    /保存响应缺少 ETag/
  );
});

test('turns a stale save response into a stable project conflict error', async () => {
  const client = createProjectClient(async () => new Response(
    JSON.stringify({ error: 'project has changed since it was loaded' }),
    { status: 412 }
  ));

  await assert.rejects(
    () => client.save(project, '"stale-version"'),
    error => error.code === 'project_conflict'
      && error.status === 412
      && error.message === '项目已在另一个页面中更新。请先刷新页面，确认最新内容后再保存。'
  );
});

test('validates and returns a normalized project without saving', async () => {
  const calls = [];
  const normalized = { ...project, connections: [] };
  const client = createProjectClient(async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify(normalized), { status: 200 });
  });

  assert.deepEqual(await client.validate(project), normalized);
  assert.deepEqual(calls, [[
    '/api/projects/validate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    },
  ]]);
});

test('recovers the backup and returns its new concurrency version', async () => {
  const calls = [];
  const client = createProjectClient(async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify(storedProject), {
      status: 200,
      headers: { ETag: '"recovered-version"' },
    });
  });

  assert.deepEqual(await client.recoverBackup(), {
    project: storedProject,
    version: '"recovered-version"',
  });
  assert.deepEqual(calls, [[
    '/api/projects/default/recover-backup',
    { method: 'POST' },
  ]]);
});

test('refuses a recovered project without a concurrency version', async () => {
  const client = createProjectClient(async () => new Response(JSON.stringify(storedProject), {
    status: 200,
  }));

  await assert.rejects(
    () => client.recoverBackup(),
    /备份恢复响应缺少 ETag/
  );
});

test('maps backup recovery refusal statuses to stable user errors', async () => {
  for (const [status, expectedMessage] of [
    [404, '当前没有可用的上一版本备份'],
    [409, '当前项目仍可正常读取，无需恢复备份'],
  ]) {
    const client = createProjectClient(async () => new Response('{}', { status }));
    await assert.rejects(
      () => client.recoverBackup(),
      error => error.status === status && error.message === expectedMessage
    );
  }
});

test('accepts a project load response with wattage and maxLoad on objects', async () => {
  const data = JSON.stringify({
    ...storedProject,
    objects: [{
      ...object,
      wattage: 350,
      maxLoad: 1000,
    }],
  });
  const client = createProjectClient(async () => new Response(data, {
    status: 200,
    headers: { ETag: '"v1"' },
  }));

  const result = await client.load();
  assert.equal(result.project.objects[0].wattage, 350);
  assert.equal(result.project.objects[0].maxLoad, 1000);
});

test('rejects project loads with invalid optional power metadata', async () => {
  for (const powerMetadata of [
    { wattage: '350' },
    { wattage: -1 },
    { maxLoad: '1000' },
    { maxLoad: -1 },
  ]) {
    const client = createProjectClient(async () => new Response(JSON.stringify({
      ...storedProject,
      objects: [{ ...object, ...powerMetadata }],
    }), {
      status: 200,
      headers: { ETag: '"v1"' },
    }));

    await assert.rejects(() => client.load(), /项目读取响应结构无效/);
  }
});
