// Smoke test: runs the real webview for both pets across times of day and weathers in a
// headless browser, fires every reaction (typing, saving, errors, Git, petting, the easter
// egg, dragging, breaks and naps…) and fails on any JavaScript error or an empty scene.
//
//   npm test              (needs Chrome, Edge or Chromium; set CHROME_PATH to pick one)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { renderHtml, findBrowser } = require('./harness');

const browser = findBrowser();
if (!browser) {
  console.log('smoke: no Chrome/Edge/Chromium found (set CHROME_PATH) — skipped');
  process.exit(0);
}

const PETS = ['capybara', 'condor'];
const MODES = ['scene', 'sunset', 'night', 'transparent'];
const WEATHERS = ['clear', 'rain', 'snow', 'fog'];
const EVENTS = ['typing', 'jump', 'pet', 'celebrate', 'scared', 'swim', 'feed', 'poke', 'typing', 'celebrate'];

// Runs in the page: reports errors and whether the scene canvas has anything drawn.
const PROBE = `<script>
  window.__errs = [];
  window.addEventListener('error', (e) => window.__errs.push(e.message));
</script>`;
const DRIVER = `<script>
  // Make the random things (birds, ducks, llamas, dust devils, fireworks…) happen early.
  setTimeout(() => { const R = Math.random; let n = 0; Math.random = () => (n++ < 40 ? R() * 0.0003 : R()); }, 300);
  ${JSON.stringify(EVENTS)}.forEach((t, i) =>
    setTimeout(() => window.postMessage({ type: t, text: i % 3 ? '' : 'x' }, '*'), 800 + i * 900));
  setTimeout(() => { const st = document.getElementById('stage'); for (let i = 0; i < 5; i++) { st.click(); } }, 6000);
  setTimeout(() => { // drag the pet and drop it near the ground
    const p = document.getElementById('pet'), r = document.getElementById('stage').getBoundingClientRect();
    p.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 120, clientY: r.bottom - 5 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
  }, 11500);
  setInterval(() => {
    const c = document.getElementById('scene');
    let drawn = 0;
    if (c && c.width > 1) {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let k = 3; k < d.length; k += 400) { if (d[k]) { drawn++; } }
    }
    document.body.setAttribute('data-result', JSON.stringify({ errors: [...new Set(window.__errs)], n: window.__errs.length, drawn }));
  }, 250);
</script>`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capibara-smoke-'));
let failed = 0, runs = 0;
for (const pet of PETS) {
  for (const background of MODES) {
    for (const weather of WEATHERS) {
      if (background === 'transparent' && weather !== 'clear') { continue; } // no scenery: weather is moot
      runs++;
      const file = path.join(dir, `${pet}-${background}-${weather}.html`);
      fs.writeFileSync(file, renderHtml({ pet, background, weather, coffeeAfterSeconds: 2, sleepAfterSeconds: 5 }, PROBE, DRIVER));
      let out = '';
      try {
        out = execFileSync(browser, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files',
          ...(process.env.CI ? ['--no-sandbox'] : []), // CI runners (Ubuntu 24.04) block Chrome's sandbox
          `--user-data-dir=${path.join(dir, 'profile')}`, '--window-size=900,330', '--virtual-time-budget=16000',
          '--dump-dom', 'file:///' + file.replace(/\\/g, '/')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 120000 });
      } catch (e) { out = String(e.stdout || ''); }
      const m = out.match(/data-result="([^"]*)"/);
      const res = m ? JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) : null;
      const scenic = background !== 'transparent';
      const ok = res && res.n === 0 && (!scenic || res.drawn > 0);
      if (!ok) { failed++; }
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${pet.padEnd(8)} ${background.padEnd(11)} ${weather.padEnd(5)}` +
        (ok ? '' : `  ${res ? `errors=${res.n} ${res.errors.join(' | ')} drawn=${res.drawn}` : 'no result (page did not run)'}`));
    }
  }
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\nsmoke: ${runs - failed}/${runs} passed`);
process.exit(failed ? 1 : 0);
