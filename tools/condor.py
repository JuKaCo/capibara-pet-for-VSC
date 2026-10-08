"""Turn the AI-generated condor strips into the extension's pixel-art sheets (dev tool).

Input: art/condor/condor_<pose>_sheet.(png|jpeg) on a flat #00B140 green background.
Steps:
  1. key out the green background;
  2. split each strip into frames (connected blobs; small specks join the nearest frame);
  3. scale every frame so the bald head has the same size everywhere (a consistent bird);
  4. one shared palette for all frames, hard alpha, a clean 1 px outline;
  5. pack each pose into a strip of CELL×CELL cells: ground poses stand on a common
     baseline centred on their feet; flying poses keep the head still so the wings flap
     around it.
Output: media/condor/<pose>_sheet.png and, printed, the frame counts and head anchors to
paste into CONDOR_POSES in src/extension.ts.

Usage (needs Pillow):  python tools/condor.py [--cell 84] [--perch 54] [--colors 22] [--preview DIR]
"""
import argparse
import glob
import os

from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('--src', default='art/condor')
ap.add_argument('--out', default='media/condor')
ap.add_argument('--cell', type=int, default=84)
ap.add_argument('--perch', type=int, default=54, help='height of the perched condor, in px')
ap.add_argument('--colors', type=int, default=22)
ap.add_argument('--preview')
args = ap.parse_args()
CELL = args.cell
FLYING = {'fly'}
# In flight the bird is drawn a bit smaller (it is farther, and the whole wing beat must fit a cell).
SCALE = {'fly': 0.82, 'spread': 0.94}
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def is_bg(c):
    r, g, b = c[:3]
    return g > 110 and g > r + 35 and g > b + 35


def key_out(im):
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if is_bg(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
    return im


def blobs(mask_px, w, h, nbrs):
    seen, comps = set(), []
    for y in range(h):
        for x in range(w):
            if mask_px[x, y] and (x, y) not in seen:
                st, comp = [(x, y)], []
                seen.add((x, y))
                while st:
                    a, b = st.pop()
                    comp.append((a, b))
                    for da, db in nbrs:
                        n = (a + da, b + db)
                        if 0 <= n[0] < w and 0 <= n[1] < h and n not in seen and mask_px[n]:
                            seen.add(n)
                            st.append(n)
                comps.append(comp)
    return comps


def frames(im):
    """Frames = big connected blobs of the (dilated, 1/4-scale) mask; specks join the nearest."""
    k = 4
    m = im.split()[3].resize((im.width // k, im.height // k), Image.BOX).point(lambda v: 255 if v > 20 else 0)
    m = m.filter(ImageFilter.MaxFilter(3))
    nbrs8 = [(a, b) for a in (-1, 0, 1) for b in (-1, 0, 1) if a or b]
    comps = blobs(m.load(), m.width, m.height, nbrs8)
    big = max(len(c) for c in comps)
    boxes = []
    for c in comps:
        xs = [p[0] for p in c]; ys = [p[1] for p in c]
        boxes.append([min(xs) * k, min(ys) * k, (max(xs) + 1) * k, (max(ys) + 1) * k, len(c)])
    main = sorted([b for b in boxes if b[4] >= 0.15 * big], key=lambda b: b[0])
    out = []
    for x0, y0, x1, y1, _ in main:
        f = im.crop((max(0, x0 - 2), max(0, y0 - 2), min(im.width, x1 + 2), min(im.height, y1 + 2)))
        bb = f.getbbox()
        out.append((f.crop(bb), y0 - 2 + bb[1]))  # frame + its top in the strip (for hops)
    return out


def head_box(f):
    """The bald reddish head (+ comb): bounding box of its pixels."""
    px = f.load()
    pts = [(x, y) for y in range(f.height) for x in range(f.width)
           if px[x, y][3] and px[x, y][0] > 90 and px[x, y][0] > px[x, y][1] + 25 and px[x, y][0] > px[x, y][2] + 15]
    if not pts:
        return None
    xs = sorted(p[0] for p in pts); ys = sorted(p[1] for p in pts)
    q = lambda arr, t: arr[int(len(arr) * t)]
    return q(xs, 0.02), q(ys, 0.02), q(xs, 0.98), q(ys, 0.98)


def main():
    sheets = {}
    for path in sorted(glob.glob(os.path.join(args.src, 'condor_*_sheet.*'))):
        pose = os.path.basename(path).split('_')[1]
        sheets[pose] = frames(key_out(Image.open(path)))
    ref = sheets['perch'][0][0]
    hb = head_box(ref)
    head_target = (hb[2] - hb[0]) * args.perch / ref.height

    # Scale every frame by its sheet's head size, keeping vertical offsets (hops).
    small = {}
    for pose, frs in sheets.items():
        widths = [hb[2] - hb[0] for hb in (head_box(f) for f, _ in frs) if hb]
        k = head_target / (sum(widths) / len(widths)) * SCALE.get(pose, 1)
        small[pose] = []
        for f, top in frs:
            w, h = max(1, round(f.width * k)), max(1, round(f.height * k))
            rgb = f.convert('RGB').resize((w, h), Image.BOX)
            a = f.split()[3].resize((w, h), Image.BOX).point(lambda v: 255 if v >= 128 else 0)
            s = rgb.convert('RGBA'); s.putalpha(a)
            hbx = head_box(f)
            head = None if not hbx else ((hbx[0] + hbx[2]) / 2 * k, (hbx[1] + hbx[3]) / 2 * k)
            small[pose].append({'im': s, 'top': top * k, 'head': head})

    # One palette for the whole bird.
    opaque = [p[:3] for frs in small.values() for fr in frs for p in fr['im'].getdata() if p[3]]
    side = int(len(opaque) ** 0.5) + 1
    mos = Image.new('RGB', (side, side)); mos.putdata(opaque + [opaque[0]] * (side * side - len(opaque)))
    K = args.colors
    pal = mos.quantize(colors=K, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).getpalette()[:K * 3]
    PAL = [tuple(pal[i:i + 3]) for i in range(0, K * 3, 3)]
    cache = {}

    def q(c):
        if c not in cache:
            cache[c] = min(PAL, key=lambda p: sum((a - b) ** 2 for a, b in zip(p, c)))
        return cache[c]
    outline = min(PAL, key=sum)

    for frs in small.values():
        for fr in frs:
            s = fr['im']; px = s.load()
            for y in range(s.height):
                for x in range(s.width):
                    if px[x, y][3]:
                        px[x, y] = q(px[x, y][:3]) + (255,)
            # drop specks not attached to the bird
            comps = blobs(_Mask(s), s.width, s.height, N4)
            big = max(len(c) for c in comps)
            for c in comps:
                if len(c) < max(6, big * 0.02):
                    for p in c:
                        px[p] = (0, 0, 0, 0)
            for x in range(s.width):  # 1 px outline on the silhouette
                for y in range(s.height):
                    if px[x, y][3] and any(not (0 <= x + a < s.width and 0 <= y + b < s.height) or not px[x + a, y + b][3] for a, b in N4):
                        px[x, y] = outline + (255,)

    # Pack into cells.
    os.makedirs(args.out, exist_ok=True)
    report = {}
    for pose, frs in small.items():
        cells = frs if pose != 'fly' else [frs[0], frs[1], frs[2], frs[1]]  # up, level, down, level
        sheet = Image.new('RGBA', (CELL * len(cells), CELL), (0, 0, 0, 0))
        if pose in FLYING:
            # keep the head still (70 % across, 52 % down) so the wings beat around it
            for i, fr in enumerate(cells):
                hx, hy = fr['head']
                ox, oy = round(CELL * 0.7 - hx), round(CELL * 0.52 - hy)
                if ox < 0 or oy < 0 or ox + fr['im'].width > CELL or oy + fr['im'].height > CELL:
                    print(f'warning: {pose} frame {i} spills out of its cell', (ox, oy, fr['im'].size))
                sheet.alpha_composite(fr['im'], (i * CELL + ox, oy))
        else:
            bottom = max(fr['top'] + fr['im'].height for fr in frs)
            for i, fr in enumerate(cells):
                s = fr['im']
                # centre on the feet (the lowest rows), stand on the baseline 2 px above the cell bottom
                px = s.load()
                feet = [x for y in range(s.height - 3, s.height) for x in range(s.width) if px[x, y][3]]
                fx = sum(feet) / len(feet) if feet else s.width / 2
                lift = round(bottom - (fr['top'] + s.height))
                ox, oy = round(CELL / 2 - fx), CELL - 2 - s.height - lift
                if ox < 0 or oy < 0 or ox + s.width > CELL:
                    print(f'warning: {pose} frame {i} spills out of its cell', (ox, oy, s.size))
                sheet.alpha_composite(s, (i * CELL + ox, oy))
        sheet.save(os.path.join(args.out, f'{pose}_sheet.png'), optimize=True)
        # head anchor (frame 1): centre column and top row of the head, in cell px
        f0 = sheet.crop((0, 0, CELL, CELL)); hbx = head_box(f0)
        report[pose] = (len(cells), None if not hbx else (round((hbx[0] + hbx[2]) / 2), hbx[1]))
        if args.preview:
            os.makedirs(args.preview, exist_ok=True)
            bg = Image.new('RGBA', sheet.size, (200, 220, 240, 255)); bg.alpha_composite(sheet)
            bg.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(os.path.join(args.preview, f'{pose}.png'))
    print('palette', len(set(PAL)), 'outline', '#%02x%02x%02x' % outline)
    for pose, (n, head) in sorted(report.items()):
        print(f'{pose:9s} frames={n} head={head}')


class _Mask:
    """Alpha of an RGBA image as a px[x, y] truthy lookup."""
    def __init__(self, im):
        self.px = im.load()

    def __getitem__(self, xy):
        return self.px[xy][3]


main()
