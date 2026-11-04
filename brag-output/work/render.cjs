const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const dir = __dirname + '/frames'; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('file://' + __dirname + '/video.html'); await p.evaluate(() => window.ready);
  const FPS = 30, N = 21 * FPS;
  for (let i = 0; i < N; i++) {
    await p.evaluate((t) => seek(t), i / FPS);
    await p.screenshot({ path: `${dir}/${String(i).padStart(5, '0')}.png`, type: 'png' });
  }
  await b.close(); console.log('frames', N);
})();
