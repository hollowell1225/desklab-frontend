import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canEditProject,
  canStartObjectDrag,
  getCanvasObjectClickAction,
} from '../src/domain/project-access.js';

test('project editing is available only after a safe load with no draft decision pending', () => {
  assert.equal(canEditProject({
    projectLoaded: false,
    projectLoadFailed: false,
    recoveryPending: false,
  }), false);
  assert.equal(canEditProject({
    projectLoaded: true,
    projectLoadFailed: true,
    recoveryPending: false,
  }), false);
  assert.equal(canEditProject({
    projectLoaded: true,
    projectLoadFailed: false,
    recoveryPending: true,
  }), false);
  assert.equal(canEditProject({
    projectLoaded: true,
    projectLoadFailed: false,
    recoveryPending: false,
  }), true);
});

test('canvas object clicks are ignored while project editing is locked', () => {
  assert.equal(getCanvasObjectClickAction({
    projectEditable: false,
    connectionMode: false,
    objectId: 'desk',
    selectedObjectId: null,
  }), 'ignore');

  assert.equal(canStartObjectDrag({
    projectEditable: false,
    connectionMode: false,
  }), false);
});

test('connection target mode only accepts a different editable device', () => {
  assert.equal(getCanvasObjectClickAction({
    projectEditable: true,
    connectionMode: true,
    objectId: 'source',
    selectedObjectId: 'source',
  }), 'ignore');

  assert.equal(getCanvasObjectClickAction({
    projectEditable: true,
    connectionMode: true,
    objectId: 'target',
    selectedObjectId: 'source',
  }), 'choose-connection-target');

  assert.equal(canStartObjectDrag({
    projectEditable: true,
    connectionMode: true,
  }), false);
});

test('normal editable canvas clicks select and drag objects', () => {
  assert.equal(getCanvasObjectClickAction({
    projectEditable: true,
    connectionMode: false,
    objectId: 'desk',
    selectedObjectId: null,
  }), 'select');

  assert.equal(canStartObjectDrag({
    projectEditable: true,
    connectionMode: false,
  }), true);
});
