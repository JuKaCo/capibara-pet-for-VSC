import * as vscode from 'vscode';

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
//   sleep     sleeps after a long pause (the sprite already carries 💤)
// Click the capybara -> it hops and a heart floats up. The animation pauses when
// the view is hidden, and it respects the user's prefers-reduced-motion setting.
// The webview reports its mood back so a status bar item can mirror it; speech
// bubbles, the pet's name, and typing-intensity speed are all configurable.

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
    });
  }

  notify(type: string) {
    this.view?.webview.postMessage({ type });
  }

  // Rebuild the webview when settings change so size/speed/timings apply live.
  refresh() {
    if (this.view) { this.view.webview.html = this.html(this.view.webview); }
  }

  private uri(webview: vscode.Webview, name: string): string {
    return webview
      .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', name + '.png'))
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
    const coffeeAfter = Math.round(clamp(cfg.get<number>('coffeeAfterSeconds', 6), 1, 600) * 1000 / TICK);
    const sleepAfter = Math.round(clamp(cfg.get<number>('sleepAfterSeconds', 15), 2, 3600) * 1000 / TICK);
    const states = Object.keys(SHEETS);

    const classes = states.map((s) => {
      const { n, dur } = SHEETS[s];
      const url = this.uri(webview, s + '_sheet');
      return `.s-${s}{background-image:url('${url}');background-size:${n * DISP}px ${DISP}px;` +
        `animation:play${n} ${dur}s steps(${n}) infinite;}`;
    }).join('\n  ');

    const sizes = Array.from(new Set(states.map((s) => SHEETS[s].n)));
    const keyframes = sizes.map((n) =>
      `@keyframes play${n}{from{background-position-x:0;}to{background-position-x:-${n * DISP}px;}}`
    ).join('\n  ');

    const move = JSON.stringify({ walk: 1.2 * speed, run: 3.0 * speed });
    const name = (cfg.get<string>('name', '') || '').trim();
    const bubbles = cfg.get<boolean>('bubbles', true);
    const bgPref = cfg.get<string>('background', 'scene');
    const k = vscode.window.activeColorTheme.kind;
    const isDark = k === vscode.ColorThemeKind.Dark || k === vscode.ColorThemeKind.HighContrast;
    const mode = bgPref === 'auto' ? (isDark ? 'night' : 'scene') : bgPref;
    let stageBg = '';
    if (mode === 'scene') {
      stageBg = 'background:linear-gradient(180deg,#cfeaff 0%,#eaf6ff 58%,#bcdd92 58%,#a3cf73 100%);';
    } else if (mode === 'night') {
      stageBg = 'background:' +
        'radial-gradient(1.5px 1.5px at 18% 16%, #ffffffcc, transparent),' +
        'radial-gradient(1.5px 1.5px at 52% 10%, #ffffffaa, transparent),' +
        'radial-gradient(1.5px 1.5px at 78% 22%, #ffffff99, transparent),' +
        'linear-gradient(180deg,#0b1026 0%,#1c2747 58%,#243018 58%,#2e3a1e 100%);';
    } else if (mode === 'solid') {
      stageBg = 'background:var(--vscode-sideBar-background, #1e1e1e);';
    }
    const sceneMode = mode === 'scene' || mode === 'night';
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
  #floor { position:absolute; left:0; right:0; bottom:0; height:2px;
    background:var(--vscode-editorIndentGuide-background, #ffffff22); }
  ${floorCss}
  #pet { position:absolute; bottom:4px; left:20px; width:${DISP}px; height:${DISP}px;
    transition:transform .08s linear; cursor:grab; }
  body.dragging, body.dragging #pet { cursor:grabbing; }
  #breath { width:100%; height:100%; transform-origin:bottom center; }
  #breath.breathing { animation:breathe 3.2s ease-in-out infinite; }
  @keyframes breathe { 0%,100%{transform:scaleY(1);} 50%{transform:scaleY(1.035);} }
  #sprite { width:100%; height:100%; background-repeat:no-repeat;
    image-rendering:pixelated; filter:drop-shadow(0 3px 2px rgba(0,0,0,.25)); }
  .heart { position:absolute; font-size:18px; pointer-events:none;
    animation:floatUp .9s ease-out forwards; }
  @keyframes floatUp { from{opacity:1;transform:translateY(0);} to{opacity:0;transform:translateY(-40px);} }
  .bubble { position:absolute; padding:2px 7px; border-radius:9px; white-space:nowrap;
    font-family:var(--vscode-font-family); font-size:11px; pointer-events:none;
    background:var(--vscode-editorHoverWidget-background, #252526);
    color:var(--vscode-editorHoverWidget-foreground, #dddddd);
    border:1px solid var(--vscode-editorHoverWidget-border, #454545);
    animation:bubblePop 1.6s ease-out forwards; }
  @keyframes bubblePop {
    0%{opacity:0;transform:translateX(-50%) translateY(6px) scale(.8);}
    15%{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}
    80%{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}
    100%{opacity:0;transform:translateX(-50%) translateY(-6px) scale(1);} }
  body.paused #sprite { animation-play-state:paused; }
  @media (prefers-reduced-motion: reduce) { #sprite { animation:none !important; } }
  ${classes}
  ${keyframes}
</style>
</head>
<body>
<div id="stage">
  <div id="pet" title="${esc(name)}"><div id="breath"><div id="sprite" class="s-walk"></div></div></div>
  <div id="floor"></div>
</div>
<script nonce="${nonce}">
  const MOVE = ${move};
  const TICK = ${TICK};
  const COFFEE_AFTER = ${coffeeAfter};   // inactivity ticks -> coffee break
  const SLEEP_AFTER = ${sleepAfter};   // inactivity ticks -> falls asleep
  const PET = ${DISP};
  const BUBBLES = ${bubbles};
  const PETS = ['hi!', 'hee!', '♥'];

  const vscodeApi = acquireVsCodeApi();
  const pet = document.getElementById('pet');
  const breath = document.getElementById('breath');
  const sprite = document.getElementById('sprite');
  const stage = document.getElementById('stage');
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  let x = 20, dir = 1;
  let inactivity = 0, runFor = 0, celebrateFor = 0, scaredFor = 0, jumpFor = 0, typeRate = 0;
  let lastState = '';

  // Idle micro-behaviour (no new sprites): while strolling it occasionally stops
  // for a moment, sometimes looking the other way; it "breathes" while standing.
  let pauseFor = 0, look = 0, walkTimer = randWalk();
  let dragging = false, moved = false; // drag-to-move state
  function randWalk() { return 180 + Math.floor(Math.random() * 260); } // ticks between pauses
  function randPause() { return 24 + Math.floor(Math.random() * 46); }  // ticks standing still

  function state() {
    if (celebrateFor > 0) return 'celebrate';
    if (scaredFor > 0) return 'scared';
    if (jumpFor > 0) return 'jump';
    if (runFor > 0) return 'run';
    if (inactivity > SLEEP_AFTER) return 'sleep';
    if (inactivity > COFFEE_AFTER) return 'coffee';
    return 'walk';
  }

  function tick() {
    inactivity++;
    if (runFor>0) runFor--; if (celebrateFor>0) celebrateFor--;
    if (scaredFor>0) scaredFor--; if (jumpFor>0) jumpFor--;
    if (typeRate > 0) { typeRate = Math.max(0, typeRate - 0.12); }
    const intensity = Math.min(1, typeRate / 8);
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
    if (s === 'walk' && !REDUCED) {
      if (pauseFor > 0) { pauseFor--; standing = true; }
      else if (--walkTimer <= 0) {
        pauseFor = randPause(); walkTimer = randWalk(); standing = true;
        look = Math.random() < 0.6 ? pauseFor : 0;
      }
    } else { pauseFor = 0; look = 0; }
    if (look > 0) { look--; }

    let mv = (REDUCED || standing || dragging) ? 0 : (MOVE[s] || 0);
    if (s === 'run' && mv > 0) { mv *= (1 + intensity); } // faster the faster you type
    if (mv > 0) {
      const max = Math.max(0, stage.clientWidth - PET);
      x += dir * mv;
      if (x >= max) { x = max; dir = -1; }
      if (x <= 0)   { x = 0;   dir = 1; }
    }
    pet.style.left = x + 'px';
    const face = (dir > 0 ? 1 : -1) * (look > 0 ? -1 : 1);
    pet.style.transform = face > 0 ? 'scaleX(1)' : 'scaleX(-1)';

    // Breathe while calm and standing (paused stroll or coffee break).
    const calm = (s === 'walk' && standing) || s === 'coffee';
    breath.classList.toggle('breathing', calm && !REDUCED);
  }

  let timer = null;
  function start() { if (!timer) { timer = setInterval(tick, TICK); } }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  start();

  // Click the pet: a little hop and a heart floating up.
  function heart() {
    const h = document.createElement('div');
    h.className = 'heart';
    h.textContent = '❤️';
    h.style.left = (x + PET / 2 - 9) + 'px';
    h.style.bottom = (4 + PET) + 'px';
    stage.appendChild(h);
    setTimeout(() => h.remove(), 900);
  }

  // Small speech bubble above the pet (one at a time).
  let curBubble = null;
  function bubble(text) {
    if (!BUBBLES) { return; }
    if (curBubble) { curBubble.remove(); }
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text;
    b.style.left = (x + PET / 2) + 'px';
    b.style.bottom = (8 + PET) + 'px';
    stage.appendChild(b);
    curBubble = b;
    setTimeout(() => { if (b === curBubble) { curBubble = null; } b.remove(); }, 1600);
  }

  // Click anywhere in the panel to pet the capybara (ignored right after a drag).
  stage.addEventListener('click', () => {
    if (moved) { moved = false; return; }
    inactivity = 0; jumpFor = 9; heart();
    bubble(PETS[Math.floor(Math.random() * PETS.length)]);
  });

  // Drag the capybara horizontally with the mouse.
  pet.addEventListener('mousedown', (e) => {
    dragging = true; moved = false; inactivity = 0;
    document.body.classList.add('dragging');
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) { return; }
    moved = true;
    const r = stage.getBoundingClientRect();
    const max = Math.max(0, stage.clientWidth - PET);
    x = Math.min(max, Math.max(0, e.clientX - r.left - PET / 2));
    pet.style.left = x + 'px';
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) { return; }
    dragging = false;
    document.body.classList.remove('dragging');
  });

  window.addEventListener('message', (e) => {
    const m = e.data || {};
    // Pause/resume the loop when the view is hidden/shown (saves CPU).
    if (m.type === 'pause') { stop(); document.body.classList.add('paused'); return; }
    if (m.type === 'resume') { start(); document.body.classList.remove('paused'); return; }
    inactivity = 0;
    if (m.type === 'typing') { runFor = 38; typeRate = Math.min(10, typeRate + 1.5); }
    else if (m.type === 'celebrate') { celebrateFor = 26; bubble('yay!'); }
    else if (m.type === 'scared') { scaredFor = 24; bubble('uh-oh'); }
    else if (m.type === 'jump') jumpFor = 9;
    else if (m.type === 'pet') {
      jumpFor = 9; heart();
      bubble(PETS[Math.floor(Math.random() * PETS.length)]);
    }
  });
</script>
</body>
</html>`;
  }
}

const MOOD: { [s: string]: string } = {
  walk: '🚶', run: '🏃', jump: '🦘', celebrate: '🎉', scared: '😱', coffee: '☕', sleep: '😴',
};

export function activate(context: vscode.ExtensionContext) {
  const provider = new CapibaraViewProvider(context.extensionUri);

  // Status bar item that mirrors the pet's current mood (click to focus the view).
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'capibaraPet.show';
  context.subscriptions.push(statusBar);

  let lastMood = 'walk';
  const updateStatusBar = (s: string) => {
    lastMood = s;
    const c = vscode.workspace.getConfiguration('capibaraPet');
    if (!c.get<boolean>('enabled', true) || !c.get<boolean>('statusBar', true)) {
      statusBar.hide();
      return;
    }
    const name = (c.get<string>('name', '') || '').trim();
    statusBar.text = `🦫 ${MOOD[s] || '🚶'}`;
    statusBar.tooltip = `${name || 'Capibara Pet'} — ${s}`;
    statusBar.show();
  };
  provider.onState = updateStatusBar;
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
}

export function deactivate() {}
