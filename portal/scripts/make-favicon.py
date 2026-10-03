"""Generate a favicon from just the flower mark of the GIO4X logo.

Detects the left-most content cluster (the flower) in public/logo.png by finding
the first wide vertical gap before the 'GIO4X' wordmark, crops it, squares it on a
transparent canvas, and writes favicon.ico + icon.png into the portal app dir
(Next.js App Router auto-serves app/favicon.ico and app/icon.png).
"""
import sys
from PIL import Image

SRC = "apps/portal/public/logo.png"
APP_DIR = "apps/portal/src/app"

im = Image.open(SRC).convert("RGBA")
W, H = im.size
px = im.load()
alpha = im.split()[3]
amask = alpha.load()

# column has content if any pixel alpha > threshold
TH = 20
col_has = [False] * W
for x in range(W):
    for y in range(0, H, 2):  # sample every other row for speed
        if amask[x, y] > TH:
            col_has[x] = True
            break

# first content column
c0 = next((x for x in range(W) if col_has[x]), 0)

# walk right from c0 until a gap of >= GAP empty columns (separates flower / text)
GAP = 40
x = c0
gap_run = 0
flower_right = W
while x < W:
    if not col_has[x]:
        gap_run += 1
        if gap_run >= GAP:
            flower_right = x - gap_run + 1
            break
    else:
        gap_run = 0
    x += 1

# row bbox within [c0, flower_right]
top, bottom = None, None
for y in range(H):
    row_has = False
    for xx in range(c0, flower_right, 2):
        if amask[xx, y] > TH:
            row_has = True
            break
    if row_has:
        if top is None:
            top = y
        bottom = y

left, right = c0, flower_right
print(f"image={W}x{H} flower_bbox=({left},{top},{right},{bottom}) "
      f"w={right-left} h={bottom-top}")

flower = im.crop((left, top, right, bottom))
fw, fh = flower.size

# square canvas with ~8% padding, centered, transparent
side = int(max(fw, fh) * 1.16)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(flower, ((side - fw) // 2, (side - fh) // 2), flower)

# high-res master + favicon.ico (multi-size) + apple icon
master = canvas.resize((512, 512), Image.LANCZOS)
master.save(f"{APP_DIR}/icon.png")
master.resize((180, 180), Image.LANCZOS).save(f"{APP_DIR}/apple-icon.png")
canvas.resize((64, 64), Image.LANCZOS).save(
    f"{APP_DIR}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
)
# a preview for visual confirmation (not committed)
master.save("scripts/_favicon_preview.png")
print("wrote:", f"{APP_DIR}/icon.png", f"{APP_DIR}/apple-icon.png", f"{APP_DIR}/favicon.ico")
