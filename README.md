# 🐾 Capibara Pet

[![Version](https://img.shields.io/visual-studio-marketplace/v/JuanCarlosCondori.capibara-pet?label=Marketplace&color=8a2be2)](https://marketplace.visualstudio.com/items?itemName=JuanCarlosCondori.capibara-pet)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/JuanCarlosCondori.capibara-pet?color=blue)](https://marketplace.visualstudio.com/items?itemName=JuanCarlosCondori.capibara-pet)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/JuanCarlosCondori.capibara-pet?color=gold)](https://marketplace.visualstudio.com/items?itemName=JuanCarlosCondori.capibara-pet&ssr=false#review-details)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A little capybara pet that lives in a panel inside your VS Code editor. It strolls around calmly, runs while you type, gets scared when there are errors, sips its coffee during short breaks, and falls asleep if you leave it alone for a while.

Animated with spritesheets and CSS — flicker-free and never in the way of your code.

## States

The capybara reacts to what you do:

| State | When it happens |
|-------|-----------------|
| 🚶 **Walk** | Default — strolling around the panel |
| 🏃 **Run** | While you type |
| 🦘 **Jump** | When you move to another line |
| 🎉 **Celebrate** | When you save a file |
| 😱 **Scared** | When the file has errors |
| ☕ **Coffee** | After a medium pause (~6 s) |
| 😴 **Sleep** | After a long pause (~15 s) — with its 💤 |

## Getting started

1. Install the extension.
2. Open the **Explorer** (`Ctrl+Shift+E` / `Cmd+Shift+E`). At the bottom you'll find a **"Capibara"** section — expand it and the pet appears in its little box.
3. Want it somewhere else? Just **drag the "Capibara" section** to another spot — for example into the **Secondary Side Bar** (`Ctrl+Alt+B`) to keep it pinned in a corner. VS Code remembers the position.

## Settings

Tweak the pet from **Settings** (`Ctrl+,` / `Cmd+,`) → search for "Capibara Pet". Changes apply live.

| Setting | Default | What it does |
|---------|:-------:|--------------|
| `capibaraPet.size` | `84` | Size of the capybara, in pixels (40–160). |
| `capibaraPet.speed` | `1` | Walk/run speed multiplier (0.25–3). |
| `capibaraPet.coffeeAfterSeconds` | `6` | Idle seconds before the coffee break. |
| `capibaraPet.sleepAfterSeconds` | `15` | Idle seconds before falling asleep. |
| `capibaraPet.reactToErrors` | `true` | Whether it gets scared when the file has errors. |

## Install from the Marketplace

Search for **"Capibara Pet"** in the Extensions tab of VS Code, or install it from the command line:

```
code --install-extension YOUR_PUBLISHER_ID.capibara-pet
```

## Notes

- No runtime dependencies and no configuration needed — it just works.
- The pet lives in a webview panel (VS Code does not allow floating overlays on top of the editor), with a transparent background so it blends with your theme.

## Credits

Made with care by Juan Carlos Condori. Pixel-art capybara sprites.

## License

MIT. See the LICENSE file included in the package.
