import * as vscode from 'vscode';
import { watchGit, watchTasks } from './reactions';

// Capibara Pet — a mascot living in a docked panel (webview).
// Spritesheet animation with CSS steps() (flicker-free). Drag the panel to the
// secondary side bar to pin it in a corner.
// States:
//   walk      strolls around (default)
//   run       runs while you type
//   jump      hops when you change line
//   celebrate cheers when you save (or when a debug session starts)
//   scared    gets scared if the file has errors
//   coffee    sips coffee during medium pauses
//   sleep     sleeps after a long pause (pixel "z"s float up from the stage)
//   swim      on some breaks it goes for a swim in the lake instead of its coffee
//             (or on command); any editor activity brings it back out
//   eat       munches a watermelon slice (the Feed command)
// Optional: a baby capybara that follows it, fur colour variants, 8-bit sounds.
// Or pick the Andean condor (capibaraPet.pet): it soars over the Illimani in its own
// habitat, perches on a rock to sunbathe and sleep, and spreads its wings to celebrate.
// Click the capybara -> it hops and a pixel heart floats up. The animation pauses
// when the view is hidden, and it respects the user's prefers-reduced-motion setting.
// The stage (day/night scenery, shadow and particles) is procedural pixel art drawn
// by media/pixelart.js on low-res canvases; the pet moves on the same pixel grid.
// The webview reports its mood back so a status bar item can mirror it; speech
// bubbles, the pet's name, and typing-intensity speed are all configurable.

// Sprite cells are SPRITE_GRID x SPRITE_GRID pixel art (made with tools/pixelize.py).
const SPRITE_GRID = 42;

// Fur variants: media/fur/<name>/ holds the recoloured sheets (tools/furs.py);
// these four tones also colour the swimmer and the baby drawn by pixelart.js.
const FURS: { [name: string]: { f: string; h: string; s: string; d: string } } = {
  classic: { f: '#c86e3d', h: '#f08952', s: '#8e4d35', d: '#7c3f2b' },
  chocolate: { f: '#7a4a32', h: '#9c6648', s: '#553222', d: '#45281c' },
  golden: { f: '#d9a050', h: '#f4c474', s: '#a87434', d: '#8a5c28' },
  cream: { f: '#e6d3bc', h: '#fbeedd', s: '#c2ab92', d: '#a88e86' },
  ash: { f: '#8c8782', h: '#aba6a0', s: '#67635f', d: '#55514d' },
};

// The condor: finer pixel art (84×84 cells, made by tools/condor.py from art/condor/).
// `head` is the top-centre of its head in each pose (for hats and effects); `glide`
// is the level-wings frame of `fly`, held still.
const CONDOR_GRID = 84;
const CONDOR_POSES: { [pose: string]: { n: number; dur: number; head: [number, number] } } = {
  fly: { n: 4, dur: 0.48, head: [52, 29] },
  hop: { n: 4, dur: 0.6, head: [51, 37] },
  perch: { n: 2, dur: 1.8, head: [48, 29] },
  spread: { n: 2, dur: 0.5, head: [45, 37] },
  scared: { n: 2, dur: 0.24, head: [45, 21] },
  sunbathe: { n: 2, dur: 2.2, head: [42, 29] },
  sleep: { n: 2, dur: 2.4, head: [46, 31] },
};

interface SheetCfg { n: number; dur: number; }
const SHEETS: { [s: string]: SheetCfg } = {
  walk: { n: 4, dur: 0.72 },
  run: { n: 7, dur: 0.80 },
  jump: { n: 2, dur: 0.50 },
  celebrate: { n: 4, dur: 0.50 },
  scared: { n: 2, dur: 0.32 },
  coffee: { n: 2, dur: 1.40 },
  sleep: { n: 2, dur: 1.70 },
};

class CapibaraViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'capibaraPet.view';
  private view?: vscode.WebviewView;
  public onState?: (s: string) => void;
  public onWorld?: (w: { mode: string; weather: string; season: string; holiday: string }) => void;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    view.webview.html = this.html(view.webview);
    // Pause the animation loop while the view is not visible (saves CPU/battery).
    view.onDidChangeVisibility(() => this.notify(view.visible ? 'resume' : 'pause'));
    // The webview reports its current mood so the status bar can mirror it.
    view.webview.onDidReceiveMessage((m) => {
      if (m && m.type === 'state' && this.onState) { this.onState(m.s); }
      if (m && m.type === 'world' && this.onWorld) { this.onWorld(m.w); }
    });
  }

  // `text`, when given, replaces the default speech bubble of that reaction.
  notify(type: string, text?: string) {
    this.view?.webview.postMessage({ type, text });
  }

  // Rebuild the webview when settings change so size/speed/timings apply live.
  refresh() {
    if (this.view) { this.view.webview.html = this.html(this.view.webview); }
  }

  private uri(webview: vscode.Webview, file: string): string {
    return webview
      .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', file))
      .toString();
  }

  private html(webview: vscode.Webview): string {
    const cfg = vscode.workspace.getConfiguration('capibaraPet');
    if (!cfg.get<boolean>('enabled', true)) {
      // Hidden: render an empty, locked-down document.
      return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">` +
        `<meta http-equiv="Content-Security-Policy" content="default-src 'none';"></head><body></body></html>`;
    }
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const DISP = Math.round(clamp(cfg.get<number>('size', 84), 40, 160));
    const speed = clamp(cfg.get<number>('speed', 1), 0.25, 3);
    const TICK = 70;
    // One "art pixel" = one sprite pixel on screen; the scenery, particles and the
    // movement grid all use it. Sizes that are multiples of SPRITE_GRID (42, 84,
    // 126) give whole screen pixels, so the art stays perfectly even.
    const condor = cfg.get<string>('pet', 'capybara') === 'condor';
    const GRID = condor ? CONDOR_GRID : SPRITE_GRID;
    const PX = DISP / GRID;
    // CSS offset of the sprite's feet from the stage bottom (they sit 2 px above the cell bottom).
    const FEET = 4 + PX * 2;
    const BPX = Math.max(1, Math.round(PX)); // bubble border/tail thickness
    const coffeeAfter = Math.round(clamp(cfg.get<number>('coffeeAfterSeconds', 6), 1, 600) * 1000 / TICK);
    const sleepAfter = Math.round(clamp(cfg.get<number>('sleepAfterSeconds', 15), 2, 3600) * 1000 / TICK);
    const states = Object.keys(SHEETS);
    const furName = FURS[cfg.get<string>('color', 'classic')] ? cfg.get<string>('color', 'classic') : 'classic';
    const sheet = (s: string) => this.uri(webview, (furName === 'classic' ? '' : `fur/${furName}/`) + s + '_sheet.png');

    const condorSheet = (pose: string) => this.uri(webview, `condor/${pose}_sheet.png`);
    const classes = condor
      ? Object.keys(CONDOR_POSES).map((pose) => {
        const { n, dur } = CONDOR_POSES[pose];
        return `.s-${pose}{background-image:url('${condorSheet(pose)}');background-size:${n * DISP}px ${DISP}px;` +
          `animation:play${n} ${dur}s steps(${n}) infinite;}`;
      }).join('\n  ') +
        // Gliding: the level-wings frame of the wing beat, held still.
        `\n  .s-glide{background-image:url('${condorSheet('fly')}');background-size:${4 * DISP}px ${DISP}px;background-position-x:-${DISP}px;}`
      : states.map((s) => {
        const { n, dur } = SHEETS[s];
        return `.s-${s}{background-image:url('${sheet(s)}');background-size:${n * DISP}px ${DISP}px;` +
          `animation:play${n} ${dur}s steps(${n}) infinite;}`;
      }).join('\n  ') +
        // Eating: the first walk frame, standing still (it nibbles by squashing a pixel).
        `\n  .s-eat{background-image:url('${sheet('walk')}');background-size:${SHEETS.walk.n * DISP}px ${DISP}px;}`;

    const sizes = Array.from(new Set(states.map((s) => SHEETS[s].n).concat([4, 2])));
    const keyframes = sizes.map((n) =>
      `@keyframes play${n}{from{background-position-x:0;}to{background-position-x:-${n * DISP}px;}}`
    ).join('\n  ');

    const move = JSON.stringify({ walk: 1.2 * speed, run: 3.0 * speed });
    const name = (cfg.get<string>('name', '') || '').trim();
    const bubbles = cfg.get<boolean>('bubbles', true);
    const bgPref = cfg.get<string>('background', 'time');
    const sounds = cfg.get<boolean>('sounds', false);
    const world = JSON.stringify({
      weather: cfg.get<string>('weather', 'auto'),
      seasons: cfg.get<boolean>('seasons', true),
      hemisphere: cfg.get<string>('hemisphere', 'auto'),
      baby: !condor && cfg.get<boolean>('baby', true),
      fur: FURS[furName],
      kind: condor ? 'condor' : 'capybara',
      habitat: condor ? 'andes' : 'lake',
      heads: condor ? Object.assign({ glide: CONDOR_POSES.fly.head },
        ...Object.keys(CONDOR_POSES).map((p) => ({ [p]: CONDOR_POSES[p].head }))) : undefined,
      shadowW: condor ? 0.22 : 0.34,
    });
    const k = vscode.window.activeColorTheme.kind;
    const isDark = k === vscode.ColorThemeKind.Dark || k === vscode.ColorThemeKind.HighContrast;
    const mode = bgPref === 'auto' ? (isDark ? 'night' : 'scene') : bgPref;
    // The scene/night scenery is painted by pixelart.js; these are just fallbacks.
    let stageBg = '';
    if (mode === 'scene' || mode === 'time') {
      stageBg = 'background:#93cbf4;';
    } else if (mode === 'sunset') {
      stageBg = 'background:#e6765e;';
    } else if (mode === 'night') {
      stageBg = 'background:#0c1330;';
    } else if (mode === 'solid') {
      stageBg = 'background:var(--vscode-sideBar-background, #1e1e1e);';
    }
    // 'time' is resolved in the webview from the local clock (and switches live).
    const sceneMode = ['time', 'scene', 'sunset', 'night'].indexOf(mode) >= 0;
    const floorCss = sceneMode ? '#floor{display:none;}' : '';
    const esc = (t: string) =>
      t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const nonce = Array.from({ length: 32 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
        Math.floor(Math.random() * 62)
      ]).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; img-src ${webview.cspSource}; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
<style nonce="${nonce}">
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:100%; height:100%; background:transparent; overflow:hidden; }
  #stage { position:relative; width:100%; height:100%; min-height:96px; cursor:pointer; ${stageBg} }
  .pix { position:absolute; left:0; bottom:0; pointer-events:none; image-rendering:pixelated; }
  #scene { z-index:0; }
  #floor { position:absolute; left:0; right:0; bottom:0; height:2px; z-index:1;
    background:var(--vscode-editorIndentGuide-background, #ffffff22); }
  ${floorCss}
  #pet { position:absolute; bottom:4px; left:20px; width:${DISP}px; height:${DISP}px;
    z-index:2; cursor:grab; }
  #fx { z-index:3; }
  body.dragging, body.dragging #pet { cursor:grabbing; }
  #breath { width:100%; height:100%; transform-origin:bottom center; }
  /* Breathing grows exactly one art pixel, in hard steps (no smooth tweening). */
  #breath.breathing { animation:breathe 3.2s step-end infinite; }
  #sprite.chew { transform-origin:bottom center; transform:scaleY(${((DISP - PX) / DISP).toFixed(4)}); }
  @keyframes breathe { 0%{transform:scaleY(1);} 50%{transform:scaleY(${((DISP + PX) / DISP).toFixed(4)});} 100%{transform:scaleY(1);} }
  #sprite { width:100%; height:100%; background-repeat:no-repeat; image-rendering:pixelated; }
  /* Pixel speech bubble: square corners notched with box-shadows (8-bit border). */
  .bubble { position:absolute; z-index:4; margin-bottom:${BPX}px; padding:1px 6px; white-space:nowrap;
    font-family:var(--vscode-editor-font-family, monospace); font-size:11px; font-weight:bold;
    pointer-events:none; --bd:var(--vscode-editorHoverWidget-border, #454545);
    background:var(--vscode-editorHoverWidget-background, #252526);
    color:var(--vscode-editorHoverWidget-foreground, #dddddd);
    box-shadow:0 -${BPX}px 0 0 var(--bd), 0 ${BPX}px 0 0 var(--bd), -${BPX}px 0 0 0 var(--bd), ${BPX}px 0 0 0 var(--bd);
    animation:bubblePop 1.6s steps(2, end) forwards; }
  .bubble::after { content:''; position:absolute; left:50%; bottom:-${BPX * 2}px;
    width:${BPX}px; height:${BPX}px; background:var(--bd); }
  @keyframes bubblePop {
    0%{opacity:0;transform:translateX(-50%) translateY(${BPX * 2}px);}
    12%{opacity:1;transform:translateX(-50%) translateY(0);}
    82%{opacity:1;transform:translateX(-50%) translateY(0);}
    100%{opacity:0;transform:translateX(-50%) translateY(-${BPX * 2}px);} }
  body.paused #sprite { animation-play-state:paused; }
  @media (prefers-reduced-motion: reduce) { #sprite, .bubble { animation:none !important; } }
  ${classes}
  ${keyframes}
</style>
</head>
<body>
<div id="stage">
  <div id="pet" title="${esc(name)}"><div id="breath"><div id="sprite" class="s-${condor ? 'glide' : 'walk'}"></div></div></div>
  <div id="floor"></div>
</div>
<script nonce="${nonce}" src="${this.uri(webview, 'pixelart.js')}"></script>
${sounds ? `<script nonce="${nonce}" src="${this.uri(webview, 'chiptune.js')}"></script>` : ''}
<script nonce="${nonce}">
  const MOVE = ${move};
  const TICK = ${TICK};
  const COFFEE_AFTER = ${coffeeAfter};   // inactivity ticks -> coffee break
  const SLEEP_AFTER = ${sleepAfter};   // inactivity ticks -> falls asleep
  const PET = ${DISP};
  const BUBBLES = ${bubbles};
  const PETS = ['hi!', 'hee!', '♥'];
  const PX = ${PX};   // art pixel: the pet snaps to this grid, like the scenery
  const KIND = '${condor ? 'condor' : 'capybara'}';
  const SPEED = ${speed};
  const SOUNDS = ${sounds};
  const sfx = (n) => { if (SOUNDS && window.Chiptune) { window.Chiptune.play(n); } };

  const vscodeApi = acquireVsCodeApi();
  const pet = document.getElementById('pet');
  const breath = document.getElementById('breath');
  const sprite = document.getElementById('sprite');
  const stage = document.getElementById('stage');
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const snap = (v) => Math.round(v / PX) * PX;
  const pix = window.PixelArt.create({
    stage, px: PX, pet: PET, grid: ${GRID}, base: 4, feet: ${FEET},
    mode: '${sceneMode ? mode : 'none'}', reduced: REDUCED, ...${world},
    onWorld: (w) => vscodeApi.postMessage({ type: 'world', w: w }),
    sfx: sfx,
  });

  let x = 20, dir = 1;
  let inactivity = 0, runFor = 0, celebrateFor = 0, scaredFor = 0, jumpFor = 0, typeRate = 0;
  let lastState = '', frameN = 0, lastP = null;

  // Swimming: when a break starts it sometimes heads for the lake instead of its
  // coffee (once per break); any editor activity brings it back out, dripping.
  const SWIM_CHANCE = 0.45;
  let swim = null, rolledSwim = false, shakeFor = 0;
  const clicks = []; // recent clicks, for the mandarin easter egg

  // Feeding: a watermelon slice drops in front of it, it walks over and eats it.
  let meal = null;

  // Idle micro-behaviour (no new sprites): while strolling it occasionally stops
  // for a moment, sometimes looking the other way; it "breathes" while standing.
  let pauseFor = 0, look = 0, walkTimer = randWalk();
  let dragging = false, moved = false; // drag-to-move state
  function randWalk() { return 180 + Math.floor(Math.random() * 260); } // ticks between pauses
  function randPause() { return 24 + Math.floor(Math.random() * 46); }  // ticks standing still

  function active() { inactivity = 0; rolledSwim = false; }

  function goSwim() {
    const lake = pix.lake();
    if (!lake || REDUCED || swim || meal || dragging) { return false; }
    // Walk to a spot in front of the water, near where it already is.
    const target = Math.min(lake.to, Math.max(lake.from, x + (Math.random() - 0.5) * PET));
    swim = { phase: 'go', target: target, left: 0 };
    return true;
  }

  function leaveWater() {
    if (!swim) { return; }
    if (swim.phase === 'in') {
      const out = pix.swimEnd();
      if (out) {
        x = Math.min(Math.max(0, stage.clientWidth - PET), Math.max(0, out.x));
        dir = out.face > 0 ? 1 : -1;
      }
      pet.style.visibility = '';
      shakeFor = 14; // shakes the water off
    }
    swim = null;
  }

  const inWater = () => !!swim && swim.phase === 'in';

  function goFeed() {
    leaveWater();
    stopMeal();
    const w = stage.clientWidth, cx = x + PET / 2;
    let side = dir, fx = cx + side * PET * 0.9; // in front of it, or behind if there's no room
    if (fx < PET * 0.2 || fx > w - PET * 0.2) { side = -side; fx = cx + side * PET * 0.9; }
    fx = Math.min(w - 8, Math.max(8, fx));
    pix.dropFood(fx);
    // Stand with the mouth (col ~36 of 42 facing right) at the slice.
    const target = side > 0 ? fx - PET * 0.86 : fx - PET * 0.14;
    meal = { phase: 'wait', side: side, target: Math.min(Math.max(0, w - PET), Math.max(0, target)), t: 0 };
  }

  function stopMeal() {
    if (meal) { pix.dropFoodNow(); meal = null; }
  }

  function state() {
    if (celebrateFor > 0) return 'celebrate';
    if (scaredFor > 0) return 'scared';
    if (jumpFor > 0) return 'jump';
    if (runFor > 0) return 'run';
    if (meal) return meal.phase === 'eat' ? 'eat' : 'walk';
    if (swim) return inWater() ? 'swim' : 'walk';
    if (inactivity > SLEEP_AFTER) return 'sleep';
    if (inactivity > COFFEE_AFTER) return 'coffee';
    return 'walk';
  }

  function tick() {
    inactivity++;
    if (runFor>0) runFor--; if (celebrateFor>0) celebrateFor--;
    if (scaredFor>0) scaredFor--; if (jumpFor>0) jumpFor--;
    if (typeRate > 0) { typeRate = Math.max(0, typeRate - 0.12); }
    if (shakeFor > 0) { shakeFor--; }
    const intensity = Math.min(1, typeRate / 8);
    if (meal) {
      if (meal.phase === 'wait' && pix.foodLanded()) { meal.phase = 'go'; }
      if (meal.phase === 'go') {
        const d = meal.target - x;
        if (Math.abs(d) <= 2 || REDUCED) { meal.phase = 'eat'; meal.t = 0; dir = meal.side; }
        else { dir = d > 0 ? 1 : -1; }
      } else if (meal.phase === 'eat' && ++meal.t % 12 === 0) {
        sfx('nom');
        if (pix.bite()) { meal = null; heart(); bubble('nom nom!'); }
      }
    }
    if (!rolledSwim && !swim && !meal && inactivity > COFFEE_AFTER) {
      rolledSwim = true;
      if (Math.random() < SWIM_CHANCE) { goSwim(); }
    }
    if (swim && swim.phase === 'go') {
      const d = swim.target - x;
      if (Math.abs(d) <= 2) {
        if (pix.swimStart({ x: snap(x), face: dir })) {
          swim.phase = 'in';
          swim.left = 220 + Math.floor(Math.random() * 200); // ~15-30 s in the water
          pet.style.visibility = 'hidden';
        } else { swim = null; }
      } else { dir = d > 0 ? 1 : -1; }
    } else if (inWater() && (!pix.swimming() || --swim.left <= 0)) {
      leaveWater();
    }
    const s = state();
    if (s !== lastState) {
      sprite.className = 's-' + s;
      lastState = s;
      vscodeApi.postMessage({ type: 'state', s: s });
      if (s === 'sleep') bubble('zzz');
      else if (s === 'coffee') bubble('☕');
    }

    // While strolling, take the occasional break (and maybe glance around).
    let standing = false;
    if (s === 'walk' && !REDUCED && !swim && !meal) {
      if (pauseFor > 0) { pauseFor--; standing = true; }
      else if (--walkTimer <= 0) {
        pauseFor = randPause(); walkTimer = randWalk(); standing = true;
        look = Math.random() < 0.6 ? pauseFor : 0;
      }
    } else { pauseFor = 0; look = 0; }
    if (look > 0) { look--; }

    const waiting = !!meal && meal.phase === 'wait'; // watches the slice fall
    let mv = (REDUCED || standing || waiting || dragging || inWater()) ? 0 : (MOVE[s] || 0);
    if (s === 'run' && mv > 0) { mv *= (1 + intensity); } // faster the faster you type
    if (meal && meal.phase === 'go') { mv *= 1.6; } // hurries to the watermelon
    if (mv > 0) {
      const max = Math.max(0, stage.clientWidth - PET);
      x += dir * mv;
      if (x >= max) { x = max; dir = -1; }
      if (x <= 0)   { x = 0;   dir = 1; }
    }
    const px = snap(x);
    pet.style.left = px + 'px';
    const face = (dir > 0 ? 1 : -1) * (look > 0 ? -1 : 1);
    // Scared: shiver sideways by one art pixel.
    frameN++;
    const shiver = (s === 'scared' || shakeFor > 0) && !REDUCED && !dragging && (frameN >> 1) % 2 ? PX : 0;
    pet.style.transform = 'translateX(' + shiver + 'px) scaleX(' + (face > 0 ? 1 : -1) + ')';

    // Breathe while calm and standing (paused stroll or coffee break).
    const calm = (s === 'walk' && standing) || s === 'coffee';
    breath.classList.toggle('breathing', calm && !REDUCED);
    sprite.classList.toggle('chew', s === 'eat' && !REDUCED && (frameN >> 2) % 2 === 0);

    // Scenery, shadow and particles follow the (snapped) pet.
    lastP = { x: px, face: face, state: s, moving: mv > 0 };
    pix.frame(lastP);
  }

  // ------------------------------------------------------------- the condor
  // It soars in slow circles (thermals) over the Andes and flaps when it climbs or
  // when you type; on a break it flies to its rock to sunbathe, then sleeps there;
  // it spreads its wings to celebrate, shoots up when scared, now and then lands on
  // the ground for a few hops, and can be dragged anywhere.
  const C = { mode: 'air', alt: -1, theta: 0, cx: -1, pose: 'glide', flap: 0, ground: 0, takeoff: 0 };
  // Taking off: wings open and a push upwards for a moment, then flapping.
  function takeOff() { C.mode = 'air'; C.flap = 18; C.takeoff = 6; }
  const FEET_OFF = ${FEET} - 4;           // feet above the cell's bottom edge
  const maxAlt = () => Math.max(0, stage.clientHeight - PET - 6);

  function condorTick() {
    inactivity++;
    if (runFor>0) runFor--; if (celebrateFor>0) celebrateFor--;
    if (scaredFor>0) scaredFor--; if (jumpFor>0) jumpFor--;
    if (shakeFor > 0) { shakeFor--; }
    const W = stage.clientWidth, perch = pix.perch();
    if (C.cx < 0) { C.cx = W / 2; C.alt = maxAlt() * 0.6; x = W / 2 - PET / 2; }
    const s = state();
    if (s !== lastState) {
      lastState = s;
      vscodeApi.postMessage({ type: 'state', s: s });
      if (s === 'sleep') bubble('zzz');
      else if (s === 'coffee') bubble('☀️');
    }
    let pose = 'glide', moving = false;
    const busy = s === 'run' || s === 'jump' || inactivity < 2;
    const rest = (s === 'coffee' || s === 'sleep') && !!perch && !REDUCED;
    if (dragging) {
      pose = C.alt > 6 ? 'fly' : 'perch';
    } else if (C.mode === 'perched' || C.mode === 'ground') {
      if (C.mode === 'ground' && --C.ground <= 0) { takeOff(); }
      if (C.mode === 'perched' && !rest && s !== 'celebrate' && s !== 'scared') { takeOff(); }
      if (C.mode === 'ground' && busy) { takeOff(); }
      if (C.mode === 'ground' && C.mode !== 'air') { // a few clumsy hops now and then
        if ((C.ground >> 4) % 3 === 0 && !REDUCED) { x += dir * 0.7 * SPEED; moving = true; }
        if (x < 4 || x > W - PET - 4) { dir = -dir; }
      }
      pose = C.mode === 'air' ? 'spread' // just took off: wings open
        : s === 'sleep' ? 'sleep' : s === 'coffee' ? 'sunbathe' : s === 'celebrate' ? 'spread'
        : s === 'scared' ? 'scared' : moving ? 'hop' : 'perch';
    } else if (rest) { // fly to the rock and land on it
      const tx = perch.x - PET / 2, ta = perch.bottom - 4 - FEET_OFF;
      const dx = tx - x, da = ta - C.alt, d = Math.hypot(dx, da);
      const flare = d < 26 && !REDUCED, v = (flare ? 1.4 : 2.6) * SPEED; // brakes with open wings
      if (d <= v) { x = tx; C.alt = ta; C.mode = 'perched'; pose = 'perch'; }
      else {
        x += dx / d * v; C.alt += da / d * v; dir = dx >= 0 ? 1 : -1; moving = true;
        pose = flare ? 'spread' : da > 1 ? 'fly' : 'glide';
      }
    } else { // soaring in a thermal that drifts across the sky
      const fast = s === 'run', rx = Math.min(W * 0.32, 170), ry = Math.max(5, maxAlt() * 0.12);
      C.theta += (fast ? 0.05 : 0.02) * SPEED;
      C.cx += (W / 2 - C.cx) * 0.003 + Math.sin(C.theta * 0.11) * 0.4;
      const tx = C.cx + Math.cos(C.theta) * rx - PET / 2;
      let ta = maxAlt() * (fast ? 0.42 : s === 'scared' ? 0.95 : 0.62) + Math.sin(C.theta) * ry;
      if (s === 'jump') { ta -= 8; }
      const nx = REDUCED ? x : x + (tx - x) * 0.08;
      const na = REDUCED ? C.alt : C.alt + (ta - C.alt) * (s === 'scared' ? 0.18 : 0.06);
      if (Math.abs(nx - x) > 0.05) { dir = nx > x ? 1 : -1; moving = true; }
      const climbing = na - C.alt > 0.35;
      x = nx; C.alt = na;
      if (C.takeoff > 0) { C.takeoff--; C.alt += 1.6 * SPEED; }
      if (C.flap > 0) { C.flap--; }
      else if (climbing && Math.random() < 0.04) { C.flap = 12 + Math.floor(Math.random() * 14); }
      pose = C.takeoff > 0 ? 'spread' : fast || s === 'scared' || s === 'jump' || s === 'celebrate' || C.flap > 0 ? 'fly' : 'glide';
      // Once in a while it comes down to the ground for a few hops.
      if (!fast && s === 'walk' && !REDUCED && Math.random() < 1 / 1400) { C.mode = 'landing'; }
    }
    if (C.mode === 'landing' && !dragging) {
      C.alt = Math.max(0, C.alt - (C.alt < 20 ? 0.9 : 1.6) * SPEED);
      pose = C.alt < 20 ? 'spread' : 'glide'; // flares its wings just before touching down
      if (C.alt <= 0) {
        C.mode = 'ground'; C.ground = 140 + Math.floor(Math.random() * 120);
        if (lastP) { pix.puff(lastP); } // a puff of dust as it lands
      }
      if (busy) { takeOff(); }
    }
    x = Math.min(Math.max(x, -PET * 0.15), W - PET * 0.85);
    C.alt = Math.min(Math.max(C.alt, 0), Math.max(maxAlt(), perch ? perch.bottom : 0));
    const px = snap(x), bottom = 4 + snap(C.alt);
    pet.style.left = px + 'px';
    pet.style.bottom = bottom + 'px';
    frameN++;
    const shiver = (pose === 'scared' || shakeFor > 0) && !REDUCED && (frameN >> 1) % 2 ? PX : 0;
    pet.style.transform = 'translateX(' + shiver + 'px) scaleX(' + (dir > 0 ? 1 : -1) + ')';
    if (pose !== C.pose) { sprite.className = 's-' + pose; C.pose = pose; }
    lastP = {
      x: px, face: dir, state: s, moving: moving, pose: pose, bottom: bottom, alt: C.alt,
      shadowAt: C.mode === 'perched' ? bottom : 4, // on the rock, or on the ground far below
    };
    pix.frame(lastP);
  }

  let timer = null;
  function start() { if (!timer) { timer = setInterval(KIND === 'condor' ? condorTick : tick, TICK); } }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  start();

  // Click the pet: a little hop and a pixel heart floating up.
  function heart() { pix.heart(lastP || { x: snap(x), face: dir }); }

  // Small speech bubble above the pet (one at a time).
  let curBubble = null;
  function bubble(text) {
    if (!BUBBLES) { return; }
    if (curBubble) { curBubble.remove(); }
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text;
    const sw = inWater() ? pix.swimmerAt() : null; // above the swimmer, if in the lake
    b.style.left = (sw ? sw.cx : snap(x + PET / 2)) + 'px';
    const up = KIND === 'condor' && lastP ? lastP.bottom - 4 - PET * 0.12 : 0; // above the bird, wherever it flies
    b.style.bottom = (sw ? sw.top + 6 : 8 + PET + up) + 'px';
    stage.appendChild(b);
    curBubble = b;
    setTimeout(() => { if (b === curBubble) { curBubble = null; } b.remove(); }, 1600);
  }

  // Click anywhere in the panel to pet the capybara (ignored right after a drag).
  // Five quick clicks: a mandarin on its head.
  stage.addEventListener('click', () => {
    if (moved) { moved = false; return; }
    active();
    const now = Date.now();
    clicks.push(now);
    while (clicks.length && now - clicks[0] > 3000) { clicks.shift(); }
    const yuzu = clicks.length >= 5;
    if (yuzu) { clicks.length = 0; pix.orange(); } // a mandarin — or, for the condor, a chullo
    sfx(yuzu ? 'yuzu' : 'pet');
    if (!inWater()) {
      leaveWater(); // cancels a walk to the lake
      if (!yuzu) { jumpFor = 9; } // no hop, so the mandarin lands right away
    }
    heart();
    bubble(yuzu ? (KIND === 'condor' ? 'chullo!' : 'yuzu!') : PETS[Math.floor(Math.random() * PETS.length)]);
  });

  // Drag the capybara horizontally with the mouse.
  pet.addEventListener('mousedown', (e) => {
    dragging = true; moved = false; active();
    document.body.classList.add('dragging');
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) { return; }
    moved = true;
    const r = stage.getBoundingClientRect();
    const max = Math.max(0, stage.clientWidth - PET);
    x = Math.min(max, Math.max(0, e.clientX - r.left - PET / 2));
    pet.style.left = snap(x) + 'px';
    if (KIND === 'condor') {
      C.alt = Math.min(maxAlt(), Math.max(0, r.bottom - e.clientY - PET / 2));
      C.mode = 'air'; C.cx = x + PET / 2; C.theta = 0;
    }
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) { return; }
    dragging = false;
    document.body.classList.remove('dragging');
    if (KIND === 'condor' && C.alt < 8) { C.mode = 'ground'; C.alt = 0; C.ground = 160; if (lastP) { pix.puff(lastP); } }
  });

  window.addEventListener('message', (e) => {
    const m = e.data || {};
    // Pause/resume the loop when the view is hidden/shown (saves CPU).
    if (m.type === 'pause') { stop(); document.body.classList.add('paused'); return; }
    if (m.type === 'resume') { start(); document.body.classList.remove('paused'); return; }
    if (KIND === 'condor' && (m.type === 'swim' || m.type === 'feed')) { bubble('?'); return; }
    if (m.type === 'swim') { stopMeal(); if (!goSwim()) { bubble('?'); } return; }
    if (m.type === 'feed') { goFeed(); return; }
    if (m.type !== 'pet') { leaveWater(); stopMeal(); } // editor activity: out of the water / meal
    active();
    if (m.type === 'typing') { runFor = 38; typeRate = Math.min(10, typeRate + 1.5); }
    else if (m.type === 'celebrate') { celebrateFor = 26; bubble(m.text || 'yay!'); if (m.text) { sfx('fanfare'); } }
    else if (m.type === 'scared') { scaredFor = 24; bubble(m.text || 'uh-oh'); if (m.text) { sfx('oops'); } }
    else if (m.type === 'jump') { jumpFor = 9; if (m.text) { bubble(m.text); } }
    else if (m.type === 'pet') {
      if (!swim) { jumpFor = 9; }
      heart(); sfx('pet');
      bubble(PETS[Math.floor(Math.random() * PETS.length)]);
    }
  });
</script>
</body>
</html>`;
  }
}

const MOOD: { [s: string]: string } = {
  walk: '🚶', run: '🏃', jump: '🦘', celebrate: '🎉', scared: '😱', coffee: '☕', sleep: '😴', swim: '🏊', eat: '🍉',
};
// The condor's moods: soaring, flapping, sunbathing on its rock…
const CONDOR_MOOD: { [s: string]: string } = {
  walk: '🪶', run: '💨', jump: '💨', celebrate: '🎉', scared: '😱', coffee: '☀️', sleep: '😴',
};

export function activate(context: vscode.ExtensionContext) {
  const provider = new CapibaraViewProvider(context.extensionUri);

  // Status bar item that mirrors the pet's current mood (click to focus the view).
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'capibaraPet.show';
  context.subscriptions.push(statusBar);

  let lastMood = 'walk', worldTip = '';
  const updateStatusBar = (s: string) => {
    lastMood = s;
    const c = vscode.workspace.getConfiguration('capibaraPet');
    if (!c.get<boolean>('enabled', true) || !c.get<boolean>('statusBar', true)) {
      statusBar.hide();
      return;
    }
    const name = (c.get<string>('name', '') || '').trim();
    const condor = c.get<string>('pet', 'capybara') === 'condor';
    statusBar.text = condor ? `🦅 ${CONDOR_MOOD[s] || '🪶'}` : `🦫 ${MOOD[s] || '🚶'}`;
    statusBar.tooltip = `${name || (condor ? 'Condor' : 'Capibara Pet')} — ${s}${worldTip}`;
    statusBar.show();
  };
  provider.onState = updateStatusBar;
  // The tooltip also tells the weather and season of the pet's little world.
  provider.onWorld = (w) => {
    const sky: { [k: string]: string } = { clear: w.mode === 'night' ? '🌙' : '☀️', cloudy: '☁️', rain: '🌧️', storm: '⛈️', fog: '🌫️', snow: '❄️' };
    const season: { [k: string]: string } = { spring: '🌸', summer: '🌿', autumn: '🍂', winter: '⛄' };
    const holiday: { [k: string]: string } = { halloween: ' 🎃', christmas: ' 🎄', newyear: ' 🎆' };
    worldTip = w.mode === 'none' ? '' :
      ` · ${sky[w.weather] || ''} ${w.weather} · ${season[w.season] || ''} ${w.season}${holiday[w.holiday] || ''}`;
    updateStatusBar(lastMood);
  };
  updateStatusBar(lastMood);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CapibaraViewProvider.viewId,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.commands.registerCommand('capibaraPet.show', () =>
      vscode.commands.executeCommand('capibaraPet.view.focus')),
    vscode.commands.registerCommand('capibaraPet.pet', async () => {
      // Make sure the view is visible so the pet always reacts.
      await vscode.commands.executeCommand('capibaraPet.view.focus');
      provider.notify('pet');
    }),
    vscode.commands.registerCommand('capibaraPet.swim', async () => {
      await vscode.commands.executeCommand('capibaraPet.view.focus');
      provider.notify('swim');
    }),
    vscode.commands.registerCommand('capibaraPet.feed', async () => {
      await vscode.commands.executeCommand('capibaraPet.view.focus');
      provider.notify('feed');
    }),
    vscode.commands.registerCommand('capibaraPet.toggle', async () => {
      const c = vscode.workspace.getConfiguration('capibaraPet');
      await c.update('enabled', !c.get<boolean>('enabled', true), vscode.ConfigurationTarget.Global);
    })
  );

  let lastLine = -1;
  let hadErrors = false;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(() => provider.notify('typing')),
    vscode.workspace.onDidSaveTextDocument(() => provider.notify('celebrate')),
    vscode.window.onDidChangeTextEditorSelection((e) => {
      const line = e.selections[0]?.active.line ?? -1;
      if (line !== lastLine) { lastLine = line; provider.notify('jump'); }
      else { provider.notify('poke'); }
    }),
    vscode.languages.onDidChangeDiagnostics(() => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) { return; }
      const hasErrors = vscode.languages
        .getDiagnostics(ed.document.uri)
        .some((d) => d.severity === vscode.DiagnosticSeverity.Error);
      // Only react when we just *entered* an error state (avoids constant spam).
      const react = vscode.workspace.getConfiguration('capibaraPet').get<boolean>('reactToErrors', true);
      if (react && hasErrors && !hadErrors) { provider.notify('scared'); }
      hadErrors = hasErrors;
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('capibaraPet')) { provider.refresh(); updateStatusBar(lastMood); }
    }),
    vscode.window.onDidChangeActiveColorTheme(() => provider.refresh()),
    vscode.debug.onDidStartDebugSession(() => {
      if (vscode.workspace.getConfiguration('capibaraPet').get<boolean>('reactToDebug', true)) {
        provider.notify('celebrate');
      }
    })
  );

  // Git (commit, push, conflicts, branches) and build/test results.
  const notify = (type: string, text?: string) => provider.notify(type, text);
  watchTasks(notify, context.subscriptions);
  void watchGit(notify, context.subscriptions);
}

export function deactivate() {}
