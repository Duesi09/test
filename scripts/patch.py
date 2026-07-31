"""Patch template files: head kit links, drop template branding, CSP blob:."""

ROOT = "app/src/routes/__root.tsx"
src = open(ROOT).read()

old = '      { name: "author", content: "Higgsfield" },\n'
assert old in src, "author line not found"
src = src.replace(old, "")

old = '      { name: "twitter:site", content: "@Higgsfield" },\n'
assert old in src, "twitter:site line not found"
src = src.replace(old, '      { name: "theme-color", content: "#0B0B0D" },\n')

old = '      ...(favicon ? [{ rel: "icon", href: favicon }] : []),'
assert old in src, "favicon links line not found"
src = src.replace(
    old,
    old
    + '\n      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },'
    + '\n      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },'
    + '\n      { rel: "manifest", href: "/site.webmanifest" },',
)
open(ROOT, "w").write(src)

SEC = "app/src/lib/security-headers.server.ts"
src = open(SEC).read()
old = "media-src 'self' https:; "
assert old in src, "media-src directive not found"
src = src.replace(old, "media-src 'self' https: blob:; ")
open(SEC, "w").write(src)

print("patches applied")
