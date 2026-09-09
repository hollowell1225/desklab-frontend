import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    channel: 'chrome',
    headless: true,
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
