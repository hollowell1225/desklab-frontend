import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProjectDraft,
  isDraftDifferent,
  parseProjectDraft,
  projectFingerprint,
} from '../src/domain/draft.js';

const project = {
  room: { length: 5, width: 4, height: 3 },
  objects: [],
  connections: [],
  camera: null,
};

test('creates and parses a versioned project draft without sharing references', () => {
  const draft = createProjectDraft(project, '2026-06-19T12:00:00.000Z');
  const parsed = parseProjectDraft(JSON.stringify(draft));
  assert.deepEqual(parsed, draft);

  project.room.length = 9;
  assert.equal(draft.project.room.length, 5);
  project.room.length = 5;
});

test('rejects malformed, unsupported, or incomplete drafts', () => {
  assert.equal(parseProjectDraft('not json'), null);
  assert.equal(parseProjectDraft(JSON.stringify({ version: 2, savedAt: '2026-06-19T12:00:00.000Z', project })), null);
  assert.equal(parseProjectDraft(JSON.stringify({ version: 1, savedAt: 'invalid', project })), null);
  assert.equal(parseProjectDraft(JSON.stringify({ version: 1, savedAt: '2026-06-19T12:00:00.000Z', project: {} })), null);
});

test('rejects drafts whose project room dimensions cannot be restored safely', () => {
  const draft = createProjectDraft({
    ...project,
    room: { length: 5, width: 0, height: Number.NaN },
  }, '2026-06-19T12:00:00.000Z');

  assert.equal(parseProjectDraft(JSON.stringify(draft)), null);
});

test('rejects drafts whose project objects cannot be restored safely', () => {
  const draft = createProjectDraft({
    ...project,
    objects: [{
      id: 'desk-1',
      type: 'desk',
      name: 'Desk',
      shape: 'rect',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 0, z: 1 },
    }],
  }, '2026-06-19T12:00:00.000Z');

  assert.equal(parseProjectDraft(JSON.stringify(draft)), null);
});

test('rejects drafts whose project object ids are duplicated', () => {
  const desk = {
    id: 'desk-1',
    type: 'desk',
    name: 'Desk',
    shape: 'rect',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
  const draft = createProjectDraft({
    ...project,
    objects: [desk, { ...desk, name: 'Duplicate Desk' }],
  }, '2026-06-19T12:00:00.000Z');

  assert.equal(parseProjectDraft(JSON.stringify(draft)), null);
});

test('rejects drafts whose device-model fields have the wrong type', () => {
  const base = {
    id: 'desk-1',
    type: 'desk',
    name: 'Desk',
    shape: 'rect',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
  const badObjects = [
    { ...base, category: 123 },
    { ...base, category: '   ' },
    { ...base, modelId: 7 },
    { ...base, assetUrl: 42 },
    { ...base, color: 0xffffff },
  ];

  for (const object of badObjects) {
    const draft = createProjectDraft({
      ...project,
      objects: [object],
    }, '2026-06-19T12:00:00.000Z');
    assert.equal(parseProjectDraft(JSON.stringify(draft)), null);
  }
});

test('accepts drafts whose device-model fields are valid', () => {
  const draft = createProjectDraft({
    ...project,
    objects: [{
      id: 'desk-1',
      type: 'desk',
      name: 'Desk',
      shape: 'rect',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      category: 'furniture',
      modelId: 'desk-standard',
      assetUrl: null,
      color: '',
    }],
  }, '2026-06-19T12:00:00.000Z');

  assert.deepEqual(parseProjectDraft(JSON.stringify(draft)), draft);
});

test('rejects drafts whose port anchors fall outside the normalized range', () => {
  const draft = createProjectDraft({
    ...project,
    objects: [{
      id: 'desk-1',
      type: 'desk',
      name: 'Desk',
      shape: 'rect',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      ports: [{
        id: 'out',
        name: 'Output',
        type: 'hdmi',
        direction: 'output',
        anchor: { x: 0.9, y: 0, z: 0 },
      }],
    }],
  }, '2026-06-19T12:00:00.000Z');

  assert.equal(parseProjectDraft(JSON.stringify(draft)), null);
});

test('rejects drafts whose port anchors are malformed', () => {
  const draft = createProjectDraft({
    ...project,
    objects: [{
      id: 'desk-1',
      type: 'desk',
      name: 'Desk',
      shape: 'rect',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      ports: [{
        id: 'out',
        name: 'Output',
        type: 'hdmi',
        direction: 'output',
        anchor: { x: 0, y: Number.NaN, z: 0 },
      }],
    }],
  }, '2026-06-19T12:00:00.000Z');

  assert.equal(parseProjectDraft(JSON.stringify(draft)), null);
});

test('accepts drafts whose port anchors are within the normalized range', () => {
  const draft = createProjectDraft({
    ...project,
    objects: [{
      id: 'desk-1',
      type: 'desk',
      name: 'Desk',
      shape: 'rect',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      ports: [{
        id: 'out',
        name: 'Output',
        type: 'hdmi',
        direction: 'output',
        anchor: { x: 0.5, y: -0.5, z: 0 },
      }],
    }],
  }, '2026-06-19T12:00:00.000Z');

  assert.deepEqual(parseProjectDraft(JSON.stringify(draft)), draft);
});

test('rejects drafts whose project camera cannot be restored safely', () => {
  const draft = createProjectDraft({
    ...project,
    camera: {
      position: { x: 0, y: Number.POSITIVE_INFINITY, z: 0 },
      target: { x: 0, y: 0, z: 0 },
    },
  }, '2026-06-19T12:00:00.000Z');

  assert.equal(parseProjectDraft(JSON.stringify(draft)), null);
});

test('rejects drafts whose connections reference missing objects', () => {
  const draft = createProjectDraft({
    ...project,
    objects: [{
      id: 'source',
      type: 'device',
      name: 'Source',
      shape: 'rect',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }],
    connections: [{
      id: 'connection-1',
      fromObjectId: 'source',
      toObjectId: 'missing-target',
      cableType: 'other',
      length: 1,
      name: 'Bad draft cable',
    }],
  }, '2026-06-19T12:00:00.000Z');

  assert.equal(parseProjectDraft(JSON.stringify(draft)), null);
});

test('rejects drafts whose connections cannot be restored safely', () => {
  const objects = [
    {
      id: 'source',
      type: 'device',
      name: 'Source',
      shape: 'rect',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    {
      id: 'target',
      type: 'device',
      name: 'Target',
      shape: 'rect',
      position: { x: 1, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
  ];
  const draft = createProjectDraft({
    ...project,
    objects,
    connections: [{
      id: 'connection-1',
      fromObjectId: 'source',
      toObjectId: 'target',
      cableType: 'other',
      length: 0,
      name: 'Bad draft cable',
    }],
  }, '2026-06-19T12:00:00.000Z');

  assert.equal(parseProjectDraft(JSON.stringify(draft)), null);
});

test('rejects drafts whose connections reference missing ports', () => {
  const objects = [
    {
      id: 'source',
      type: 'device',
      name: 'Source',
      shape: 'rect',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      ports: [{ id: 'out', name: 'Output', type: 'hdmi', direction: 'output' }],
    },
    {
      id: 'target',
      type: 'device',
      name: 'Target',
      shape: 'rect',
      position: { x: 1, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      ports: [{ id: 'in', name: 'Input', type: 'hdmi', direction: 'input' }],
    },
  ];
  const draft = createProjectDraft({
    ...project,
    objects,
    connections: [{
      id: 'connection-1',
      fromObjectId: 'source',
      toObjectId: 'target',
      fromPortId: 'out',
      toPortId: 'missing-in',
      cableType: 'hdmi',
      length: 1,
      name: 'Bad draft cable',
    }],
  }, '2026-06-19T12:00:00.000Z');

  assert.equal(parseProjectDraft(JSON.stringify(draft)), null);
});

test('rejects drafts whose connection ids are duplicated', () => {
  const objects = [
    {
      id: 'source',
      type: 'device',
      name: 'Source',
      shape: 'rect',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    {
      id: 'target',
      type: 'device',
      name: 'Target',
      shape: 'rect',
      position: { x: 1, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
  ];
  const cable = {
    id: 'connection-1',
    fromObjectId: 'source',
    toObjectId: 'target',
    cableType: 'other',
    length: 1,
    name: 'Cable',
  };
  const draft = createProjectDraft({
    ...project,
    objects,
    connections: [cable, { ...cable, name: 'Duplicate Cable' }],
  }, '2026-06-19T12:00:00.000Z');

  assert.equal(parseProjectDraft(JSON.stringify(draft)), null);
});

test('rejects drafts whose connections reuse the same physical port', () => {
  const objects = [
    {
      id: 'source',
      type: 'device',
      name: 'Source',
      shape: 'rect',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      ports: [{ id: 'out', name: 'Output', type: 'hdmi', direction: 'output' }],
    },
    {
      id: 'target-1',
      type: 'device',
      name: 'Target 1',
      shape: 'rect',
      position: { x: 1, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      ports: [{ id: 'in', name: 'Input', type: 'hdmi', direction: 'input' }],
    },
    {
      id: 'target-2',
      type: 'device',
      name: 'Target 2',
      shape: 'rect',
      position: { x: 2, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      ports: [{ id: 'in', name: 'Input', type: 'hdmi', direction: 'input' }],
    },
  ];
  const draft = createProjectDraft({
    ...project,
    objects,
    connections: [
      {
        id: 'first',
        fromObjectId: 'source',
        toObjectId: 'target-1',
        fromPortId: 'out',
        toPortId: 'in',
        cableType: 'hdmi',
        length: 1,
        name: 'First cable',
      },
      {
        id: 'second',
        fromObjectId: 'source',
        toObjectId: 'target-2',
        fromPortId: 'out',
        toPortId: 'in',
        cableType: 'hdmi',
        length: 1,
        name: 'Second cable',
      },
    ],
  }, '2026-06-19T12:00:00.000Z');

  assert.equal(parseProjectDraft(JSON.stringify(draft)), null);
});

test('detects layout and camera differences', () => {
  const draft = createProjectDraft(project, '2026-06-19T12:00:00.000Z');
  assert.equal(isDraftDifferent(draft, project), false);

  const changed = {
    ...project,
    camera: {
      position: { x: 0, y: 5, z: -6 },
      target: { x: 0, y: 1.5, z: 0 },
    },
  };
  assert.equal(isDraftDifferent(draft, changed), true);
  assert.notEqual(projectFingerprint(project), projectFingerprint(changed));
});

test('treats absent and empty connection/camera fields as equivalent', () => {
  // The backend drops empty connections and omits camera; live editor state keeps
  // [] / null. These must fingerprint identically so a clean save raises no
  // spurious recovery prompt or dirty state.
  const bare = { room: { length: 5, width: 4, height: 3 }, objects: [] };
  const explicit = { ...bare, connections: [], camera: null };

  assert.equal(projectFingerprint(bare), projectFingerprint(explicit));

  const draft = createProjectDraft(bare, '2026-06-19T12:00:00.000Z');
  assert.equal(isDraftDifferent(draft, explicit), false);
});
