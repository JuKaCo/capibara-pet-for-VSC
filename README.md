# 🐾 Capibara Pet

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
