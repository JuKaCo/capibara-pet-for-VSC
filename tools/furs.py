"""Fur colour variants of the sprite sheets (dev tool, not shipped).

Swaps the four fur tones of the shared palette (fur, rim highlight, shade, deep
shade) in every media/<state>_sheet.png and writes media/fur/<variant>/. The
outline, eyes and the cup keep their colours.

Usage (needs Pillow):  python tools/furs.py

FURS must match FURS in src/extension.ts (the swimmer and the baby use it).
"""
import os

from PIL import Image

SHEETS = ['walk', 'run', 'jump', 'celebrate', 'scared', 'coffee', 'sleep']
CLASSIC = {'f': '#c86e3d', 'h': '#f08952', 's': '#8e4d35', 'd': '#7c3f2b'}
FURS = {
    'chocolate': {'f': '#7a4a32', 'h': '#9c6648', 's': '#553222', 'd': '#45281c'},
    'golden': {'f': '#d9a050', 'h': '#f4c474', 's': '#a87434', 'd': '#8a5c28'},
    'cream': {'f': '#e6d3bc', 'h': '#fbeedd', 's': '#c2ab92', 'd': '#a88e86'},
    'ash': {'f': '#8c8782', 'h': '#aba6a0', 's': '#67635f', 'd': '#55514d'},
}

rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def main():
    media = os.path.join(os.path.dirname(__file__), '..', 'media')
    for name, fur in FURS.items():
        swap = {rgb(CLASSIC[k]): rgb(v) for k, v in fur.items()}
        out = os.path.join(media, 'fur', name)
        os.makedirs(out, exist_ok=True)
        for s in SHEETS:
            im = Image.open(os.path.join(media, f'{s}_sheet.png')).convert('RGBA')
            px = im.load()
            for y in range(im.height):
                for x in range(im.width):
                    c = px[x, y]
                    if c[3] and c[:3] in swap:
                        px[x, y] = swap[c[:3]] + (c[3],)
            im.save(os.path.join(out, f'{s}_sheet.png'), optimize=True)
        print('wrote', out)


main()
