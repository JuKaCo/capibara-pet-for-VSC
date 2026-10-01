# docs/ — demo assets

Marketing/demo assets for the README. **Not** shipped in the `.vsix` (excluded via
`.vscodeignore`), so they don't bloat the published extension.

## Expected files

- **`demo.gif`** — short loop of the capybara in action, referenced from the main
  `README.md`. Recommended width ~640px, kept under a few MB.

The README references it by absolute URL (the VS Code Marketplace does not resolve
relative image paths):

```
https://raw.githubusercontent.com/JuKaCo/capibara-pet-for-VSC/main/docs/demo.gif
```

- **Feature screenshots** used by the main `README.md`: `hero.png`, `time-of-day.png`,
  `weather.png`, `seasons.png`, `swim.png`, `feed.png`, `fur-colors.png`. They are real
  renders of the webview (scene + sprite + effects composited at art-pixel scale and
  upscaled with nearest-neighbour), so they stay crisp and tiny (2–40 KB each).

Add more screenshots here and link them the same way if you want.
