# Change Log

All notable changes to the **Capibara Pet** extension are documented here.

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
