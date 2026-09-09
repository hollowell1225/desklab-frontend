import { test, expect } from '@playwright/test';
import { isProjectEnvelope } from '../src/domain/project-validation.js';

function box(id, x = 0) {
  return {
    id, name: id, type: 'furniture', shape: 'box',
    position: { x, y: 0, z: 0.5 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    ports: [],
  };
}

async function openProject(page, objects, connections = []) {
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

test('no automatic suggestions still directs the user to unresolved layout problems', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A'), box('桌子 B')]);
  await expect(page.getByRole('button', { name: '布局检查 (1)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('免费改进 0', { exact: true })).toBeVisible();
  await expect(dialog.getByText('加购建议 0', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('还有 1 项检查问题需要处理');
  await expect(dialog).not.toContainText('完美');
  await dialog.getByRole('button', { name: '查看布局问题 (1)', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: '布局检查', exact: true }))
    .toContainText('桌子 A 与 桌子 B 可能互相穿插');
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('an empty project explains how to start instead of presenting an all-clear', async ({ page }) => {
  const evidence = await openProject(page, []);
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('先添加设备，建立你的桌面方案。');
  await expect(dialog).not.toContainText('完美');
  await expect(dialog.getByRole('button', { name: /查看.*问题/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: '添加第一件设备', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByPlaceholder('搜索设备名称、类型、型号...')).toBeVisible();
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('applying free fixes keeps manual problems visible and supports undo and redo', async ({ page }) => {
  const floating = { ...box('悬空设备', 3), position: { x: 3, y: 0, z: 1.5 } };
  const evidence = await openProject(page, [box('桌子 A'), box('桌子 B'), floating]);
  const openRecommendations = () => page.getByRole('button', { name: /^改进建议/ }).click();
  const closeRecommendations = () => page.getByRole('button', { name: '关闭改进建议', exact: true }).click();
  await openRecommendations();
  const dialog = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  await expect(dialog).toContainText('还有 2 项检查问题需要处理');
  await dialog.getByRole('button', { name: '一键修复所有免费项 (1)', exact: true }).click();
  await expect(dialog.getByText('免费改进 0', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('还有 1 项检查问题需要处理');
  await expect(dialog).not.toContainText('完美');
  await closeRecommendations();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await openRecommendations();
  await expect(dialog.getByText('免费改进 1', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('还有 2 项检查问题需要处理');
  await closeRecommendations();
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await openRecommendations();
  await expect(dialog.getByText('免费改进 0', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('还有 1 项检查问题需要处理');
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('wiring problems remain reachable alongside purchase suggestions', async ({ page }) => {
  const device = {
    ...box('待供电设备'), type: 'device',
    ports: [{ id: 'power-in', name: '电源输入', type: 'ac_input', direction: 'input' }],
  };
  const evidence = await openProject(page, [device]);
  await page.getByRole('button', { name: /^改进建议/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('加购建议 1', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '查看布线问题 (1)', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: '布线检查', exact: true })).toContainText('待供电设备');
  await expect(page.getByRole('button', { name: '撤销', exact: true })).toBeDisabled();
  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('a checked layout describes the scope of the result without guaranteeing perfection', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A', -2), box('桌子 B', 2)]);
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '自动检查与改进建议', exact: true });
  await expect(dialog).toContainText('当前检查未发现需要处理的问题');
  await expect(dialog).toContainText('根据当前设备、位置和连接规则生成建议');
  await expect(dialog).not.toContainText('完美');
  await expect(dialog.getByRole('button', { name: /查看.*问题/ })).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
