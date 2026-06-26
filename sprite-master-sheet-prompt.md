# Prompt — MASTER SHEET (all states in ONE image)

## Why a single image
A single render = the SAME capybara across ALL states (same color, size, details).
It's maximum consistency. Only the pose/legs change.

## Golden rules
1. ONE single image. Organized in **rows**: each row = one state, frames left to right.
2. The SAME capybara across the WHOLE sheet: same color, same size, same proportions, same outline thickness. ONLY pose/legs/accessories change.
3. 16-bit pixel-art style, clean dark outline, no anti-aliasing.
4. Side profile facing RIGHT (except sleep = lying down, coffee = sitting).
5. Same baseline in each row; same frame size across the WHOLE sheet.
6. **Flat solid #00B140 green background.** No shadows.
7. **Generous SPACING** between frames and between rows (green space around each one).
8. **NO text, NO numbers, NO labels, NO borders or grid lines.**

## PROMPT (copy it as-is)
> A single large pixel-art sprite sheet of ONE cute chibi capybara, organized in rows, one animation per row, frames left to right. The SAME capybara in EVERY frame across the whole sheet: identical warm brown color, identical size, proportions and outline thickness — only the pose/legs/accessories change. 16-bit pixel art, crisp pixels, no anti-aliasing, thick clean dark outline. Side profile facing RIGHT. Generous green spacing between every frame and every row. Flat solid #00B140 green background, no shadows, NO text, NO numbers, NO labels, NO grid lines, NO borders.
>
> Rows, in this order:
> Row 1 — WALK cycle, 4 frames (legs in 4 progressive walking positions).
> Row 2 — RUN cycle, 4 frames (forward lean, fast gallop legs).
> Row 3 — SLEEP, 2 frames, lying down curled, eyes closed as happy curves, a small "Z" floating (frame 2 belly slightly raised, breathing).
> Row 4 — CELEBRATE, 2 frames, both front paws raised happily with little sparkles.
> Row 5 — COFFEE, 2 frames, sitting and holding a tiny coffee cup (frame 2 sipping).
> Row 6 — SCARED, 2 frames, startled with wide eyes and a small sweat drop, ears flat.
> Row 7 — JUMP, 2 frames, frame 1 crouched gathering energy, frame 2 mid-air with legs tucked and ears up.
>
> Keep every capybara the same scale across all rows. Feet aligned per row.

## Tips
- Use your `base.png` as a reference image to lock the look.
- If it adds text/numbers: re-generate with `absolutely no text, no numbers, no labels anywhere`.
- Keep LOTS of green space between sprites: it makes it easier for me to crop them without them sticking together.

## What I do when you hand it over
1. I remove the green background to transparency.
2. I detect each capybara as a separate "blob" and group them by rows (states) in the order above.
3. I re-align them into exact per-state spritesheets (walk/run/sleep/celebrate/coffee/scared).
4. I wire each state to a behavior in the extension.
