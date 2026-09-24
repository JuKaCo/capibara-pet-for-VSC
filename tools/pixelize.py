"""Turn hi-res capybara sprite strips into true pixel art (dev tool, not shipped).

Takes the `<state>_sheet.png` strips (one row of square cells, e.g. 128 px) and:
  1. removes the ground line baked under each frame (the stage draws a shadow);
  2. removes small detached details (zzz, sweat, steam, sparkles) that turn into
     noise on the grid; the stage redraws them as pixel particles instead;
  3. builds ONE shared palette for every sheet (median cut + merging of
     near-identical tones, a single black for the outline);
  4. downsamples each cell to a GRID x GRID pixel grid, keeping thin dark lines;
  5. polishes: removes speckles, draws a clean 1 px outline around the body and
     a 1 px rim highlight along its top edge.
With --icon it also renders media/icon.png from walk frame 1.

Usage (needs Pillow):
  python tools/pixelize.py --src <hi-res dir> --out media [--grid 42] [--colors 12]
                           [--preview <dir>] [--icon]

GRID must match SPRITE_GRID in src/extension.ts.
"""
import argparse
import os
from collections import Counter

from PIL import Image

SHEETS = ['walk', 'run', 'jump', 'celebrate', 'scared', 'coffee', 'sleep']
N4 = ((-1, 0), (1, 0), (0, -1), (0, 1))

ap = argparse.ArgumentParser()
ap.add_argument('--src', default='media')
ap.add_argument('--out', default='media')
ap.add_argument('--grid', type=int, default=42)
ap.add_argument('--colors', type=int, default=12)
ap.add_argument('--preview')
ap.add_argument('--icon', action='store_true')
args = ap.parse_args()
N = args.grid

lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
dark = lambda c: c[3] > 0 and lum(c) < 55
dist2 = lambda a, b: sum((x - y) ** 2 for x, y in zip(a, b))


def components(px, x0, w, h, solid, nbrs):
    """Connected components of `solid` pixels inside one cell."""
    seen, comps = set(), []
    for y in range(h):
        for x in range(x0, x0 + w):
            if (x, y) in seen or not solid(px[x, y]):
                continue
            comp, stack = [], [(x, y)]
            seen.add((x, y))
            while stack:
                a, b = stack.pop()
                comp.append((a, b))
                for da, db in nbrs:
                    n = (a + da, b + db)
                    if x0 <= n[0] < x0 + w and 0 <= n[1] < h and n not in seen and solid(px[n]):
                        seen.add(n)
                        stack.append(n)
            comps.append(comp)
    return comps


def strip_ground_line(im, cell):
    """Clear the wide dark bar at the bottom of each frame, except right under
    the body/feet (there it stays as their bottom outline)."""
    px = im.load()
    for f in range(im.width // cell):
        x0, rows, y = f * cell, [], im.height - 1
        while y > 0:
            op = [x for x in range(x0, x0 + cell) if px[x, y][3] > 0]
            if not op:
                if rows:
                    break
                y -= 1
                continue
            dk = [x for x in op if dark(px[x, y])]
            span = op[-1] - op[0] + 1
            # wide, solid and mostly dark (its anti-aliased top row is ~50% dark)
            if len(dk) >= 0.4 * len(op) and len(op) >= 0.8 * span and span > cell * 0.3:
                rows.append(y)
                y -= 1
            else:
                break
        if not rows:
            continue
        top = min(rows)
        for x in range(x0, x0 + cell):
            if px[x, top - 1][3] == 0:  # nothing stands on this column
                for r in rows:
                    px[x, r] = (0, 0, 0, 0)


def drop_loose_bits(im, cell):
    px = im.load()
    nbrs8 = [(a, b) for a in (-1, 0, 1) for b in (-1, 0, 1) if a or b]
    for f in range(im.width // cell):
        comps = components(px, f * cell, cell, im.height, lambda c: c[3] >= 64, nbrs8)
        if not comps:
            continue
        big = max(len(c) for c in comps)
        for c in comps:
            if len(c) < 0.04 * big:
                for p in c:
                    px[p] = (0, 0, 0, 0)


def median_cut(cols, k):
    side = int(len(cols) ** 0.5) + 1
    mosaic = Image.new('RGB', (side, side))
    mosaic.putdata(cols + [cols[0]] * (side * side - len(cols)))
    pal = mosaic.quantize(colors=k, method=Image.Quantize.MEDIANCUT,
                          dither=Image.Dither.NONE).getpalette()[:k * 3]
    return [tuple(pal[i:i + 3]) for i in range(0, k * 3, 3)]


def build_palette(sheets):
    opaque = []
    for im in sheets.values():
        opaque += [p[:3] for p in im.getdata() if p[3] >= 128]
    light = [c for c in opaque if lum(c) > 185]  # eyes, cup: keep as accents
    pal = median_cut([c for c in opaque if lum(c) <= 185], args.colors)
    if len(light) > 20:
        pal += median_cut(light, 2)
    # Merge swatches closer than 24 (weighted by use): median cut splits the
    # dominant fur colour into near-identical tones.
    use = Counter(min(range(len(pal)), key=lambda i: dist2(pal[i], c)) for c in opaque[::7])
    sw = [[pal[i], use[i]] for i in range(len(pal)) if use[i]]
    merged = True
    while merged:
        merged = False
        for i in range(len(sw)):
            for j in range(i + 1, len(sw)):
                if dist2(sw[i][0], sw[j][0]) < 24 ** 2:
                    (ci, wi), (cj, wj) = sw[i], sw[j]
                    sw[i] = [tuple(round((a * wi + b * wj) / (wi + wj)) for a, b in zip(ci, cj)), wi + wj]
                    del sw[j]
                    merged = True
                    break
            if merged:
                break
    fur = max(sw, key=lambda t: t[1])[0]
    blacks = [c for c, _ in sw if lum(c) < 45]  # one black is enough
    pal = [c for c, _ in sw if lum(c) >= 45] + ([min(blacks, key=lum)] if blacks else [])
    return pal, fur


def downsample(im, cell, pal):
    cache = {}

    def q(c):
        if c[:3] not in cache:
            cache[c[:3]] = min(range(len(pal)), key=lambda i: dist2(pal[i], c[:3]))
        return cache[c[:3]]

    frames = im.width // cell
    out = Image.new('RGBA', (frames * N, N), (0, 0, 0, 0))
    src, dst, s = im.load(), out.load(), cell / N
    for f in range(frames):
        for j in range(N):
            for i in range(N):
                xa, xb = int(f * cell + i * s), int(f * cell + (i + 1) * s)
                ya, yb = int(j * s), int((j + 1) * s)
                cols = [src[x, y] for x in range(xa, max(xb, xa + 1)) for y in range(ya, max(yb, ya + 1))]
                solid = [c for c in cols if c[3] >= 128]
                if len(solid) < 0.45 * len(cols):
                    continue
                dk = [c for c in solid if dark(c)]
                pick = dk if len(dk) >= 0.3 * len(solid) else solid  # thin dark lines win
                dst[f * N + i, j] = pal[Counter(q(c) for c in pick).most_common(1)[0][0]] + (255,)
    return out


def polish(im, outline, fur, highlight):
    px = im.load()
    for f in range(im.width // N):
        x0 = f * N
        inside = lambda x, y: x0 <= x < x0 + N and 0 <= y < im.height
        for _ in range(2):  # speckles: 3+ of the 4 neighbours agree on another colour
            changes = []
            for y in range(im.height):
                for x in range(x0, x0 + N):
                    c = px[x, y]
                    nb = [px[x + a, y + b] for a, b in N4 if inside(x + a, y + b)]
                    if not c[3] or c[:3] == outline or len(nb) < 4 or not all(n[3] for n in nb):
                        continue
                    top, cnt = Counter(nb).most_common(1)[0]
                    if cnt >= 3 and top != c:
                        changes.append((x, y, top))
            for x, y, c in changes:
                px[x, y] = c
        comps = components(px, x0, N, im.height, lambda c: c[3] > 0, N4)
        if not comps:
            continue
        body = max(comps, key=len)
        edge = [(a, b) for a, b in body
                if any(not inside(a + da, b + db) or not px[a + da, b + db][3] for da, db in N4)]
        for p in edge:
            px[p] = outline + (255,)
        for a, b in body:  # rim light under the top silhouette edge
            if px[a, b][:3] == fur and b >= 2 and px[a, b - 1][:3] == outline and not px[a, b - 2][3]:
                px[a, b] = highlight + (255,)
    return im


def make_icon(walk):
    """Marketplace icon: 256 px pixel rounded square with the walking capybara.
    (media/pet-icon.svg, the 16 px view icon, is hand-drawn on a pixel grid.)"""
    frame = walk.crop((0, 0, N, N))
    frame = frame.crop(frame.getbbox())
    g, scale = 64, 6  # frame: 64x64 grid, 4 px per cell; capybara: 6 px per pixel
    art = Image.new('RGBA', (g, g), (0, 0, 0, 0))
    ap_ = art.load()
    bg, rim, shade = (251, 233, 200, 255), (226, 190, 140, 255), (235, 205, 160, 255)
    notch = [3, 1, 1]  # stepped corners
    for y in range(g):
        for x in range(g):
            dy = min(y, g - 1 - y)
            dx = min(x, g - 1 - x)
            if dy < len(notch) and dx < notch[dy] or dx < len(notch) and dy < notch[dx]:
                continue
            border = dx == 0 or dy == 0 or (dy < len(notch) and dx == notch[dy]) or (dx < len(notch) and dy == notch[dx])
            ap_[x, y] = rim if border else bg
    big = art.resize((256, 256), Image.NEAREST)
    fw, fh = frame.width * scale, frame.height * scale
    ox, oy = (256 - fw) // 2, 256 - 44 - fh
    sh = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    shp = sh.load()
    cx, cy, rx = 128, oy + fh + 2, fw * 0.42
    for y in range(cy - 4, cy + 8):
        for x in range(256):
            if ((x - cx) / rx) ** 2 + ((y - cy - 2) / 7) ** 2 <= 1:
                shp[x, y] = shade
    big.alpha_composite(sh)
    big.alpha_composite(frame.resize((fw, fh), Image.NEAREST), (ox, oy))
    big.save(os.path.join(args.out, 'icon.png'), optimize=True)


def main():
    sheets = {}
    for s in SHEETS:
        im = Image.open(os.path.join(args.src, f'{s}_sheet.png')).convert('RGBA')
        cell = im.height
        strip_ground_line(im, cell)
        drop_loose_bits(im, cell)
        sheets[s] = (im, cell)
    pal, fur = build_palette({s: v[0] for s, v in sheets.items()})
    outline = min(pal, key=lum)
    highlight = tuple(min(255, round(v * 1.14 + 12)) for v in fur)
    print('palette:', ' '.join('#%02x%02x%02x' % c for c in pal + [highlight]))
    os.makedirs(args.out, exist_ok=True)
    out = {}
    for s, (im, cell) in sheets.items():
        small = polish(downsample(im, cell, pal), outline, fur, highlight)
        small.save(os.path.join(args.out, f'{s}_sheet.png'), optimize=True)
        out[s] = small
        if args.preview:
            os.makedirs(args.preview, exist_ok=True)
            big = small.resize((small.width * 6, small.height * 6), Image.NEAREST)
            bg = Image.new('RGBA', big.size, (235, 240, 245, 255))
            bg.alpha_composite(big)
            bg.convert('RGB').save(os.path.join(args.preview, f'preview_{s}.png'))
    if args.icon:
        make_icon(out['walk'])
    print(f'wrote {len(out)} sheets at {N}px' + (' + icon' if args.icon else ''))


main()
