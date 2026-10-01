import * as vscode from 'vscode';

// Reactions to what happens around the code (not just in the editor):
//   Git    commit / push -> celebrate, merge conflict -> scared, branch switch -> hop
//   Tasks  a build or test task (or such a command typed in the terminal) that
//          finishes -> celebrate when it passes, scared when it fails
// Each reaction carries a short text for the speech bubble.

export type Notify = (type: string, text?: string) => void;

const enabled = (key: string) =>
  vscode.workspace.getConfiguration('capibaraPet').get<boolean>(key, true);

// --- Git ---------------------------------------------------------------------

// The few bits of the built-in Git extension API (vscode.git, API v1) we use.
interface GitBranch { name?: string; commit?: string; upstream?: unknown; ahead?: number; }
interface GitRepository {
  state: { HEAD?: GitBranch; mergeChanges: unknown[]; onDidChange: vscode.Event<void>; };
  onDidCommit?: vscode.Event<void>; // newer VS Code versions only
}
interface GitAPI {
  repositories: GitRepository[];
  onDidOpenRepository: vscode.Event<GitRepository>;
}

export async function watchGit(notify: Notify, subs: vscode.Disposable[]) {
  const ext = vscode.extensions.getExtension<{ getAPI(v: 1): GitAPI }>('vscode.git');
  if (!ext) { return; }
  let api: GitAPI;
  try {
    api = (ext.isActive ? ext.exports : await ext.activate()).getAPI(1);
  } catch {
    return; // Git disabled or unavailable: just no Git reactions
  }

  const watch = (repo: GitRepository) => {
    const snap = () => {
      const h = repo.state.HEAD;
      return {
        commit: h?.commit, branch: h?.name, ahead: h?.ahead ?? 0,
        upstream: !!h?.upstream, conflicts: repo.state.mergeChanges.length,
      };
    };
    let prev = snap();
    const hasCommitEvent = typeof repo.onDidCommit === 'function';
    if (repo.onDidCommit) {
      subs.push(repo.onDidCommit(() => { if (enabled('reactToGit')) { notify('celebrate', 'commit!'); } }));
    }
    subs.push(repo.state.onDidChange(() => {
      const cur = snap();
      if (enabled('reactToGit')) {
        if (cur.conflicts > 0 && prev.conflicts === 0) {
          notify('scared', 'conflict!');
        } else if (cur.branch && prev.branch && cur.branch !== prev.branch) {
          notify('jump', cur.branch.length > 14 ? cur.branch.slice(0, 13) + '…' : cur.branch);
        } else if (cur.commit === prev.commit && prev.ahead > 0 && cur.ahead === 0 && cur.upstream) {
          notify('celebrate', 'pushed!');
        } else if (!hasCommitEvent && cur.commit !== prev.commit && cur.ahead > prev.ahead) {
          notify('celebrate', 'commit!'); // older VS Code: infer the commit from HEAD
        }
      }
      prev = cur;
    }));
  };

  api.repositories.forEach(watch);
  subs.push(api.onDidOpenRepository(watch));
}

// --- Tasks and terminal commands ---------------------------------------------

// Terminal commands worth a reaction: test runners and builds — judged by the
// program or its subcommand / script name, so `git commit -m "fix tests"` or
// `cd test` don't count. Script names may carry a suffix (`test:unit`, `build-prod`).
const TEST_NAME = /^(test|tests|spec|e2e|jest|vitest|mocha|ava|pytest|phpunit|pest|rspec|karma|playwright|cypress)([:\-_.].*)?$/;
const BUILD_NAME = /^(build|compile|tsc|webpack|rollup|esbuild|msbuild|package)([:\-_.].*)?$/;
// Programs whose first non-flag argument says what they do (`go test`, `npm run build`).
const RUNNERS = new Set(['npm', 'yarn', 'pnpm', 'bun', 'npx', 'pnpx', 'bunx', 'go', 'cargo', 'dotnet',
  'mvn', 'mvnw', 'gradle', 'gradlew', 'make', 'mix', 'swift', 'deno', 'vite', 'ng', 'nx', 'turbo']);

export function classifyCommand(cmd: string): string {
  const words = cmd.trim().split(/\s+/);
  let i = 0;
  while (i < words.length && /^\w+=/.test(words[i])) { i++; } // skip VAR=value prefixes
  let name = (words[i] || '').replace(/^.*[\\/]/, '').replace(/\.(exe|cmd|bat|sh)$/i, '').toLowerCase();
  const args = words.slice(i + 1).filter((w) => !w.startsWith('-'));
  if (RUNNERS.has(name)) {
    const runner = name;
    name = ((args[0] === 'run' || args[0] === 'run-script' ? args[1] : args[0]) || '').toLowerCase();
    if (runner === 'make' && !TEST_NAME.test(name)) { return 'build'; } // any make target builds
  } else if (/^py(thon)?3?$/.test(name) && words[i + 1] === '-m') {
    name = (words[i + 2] || '').toLowerCase(); // python -m pytest
  }
  return TEST_NAME.test(name) ? 'tests' : BUILD_NAME.test(name) ? 'build' : '';
}

function result(label: string, ok: boolean, notify: Notify) {
  notify(ok ? 'celebrate' : 'scared', `${label} ${ok ? '✓' : '✗'}`);
}

export function watchTasks(notify: Notify, subs: vscode.Disposable[]) {
  subs.push(vscode.tasks.onDidEndTaskProcess((e) => {
    if (e.exitCode === undefined || !enabled('reactToTasks')) { return; }
    const task = e.execution.task;
    if (task.isBackground) { return; } // watchers: their exit is not a result
    const label = task.group === vscode.TaskGroup.Test ? 'tests'
      : task.group === vscode.TaskGroup.Build ? 'build'
      : task.name.length > 12 ? task.name.slice(0, 11) + '…' : task.name;
    result(label, e.exitCode === 0, notify);
  }));

  // Commands typed in the integrated terminal (needs shell integration, VS Code 1.93+).
  if (typeof vscode.window.onDidEndTerminalShellExecution === 'function') {
    subs.push(vscode.window.onDidEndTerminalShellExecution((e) => {
      if (e.exitCode === undefined || !enabled('reactToTasks')) { return; }
      const label = classifyCommand(e.execution.commandLine.value);
      if (label) { result(label, e.exitCode === 0, notify); }
    }));
  }
}
