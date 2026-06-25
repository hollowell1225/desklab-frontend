import test from 'node:test';
import assert from 'node:assert/strict';

import { createStatusNotifier } from '../src/domain/status-notifier.js';

function createFakeScheduler() {
  let nextId = 1;
  const callbacks = new Map();
  return {
    schedule(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancel(id) {
      callbacks.delete(id);
    },
    run(id) {
      const callback = callbacks.get(id);
      callbacks.delete(id);
      callback?.();
    },
    ids() {
      return [...callbacks.keys()];
    },
  };
}

test('a newer status cancels the older status clear timer', () => {
  const states = [];
  const scheduler = createFakeScheduler();
  const notifier = createStatusNotifier(state => states.push(state), {
    schedule: callback => scheduler.schedule(callback),
    cancel: id => scheduler.cancel(id),
  });

  notifier.show({ text: '旧消息', type: 'success' }, 3000);
  const [oldTimerId] = scheduler.ids();
  notifier.show({ text: '新错误', type: 'error' }, 5000);

  scheduler.run(oldTimerId);
  assert.deepEqual(states.at(-1), { text: '新错误', type: 'error' });

  const [newTimerId] = scheduler.ids();
  scheduler.run(newTimerId);
  assert.deepEqual(states.at(-1), { text: '', type: '' });
});

test('a persistent status also cancels a pending transient clear', () => {
  const states = [];
  const scheduler = createFakeScheduler();
  const notifier = createStatusNotifier(state => states.push(state), {
    schedule: callback => scheduler.schedule(callback),
    cancel: id => scheduler.cancel(id),
  });

  notifier.show({ text: '短消息', type: 'success' }, 3000);
  notifier.show({ text: '后端读取失败', type: 'error' });

  assert.deepEqual(scheduler.ids(), []);
  assert.deepEqual(states.at(-1), { text: '后端读取失败', type: 'error' });
});
