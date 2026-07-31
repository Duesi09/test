#!/usr/bin/env bash
# Assemble the lewis-hamilton-44 site from a fresh clone + payload dir.
# Run from the repo root with the payload untarred at ./payload.
set -euo pipefail

STORYBOARD_URL="https://d8j0ntlcm91z4.cloudfront.net/user_3G2gn1RfU9WwRpCA6M8u5wyxMAB/hf_20260731_101846_2b5532f5-0f12-4fa2-acea-f502f610e6a9.png"

mkdir -p app/public/assets/story app/public/fonts refs

# 1. Storyboard: keep the working artifact, slice the six panels into stills.
curl -fsSL -o refs/storyboard.png "$STORYBOARD_URL"
convert refs/storyboard.png -crop 3x2@ +repage /tmp/p_%d.png
i=0
for n in hero origins dynasty plate-macro beyond red; do
  convert "/tmp/p_$i.png" -gravity center -crop 97%x97%+0+0 +repage \
    -resize 1200x -quality 85 "app/public/assets/story/$n.jpg"
  i=$((i + 1))
done
identify -format "%f %wx%h\n" app/public/assets/story/*.jpg

# 2. Payload files into place.
cp -r payload/app/. app/

# 3. Site style layer (idempotent append).
if ! grep -q "lewis-hamilton-44 site layer" app/src/styles.css; then
  cat payload/styles-append.css >> app/src/styles.css
fi

# 4. Template patches, fonts, favicons.
python3 payload/scripts/patch.py
python3 payload/scripts/fonts.py
python3 payload/scripts/favicon.py

# 5. Sanity greps (mechanical gate, code side).
! grep -rn "—\|–" app/src/routes/ app/src/scroll-scrub-scenes.ts || {
  echo "DASH FOUND"; exit 1;
}
! grep -rniE "lorem ipsum|REMOVE_THIS|blank-app-v1" app/src/routes/index.tsx || {
  echo "PLACEHOLDER FOUND"; exit 1;
}
! grep -rn "h-screen" app/src/routes/index.tsx || { echo "H-SCREEN FOUND"; exit 1; }

# 6. Commit and push.
git add -A
git -c user.email=agent@higgsfield.ai -c user.name="Higgsfield Agent" \
  commit -m "Lewis Hamilton tribute: cinematic one-pager, storyboard stills, head kit"
git -c http.extraHeader="Authorization: token GIT_TOKEN_PLACEHOLDER" push origin main
echo "APPLY OK"
