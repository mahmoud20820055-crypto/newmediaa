const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const D = __dirname;
(async () => {
  const mode = process.argv[2];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('console:', m.text()));
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.goto('http://127.0.0.1:8765/reel.html');
  await page.waitForFunction('window.ready === true', null, { timeout: 60000 });
  const T = await page.evaluate('window.TOTAL');
  if (mode === 'stills') {
    for (const t of process.argv.slice(3).map(Number)) {
      await page.evaluate(t => render(t), t);
      await page.screenshot({ path: path.join(D, `stills/f_${t.toFixed(2)}.jpg`), type: 'jpeg', quality: 85 });
    }
  } else {
    const fps = 30, N = Math.round(T * fps);
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), path.join(D, 'out/video_noaudio.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = 0; i < N; i++) {
      await page.evaluate(t => render(t), i / fps);
      const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.log('frame', i, '/', N);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
