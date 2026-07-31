# Lewis Hamilton 44 — tribute website

A cinematic one-page tribute to Lewis Hamilton, in the spirit of landonorris.com:
carbon-black ground, rosso corsa accent, oversized Satoshi display type, and a
film-frame visual world generated with Higgsfield.

**Live site:** https://lewis-hamilton-44.higgsfield.app

## What is in this branch

This branch carries the authored source of the site. The deployable project
(a React 19 + TanStack Start app on a Cloudflare Worker) lives in the site's
Higgsfield-managed repository; the network policy of the build session did not
allow mirroring its binary assets (storyboard render, sliced stills, fonts,
favicons) to GitHub, so this branch holds every hand-written file plus the
scripts that assemble the rest deterministically.

| Path | Purpose |
|---|---|
| `app/src/routes/index.tsx` | The whole page: nav, pinned scroll-linked hero, metrics band, seasons timeline, Ferrari split feature, bento, record book, footer |
| `styles-append.css` | The site's full style layer (appended to the template's `app/src/styles.css`) |
| `app/src/scroll-scrub-scenes.ts` | Brand tokens + the authored 4-chapter scroll-film journey (film generation deferred, see below) |
| `app/design-brief.md` | The design brief the build follows (palette, type, section plan, CTA garments, compliance notes) |
| `app/public/favicon.svg`, `site.webmanifest` | Head kit sources |
| `scripts/` | Deterministic assembly: font download, favicon rasterization, template patches |
| `apply.sh` | Assembles a fresh clone of the site template into the finished site |

## Deferred: the animated scroll film

The intended hero is a scroll-scrubbed single-shot film (the visitor's scroll
plays a ~15s studio take of the scarlet car). The Higgsfield workspace had no
generation credits at build time, so the site ships with a scroll-linked
cinematic still hero instead. The journey copy, chapter structure, storyboard
and encode plan are all authored; once credits are available the film can be
generated and wired in one pass (see `app/design-brief.md`, journey block).

## Disclaimer

An unofficial fan tribute. Not affiliated with Lewis Hamilton, Scuderia
Ferrari or Formula 1. Imagery is AI-generated concept art, not photography.
