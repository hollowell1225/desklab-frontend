import { expect } from '@playwright/test';
import { isProjectEnvelope } from '../src/domain/project-validation.js';

export function box(id, x = 0) {
  return {
    id, name: id, type: 'furniture', shape: 'box',
    position: { x, y: 0, z: 0.5 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    ports: [],
  };
}

export async function openProject(page, objects, connections = []) {
  const project = {
    id: 'default', updatedAt: '2026-09-09T00:00:00.000Z',
    room: { length: 10, width: 10, height: 3 }, objects, connections,
  };
  expect(isProjectEnvelope(project, { requireStoredFields: true })).toBe(true);
  const errors = [];
  const writes = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error('Browser runtime error:', error.message);
  });
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  // Every API request stays inside this test; no real default project is read or saved.
  await page.route('**/api/**', route => {
    if (route.request().method() !== 'GET'
      || new URL(route.request().url()).pathname !== '/api/projects/default') {
      writes.push(`${route.request().method()} ${route.request().url()}`);
      return route.abort();
    }
    return route.fulfill({
      json: project, headers: { ETag: '"ui-fixture"' },
    });
  });
  await page.goto('/');
  await expect(page).toHaveTitle('DeskLab');
  await expect(page.getByRole('button', { name: '保存项目', exact: true })).toBeEnabled();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  return { errors, writes };
}
