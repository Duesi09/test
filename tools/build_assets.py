"""Turns the frames from tools/export.js into sprite sheets, GIFs and Unity metadata.

Usage: python3 tools/build_assets.py <framesDir> <outDir>
"""
import json
import sys
from pathlib import Path

from PIL import Image

ORDER = ["Idle", "Walk", "Run", "Jump", "FallOver", "Dance", "Backflip", "StandUp",
         "Wave", "Floss", "Dab", "Cannonball", "Shake", "FindGun", "Shoot",
         "Tumble", "SuperheroLanding"]
COLS = 8


def main(frames_dir: Path, out_dir: Path) -> None:
    meta = json.loads((frames_dir / "meta.json").read_text())
    cw, ch = meta["cell"]["w"], meta["cell"]["h"]
    (out_dir / "Sprites").mkdir(parents=True, exist_ok=True)
    (out_dir / "GIFs").mkdir(parents=True, exist_ok=True)

    animations = []
    for name in ORDER:
        info = meta["clips"][name]
        files = sorted((frames_dir / name).glob(f"{name}_*.png"))
        frames = [Image.open(f).convert("RGBA") for f in files]
        assert len(frames) == info["frames"], name
        rows = (len(frames) + COLS - 1) // COLS

        sheet = Image.new("RGBA", (COLS * cw, rows * ch), (0, 0, 0, 0))
        rects = []
        for i, fr in enumerate(frames):
            x, y = (i % COLS) * cw, (i // COLS) * ch
            sheet.paste(fr, (x, y))
            # Unity measures sprite rects from the bottom-left corner of the texture.
            rects.append({"name": f"{name}_{i:03d}", "x": x, "y": rows * ch - y - ch, "w": cw, "h": ch})
        # 256-colour palette with alpha: visually identical for this flat art, ~4x smaller.
        sheet = sheet.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        sheet.save(out_dir / "Sprites" / f"{name}.png", optimize=True)

        # GIF: transparent background, loops forever for looping clips, plays once otherwise.
        gif_frames = []
        for fr in frames:
            alpha = fr.getchannel("A")
            rgb = Image.new("RGB", fr.size, (255, 255, 255))
            rgb.paste(fr, mask=alpha)
            p = rgb.convert("P", palette=Image.Palette.ADAPTIVE, colors=255)
            mask = alpha.point(lambda a: 255 if a < 128 else 0)
            p.paste(255, mask=mask)
            gif_frames.append(p)
        extra = {"loop": 0} if info["loop"] else {}
        gif_frames[0].save(
            out_dir / "GIFs" / f"{name}.gif",
            save_all=True,
            append_images=gif_frames[1:],
            duration=round(1000 / info["fps"]),
            disposal=2,
            transparency=255,
            optimize=False,
            **extra,
        )

        animations.append({
            "name": name,
            "texture": f"Sprites/{name}.png",
            "frames": len(frames),
            "fps": info["fps"],
            "loop": info["loop"],
            "columns": COLS,
            "rows": rows,
            "rects": rects,
        })
        print(f"{name}: {len(frames)} frames @ {info['fps']} fps -> {COLS}x{rows} sheet")

    manifest = {
        "cellWidth": cw,
        "cellHeight": ch,
        "pivotX": meta["cell"]["groundX"] / cw,
        "pivotY": 1 - meta["cell"]["groundY"] / ch,
        "pixelsPerUnit": 100,
        "animations": animations,
    }
    (out_dir / "robot_animations.json").write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
