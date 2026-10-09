// Renders the extension's webview HTML outside VS Code (no build needed): the TypeScript
// source is transpiled in memory, `vscode` is stubbed with the given settings, and the
// result is a standalone page that loads the real media/ files.
'use strict';
const path = require('path');
const fs = require('fs');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const ts = require(path.join(ROOT, 'node_modules', 'typescript'));

let compiled = null;
function extensionModule(vscode) {
  const origLoad = Module._load;
  Module._load = function (req, ...rest) {
    if (req === 'vscode') { return vscode; }
    if (req === './reactions') { return { watchGit() {}, watchTasks() {} }; }
    return origLoad.call(this, req, ...rest);
  };
  try {
    if (!compiled) {
      const src = fs.readFileSync(path.join(ROOT, 'src', 'extension.ts'), 'utf8');
      compiled = ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      }).outputText;
    }
    const m = new Module('extension');
    m.paths = Module._nodeModulePaths(ROOT);
    m._compile(compiled, path.join(ROOT, 'src', 'extension.js'));
    return m.exports;
  } finally {
    Module._load = origLoad;
  }
}

/**
 * @param {object} settings  capibaraPet.* values (e.g. { pet: 'condor', background: 'night' })
 * @param {string} [extraHead] HTML injected at the start of <head> (e.g. a Date override)
 * @param {string} [extraBody] HTML injected before </body> (test scripts)
 * @returns {string} the page
 */
function renderHtml(settings, extraHead = '', extraBody = '') {
  const vscode = {
    Uri: { joinPath: (b, ...p) => ({ p: path.join(b.p, ...p) }) },
    workspace: {
      getConfiguration: () => ({ get: (k, d) => (k in settings ? settings[k] : d) }),
      onDidChangeTextDocument: () => ({}), onDidSaveTextDocument: () => ({}), onDidChangeConfiguration: () => ({}),
    },
    window: {
      activeColorTheme: { kind: 2 },
      createStatusBarItem: () => ({ show() {}, hide() {} }),
      onDidChangeTextEditorSelection: () => ({}), onDidChangeActiveColorTheme: () => ({}),
      registerWebviewViewProvider: (id, p) => { provider = p; return {}; },
    },
    ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3 },
    StatusBarAlignment: {},
    commands: { registerCommand: () => ({}), executeCommand() {} },
    languages: { onDidChangeDiagnostics: () => ({}) },
    debug: { onDidStartDebugSession: () => ({}) },
    ConfigurationTarget: { Global: 1 },
  };
  let provider = null;
  extensionModule(vscode).activate({ extensionUri: { p: ROOT }, subscriptions: [] });
  const view = {
    webview: {
      cspSource: 'file:',
      asWebviewUri: (u) => 'file:///' + u.p.replace(/\\/g, '/'),
      onDidReceiveMessage() {},
    },
    onDidChangeVisibility() {},
  };
  provider.resolveWebviewView(view);
  const stub = '<script>window.acquireVsCodeApi=()=>({postMessage(){}});</script>';
  return view.webview.html
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/s, '') // file:// test pages
    .replace('<head>', '<head>' + stub + extraHead)
    .replace('</body>', extraBody + '</body>');
}

// A headless Chromium-based browser to run the pages in.
function findBrowser() {
  if (process.env.CHROME_PATH) { return process.env.CHROME_PATH; }
  const candidates = process.platform === 'win32' ? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ] : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return candidates.find((c) => fs.existsSync(c)) || null;
}

module.exports = { ROOT, renderHtml, findBrowser };
