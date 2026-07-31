/**
 * Scene data for the scroll-scrub journey.
 *
 * FILM DEFERRED: the workspace had no generation credits at build time, so the
 * single-shot film does not exist yet and the home route composes a static
 * cinematic page instead of <ScrollScrub />. The journey below is fully
 * authored so the upgrade is one step: generate the ~15s single-shot film from
 * refs/storyboard.png, cut it into four seam-locked segments under
 * public/assets/world/ (posters from the encoded clips), then render
 * <ScrollScrub scenes={scrollScrubScenes} theme={scrollScrubTheme} /> in
 * src/routes/index.tsx.
 *
 * Keep this array a module constant. Changing its identity on every render
 * intentionally rebuilds the media controller.
 */
import type {
  ScrollScrubScene,
  ScrollScrubTheme,
} from "@/components/scroll-scrub/scroll-scrub";

/** Brand tokens for the journey layer, from app/design-brief.md. */
export const scrollScrubTheme: ScrollScrubTheme = {
  accent: "#D2222A",
  background: "#0B0B0D",
  ink: "#F4F2EF",
  muted: "#9A968F",
};

export const scrollScrubScenes: ScrollScrubScene[] = [
  {
    id: "the-name",
    label: "44",
    kicker: "One flying lap",
    title: "Lewis Hamilton",
    body: "Seven world championships. More wins than any driver in history. And one last mountain, in red.",
    tags: ["7 titles", "105 wins", "104 poles"],
    clip: "/assets/world/scene-01.mp4",
    poster: "/assets/story/hero.jpg",
    mobileClip: "/assets/world/scene-01-mobile.mp4",
    mobilePoster: "/assets/story/hero.jpg",
    align: "left",
    scroll: 2,
  },
  {
    id: "lights-out",
    label: "Origins",
    title: "Lights out in Stevenage",
    body: "A first kart at eight, a handshake with McLaren at thirteen, a debut podium at 22 and a world title one season later.",
    tags: ["Debut 2007", "Champion 2008"],
    clip: "/assets/world/scene-02.mp4",
    poster: "/assets/story/origins.jpg",
    mobileClip: "/assets/world/scene-02-mobile.mp4",
    mobilePoster: "/assets/story/origins.jpg",
    align: "right",
    scroll: 2,
  },
  {
    id: "the-apex",
    label: "Dynasty",
    title: "The Mercedes dynasty",
    body: "The 2013 gamble nobody understood became six titles in seven seasons and a record book rewritten line by line.",
    tags: ["6 titles, 2014 to 2020"],
    clip: "/assets/world/scene-03.mp4",
    poster: "/assets/story/dynasty.jpg",
    mobileClip: "/assets/world/scene-03-mobile.mp4",
    mobilePoster: "/assets/story/dynasty.jpg",
    align: "left",
    scroll: 2,
  },
  {
    id: "scarlet",
    label: "Ferrari",
    title: "Now in red",
    body: "Maranello since 2025. The project is plain: Ferrari's first drivers title since 2007, and an eighth of his own.",
    tags: ["Scuderia Ferrari"],
    clip: "/assets/world/scene-04.mp4",
    poster: "/assets/story/red.jpg",
    mobileClip: "/assets/world/scene-04-mobile.mp4",
    mobilePoster: "/assets/story/red.jpg",
    align: "right",
    scroll: 2,
  },
];
