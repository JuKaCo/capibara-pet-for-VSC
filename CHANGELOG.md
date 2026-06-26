# Change Log

All notable changes to the **Capibara Pet** extension are documented here.

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
