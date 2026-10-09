# 🐾 Capibara Pet

[![Version](https://img.shields.io/visual-studio-marketplace/v/JuanCarlosCondori.capibara-pet?label=Marketplace&color=8a2be2)](https://marketplace.visualstudio.com/items?itemName=JuanCarlosCondori.capibara-pet)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/JuanCarlosCondori.capibara-pet?color=blue)](https://marketplace.visualstudio.com/items?itemName=JuanCarlosCondori.capibara-pet)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/JuanCarlosCondori.capibara-pet?color=gold)](https://marketplace.visualstudio.com/items?itemName=JuanCarlosCondori.capibara-pet&ssr=false#review-details)
[![Open VSX](https://img.shields.io/open-vsx/v/JuanCarlosCondori/capibara-pet?label=Open%20VSX&color=c160ef)](https://open-vsx.org/extension/JuanCarlosCondori/capibara-pet)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/JuanCarlosCondori/capibara-pet?label=Open%20VSX%20downloads&color=c160ef)](https://open-vsx.org/extension/JuanCarlosCondori/capibara-pet)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A little capybara pet that lives in a panel inside your VS Code editor. It strolls around calmly, runs while you type, gets scared when there are errors, sips its coffee during short breaks, and falls asleep if you leave it alone for a while.

Prefer wings? Pick the **Andean condor** instead — it soars over the Illimani and La Paz ([see below](#-the-andean-condor)).

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
| 🍉 **Eat** | Run *Feed the Capybara*: a watermelon slice drops in and it munches it (the baby shares) |

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
| **Capibara Pet: Switch Pet (Capybara ↔ Condor)** | Swaps between the capybara and the Andean condor (each with its own habitat). |
| **Capibara Pet: Go for a Swim** | Sends it for a dip in the lake (scenery backgrounds only). |
| **Capibara Pet: Feed the Capybara** | Drops a slice of watermelon for it to munch. |
| **Capibara Pet: Show/Hide the Capybara** | Quickly toggle the pet on or off. |

> You can also **drag the capybara** left/right inside the panel with your mouse.

## Settings

Tweak the pet from **Settings** (`Ctrl+,` / `Cmd+,`) → search for "Capibara Pet". Changes apply live.

**Pet**

| Setting | Default | What it does |
|---------|:-------:|--------------|
| `capibaraPet.enabled` | `true` | Show your pet. Turn it off to hide it without uninstalling. |
| `capibaraPet.pet` | `capybara` | Your pet: the `capybara` (by the lake) or the Andean `condor` (over the Illimani). |
| `capibaraPet.name` | `""` | A name for your pet (shown on hover and in the status bar). |
| `capibaraPet.size` | `84` | Size in pixels (40–160). `84` is perfectly crisp for both pets. |
| `capibaraPet.speed` | `1` | Movement speed multiplier (0.25–3): walking for the capybara, flying for the condor. |
| `capibaraPet.baby` | `true` | Its little one: a baby capybara that follows yours around, or the condor's chick in its nest on the rock. |

**Scene**

| Setting | Default | What it does |
|---------|:-------:|--------------|
| `capibaraPet.background` | `time` | Follow the time of day, always day / sunset / night, day or night by theme, a solid colour, or transparent. |
| `capibaraPet.weather` | `auto` | Automatic (changes every few hours), or always clear, cloudy, rain, storm, fog or snow. |
| `capibaraPet.seasons` | `true` | Seasonal touches and holiday surprises. |
| `capibaraPet.hemisphere` | `auto` | North or south, for the seasons and the moon (`auto` guesses from your time zone). |

**Behaviour**

| Setting | Default | What it does |
|---------|:-------:|--------------|
| `capibaraPet.coffeeAfterSeconds` | `6` | Idle seconds before a break: coffee or a swim for the capybara, sunbathing for the condor. |
| `capibaraPet.sleepAfterSeconds` | `15` | Idle seconds before it falls asleep. |
| `capibaraPet.bubbles` | `true` | Little speech bubbles (saving, sleeping, petting…). |
| `capibaraPet.sounds` | `false` | Tiny 8-bit sound effects (they start after your first click in the panel). |
| `capibaraPet.statusBar` | `true` | A status bar item (🦫 / 🦅) mirroring its mood, with the weather and season on hover. |

**Reactions**

| Setting | Default | What it does |
|---------|:-------:|--------------|
| `capibaraPet.reactToErrors` | `true` | Gets scared when the active file has errors. |
| `capibaraPet.reactToDebug` | `true` | Celebrates when a debug session starts. |
| `capibaraPet.reactToGit` | `true` | Celebrates commits and pushes, gets scared by merge conflicts, hops when you switch branch. |
| `capibaraPet.reactToTasks` | `true` | Celebrates passing builds/tests and gets scared by failing ones (tasks, and commands like `npm test` in the terminal). |

**Capybara only**

| Setting | Default | What it does |
|---------|:-------:|--------------|
| `capibaraPet.color` | `classic` | Fur colour: classic, chocolate, golden, cream or ash. |

> Tip: **click anywhere in the panel** to pet the capybara — it hops with a ❤️.
> The capybara also **runs faster the faster you type**.

## A little pixel-art world

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/hero.png" alt="The capybara and its baby walking by the lake" width="800">
</p>

The capybara is true pixel art: every state is drawn on a 42×42 grid with a shared 7-colour palette. Its world is drawn procedurally on the **same pixel grid**, so it fits any panel size without extra images: hills with trees, a flowery meadow, a dirt path and a **lake** — the capybara's natural habitat — with the hills reflected in it, reeds, cattails, water lilies, shimmering water and the odd fish ripple.

### Day, sunset and night

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/time-of-day.png" alt="The same lake by day, at sunset and at night" width="640">
</p>

By default (`time`) the light follows your local clock and changes by itself:

- **Day** (7:00–17:30): dithered blue sky, sun, drifting clouds and the odd flock of birds.
- **Sunset** (17:30–19:30, and dawn 6:00–7:00): purple-orange sky, the sun setting behind the hills, glowing water and the first stars.
- **Night**: twinkling stars, the moon — in **tonight's real phase** — glittering on the lake, shooting stars now and then, and blinking fireflies.

You can also pin one with `scene`, `sunset` or `night`.

### Weather

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/weather.png" alt="Rain, a night storm, morning fog and snow with a frozen lake" width="800">
</p>

The weather changes by itself every few hours (`capibaraPet.weather`): clear skies, clouds, rain rippling the lake, a storm with lightning behind the hills, morning fog — and in winter, snow with white hills and a **frozen lake** (no swimming then!).

### Seasons and holidays

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/seasons.png" alt="Spring blossoms, autumn trees, Halloween pumpkins and a Santa hat" width="800">
</p>

**Seasons** follow your hemisphere: spring blossoms and falling petals, autumn trees and falling leaves, duller winter fields. On the right dates there are **pumpkins and bats** at Halloween, a **Santa hat** at Christmas and **fireworks** on New Year's Eve.

### A swim in the lake

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/swim.png" alt="The capybara swimming with its baby on its back" width="480">
</p>

On some breaks the capybara walks to the water and goes for a swim instead of having its coffee (or run *Go for a Swim*) — its baby rides on its back. Any editor activity brings it back out, dripping and shaking the water off. The lake has visitors too: a **duck family** crossing the water now and then, and a **turtle** sunning on a log (it dives when it rains, or when the capybara swims by).

### Family, food and fur

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/feed.png" alt="The capybara and its baby sharing a watermelon" width="360">
</p>

A **baby capybara** follows it everywhere — trotting behind, napping by its side, hopping when it celebrates and hiding behind it when it's scared. Run *Feed the Capybara* and a **watermelon** slice drops in: it munches it bite by bite, and the baby shares.

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/fur-colors.png" alt="The five fur colours: classic, chocolate, golden, cream and ash" width="640">
</p>

Pick a fur colour with `capibaraPet.color` — `classic`, `chocolate`, `golden`, `cream` or `ash` — and turn on `capibaraPet.sounds` for little 8-bit chirps and splashes.

### Little details

- **Effects**: a hard pixel shadow, dust puffs when it walks, runs or lands, confetti and sparkles when it celebrates, a "!" and sweat drops when it gets scared, and a pixel heart when you pet it.
- Hover the 🦫 (or 🦅) status bar item to see the current weather and season.
- The pet moves on the same pixel grid as the scenery. With `prefers-reduced-motion`, the scene stays still and the effects are off.
- Sizes that are multiples of 42 (`42`, `84`, `126`) keep every pixel perfectly even.

There are a couple of surprises too: keep it calm for a while in daylight and you may get a visitor 🐦 — and try petting it many times in a row 🍊.

## 🦅 The Andean condor

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/condor-hero.png" alt="The Andean condor soaring over the Illimani" width="800">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/condor.gif" alt="The condor soaring, landing on its rock by its chick, celebrating and taking off again" width="800">
</p>

Prefer wings? Set `capibaraPet.pet` to `condor` (or run *Switch Pet*). The condor has its own, finer pixel art and lives in its own habitat: **the Illimani over La Paz** — the snowy three-summit massif, brown foothills and eroded badlands, the city on the slopes (its lights twinkle at night) and the altiplano with paja brava.

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/condor-moments.png" alt="Sunbathing on its rock, soaring at dawn, asleep at night, celebrating in a chullo at sunset" width="800">
</p>

It soars in slow circles riding thermals and flaps when you type; on a break it flies to its rock to **sunbathe with its wings open** and then sleeps there; it spreads its wings when you save or commit, and shoots up into the sky when something fails. It brakes with open wings to land and pushes off to take flight. Drag it anywhere in the sky — or drop it on the ground and watch it hop. At dawn the sun rises behind the Illimani; at dusk the mountain glows pink and gold. Pet it five times in a row for a little surprise 🧶.

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/condor-life.png" alt="The condor circling over a dust devil while a llama crosses the altiplano" width="560">
</p>

The altiplano is alive too: **dust devils** whirl across it — rising air the condor loves to circle over — **llamas** with coloured wool tassels wander by, stopping to graze, and a **vizcacha** peeks out by the rock.

A fluffy grey **chick** waits in a nest on the rock (`capibaraPet.baby`): it always looks towards its parent, peeps now and then on its own, peeps and flaps its stubby wings while the condor perches beside it (facing the nest), and sleeps when night falls.

<p align="center">
  <img src="https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/condor-sky.png" alt="The Milky Way and the Southern Cross over the Illimani at night, and the Willkakuti sunrise with a wiphala on the rock" width="800">
</p>

**The southern sky**: clear nights over the altiplano show the **Milky Way** and the **Southern Cross** above the Illimani. And on **June 21st, Willkakuti** — the Aymara New Year, *the return of the sun* — the first rays break over the mountain and a **wiphala** waves on the condor's rock.

## Install from the Marketplace

Search for **"Capibara Pet"** in the Extensions tab of VS Code, or install it from the command line:

```
code --install-extension JuanCarlosCondori.capibara-pet
```

Using **Cursor, Windsurf, VSCodium** or another editor based on Open VSX? It's there too: [open-vsx.org/extension/JuanCarlosCondori/capibara-pet](https://open-vsx.org/extension/JuanCarlosCondori/capibara-pet).

## Notes

- No runtime dependencies and no configuration needed — it just works.
- The pet lives in a webview panel (VS Code does not allow floating overlays on top of the editor), with a transparent background so it blends with your theme.

## Credits

Made with care by Juan Carlos Condori. Pixel-art capybara sprites.

## License

MIT. See the LICENSE file included in the package.
