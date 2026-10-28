import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

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

test('purchase suggestions are summarized as a copyable shopping list', async ({ page, context }, info) => {
  const device = (name, x) => ({
    ...box(name, x), type: 'device',
    ports: [{ id: 'power-in', name: '电源输入', type: 'ac_input', direction: 'input' }],
  });
  const laptop = {
    ...box('笔记本', 4), type: 'laptop',
    ports: [{ id: 'dc-in', name: 'DC 输入', type: 'dc_input', direction: 'input' }],
  };
  const evidence = await openProject(page, [device('主机', -2), device('显示器', 2), laptop]);
  await page.getByRole('button', { name: /^改进建议/ }).click();
  const list = page.getByRole('dialog').getByRole('group', { name: '购物清单' });
  await expect(list.getByRole('listitem')).toHaveText(['插排×1', '电源适配器×1']);

  if (info.project.name === 'desktop') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await list.getByRole('button', { name: '复制清单', exact: true }).click();
    // The OS clipboard may store line breaks as CRLF.
    await expect.poll(() => page.evaluate(async () => (await navigator.clipboard.readText()).replace(/\r\n/g, '\n')))
      .toBe('DeskLab 购物清单\n- 插排 ×1\n- 电源适配器 ×1');
  }
  expect(evidence).toEqual({ errors: [], writes: [] });
});
