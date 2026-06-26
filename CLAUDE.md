# CLAUDE.md — Capibara Pet

Project context for AI assistants (Claude Code). Read it before working.

## What it is

A VS Code extension: an animated capybara mascot that lives in a docked **webview
panel**. It reacts to what the user does in the editor (typing, saving, errors,
pauses). Animated with **spritesheets + CSS `steps()`** (flicker-free) and without
getting in the way of the code.

- Name / id: `capibara-pet` · displayName: "Capibara Pet"
- Current version: `0.2.0`
- Author: Juan Carlos Condori
- License: MIT

## Goal (end objective)

**Publish the extension to the Visual Studio Code Marketplace.** The code and the
packaging are ready; what's missing is the user's account/credentials part.

Pending steps to publish:

1. Create the publisher at https://marketplace.visualstudio.com/manage
2. Replace `"publisher": "your-publisher-id"` in `package.json` with the real ID.
3. Generate a PAT in Azure DevOps (scope: Marketplace → Manage).
4. `npx @vscode/vsce login <publisher-id>` (paste the PAT).
5. `npx @vscode/vsce publish`

Note: Microsoft is retiring global PATs on 2026-12-01; for CI it's best to migrate to
Microsoft Entra ID. For manual publishing the PAT still works.

## Architecture

- `src/extension.ts` — ALL the code. A `WebviewViewProvider` (`CapibaraViewProvider`)
  registers the `capibaraPet.view` view (as a section inside the Explorer). It builds
  the webview's HTML/CSS/JS inline.
  The animation state machine runs in the webview's JS; the extension side only
  listens to editor events and sends messages (`postMessage`).
- `out/extension.js` — compiled output (TypeScript → CommonJS). This is what VS Code loads.
- `media/*_sheet.png` — per-state spritesheets (128px cells, transparent background,
  baseline-aligned). The JS animates them by moving `background-position` with `steps(n)`.
- `media/icon.png` — Marketplace icon (256×256).
- `media/pet-icon.svg` — view icon (used if the user drags it out of the Explorer).

## States and triggers

| State      | Sheet                | Frames | Triggered when…                           |
|------------|----------------------|:------:|-------------------------------------------|
| walk       | `walk_sheet.png`     | 4      | default (strolls, moves along X)          |
| run        | `run_sheet.png`      | 7      | typing (`onDidChangeTextDocument`)        |
| jump       | `jump_sheet.png`     | 2      | changing line (selection)                 |
| celebrate  | `celebrate_sheet.png`| 4      | saving (`onDidSaveTextDocument`)          |
| scared     | `scared_sheet.png`   | 2      | there are errors (`onDidChangeDiagnostics`)|
| coffee     | `coffee_sheet.png`   | 2      | medium pause (~6 s of inactivity)         |
| sleep      | `sleep_sheet.png`    | 2      | long pause (~15 s); the sprite carries 💤 |

State priority (in the JS `state()`): celebrate > scared > jump > run > sleep >
coffee > walk. The frame/speed config lives in the `SHEETS` object in
`src/extension.ts`. Only `walk` and `run` move (the `MOVE` object).

## Commands

```bash
npm run compile                       # compile TS -> out/
npm run watch                         # compile in watch mode
npx @vscode/vsce package --allow-missing-repository   # generates the .vsix
```

To test without publishing: in VS Code → "Extensions: Install from VSIX…" and pick
`capibara-pet-0.2.0.vsix`. Or open the project and press **F5** (Extension Host).

## How the sprites are generated (important)

The sprites are created with an image generator (Nano Banana / Gemini) and processed
with Python + Pillow. The source is a **master sheet** `master.png` (all states in a
single image, green background `#00B140`) — it lives in the user's `Downloads/tiras/`
folder, NOT in the repo.

Processing pipeline (when a new `master.png` arrives):
1. Chroma-key: remove the green to transparency (`greenness = g - max(r,b)`).
2. Segment into bands: rows by horizontal projection, frames by vertical projection.
3. Glued frames: split each cell into N parts (N = round(width/172)) and **snap each
   cut to the valley** of the column profile (so bodies aren't cut).
4. Normalize: single global scale, center and baseline-align in 128px cells.
5. Export `media/<state>_sheet.png`.

Current `master.png` layout (1408×768): row0=walk(4), row1=run(7, glued 2-3-2),
row2=sleep(2)+celebrate(4), row3=coffee(2)+scared(2)+jump(2).

If states are added/changed: update the pipeline, regenerate the sheets and update
the `SHEETS` object (frame count) in `src/extension.ts`.

## Conventions / notes

- Minimum engine: `vscode ^1.74.0`.
- No runtime dependencies; only devDeps (typescript, @types).
- Webview CSP with `nonce`; resources only from `media/` (`localResourceRoots`).
- Known limitation: VS Code does NOT allow fixed floating overlays on top of the
  editor; that's why the mascot lives in a webview panel (it can be dragged to the
  secondary side bar to keep it in a corner). Do not retry the "decoration" approach.
- `.vscodeignore` packages only what's needed (sheets + icon + out). It excludes `src/`
  and the `sprite-*.md` files.

## TODO / future ideas

- [ ] Publish to the Marketplace (see Goal).
- [ ] (Optional) Initialize git + add `"repository"` to package.json so the README and
      its links render fully on the Marketplace page.
- [x] Settings for size/speed/idle timings + reactToErrors (`contributes.configuration`,
      read in `html()`, live refresh via `onDidChangeConfiguration`).
- [x] Palette commands: `capibaraPet.show` (focus the view) and `capibaraPet.pet`
      (hop + ❤️ via a `pet` message to the webview).
