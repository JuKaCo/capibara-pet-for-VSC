// Records the README demo GIF from the real webview in headless Chrome (no build needed):
// every <step> ms the scene, the pet sprite and the effects are composited into one frame,
// then tools/gif.py turns the frames into a crisp, scaled-up GIF with one shared palette.
//
//   node tools/demo-gif.js            -> docs/condor.gif
//   node tools/demo-gif.js capybara   -> docs/capybara.gif
// Needs Chrome/Edge/Chromium (or CHROME_PATH) and Python with Pillow (`pip install pillow`).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, renderHtml, findBrowser } = require('../test/harness');

const pet = process.argv[2] || 'condor';
const START = 400, STEP = 100;
// What happens on screen, per pet: [ms, message type, bubble text].
const SCRIPTS = {
  // Soar, rest on the rock by the chick, celebrate a test run, take off again.
  condor: { frames: 170, scale: 2, coffee: 4, events: [[11500, 'celebrate', 'tests ✓'], [15000, 'typing'], [15400, 'typing']] },
  // Stroll, share a watermelon with the baby, celebrate a commit, swim, come back out.
  capybara: { frames: 200, scale: 4, coffee: 600, events: [[1500, 'feed'], [9000, 'celebrate', 'commit!'], [11000, 'swim'], [17500, 'typing'], [17900, 'typing']] },
};
const { frames: FRAMES, scale, coffee, events: EVENTS } = SCRIPTS[pet]; // the capybara's world is on a coarser grid
const settings = { pet, background: 'scene', weather: 'clear', seasons: false, coffeeAfterSeconds: coffee, sleepAfterSeconds: 3600 };

const RECORDER = `<script>(() => {
  ${JSON.stringify(EVENTS)}.forEach(([t, type, text]) => setTimeout(() => window.postMessage({ type, text }, '*'), t));
  const frames = [], imgs = {};
  const load = (u) => imgs[u] || (imgs[u] = new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; }));
  const grab = async () => {
    const sc = document.getElementById('scene'), fx = document.getElementById('fx');
    const c = document.createElement('canvas'); c.width = sc.width; c.height = sc.height;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(sc, 0, 0);
    const pet = document.getElementById('pet'), spr = document.getElementById('sprite');
    if (pet.style.visibility !== 'hidden') {
      const img = await load(getComputedStyle(spr).backgroundImage.slice(5, -2));
      const PX = sc.style.width ? parseFloat(sc.style.width) / sc.width : 2;
      const cell = img.height, left = parseFloat(pet.style.left) / PX, size = pet.offsetWidth / PX;
      const top = sc.height - parseFloat(pet.style.bottom || '4') / PX - size;
      const frame = Math.round(-parseFloat(getComputedStyle(spr).backgroundPositionX || '0') / pet.offsetWidth) || 0;
      g.save();
      if (/scaleX\\(-1\\)/.test(pet.style.transform)) { g.translate(left * 2 + size, 0); g.scale(-1, 1); }
      g.drawImage(img, frame * cell, 0, cell, cell, left, top, size, size);
      g.restore();
    }
    g.drawImage(fx, 0, 0);
    frames.push(c.toDataURL());
    if (frames.length === ${FRAMES}) { document.body.setAttribute('data-frames', frames.join(' ')); }
  };
  setTimeout(() => { const id = setInterval(() => (frames.length >= ${FRAMES} ? clearInterval(id) : grab()), ${STEP}); }, ${START});
})();</script>`;

const browser = findBrowser();
if (!browser) { console.error('demo-gif: no Chrome/Edge/Chromium found (set CHROME_PATH)'); process.exit(1); }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capibara-gif-'));
const page = path.join(dir, 'demo.html');
fs.writeFileSync(page, renderHtml(settings, '', RECORDER));
const out = execFileSync(browser, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files',
  `--user-data-dir=${path.join(dir, 'profile')}`, '--window-size=480,220',
  `--virtual-time-budget=${START + FRAMES * STEP + 4000}`, '--dump-dom', 'file:///' + page.replace(/\\/g, '/')],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28, timeout: 300000 });
const m = out.match(/data-frames="([^"]+)"/);
if (!m) { console.error('demo-gif: the page recorded no frames'); process.exit(1); }
const frames = path.join(dir, 'frames');
fs.mkdirSync(frames);
m[1].split(' ').forEach((u, i) =>
  fs.writeFileSync(path.join(frames, String(i).padStart(3, '0') + '.png'), Buffer.from(u.split(',')[1], 'base64')));
const gif = path.join(ROOT, 'docs', `${pet}.gif`);
execFileSync('python', [path.join(__dirname, 'gif.py'), frames, gif, String(STEP), String(scale)], { stdio: 'inherit' });
fs.rmSync(dir, { recursive: true, force: true });
