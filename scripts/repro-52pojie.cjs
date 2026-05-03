const { _electron: electron } = require('playwright');

async function getMain(app) {
  for (let i = 0; i < 50; i++) {
    const ws = await app.windows();
    for (const p of ws) {
      try {
        if (!p.isClosed() && (await p.locator('input.url-input').count()) > 0) return p;
      } catch {}
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('main window not found');
}

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: ['.'], cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production' } });
  try {
    const main = await getMain(app);
    const input = main.locator('input.url-input');
    await input.click();
    await input.fill('https://www.52pojie.cn/index.php');
    await input.press('Enter');
    await main.waitForTimeout(5000);

    const page = (await app.windows()).find(async p => !p.isClosed());
    const target = await getMain(app);
    const frame = target.frameLocator('webview');

    // Directly interact with embedded page via mouse+keyboard fallback using shortcuts
    await target.keyboard.press('Control+L');
    await input.fill('https://www.52pojie.cn/index.php');
    await input.press('Enter');
    await target.waitForTimeout(4000);

    // Use Electron side to read all URLs currently loaded
    const urls = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => w.webContents.getURL()));
    console.log('WINDOW_URLS_BEFORE', JSON.stringify(urls));

    // Try triggering site search by executing JS in active tab webContents
    const result = await app.evaluate(async ({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      const mainWin = wins.find(w => !w.webContents.getURL().includes('?panel=true'));
      if (!mainWin) return { ok: false, reason: 'no main win' };
      const wc = mainWin.webContents;
      const active = wc;
      return { ok: true, current: active.getURL() };
    });

    console.log('EVAL', JSON.stringify(result));
  } finally {
    await app.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
