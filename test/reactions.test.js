// Unit test for src/reactions.ts (Git and build/test reactions, the terminal command
// classifier), run against a fake `vscode` module — no build, no VS Code needed.
'use strict';
const repo = require('path').resolve(__dirname, '..');
const ts = require(repo + '/node_modules/typescript');
const fs = require('fs'), Module = require('module');

function emitter() {
  const ls = [];
  const ev = (f) => { ls.push(f); return { dispose() {} }; };
  ev.fire = (x) => ls.forEach((f) => f(x));
  return ev;
}
const cfg = { reactToGit: true, reactToTasks: true };
const taskEnd = emitter(), shellEnd = emitter();
const TaskGroup = { Build: { id: 'build' }, Test: { id: 'test' } };
const repoState = { HEAD: { name: 'main', commit: 'a1', ahead: 0, upstream: {} }, mergeChanges: [], onDidChange: emitter() };
const fakeRepo = { state: repoState, onDidCommit: emitter() };
const vscode = {
  workspace: { getConfiguration: () => ({ get: (k, d) => (k in cfg ? cfg[k] : d) }) },
  extensions: { getExtension: () => ({ isActive: true, exports: { getAPI: () => ({ repositories: [fakeRepo], onDidOpenRepository: emitter() }) } }) },
  tasks: { onDidEndTaskProcess: taskEnd },
  TaskGroup,
  window: { onDidEndTerminalShellExecution: shellEnd },
};
const orig = Module._load;
Module._load = function (r, ...a) { return r === 'vscode' ? vscode : orig.call(this, r, ...a); };
const js = ts.transpileModule(fs.readFileSync(repo + '/src/reactions.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = new Module('r'); m._compile(js, 'reactions.js');

let got = [], fails = 0;
const notify = (t, x) => got.push(t + (x ? ':' + x : ''));
const expect = (label, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; }
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`));
  got = [];
};

// --- command classifier
const C = m.exports.classifyCommand;
const cases = {
  'npm test': 'tests', 'npm run test:unit': 'tests', 'yarn build': 'build', 'pnpm run build-prod': 'build',
  'npx jest --watch=false': 'tests', 'npx vitest run': 'tests', 'go test ./...': 'tests', 'cargo build --release': 'build',
  'cargo test': 'tests', 'make': 'build', 'make test': 'tests', 'make install': 'build', 'pytest -q': 'tests',
  'python -m pytest tests/': 'tests', 'CI=1 npm test': 'tests', 'dotnet build': 'build', 'mvn package': 'build',
  './gradlew test': 'tests', 'tsc -p .': 'build', 'node_modules/.bin/tsc': 'build',
  'git commit -m "fix tests"': '', 'cd test': '', 'ls': '', 'npm install': '', 'npm run dev': '', 'echo build': '',
};
for (const [cmd, want] of Object.entries(cases)) {
  const r = C(cmd);
  if (r !== want) { fails++; console.log(`FAIL classify ${JSON.stringify(cmd)} -> ${JSON.stringify(r)} want ${JSON.stringify(want)}`); }
}
console.log('classifier: ' + Object.keys(cases).length + ' cases checked');

(async () => {
  const subs = [];
  m.exports.watchTasks(notify, subs);
  await m.exports.watchGit(notify, subs);

  // --- tasks
  taskEnd.fire({ exitCode: 0, execution: { task: { group: TaskGroup.Test, name: 'test', isBackground: false } } });
  expect('test task passes', ['celebrate:tests ✓']);
  taskEnd.fire({ exitCode: 2, execution: { task: { group: TaskGroup.Build, name: 'compile', isBackground: false } } });
  expect('build task fails', ['scared:build ✗']);
  taskEnd.fire({ exitCode: 1, execution: { task: { group: undefined, name: 'lint everything please', isBackground: false } } });
  expect('other task, long name', ['scared:lint everyt… ✗']);
  taskEnd.fire({ exitCode: 0, execution: { task: { group: TaskGroup.Build, name: 'watch', isBackground: true } } });
  expect('background task ignored', []);
  taskEnd.fire({ exitCode: undefined, execution: { task: { group: TaskGroup.Build, name: 'x', isBackground: false } } });
  expect('no exit code ignored', []);
  shellEnd.fire({ exitCode: 1, execution: { commandLine: { value: 'npm test' } } });
  expect('terminal npm test fails', ['scared:tests ✗']);
  shellEnd.fire({ exitCode: 0, execution: { commandLine: { value: 'git status' } } });
  expect('terminal git status ignored', []);
  cfg.reactToTasks = false;
  shellEnd.fire({ exitCode: 0, execution: { commandLine: { value: 'npm test' } } });
  expect('reactToTasks off', []);
  cfg.reactToTasks = true;

  // --- git
  const H = repoState.HEAD, change = () => repoState.onDidChange.fire();
  fakeRepo.onDidCommit.fire(); H.commit = 'b2'; H.ahead = 1; change();
  expect('commit (event)', ['celebrate:commit!']);
  H.ahead = 0; change();
  expect('push', ['celebrate:pushed!']);
  H.commit = 'c3'; change();
  expect('pull / fetch: no reaction', []);
  H.name = 'feature/very-long-branch-name'; change();
  expect('branch switch', ['jump:feature/very-…']);
  repoState.mergeChanges = [{}]; change();
  expect('merge conflict', ['scared:conflict!']);
  change();
  expect('conflict still there: no repeat', []);
  repoState.mergeChanges = []; change();
  expect('conflict resolved: quiet', []);
  cfg.reactToGit = false; fakeRepo.onDidCommit.fire();
  expect('reactToGit off', []);
  console.log(fails ? `\nreactions: ${fails} FAILED` : '\nreactions: all passed');
  process.exit(fails ? 1 : 0);
})();
