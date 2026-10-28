import { test, expect } from '@playwright/test';
import { box, openProject } from './project-fixture.mjs';

test('a new user can start from a desk template that is ready to use, and undo it', async ({ page }) => {
  const evidence = await openProject(page, []);

  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用桌面模板', exact: true }).click();

  const picker = page.getByRole('dialog', { name: '桌面模板', exact: true });
  await expect(picker).toBeVisible();
  await expect(picker).not.toContainText('替换当前场景');
  await expect(picker).toContainText('家庭办公');
  await expect(picker).toContainText('台式机双屏');
  await picker.getByRole('button', { name: '使用模板：电竞桌', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A template is placed and wired so that every check comes back clean.
  await expect(page.getByRole('button', { name: '布局检查', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '布线检查', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '改进建议', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '未保存' })).toBeVisible();

  await page.getByRole('button', { name: '所有连接', exact: true }).click();
  const connections = page.getByRole('dialog', { name: '全部连接清单', exact: true });
  await expect(connections).toContainText('台式主机到带鱼屏显示器的DP线');
  await expect(connections).toContainText('台式主机网线');
  await connections.getByRole('button', { name: /关闭/ }).click();

  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await page.getByRole('button', { name: '改进建议', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('先添加设备，建立你的桌面方案。');

  expect(evidence).toEqual({ errors: [], writes: [] });
});

test('the template picker warns before replacing an existing scene', async ({ page }) => {
  const evidence = await openProject(page, [box('桌子 A')]);
  await page.getByRole('button', { name: '桌面模板', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '桌面模板', exact: true });
  await expect(picker).toContainText('套用后会替换当前场景，可以用“撤销”恢复。');
  await picker.getByRole('button', { name: '关闭桌面模板', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(evidence).toEqual({ errors: [], writes: [] });
});
