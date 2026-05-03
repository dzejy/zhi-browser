const { _electron: electron } = require('playwright');

async function getMainPage(app) {
  for (let i = 0; i < 40; i++) {
    const pages = await app.windows();
    for (const p of pages) {
      try {
        if ((await p.locator('input.url-input').count()) > 0) return p;
      } catch {}
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('main page not found');
}

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: ['.'], cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production' } });
  try {
    const page = await getMainPage(app);
    await page.waitForTimeout(1000);
    const trigger = page.locator('.search-engine-trigger').first();
    await trigger.click();
    await page.waitForTimeout(200);
    console.log('expanded', await trigger.getAttribute('aria-expanded'));
  } finally {
    await app.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
