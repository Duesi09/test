# Duesify robot: animation pack

Each animation is exported as a separate transparent PNG sprite sheet and animated GIF. Every frame comes from the same rig (`robot-rig.js`), so the robot's design and proportions stay identical across all frames.

| Animation | Frames | FPS | Length | Loops |
|-----------|-------:|----:|-------:|:-----:|
| Idle      | 48 | 12 | 4 s | yes |
| Walk      | 48 | 16 | 3 s | yes |
| Run       | 48 | 24 | 2 s | yes |
| Jump      | 48 | 16 | 3 s | no |
| FallOver  | 64 | 16 | 4 s | no (ends lying down) |
| Dance     | 96 | 12 | 8 s | yes |
| Backflip  | 64 | 16 | 4 s | no |
| StandUp   | 64 | 16 | 4 s | no (starts from the FallOver end pose) |
| Wave      | 32 | 16 | 2 s | yes |
| Floss     | 32 | 16 | 2 s | yes |
| Dab       | 32 | 16 | 2 s | yes |
| Cannonball| 48 | 16 | 3 s | no |
| Shake     | 24 | 24 | 1 s | no (shakes off water) |
| FindGun   | 56 | 16 | 3.5 s | no (gun bonks its head, it catches it) |
| Shoot     | 40 | 16 | 2.5 s | no (fires the portal gun twice) |

## Files

- `Sprites/<Name>.png`: sprite sheet, 8 columns, 384 × 480 px cells, transparent.
- `GIFs/<Name>.gif`: preview GIF, transparent. Looping clips loop; one-shots play once.
- `robot_animations.json`: cell size, pivot, fps, loop flag and the rectangle of every frame.
- `Unity/Editor/DuesifyRobotAnimationBuilder.cs`: builds everything in Unity for you.

Every cell is the same size, and the robot's feet always sit at the same pivot point: x = 50 % and y = 7.5 % up from the bottom (the bottom-center ground point).

## Unity 2D

1. Copy this whole `robot` folder into your project's `Assets` folder.
2. Run **Tools → Duesify Robot → Build Animations**.
3. It slices all sheets (pivot at the feet, 100 PPU) and creates:
   - `Generated/<Name>.anim` for each clip, with the correct fps and looping
   - `Generated/Robot.controller`
4. Add a `SpriteRenderer` and an `Animator` to a GameObject, then assign `Robot.controller`.

Animator parameters:

- `Speed` (float): 0 plays Idle, above 0.1 plays Walk, above 2 plays Run.
- `Dance` (bool)
- `Jump`, `Backflip` and `FallOver` (triggers). FallOver always continues into StandUp, then back to Idle.
- `Wave`, `Floss` and `Dab` (bools), and `Cannonball`, `Shake`, `FindGun` and `Shoot` (triggers).

The robot faces right. Use `SpriteRenderer.flipX` to make it face left.

## Regenerating

```
node tools/export.js build/frames 1.5        # needs Playwright + Chromium
python3 tools/build_assets.py build/frames robot
```

`tools/preview.html` shows every clip in the browser. Add `?step=4` to see every 4th frame, or `?frame=Backflip:32` to see a single frame.
