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

Add more screenshots here (e.g. `states.png`) and link them the same way if you want.
