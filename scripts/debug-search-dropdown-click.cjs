const { _electron: electron } = require('playwright');

async function getMainPage(app) {
  for (let i = 0; i < 40; i++) {
    const pages = await app.windows();
    for (const p of pages) {
      try {
        const c = await p.locator('input.url-input').count();
        if (c > 0) return p;
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
    await page.bringToFront();
    await page.waitForTimeout(1000);

    const trigger = page.locator('.search-engine-trigger').first();
    const count = await trigger.count();
    console.log('triggerCount', count);
    if (!count) return;

    const before = await trigger.getAttribute('class');
    const beforeExpanded = await trigger.getAttribute('aria-expanded');

    await trigger.click({ force: true });
    await page.waitForTimeout(250);

    const after = await trigger.getAttribute('class');
    const afterExpanded = await trigger.getAttribute('aria-expanded');
    const menuCount = await page.locator('.search-engine-menu').count();

    console.log(JSON.stringify({ before, beforeExpanded, after, afterExpanded, menuCount }, null, 2));
  } finally {
    await app.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
