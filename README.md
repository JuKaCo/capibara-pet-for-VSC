# 🐾 Capibara Pet

[![Version](https://img.shields.io/visual-studio-marketplace/v/JuanCarlosCondori.capibara-pet?label=Marketplace&color=8a2be2)](https://marketplace.visualstudio.com/items?itemName=JuanCarlosCondori.capibara-pet)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/JuanCarlosCondori.capibara-pet?color=blue)](https://marketplace.visualstudio.com/items?itemName=JuanCarlosCondori.capibara-pet)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/JuanCarlosCondori.capibara-pet?color=gold)](https://marketplace.visualstudio.com/items?itemName=JuanCarlosCondori.capibara-pet&ssr=false#review-details)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A little capybara pet that lives in a panel inside your VS Code editor. It strolls around calmly, runs while you type, gets scared when there are errors, sips its coffee during short breaks, and falls asleep if you leave it alone for a while.

Animated with spritesheets on a procedural pixel-art stage — flicker-free and never in the way of your code.

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
| 🎉 **Celebrate** | When you save a file, start a debug session, commit or push, or a build/test passes |
| 😱 **Scared** | When the file has errors, a build/test fails, or Git hits a merge conflict |
| ☕ **Coffee** | After a medium pause (~6 s) |
| 😴 **Sleep** | After a long pause (~15 s) — with its 💤 |
| 🏊 **Swim** | On some breaks it goes for a swim in the lake instead (or run *Go for a Swim*) — any editor activity brings it back out, dripping |

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
| **Capibara Pet: Go for a Swim** | Sends it for a dip in the lake (scenery backgrounds only). |
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
| `capibaraPet.reactToGit` | `true` | Celebrates commits and pushes, gets scared by merge conflicts, hops when you switch branch. |
| `capibaraPet.reactToTasks` | `true` | Celebrates passing builds/tests and gets scared by failing ones (tasks, and commands like `npm test` in the terminal). |
| `capibaraPet.name` | `""` | Give your capybara a name (shown on hover and in the status bar). |
| `capibaraPet.bubbles` | `true` | Show small speech bubbles (saving, sleeping, petting…). |
| `capibaraPet.statusBar` | `true` | Show a status bar item that mirrors the current mood. |
| `capibaraPet.background` | `time` | Panel backdrop: `time` (follows the local time: day, sunset, night), `scene` (day), `sunset`, `night`, `auto` (day/night by theme), `solid`, or `transparent`. |
| `capibaraPet.weather` | `auto` | Scene weather: `auto` (changes every few hours), or always `clear`, `cloudy`, `rain`, `storm`, `fog` or `snow`. |
| `capibaraPet.seasons` | `true` | Seasonal touches (blossoms, autumn leaves, winter) and holiday surprises. |
| `capibaraPet.hemisphere` | `auto` | `north` / `south` for the seasons and the moon; `auto` guesses from your time zone. |

> Tip: **click anywhere in the panel** to pet the capybara — it hops with a ❤️.
> The capybara also **runs faster the faster you type**.

## Pixel art

The capybara is true pixel art: every state is drawn on a 42×42 grid with a shared 7-colour palette. The backdrop is drawn procedurally on the **same pixel grid**, so it fits any panel size without extra images: hills with trees, a flowery meadow, a dirt path and a **lake** — the capybara's natural habitat — with the hills reflected in it, reeds, cattails, water lilies, shimmering water and the odd fish ripple.

By default (`time`) the light follows your local clock and changes by itself:

- **Day** (7:00–17:30): dithered blue sky, sun, drifting clouds and the odd flock of birds.
- **Sunset** (17:30–19:30, and dawn 6:00–7:00): purple-orange sky, the sun setting behind the hills, glowing water and the first stars.
- **Night**: twinkling stars, the moon's glitter on the lake, shooting stars now and then, and blinking fireflies.

You can also pin one with `scene`, `sunset` or `night`.

The world around it is alive too:

- **Weather** changes by itself every few hours: clear skies, clouds, rain rippling the lake, a storm with lightning behind the hills, morning fog — and in winter, snow with white hills and a frozen lake (no swimming then!).
- **Seasons** follow your hemisphere: spring blossoms and falling petals, autumn trees and falling leaves, duller winter fields.
- **The moon** shows tonight's real phase.
- **Lake visitors**: a duck family crossing the water and a turtle sunning on a log (it dives when it rains, or when the capybara swims by).
- **Holidays**: pumpkins and bats at Halloween, a Santa hat at Christmas, fireworks on New Year's Eve.
- **Effects**: a hard pixel shadow, dust puffs when it walks, runs or lands, confetti and sparkles when it celebrates, a "!" when it gets scared, and a pixel heart when you pet it.

Hover the 🦫 status bar item to see the current weather and season.

The pet moves on the same pixel grid as the scenery. With `prefers-reduced-motion`, the scene stays still and the effects are off.

> Tip: sizes that are multiples of 42 (`42`, `84`, `126`) keep every pixel perfectly even.

There are a couple of surprises too: keep it calm for a while in daylight and you may get a visitor 🐦 — and try petting it many times in a row 🍊.

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
