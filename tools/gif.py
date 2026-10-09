"""Frames -> pixel-art GIF: 2x nearest-neighbour, one shared palette (no flicker), no dithering.

    python tools/gif.py <frames dir> <out.gif> <ms per frame>
"""
import os
import sys

from PIL import Image

src, out, ms = sys.argv[1], sys.argv[2], int(sys.argv[3])
frames = [Image.open(os.path.join(src, f)).convert('RGB') for f in sorted(os.listdir(src)) if f.endswith('.png')]
frames = [f.resize((f.width * 2, f.height * 2), Image.NEAREST) for f in frames]
w, h = frames[0].size
sample = frames[:: max(1, len(frames) // 6)]
strip = Image.new('RGB', (w, h * len(sample)))
for k, f in enumerate(sample):
    strip.paste(f, (0, k * h))
pal = strip.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
q[0].save(out, save_all=True, append_images=q[1:], duration=ms, loop=0, optimize=True, disposal=1)
print(f'{out}: {len(q)} frames, {w}x{h}, {os.path.getsize(out) // 1024} KB')
