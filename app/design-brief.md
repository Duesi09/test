# Design brief: lewis-hamilton-44

- **Design read:** For F1 fans and the curious. The gravity of the most decorated career in Formula 1, felt at scroll speed. Register: monumental, reverent, precise.
- **Concept spine:** One flying lap. The page is a single qualifying lap through the career: lights out (origins), the apex (the Mercedes dynasty), the checkered flag in red (Ferrari). Spine family: journey/waypoints.
- **Delivery tier:** cinema.
- **Locked palette:** carbon black `#0B0B0D` ground, off-white ink `#F4F2EF`, muted `#9A968F`, single accent rosso corsa red `#D2222A`. Defense: the subject's actual racing livery colors (Scuderia Ferrari rosso corsa on carbon). Pure red accent: not in any banned family (not orange/amber/ember, not neon, not beige/brass, not violet).
- **Locked type:** Satoshi (400/500 body, 700/900 display) + JetBrains Mono (served as "LH Mono") for timing-data readouts. From the approved pairing table. No serif.
- Animation mode: non-animated (forced fallback: the workspace is on the free plan with 0.5 credits, so video generation was impossible at build time; the user had delegated the build, saying "start working when you are ready", and was unreachable at intake. The intended default remains the animated website: the journey block below plus src/scroll-scrub-scenes.ts are fully authored so the film can be generated and wired in one upgrade pass once credits exist.)

## Journey block (authored for the upgrade pass, A4 single-shot)

- **Journey shape:** single-shot. One continuous ~15s studio film, cut into 4 seam-locked chapter segments at encode time (cuts of one take, so every seam is an exact shared frame).
- **World grammar:** one scarlet grand prix car in a pitch-black studio void, low haze, carbon fiber surfaces, single warm key light plus a red practical glow, locked exposure, slow constant dolly, no cuts, no on-screen text or logos. Subject center-safe, edges expendable, upper third clear for copy.
- **Journey:** 1 `the-name` (wide establishing, H1) → 2 `lights-out` (front wing travel, origins) → 3 `the-apex` (halo glide, Mercedes dynasty) → 4 `scarlet` (rear wing glow finale, Ferrari). Copy lives in src/scroll-scrub-scenes.ts.
- **How the journey enacts the spine:** the scroll is the lap; each chapter is a sector board on one unbroken flying lap that ends at the checkered flag in red.
- **Mobile framing:** subject center-safe; 720p mobile encodes; mobilePoster for every mobileClip.
- **Delivery budget:** desktop clips <= 32 MiB total, mobile <= 16 MiB.
- **Storyboard:** refs/storyboard.png (approved 6-panel single-move board; also the source of the interim stills in public/assets/story/).

## Interim Tier-1 (what shipped this pass)

Scroll-linked cinematic hero: a 172dvh pinned hero whose film-frame still scales and regrades with the user's scroll position (rAF writes a progress custom property; CSS maps it to transform and overlay only). Interactive, input-driven, reduced-motion safe. Plus the drawn racing-line motif threading the page.

## Section plan (7 families, no consecutive repeats)

1. Hero: cinematic pinned full-bleed still (film frame), kicker + H1 + sub + one CTA.
2. `numbers`: oversized metrics strip over a darkened macro plate (7 / 105 / 104 / 202). Eyebrow 1.
3. `seasons`: waypoint timeline, vertical rail + editorial rows, sticky still rail right.
4. `red`: asymmetric split feature, image left, overlapping text panel right.
5. `beyond`: gapless bento, 3 cells with real variation (image cell, solid scarlet cell, carbon cell). Eyebrow 2.
6. `records`: Swiss data table, hairline rows, one scarlet numeral.
7. Footer: shear band CTA + tribute disclaimer.

Eyebrow budget: ceil(7/3) = 3. Used: hero kicker, S2, S5.

## Asset plan

- Sliced from the approved storyboard (one coherent generated world): hero.jpg, origins.jpg, dynasty.jpg, plate-macro.jpg, beyond.jpg, red.jpg in public/assets/story/. Original board kept at refs/storyboard.png.
- Monogram: hand-drawn inline SVG 44 mark (nav, footer, favicon source).
- Head kit: favicon.svg + ico + 16/32 pngs, apple-touch-icon, 192/512 + maskable + site.webmanifest, theme-color, full OG/twitter block via app-meta and root head.
- Cover/OG: composed from the storyboard's closing panel per the platform cover pipeline.
- Deferred for credits: the single-shot film, section plates beyond the macro slice, the generated icon sheet, the helmet still. No stock substitutes were used.

## CTA inventory (bespoke garments, no shared button style)

1. Hero "See the whole lap" (to `#seasons`): marker travels along a drawn racing line on hover.
2. Beyond "Visit Mission 44" (outbound): viewfinder corner brackets close around the label.
3. Footer "lewishamilton.com" (outbound): full band shears and regrades on hover.

One label per intent. No em or en dashes in visible copy. All statistics are real career facts labeled "through the 2025 season".

## Anti-convergence ledger

First build in this chat; nothing to differ from. Corner language: all-sharp. Rationed garment trio (drawing underline, flood fill, framed block) used zero times.

## Compliance notes

- Tribute site: footer states it is unofficial and unaffiliated, and that imagery is generated concept art.
- No real-person likeness was generated: the visual world is car, material and light only.
