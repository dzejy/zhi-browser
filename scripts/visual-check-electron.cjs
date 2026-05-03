const fs = require('fs');
const path = require('path');
const { _electron: electron } = require('playwright');

(async () => {
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production' }
  });

  try {
    const page = await app.firstWindow();
    await page.waitForTimeout(2500);

    const toggleBtn = page.locator('button[title="切换为垂直标签栏"]');
    if (await toggleBtn.count()) {
      await toggleBtn.first().click();
      await page.waitForTimeout(1000);
    }

    const urlInput = page.locator('input.url-input');
    await urlInput.click();
    await urlInput.fill('https://www.baidu.com/');
    await urlInput.press('Enter');

    await page.waitForTimeout(4500);

    const base64 = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const image = await win.capturePage();
      return image.toPNG().toString('base64');
    });

    const outDir = path.join(process.cwd(), 'artifacts');
    fs.mkdirSync(outDir, { recursive: true });
    const shotPath = path.join(outDir, 'vertical-layout-visual-check.png');
    fs.writeFileSync(shotPath, Buffer.from(base64, 'base64'));

    console.log('SCREENSHOT', shotPath);
  } finally {
    await app.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
