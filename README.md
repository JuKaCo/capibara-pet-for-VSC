# 🐾 Capibara Pet

[![Version](https://img.shields.io/visual-studio-marketplace/v/JuanCarlosCondori.capibara-pet?label=Marketplace&color=8a2be2)](https://marketplace.visualstudio.com/items?itemName=JuanCarlosCondori.capibara-pet)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/JuanCarlosCondori.capibara-pet?color=blue)](https://marketplace.visualstudio.com/items?itemName=JuanCarlosCondori.capibara-pet)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/JuanCarlosCondori.capibara-pet?color=gold)](https://marketplace.visualstudio.com/items?itemName=JuanCarlosCondori.capibara-pet&ssr=false#review-details)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A little capybara pet that lives in a panel inside your VS Code editor. It strolls around calmly, runs while you type, gets scared when there are errors, sips its coffee during short breaks, and falls asleep if you leave it alone for a while.

Animated with spritesheets and CSS — flicker-free and never in the way of your code.

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/demo.gif" alt="Capibara Pet in action" width="640">
</p>

## States

The capybara reacts to what you do:

| State | When it happens |
|-------|-----------------|
| 🚶 **Walk** | Default — strolling around the panel |
| 🏃 **Run** | While you type |
| 🦘 **Jump** | When you move to another line |
| 🎉 **Celebrate** | When you save a file, or start a debug session |
| 😱 **Scared** | When the file has errors |
| ☕ **Coffee** | After a medium pause (~6 s) |
| 😴 **Sleep** | After a long pause (~15 s) — with its 💤 |

## Getting started

1. Install the extension.
2. Open the **Explorer** (`Ctrl+Shift+E` / `Cmd+Shift+E`). At the bottom you'll find a **"Capibara"** section — expand it and the pet appears in its little box.
3. Want it somewhere else? Just **drag the "Capibara" section** to another spot — for example into the **Secondary Side Bar** (`Ctrl+Alt+B`) to keep it pinned in a corner. VS Code remembers the position.

## Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type "Capibara Pet":

| Command | What it does |
|---------|--------------|
| **Capibara Pet: Show the Capybara** | Reveals and focuses the pet's view. |
| **Capibara Pet: Pet the Capybara** | Give it some love — it hops with a ❤️. |
| **Capibara Pet: Show/Hide the Capybara** | Quickly toggle the pet on or off. |

> You can also **drag the capybara** left/right inside the panel with your mouse.

## Settings

Tweak the pet from **Settings** (`Ctrl+,` / `Cmd+,`) → search for "Capibara Pet". Changes apply live.

| Setting | Default | What it does |
|---------|:-------:|--------------|
| `capibaraPet.enabled` | `true` | Show the capybara. Turn off to hide it without uninstalling. |
| `capibaraPet.size` | `84` | Size of the capybara, in pixels (40–160). |
| `capibaraPet.speed` | `1` | Walk/run speed multiplier (0.25–3). |
| `capibaraPet.coffeeAfterSeconds` | `6` | Idle seconds before the coffee break. |
| `capibaraPet.sleepAfterSeconds` | `15` | Idle seconds before falling asleep. |
| `capibaraPet.reactToErrors` | `true` | Whether it gets scared when the file has errors. |
| `capibaraPet.reactToDebug` | `true` | Whether it celebrates when a debug session starts. |
| `capibaraPet.name` | `""` | Give your capybara a name (shown on hover and in the status bar). |
| `capibaraPet.bubbles` | `true` | Show small speech bubbles (saving, sleeping, petting…). |
| `capibaraPet.statusBar` | `true` | Show a status bar item that mirrors the current mood. |
| `capibaraPet.background` | `scene` | Panel backdrop: `scene` (day), `night`, `auto` (matches theme), `solid`, or `transparent`. |

> Tip: **click anywhere in the panel** to pet the capybara — it hops with a ❤️.
> The capybara also **runs faster the faster you type**.

## Install from the Marketplace

Search for **"Capibara Pet"** in the Extensions tab of VS Code, or install it from the command line:

```
code --install-extension JuanCarlosCondori.capibara-pet
```

## Notes

- No runtime dependencies and no configuration needed — it just works.
- The pet lives in a webview panel (VS Code does not allow floating overlays on top of the editor), with a transparent background so it blends with your theme.

## Credits

Made with care by Juan Carlos Condori. Pixel-art capybara sprites.

## License

MIT. See the LICENSE file included in the package.
