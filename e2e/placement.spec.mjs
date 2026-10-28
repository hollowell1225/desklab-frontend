import { test, expect } from '@playwright/test';
import { openProject } from './project-fixture.mjs';

test('devices added from the library land in free spots on and around the desk', async ({ page }) => {
  const evidence = await openProject(page, []);
  const library = page.getByPlaceholder('搜索设备名称、类型、型号...');
  const add = async name => {
    // On narrow screens the library starts collapsed and closes after adding.
    const openLibrary = page.getByRole('button', { name: '展开资产库', exact: true });
    if (await openLibrary.isVisible()) await openLibrary.click();
    await library.fill(name);
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  };

  await add('书桌');
  await add('27 英寸显示器');
  await add('15 英寸笔记本');
  await add('台式主机');
  await add('插排');

  // Nothing overlaps or floats, so the layout check has nothing to report.
  await expect(page.getByRole('button', { name: '布局检查', exact: true })).toBeVisible();
  expect(evidence).toEqual({ errors: [], writes: [] });
});
