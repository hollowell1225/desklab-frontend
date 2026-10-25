import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

const DATA_TOOLS = ['导入 JSON', '导出 JSON', '粘贴 JSON', '复制 JSON'];

test('project data tools and axes live behind the more menu', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);

  for (const name of DATA_TOOLS) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('checkbox', { name: '显示坐标轴' })).toHaveCount(0);

  const more = page.getByRole('button', { name: '更多', exact: true });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  const menu = page.getByRole('menu', { name: '更多', exact: true });
  for (const name of DATA_TOOLS) {
    await expect(menu.getByRole('menuitem', { name, exact: true })).toBeEnabled();
  }
  const axes = menu.getByRole('menuitemcheckbox', { name: '显示坐标轴' });
  await expect(axes).toBeChecked();
  await axes.click();
  await expect(axes).not.toBeChecked();
  await expect(menu, 'toggling axes keeps the menu open').toBeVisible();
  await expect(menu).toBeInViewport({ ratio: 1 });

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(more).toBeFocused();

  await more.click();
  await page.getByText('DeskLab MVP', { exact: true }).click();
  await expect(menu).toHaveCount(0);

  await more.click();
  const download = page.waitForEvent('download');
  await menu.getByRole('menuitem', { name: '导出 JSON', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^desklab-project-.*\.json$/);
  await expect(menu).toHaveCount(0);

  expect(evidence).toEqual({ errors: [], writes: [] });
});
