# Prompts for the Andean condor sprites

Same workflow as the capybara (`sprite-strip-prompts.md`): one horizontal strip per
animation, then `tools/pixelize.py` turns it into true pixel art (42×42 grid, shared
palette, clean outline).

## Golden rules (repeat them in every prompt)
1. **One single horizontal image**, all frames in ONE row, **equal square cells**.
2. **The SAME condor in every frame**: same colours, size, proportions and outline.
3. **Facing RIGHT**, side profile.
4. Ground poses: **feet on the same baseline**. Flying poses: the bird **centred** in its cell.
5. **Flat solid `#00B140` green background**, no shadows, no gradients.
6. **NO text, NO numbers, NO labels, NO borders or grid lines.**
7. 16-bit pixel art, crisp pixels, no anti-aliasing, thick clean dark outline.

## The condor (keep this description identical in every prompt)
> a cute chibi **Andean condor** (Vultur gryphus), adult male: glossy black plumage, a
> fluffy **white feather collar (ruff)** at the base of the neck, large **white patches on
> the upper wings**, a **bald dark-grey head** with a small **dark-red fleshy comb** on top,
> a short **hooked ivory beak**, long **"fingered" black primary feathers** at the wingtips,
> grey legs and feet

---

## 0. BASE — the reference design (make this one first)
> Pixel-art character sheet of ONE [condor description], standing perched in side profile
> facing RIGHT, wings folded, calm and friendly expression. 16-bit pixel art, crisp pixels,
> no anti-aliasing, thick clean dark outline, limited palette. Centered, flat solid #00B140
> green background, no shadow, no text, no labels.

Save it as `condor_base.png` and **attach it as the reference image** in every prompt below.

## 1. FLY — flapping (4 frames, 4:1) — when you type
> Single horizontal pixel-art sprite strip of the SAME [condor description] from the
> reference image, 4 frames in one row, equal square cells, 4:1 aspect ratio. Side profile
> flying to the RIGHT, a full wing-flap cycle: frame 1 wings fully up, frame 2 wings level,
> frame 3 wings fully down, frame 4 wings level again. Fingered wingtips visible, white wing
> patches visible. The bird centred in each cell, same size in every frame. 16-bit pixel art,
> crisp pixels, no anti-aliasing, thick dark outline. Flat solid #00B140 green background,
> no shadow, no text, no numbers, no labels, no grid lines.

## 2. GLIDE — soaring (2 frames, 2:1) — its default state
> Single horizontal pixel-art sprite strip of the SAME [condor description], 2 frames in one
> row, equal square cells, 2:1 aspect ratio. Side profile soaring to the RIGHT with wings
> spread wide and flat, long fingered primaries splayed at the tips: frame 1 wingtips
> slightly up, frame 2 wingtips slightly down (gentle glide). Centred, same size. 16-bit pixel
> art, crisp, no anti-aliasing. Flat solid #00B140 green background, no text, no grid lines.

## 3. PERCH — standing (2 frames, 2:1) — idle on a rock
> Single horizontal pixel-art sprite strip of the SAME [condor description], 2 frames,
> equal square cells, 2:1. Standing perched, side profile facing RIGHT, wings folded. Frame 1
> head level, frame 2 head slightly lowered (breathing). Feet on the same baseline. 16-bit
> pixel art, crisp, no anti-aliasing. Flat solid #00B140 green background, no text.

## 4. HOP — walking on the ground (4 frames, 4:1)
> Single horizontal pixel-art sprite strip of the SAME [condor description], 4 frames, equal
> square cells, 4:1. A clumsy hopping walk to the RIGHT, wings slightly lifted for balance:
> frame 1 crouch, frame 2 small hop up, frame 3 landing, frame 4 step. Feet on the same
> baseline when on the ground. 16-bit pixel art, crisp. Flat solid #00B140 green background,
> no text, no grid lines.

## 5. SPREAD — wings wide open (2 frames, 2:1) — when you save / commit
> Single horizontal pixel-art sprite strip of the SAME [condor description], 2 frames, equal
> square cells, 2:1. Standing facing the viewer slightly turned RIGHT, **both wings fully
> spread open** in a proud display, white wing patches and fingered tips clearly visible.
> Frame 1 wings fully open, frame 2 wings open with a small flap. Feet on the same baseline.
> 16-bit pixel art, crisp. Flat solid #00B140 green background, no text.

## 6. SCARED — startled (2 frames, 2:1) — errors
> Single horizontal pixel-art sprite strip of the SAME [condor description], 2 frames, equal
> square cells, 2:1. Standing facing RIGHT, startled: neck stretched up, white ruff fluffed
> out, wings half-raised, wide surprised eye. Frame 2 the same pose shaking slightly. Feet on
> the same baseline. 16-bit pixel art, crisp. Flat solid #00B140 green background, no text.

## 7. SUNBATHE — wings open in the sun (2 frames, 2:1) — the coffee-break equivalent
> Single horizontal pixel-art sprite strip of the SAME [condor description], 2 frames, equal
> square cells, 2:1. Perched in side profile facing RIGHT, relaxing with wings held half-open
> to warm in the sun, eyes half-closed, content. Frame 2 wings very slightly lower. Feet on
> the same baseline. 16-bit pixel art, crisp. Flat solid #00B140 green background, no text.

## 8. SLEEP — resting (2 frames, 2:1)
> Single horizontal pixel-art sprite strip of the SAME [condor description], 2 frames, equal
> square cells, 2:1. Perched asleep in side profile facing RIGHT, head tucked into the white
> ruff, wings folded, eyes closed. Frame 2 body slightly raised (breathing). Feet on the same
> baseline. 16-bit pixel art, crisp. Flat solid #00B140 green background, no text, no "Zzz".

---

## Gemini: frame by frame from the base (recommended)

Gemini keeps the character best when you ask it to **edit** the base image, one frame per
request. Always **attach the original `condor_base.png`** (not the previous result, so it
doesn't drift) and paste the template with one pose:

> Edit this image. Keep exactly the same Andean condor character — same pixel-art style,
> same colours, same proportions, same outline thickness and the same size in the frame —
> and keep the flat solid #00B140 green background. Change only its pose: **[POSE]**.
> Side view, facing right. Crisp pixel art, no smoothing, no gradients, no shadow, no
> ground, no text, no extra objects.

| File | [POSE] |
|---|---|
| `condor_glide_1.png` | soaring in the air, both wings spread wide and flat, the long fingered feathers at the wingtips splayed, white wing patches visible, legs tucked under the body, wingtips slightly raised; the bird centred in the image |
| `condor_glide_2.png` | the same soaring pose with the wingtips slightly lowered |
| `condor_fly_1.png` | flying in the air, both wings raised fully up above the body, legs tucked, centred |
| `condor_fly_2.png` | flying, wings stretched straight out level with the body in mid-flap, legs tucked, centred |
| `condor_fly_3.png` | flying, both wings pushed fully down below the body, legs tucked, centred |
| `condor_perch_2.png` | standing perched exactly like the original, but with the head slightly lowered (breathing) |
| `condor_spread_1.png` | standing, both wings fully spread open in a proud display, white wing patches and fingered tips clearly visible |
| `condor_scared_1.png` | standing startled: neck stretched up, white ruff fluffed out, wings half raised, wide surprised eye |
| `condor_sunbathe_1.png` | perched relaxing with the wings held half open to warm in the sun, eyes half closed |
| `condor_sleep_1.png` | perched asleep, head tucked into the white feather collar, eyes closed, wings folded |
| `condor_hop_1.png` | crouching to hop forward, wings slightly lifted for balance |
| `condor_hop_2.png` | in a small hop just above the ground, wings slightly lifted |

(The base itself is `perch_1`; fly frame 4 reuses frame 2.)

If Gemini drifts: start a new chat, attach the base again, and add *"do not redesign the
character"*. If it changes the background, add *"the background must stay flat #00B140,
nothing else"*.

## Tips
- If it adds text or numbers anyway, regenerate with: `absolutely no text, no numbers, no labels anywhere`.
- If a strip is hard to get right, generate the frames **one by one** with the same reference
  image — I can align them into a perfect strip by their content.
- Uneven cells or slightly different sizes are fine: the pipeline crops each frame by its
  content and re-aligns it to an exact grid and baseline.
- Hand them over as `condor_<state>_sheet.png` (e.g. `condor_fly_sheet.png`), any resolution.
