# duesify.com — Coming soon

A one-screen "COMING SOON" page with a little chibi robot that lives on the letters.

## What it does

The robot drops in, waves, takes a few steps, backflips off the letters into a hidden pool,
pops out next to the N, gets bonked by a portal gun, portals up to the ceiling, tumbles down,
lands like a superhero, gets an idea, puts on a hard hat, shoots one portal next to each board spot and
teleport-builds wooden boards onto the letters (one of 10 layouts, picked at random per visit).
Then it does a cute little dance on the spot, forever.

- Click the robot to make it Floss, Dab or dance.
- Hover it and it smiles at you.
- Add `?layout=1` … `?layout=10` to the URL to see a specific board layout.
- With "reduce motion" turned on, it just stands and breathes.

## Files

| File | What it is |
|------|------------|
| `index.html` | The page (text, styles, portal/board effects). |
| `robot-rig.js` | The robot: drawing and every animation clip. |
| `scene.js` | The story the robot plays on the page. |
| `favicon.png` | Tab icon (rendered from the rig). |
| `robot/` | GIFs, sprite sheets and a Unity importer for all animations (see `robot/README.md`). |
| `tools/` | Preview page and scripts that export the sprite sheets and GIFs. |

No build step. Open `index.html` in a browser to run it locally.

## Deploy on Netlify

1. Netlify → **Add new site → Import an existing project → GitHub** → pick this repo.
2. **Branch to deploy:** `duesify`
3. **Build command:** leave empty. **Publish directory:** `.`
4. Deploy, then add `duesify.com` under **Domain management**.
