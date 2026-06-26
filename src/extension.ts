import * as vscode from 'vscode';

// Capibara Pet — a mascot living in a docked panel (webview).
// Spritesheet animation with CSS steps() (flicker-free). Drag the panel to the
// secondary side bar to pin it in a corner.
// States:
//   walk      strolls around (default)
//   run       runs while you type
//   jump      hops when you change line
//   celebrate cheers when you save
//   scared    gets scared if the file has errors
//   coffee    sips coffee during medium pauses
//   sleep     sleeps after a long pause (the sprite already carries 💤)

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

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    view.webview.html = this.html(view.webview);
  }

  notify(type: string) {
    this.view?.webview.postMessage({ type });
  }

  private uri(webview: vscode.Webview, name: string): string {
    return webview
      .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', name + '.png'))
      .toString();
  }

  private html(webview: vscode.Webview): string {
    const DISP = 84;
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

    const move = JSON.stringify({ walk: 1.2, run: 3.0 });

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
  #stage { position:relative; width:100%; height:100%; min-height:96px; }
  #floor { position:absolute; left:0; right:0; bottom:0; height:2px;
    background:var(--vscode-editorIndentGuide-background, #ffffff22); }
  #pet { position:absolute; bottom:4px; left:20px; width:${DISP}px; height:${DISP}px;
    transition:transform .08s linear; }
  #sprite { width:100%; height:100%; background-repeat:no-repeat;
    image-rendering:pixelated; filter:drop-shadow(0 3px 2px rgba(0,0,0,.25)); }
  ${classes}
  ${keyframes}
</style>
</head>
<body>
<div id="stage">
  <div id="pet"><div id="sprite" class="s-walk"></div></div>
  <div id="floor"></div>
</div>
<script nonce="${nonce}">
  const MOVE = ${move};
  const TICK = 70;
  const COFFEE_AFTER = 90;   // ~6 s -> coffee break
  const SLEEP_AFTER = 210;   // ~15 s -> falls asleep
  const PET = ${DISP};

  const pet = document.getElementById('pet');
  const sprite = document.getElementById('sprite');
  const stage = document.getElementById('stage');

  let x = 20, dir = 1;
  let inactivity = 0, runFor = 0, celebrateFor = 0, scaredFor = 0, jumpFor = 0;
  let lastState = '';

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
    const s = state();
    if (s !== lastState) { sprite.className = 's-' + s; lastState = s; }

    const mv = MOVE[s] || 0;
    if (mv > 0) {
      const max = Math.max(0, stage.clientWidth - PET);
      x += dir * mv;
      if (x >= max) { x = max; dir = -1; }
      if (x <= 0)   { x = 0;   dir = 1; }
    }
    pet.style.left = x + 'px';
    pet.style.transform = dir > 0 ? 'scaleX(1)' : 'scaleX(-1)';
  }
  setInterval(tick, TICK);

  window.addEventListener('message', (e) => {
    const m = e.data || {};
    inactivity = 0;
    if (m.type === 'typing') runFor = 38;
    else if (m.type === 'celebrate') celebrateFor = 26;
    else if (m.type === 'scared') scaredFor = 24;
    else if (m.type === 'jump') jumpFor = 9;
  });
</script>
</body>
</html>`;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new CapibaraViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CapibaraViewProvider.viewId,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  let lastLine = -1;
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
      const errs = vscode.languages
        .getDiagnostics(ed.document.uri)
        .filter((d) => d.severity === vscode.DiagnosticSeverity.Error);
      if (errs.length > 0) { provider.notify('scared'); }
    })
  );
}

export function deactivate() {}
