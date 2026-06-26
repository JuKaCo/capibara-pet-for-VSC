# Prompts for a SINGLE strip of frames (spritesheet)

## Why a single strip
- A single render = the capybara comes out **identical** in every frame (same color/details); only the legs change.
- It allows animating with CSS `steps()` (moving background-position) → smooth and **flicker-free**.

## Golden rules
1. **One single horizontal image** with ALL frames in one row.
2. **Exactly 4 frames**, equal-size cells, uniform spacing.
3. **The SAME capybara in every frame**: same color, size, outline thickness; ONLY the legs change.
4. **Facing RIGHT**, side profile. Same baseline (feet aligned).
5. **Flat solid `#00B140` green background**, no shadows.
6. **NO text, NO numbers, NO labels, NO borders or grid lines.**
7. **Wide 4:1** aspect ratio (e.g. 2048×512), capybara centered in each quarter.

---

## PROMPT — WALK strip (the main one)
> Single horizontal pixel-art sprite sheet (film strip) of ONE cute chibi capybara, 4 frames in a single row, evenly spaced equal cells, 4:1 aspect ratio. The SAME capybara in every frame: identical warm brown color, same size, same proportions, same outline thickness — ONLY the legs change to show a walk cycle. Side profile facing RIGHT, feet aligned on the same baseline. 16-bit pixel-art, crisp pixels, no anti-aliasing, thick clean dark outline. Frame 1: front leg forward / back leg back (contact). Frame 2: legs together under body (passing). Frame 3: legs swapped (opposite contact). Frame 4: legs gathered (passing). Flat solid #00B140 green background, no shadow, no text, no numbers, no labels, no grid lines, no borders.

## PROMPT — RUN strip (optional, for while you type)
> Same single-row 4-frame pixel-art sprite strip of the SAME capybara (identical color/size/outline), side profile facing RIGHT, 4:1 ratio, equal cells, flat #00B140 background. A fast RUN cycle with a forward lean: frame 1 legs stretched reaching forward, frame 2 gathered under body (suspension), frame 3 legs stretched backward pushing off, frame 4 mid-recovery. Same baseline in all frames. No text, no numbers, no labels, no grid lines.

## PROMPT — SLEEP strip (optional)
> Single-row 2-frame pixel-art sprite strip of the SAME capybara lying down asleep, side view, 2:1 ratio, equal cells, flat #00B140 background. Frame 1 belly relaxed, frame 2 belly slightly raised (breathing). Eyes closed as happy curved lines. No text, no numbers, no labels.

---

## Tips for getting it aligned
- Use the SAME reference image (your `base.png`) in every prompt.
- If it adds text/numbers anyway: re-generate asking for `absolutely no text, no numbers, no labels anywhere`.
- It doesn't matter if the cells come out a bit uneven: I crop by content and re-align to a perfect grid.
- Keep the green background flat and shadow-free for a clean transparency crop.

## What I do when you hand it over
1. I crop the green background to transparency.
2. I detect each frame by content and re-align them to an EXACT grid (same size and baseline).
3. I generate the final spritesheet `media/walk_sheet.png` (and run/sleep if you make them).
4. I switch the webview to CSS `steps()` animation → smooth and flicker-free.
