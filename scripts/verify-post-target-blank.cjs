const { _electron: electron } = require('playwright');

function dataUrl(html) {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

async function getMain(app) {
  for (let i = 0; i < 40; i++) {
    const ws = await app.windows();
    for (const p of ws) {
      try {
        if (!p.isClosed() && (await p.locator('input.url-input').count()) > 0) return p;
      } catch {}
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('main not found');
}

async function openInMain(app, url) {
  const main = await getMain(app);
  const input = main.locator('input.url-input');
  await input.click();
  await input.fill(url);
  await input.press('Enter');
  await main.waitForTimeout(2600);
}

(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: ['.'], cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production' } });
  try {
    const html = `<!doctype html><html><body>
      <form id="f" action="https://www.bing.com/search" method="post" target="_blank">
        <input type="hidden" name="q" value="sssss" />
        <input type="hidden" name="form" value="QBLH" />
      </form>
      <script>document.getElementById('f').submit();</script>
    </body></html>`;

    await openInMain(app, dataUrl(html));
    await new Promise(r => setTimeout(r, 4500));

    const windows = [];
    for (const p of await app.windows()) {
      try {
        windows.push({ url: await p.url(), title: await p.title() });
      } catch {
        windows.push({ url: '', title: '' });
      }
    }

    const titleHasKeyword = windows.some((w) => /sssss/i.test(w.title));
    console.log(JSON.stringify({ titleHasKeyword, windows }, null, 2));
  } finally {
    await app.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
