# Change Log

All notable changes to the **Capibara Pet** extension are documented here.

## [0.11.0]

### Added
- **A second pet: the Andean condor** (`capibaraPet.pet`: `capybara` or `condor`). It
  has its own finer pixel art (84×84 cells, about twice the detail of the capybara) and
  its own behaviour: it soars in slow circles riding thermals and flaps when it climbs
  or when you type; on a break it flies to its rock to **sunbathe with its wings open**,
  then sleeps there; it **spreads its wings** to celebrate, shoots up when something
  fails, now and then lands for a few clumsy hops, and can be dragged anywhere in the
  sky. Its shadow on the ground shrinks the higher it flies.
- **Its habitat: the Illimani over La Paz**, drawn on the same finer grid — the
  three-summit massif with relief shaded from a height field (rocky ribs, glacier
  tongues, its feet fading into the haze), brown foothills with ravines, eroded
  badlands like the Valle de la Luna, the city on the slopes (its lights twinkle at dusk
  and at night), the altiplano with paja brava, and a perching rock. Cirrus streaks and
  billowing cumulus in a deep high-altitude sky; at sunset the mountain glows pink and
  gold (the sun is behind you). Time of day, weather, seasons, holidays and the real
  moon phase all work there too.
- **Easter egg**: pet the condor five times in a row and it wears a **chullo**.
- **Dawn over the Illimani**: following the clock, the warm light of the morning is
  now a real sunrise — the sun peeks over the right summit and the massif stands dark
  against a golden sky, its crest rimmed with light (at dusk it keeps glowing pink).
- **Take-off and landing**: the condor flares its wings to brake as it lands on its
  rock or on the ground (raising a puff of dust), and opens them to push off before
  flapping away.
- The status bar shows 🦅 and the condor's own moods (🪶 soaring, 💨 flapping,
  ☀️ sunbathing, 😴 asleep).
- **Andean life**: dust devils whirl across the dry altiplano now and then — rising
  air, so the condor drifts over and circles above them, higher; a small herd of
  llamas with coloured wool tassels in their ears crosses the plain, stopping to graze;
  a vizcacha peeks out at the foot of the condor's rock (and hides when it comes close).
- **Feathers**: the condor loses one now and then when it flaps hard or gets a fright;
  it drifts down swaying and rests on the ground.
- **README**: screenshots of the condor (soaring, its rock, dawn, night, the chullo,
  the altiplano's life) and a description that introduces both pets.
- **Clearer settings**: grouped into sections (Pet, Scene, Behaviour, Reactions,
  Capybara only) in a logical order instead of alphabetically; descriptions written for
  both pets; readable, translated labels in every dropdown (e.g. "Follow the time of
  day", "Always day"). Setting names and values are unchanged, so existing settings keep
  working.

## [0.10.0]

### Added
- **Swimming**: on some breaks the capybara walks to the lake and goes for a swim
  instead of having its coffee — a smaller swimmer (it is farther away) bobbing in the
  water with a wake behind it. Any editor activity brings it back out with a splash,
  dripping and shaking the water off. New command **Go for a Swim**
  (`capibaraPet.swim`) and a 🏊 status bar mood. Needs a scenery background.
- **A little visitor**: while the capybara is calm in daylight (strolling, sipping
  coffee, napping or swimming), a small yellow-bellied bird sometimes lands on its head
  and sings; it flies away when the capybara runs, jumps or gets scared.
- **Easter egg**: pet the capybara five times in a row and it wears a mandarin on its
  head (also while swimming, hot-spring style). It falls off, bouncing, if it runs or
  jumps.
- **Git reactions** (`capibaraPet.reactToGit`): celebrates your commits ("commit!") and
  pushes ("pushed!"), gets scared by a merge conflict, and hops showing the branch name
  when you switch branch. Uses the built-in Git extension; nothing to set up.
- **Build & test reactions** (`capibaraPet.reactToTasks`): when a task finishes it
  celebrates ("tests ✓", "build ✓") or gets scared ("tests ✗") depending on the exit
  code. Commands typed in the integrated terminal count too — test runners and builds
  only (`npm test`, `npm run build`, `npx jest`, `pytest`, `go test`, `cargo build`,
  `make`, `dotnet build`…), judged by the program and its subcommand so that something
  like `git commit -m "fix tests"` doesn't trigger it (needs shell integration).

- **Weather** (`capibaraPet.weather`, `auto` by default — one roll every 4 hours):
  clear, cloudy (more clouds, greyer sky), rain (drops falling in front of the scene and
  rippling the lake), storm (heavier rain and the odd lightning bolt behind the hills,
  with a soft flash; off with reduced motion), morning fog drifting over the lake, and
  snow in winter — white hills and fields, snow-capped trees and a frozen lake (no
  swimming, no ducks). No birds, fireflies, sun or moon while it rains or snows.
- **Seasons** (`capibaraPet.seasons`): spring blossoms with falling petals and more
  flowers, orange autumn trees with falling leaves, duller winter fields. The hemisphere
  (`capibaraPet.hemisphere`) is guessed from the time zone.
- **Real moon phase**: the night moon shows tonight's phase (mirrored in the southern
  hemisphere); its glitter on the lake fades with a thin moon.
- **Lake visitors**: a duck with her ducklings crossing the lake now and then, and a
  turtle sunning on a log that dives when it rains or the capybara swims close.
- **Holidays**: pumpkins (glowing at night) and bats at Halloween, a Santa hat on the
  capybara at Christmas, fireworks on New Year's Eve.
- The status bar tooltip shows the current weather and season.
- **README**: a gallery of real screenshots of the new features (day/sunset/night,
  weather, seasons and holidays, swimming, feeding, fur colours).
- **Baby capybara** (`capibaraPet.baby`, on by default): a half-size baby that follows
  its mum — walking behind her, running when she runs (or to catch up), napping by her side, hopping
  when she celebrates and pressing close when she's scared. When she swims, it rides
  on her back.
- **Feed the Capybara** command: a watermelon slice drops in front of it, it hurries
  over and munches it bite by bite (seeds flying, "nom nom!"); the baby shares from the
  other side. 🍉 status bar mood.
- **Fur colours** (`capibaraPet.color`): `classic`, `chocolate`, `golden`, `cream` and
  `ash` — real palette swaps of the pixel art (also for the swimmer and the baby).
- **8-bit sounds** (`capibaraPet.sounds`, off by default): petting, the mandarin,
  eating, splashes, commit/push/test results, the bird's song, ducks and thunder —
  synthesised on the fly with WebAudio, no audio files. Not on frequent events like
  saving or typing.

### Changed
- Reactions can now carry their own speech bubble text.

## [0.9.0]

### Added
- **Pixel-art stage**: the scenery is drawn procedurally on a low-res canvas
  (Bayer-dithered sky, hills, trees, meadow and path) and adapts to any panel size.
- **Lake**: the capybara's habitat — a lake between the hills and the path with the
  hills mirrored in it, reeds, cattails and water lilies on the bank, shimmering water,
  a glitter path under the sun or moon, and the odd fish ripple.
- **Time of day**: the new `time` background (now the default) follows the local
  clock — day from 7:00 to 17:30, sunset from 17:30 to 19:30 (and at dawn, 6:00–7:00),
  night otherwise — and relights itself live. The landscape stays the same; only the
  light changes.
- **Sunset** background (`sunset`): purple-orange sky, the sun going down behind the
  hills, back-lit clouds, bird silhouettes and the first stars.
- **Sky life**: drifting clouds and birds by day; twinkling stars, a moon, shooting
  stars and fireflies at night.
- **Pixel effects**: dust puffs when walking, running or landing a jump, confetti and
  sparkles when celebrating, a "!" and sweat drops when scared, coffee steam, floating
  "z"s when asleep, and a pixel heart when petted.

### Changed
- **True pixel-art sprites**: all seven spritesheets are now real pixel art on a
  42×42 grid with one shared 7-colour palette, a clean 1 px outline and a rim
  highlight (and ~1 KB each). The ground line baked under every frame is gone (the
  stage draws the shadow). The Marketplace icon and the view icon are pixel art too.
- **One pixel grid for everything**: one sprite pixel = one art pixel of the scenery
  and effects. The default size (84) shows each pixel as 2×2 screen pixels; multiples
  of 42 keep the art perfectly even.
- `scene` and `night` are now pixel-art scenes instead of CSS gradients, and
  `capibaraPet.background` defaults to `time` (was `scene`).
- Movement, breathing and the shadow now follow the pixel grid: the pet snaps to art
  pixels, breathes in one-pixel steps, shivers when scared, and the blurry drop-shadow
  became a hard pixel shadow. Speech bubbles have square pixel borders.

## [0.8.0]

### Added
- **Backgrounds**: optional CSS backdrops behind the pet via `capibaraPet.background` —
  `scene` (day), `night`, `auto` (follows the editor theme), `solid` (theme colour),
  or `transparent`.

## [0.7.0]

### Added
- **Show/Hide command** (`capibaraPet.toggle`) to quickly turn the pet on or off.
- **Drag to move**: grab the capybara with the mouse and slide it along the panel.

### Changed
- **Localized UI (English / Spanish)**: command titles and setting descriptions now
  follow your VS Code display language.

## [0.6.0]

### Added
- **Idle micro-behaviour**: while strolling, the capybara now takes the occasional
  break, sometimes glances the other way, and gently "breathes" while standing —
  so it feels more alive (no extra art, respects `prefers-reduced-motion`).
- **Status bar mood**: an optional 🦫 status bar item mirrors the current mood and
  focuses the view on click (`capibaraPet.statusBar`).
- **Name your pet**: `capibaraPet.name` shows as a hover tooltip and in the status bar.
- **Speech bubbles**: little messages when saving, sleeping, taking coffee or being
  petted (`capibaraPet.bubbles`).
- **Typing intensity**: the capybara runs faster the faster you type.
- The capybara now **celebrates when a debug session starts** (toggle with
  `capibaraPet.reactToDebug`).
- New `capibaraPet.enabled` setting to **show/hide** the pet without uninstalling.
- **Click anywhere** in the panel to pet the capybara (not just on the sprite).

### Changed
- **Pet the Capybara** command now focuses the view first, so it always has a
  visible effect.

## [0.5.0]

### Added
- **Command palette** commands (category "Capibara Pet"):
  - **Show the Capybara** — reveals/focuses the pet's view.
  - **Pet the Capybara** — give it a little love; it hops with a ❤️.

## [0.4.0]

### Added
- **Settings** to customize the pet (applied live, no reload needed):
  - `capibaraPet.size` — size in pixels.
  - `capibaraPet.speed` — walk/run speed multiplier.
  - `capibaraPet.coffeeAfterSeconds` — idle time before the coffee break.
  - `capibaraPet.sleepAfterSeconds` — idle time before sleeping.
  - `capibaraPet.reactToErrors` — toggle the "scared" reaction to errors.

## [0.3.0]

### Added
- **Click interaction**: click the capybara and it hops while a little ❤️ floats up.

### Changed
- **Performance**: the animation loop now pauses when the view is hidden and resumes
  when it becomes visible again (saves CPU/battery).
- **Less noisy "scared"**: the pet now reacts only when a file *enters* an error
  state, instead of on every diagnostics update.

### Accessibility
- Respects the system **`prefers-reduced-motion`** setting: when enabled, the sprite
  animation and the strolling movement are turned off.

## [0.2.0]

### Added
- Seven states driven by editor activity: walk, run, jump, celebrate, scared, coffee
  and sleep.
- Lives as a **Capibara** section inside the Explorer.
- Flicker-free spritesheet animation using CSS `steps()`.
