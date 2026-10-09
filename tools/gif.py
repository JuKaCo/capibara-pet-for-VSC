"""Frames -> pixel-art GIF: scaled up nearest-neighbour (2x by default), one shared palette (no flicker), no dithering.

    python tools/gif.py <frames dir> <out.gif> <ms per frame> [scale]
"""
import os
import sys

from PIL import Image

src, out, ms = sys.argv[1], sys.argv[2], int(sys.argv[3])
k = int(sys.argv[4]) if len(sys.argv) > 4 else 2
frames = [Image.open(os.path.join(src, f)).convert('RGB') for f in sorted(os.listdir(src)) if f.endswith('.png')]
frames = [f.resize((f.width * k, f.height * k), Image.NEAREST) for f in frames]
w, h = frames[0].size
sample = frames[:: max(1, len(frames) // 6)]
strip = Image.new('RGB', (w, h * len(sample)))
for i, f in enumerate(sample):
    strip.paste(f, (0, i * h))
pal = strip.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
q[0].save(out, save_all=True, append_images=q[1:], duration=ms, loop=0, optimize=True, disposal=1)
print(f'{out}: {len(q)} frames, {w}x{h}, {os.path.getsize(out) // 1024} KB')
