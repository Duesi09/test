import subprocess

from PIL import Image, ImageDraw

CARBON = (11, 11, 13)
INK = (244, 242, 239)
RED = (210, 34, 42)


def draw_four(d, size, x0, color, w):
    """A geometric numeral 4: diagonal, crossbar, stem. Coordinates in a
    0..1 box scaled by size, offset by x0."""

    def pt(x, y):
        return (x0 + x * size, y * size)

    d.line([pt(0.42, 0.22), pt(0.20, 0.62)], fill=color, width=w)
    d.line([pt(0.20, 0.62), pt(0.52, 0.62)], fill=color, width=w)
    d.line([pt(0.42, 0.22), pt(0.42, 0.78)], fill=color, width=w)


def make(size):
    img = Image.new("RGB", (size, size), CARBON)
    d = ImageDraw.Draw(img)
    w = max(2, int(size * 0.075))
    half = size * 0.52
    draw_four(d, size, -size * 0.04, INK, w)
    draw_four(d, size, half - size * 0.08, RED, w)
    return img


for s, name in [
    (512, "icon-512.png"),
    (192, "icon-192.png"),
    (180, "apple-touch-icon.png"),
    (32, "favicon-32.png"),
    (16, "favicon-16.png"),
]:
    make(s).save(f"app/public/{name}")

maskable = Image.new("RGB", (512, 512), CARBON)
maskable.paste(make(384), (64, 64))
maskable.save("app/public/icon-512-maskable.png")

make(32).save("app/public/favicon.ico", sizes=[(16, 16), (32, 32)])
print("favicons done")
subprocess.run(["ls", "-la", "app/public"], check=False)
