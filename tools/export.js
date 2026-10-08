// Bakes every robot animation frame to PNG files.
// Usage: node tools/export.js <outDir> [scale]
// Needs Playwright (Chromium). Then run tools/build_assets.py to make sheets + GIFs.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const outDir = path.resolve(process.argv[2] || 'build/frames');
  const scale = parseFloat(process.argv[3] || '1.5');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(__dirname, 'export.html'));
  const data = await page.evaluate(s => window.renderAll(s), scale);
  await browser.close();

  const meta = { cell: data.cell, clips: {} };
  for (const [name, clip] of Object.entries(data.clips)) {
    const dir = path.join(outDir, name);
    fs.mkdirSync(dir, { recursive: true });
    clip.frames.forEach((url, i) => {
      fs.writeFileSync(path.join(dir, `${name}_${String(i).padStart(3, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
    });
    meta.clips[name] = { frames: clip.frames.length, fps: clip.fps, loop: clip.loop };
  }
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log('Wrote', Object.keys(meta.clips).length, 'clips to', outDir);
})();
