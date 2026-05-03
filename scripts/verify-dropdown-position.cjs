const { _electron: electron } = require('playwright');

async function getMain(app) {
  for (let i = 0; i < 40; i++) {
    for (const p of await app.windows()) {
      try { if ((await p.locator('input.url-input').count()) > 0) return p; } catch {}
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('main not found');
}

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: ['.'], cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production' } });
  try {
    const page = await getMain(app);
    await page.waitForTimeout(1000);
    const trigger = page.locator('.search-engine-trigger').first();
    await trigger.click();
    await page.waitForTimeout(250);
    const data = await page.evaluate(() => {
      const t = document.querySelector('.search-engine-trigger');
      const m = document.querySelector('.search-engine-menu');
      if (!t || !m) return null;
      const tr = t.getBoundingClientRect();
      const mr = m.getBoundingClientRect();
      return { triggerTop: tr.top, triggerBottom: tr.bottom, menuTop: mr.top, menuBottom: mr.bottom, menuAbove: mr.bottom <= tr.top + 1 };
    });
    console.log(JSON.stringify(data, null, 2));
  } finally {
    await app.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
