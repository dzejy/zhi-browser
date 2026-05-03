const { _electron: electron } = require('playwright');

function dataUrl(html) {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

async function openUrlInZhi(page, url) {
  const input = page.locator('input.url-input');
  await input.click();
  await input.fill(url);
  await input.press('Enter');
  await page.waitForTimeout(1800);
}

async function getLiveMainPage(app) {
  for (let i = 0; i < 30; i++) {
    const pages = await app.windows();
    for (const p of pages) {
      try {
        const closed = p.isClosed();
        if (!closed && (await p.locator('input.url-input').count()) > 0) {
          return p;
        }
      } catch {
        // try next page
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Cannot find a live Zhi main window with url input');
}

async function getWindowUrlsFromPages(app) {
  const pages = await app.windows();
  const urls = [];
  for (const p of pages) {
    try {
      urls.push(await p.url());
    } catch {
      urls.push('');
    }
  }
  return urls;
}

(async () => {
  const app = await electron.launch({
    executablePath: require('electron'),
    args: ['.'],
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'production' }
  });

  const result = {
    formTargetBlank: { passed: false, details: '' },
    aboutBlankThenGithub: { passed: false, details: '' }
  };

  try {
    let mainPage = await getLiveMainPage(app);
    await mainPage.waitForTimeout(2500);

    // Case 1: form target=_blank should carry keyword to new window URL
    const case1Html = `<!doctype html><html><body>
      <form id="f" action="https://www.baidu.com/s" method="get" target="_blank">
        <input id="kw" name="wd" value="bandzip" />
        <button id="go" type="submit">go</button>
      </form>
      <script>document.getElementById('go').click();</script>
    </body></html>`;

    const beforeCount1 = (await app.windows()).length;
    mainPage = await getLiveMainPage(app);
    await openUrlInZhi(mainPage, dataUrl(case1Html));
    await mainPage.waitForTimeout(2500);
    const windowsAfter1 = await app.windows();
    const afterCount1 = windowsAfter1.length;

    const urls1 = await getWindowUrlsFromPages(app);

    const hasBandzip = urls1.some((u) => /baidu\.com\/s/.test(u) && /(?:\?|&)wd=bandzip(?:&|$)/.test(u));
    result.formTargetBlank.passed = hasBandzip;
    result.formTargetBlank.details = `windowCount ${beforeCount1}->${afterCount1}; urls=${JSON.stringify(urls1)}`;

    // Close extra windows before case 2
    await app.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows();
      wins.slice(1).forEach((w) => w.close());
    });
    mainPage = await getLiveMainPage(app);
    await mainPage.waitForTimeout(800);

    // Case 2: about:blank popup then redirect to github should not become baidu
    const case2Html = `<!doctype html><html><body>
      <button id="go">go</button>
      <script>
        document.getElementById('go').addEventListener('click', () => {
          const w = window.open('about:blank', '_blank');
          setTimeout(() => {
            try { w.location.href = 'https://github.com/login'; } catch (e) {}
          }, 60);
        });
        document.getElementById('go').click();
      </script>
    </body></html>`;

    const beforeCount2 = (await app.windows()).length;
    mainPage = await getLiveMainPage(app);
    await openUrlInZhi(mainPage, dataUrl(case2Html));
    await mainPage.waitForTimeout(3200);

    const windowsAfter2 = await app.windows();
    const afterCount2 = windowsAfter2.length;
    const urls2 = await getWindowUrlsFromPages(app);

    const hasGithub = urls2.some((u) => u.startsWith('https://github.com/login'));
    const hasWrongBaidu = urls2.some((u) => u.startsWith('https://www.baidu.com'));
    result.aboutBlankThenGithub.passed = hasGithub && !hasWrongBaidu;
    result.aboutBlankThenGithub.details = `windowCount ${beforeCount2}->${afterCount2}; urls=${JSON.stringify(urls2)}`;

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
