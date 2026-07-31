import os
import re
import urllib.request


def fetch(url):
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/126"}
    )
    return urllib.request.urlopen(req, timeout=30).read()


os.makedirs("app/public/fonts", exist_ok=True)

css = fetch(
    "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap"
).decode()
got = 0
for block in css.split("@font-face"):
    if "italic" in block.lower():
        continue
    weight = re.search(r"font-weight:\s*(\d+)", block)
    url = re.search(r"url\('(//[^']+\.woff2)'\)", block)
    if weight and url:
        path = f"app/public/fonts/satoshi-{weight.group(1)}.woff2"
        open(path, "wb").write(fetch("https:" + url.group(1)))
        got += 1
assert got >= 4, f"satoshi weights downloaded: {got}"

css = fetch(
    "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
).decode()
got = 0
for block in css.split("@font-face"):
    if "U+0000-00FF" not in block:
        continue
    weight = re.search(r"font-weight:\s*(\d+)", block)
    url = re.search(r"url\((https://[^)]+\.woff2)\)", block)
    if weight and url:
        path = f"app/public/fonts/jbm-{weight.group(1)}.woff2"
        open(path, "wb").write(fetch(url.group(1)))
        got += 1
assert got >= 3, f"jbm weights downloaded: {got}"
print("fonts:", sorted(os.listdir("app/public/fonts")))
