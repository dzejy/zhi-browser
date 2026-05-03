const { _electron: electron } = require('playwright');

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: ['.'], cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production' } });
  try {
    const pages = await app.windows();
    console.log('windows=', pages.length);
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      await p.waitForTimeout(300);
      let url = '';
      try { url = await p.url(); } catch {}
      const triggerCount = await p.locator('.search-engine-trigger').count().catch(() => 0);
      const selectCount = await p.locator('.quick-search-engine-select').count().catch(() => 0);
      const quickWrap = await p.locator('.quick-search-wrapper').count().catch(() => 0);
      console.log(i, { url, triggerCount, selectCount, quickWrap });
    }
  } finally {
    await app.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
