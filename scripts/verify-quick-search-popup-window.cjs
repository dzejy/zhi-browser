const { _electron: electron } = require('playwright');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: ['.'], cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production' } });
  try {
    const pages = await app.windows();
    const main = pages.find(async p => (await p.locator('input.url-input').count())>0) || pages[0];
    await main.waitForTimeout(1200);
    const before = (await app.windows()).length;
    await main.locator('.search-engine-trigger').first().click();
    await main.waitForTimeout(500);
    const after = (await app.windows()).length;
    console.log(JSON.stringify({ before, after }, null, 2));
  } finally { await app.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
