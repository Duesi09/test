import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

/* Scroll-linked hero: writes a 0..1 progress custom property that the CSS
 * turns into transform and overlay changes only. Skipped entirely under
 * prefers-reduced-motion; the static composition stands on its own. */
function useHeroProgress() {
  const bandRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const rect = band.getBoundingClientRect();
      const span = Math.max(1, rect.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -rect.top / span));
      band.style.setProperty("--lh-p", p.toFixed(4));
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue, { passive: true });
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return bandRef;
}

/* Hand-drawn 44 monogram, inline SVG. Color comes from CSS classes. */
function Monogram({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 44 44">
      <path className="lh-mono-stroke" d="M19 8 L9 26 H24 M19 8 V36" />
      <path className="lh-mono-stroke" d="M35 8 L25 26 H40 M35 8 V36" />
      <path className="lh-mono-base" d="M8 41 H40" />
    </svg>
  );
}

const NAV_LINKS = [
  ["#numbers", "Numbers"],
  ["#seasons", "Seasons"],
  ["#red", "Ferrari"],
  ["#beyond", "Beyond"],
  ["#records", "Records"],
] as const;

function SiteNav() {
  return (
    <header className="lh-nav">
      <a className="lh-nav__brand" href="#top">
        <Monogram className="lh-nav__mark" />
        <span className="lh-nav__name">Lewis Hamilton</span>
      </a>
      <nav aria-label="Sections" className="lh-nav__links">
        {NAV_LINKS.map(([href, label]) => (
          <a href={href} key={href}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}

/* Hero CTA: the arrow is a small marker that travels along a drawn racing
 * line on hover and focus. */
function LapLink() {
  return (
    <a className="lh-lap-link" href="#seasons">
      <span className="lh-lap-link__label">See the whole lap</span>
      <span aria-hidden="true" className="lh-lap-link__trackwrap">
        <svg className="lh-lap-link__track" fill="none" viewBox="0 0 220 24">
          <path className="lh-lap-link__path" d="M2 20 C 60 20, 70 4, 120 4 S 200 16, 218 12" />
        </svg>
        <span className="lh-lap-link__marker" />
      </span>
    </a>
  );
}

const METRICS = [
  ["7", "world championships"],
  ["105", "grand prix wins"],
  ["104", "pole positions"],
  ["202", "podium finishes"],
] as const;

const SEASONS: ReadonlyArray<{
  year: string;
  text: string;
  accent?: boolean;
}> = [
  {
    year: "1993",
    text: "A first kart at eight years old. Within two years he is a British cadet champion.",
  },
  {
    year: "1998",
    text: "Signed to the McLaren young driver programme at thirteen, the youngest signing the team had ever made.",
  },
  {
    year: "2007",
    text: "Formula 1 debut in Melbourne. A podium first time out, then the rookie title bid that fell one point short.",
  },
  {
    year: "2008",
    accent: true,
    text: "World champion at 23, seized at the last corner of the last lap in Brazil.",
  },
  {
    year: "2013",
    text: "Leaves McLaren for Mercedes. Plenty called it a mistake. It became a dynasty.",
  },
  {
    year: "2020",
    text: "A seventh title equals Michael Schumacher. A knighthood follows within weeks.",
  },
  {
    year: "2021",
    text: "The first driver ever to reach 100 pole positions and 100 race wins.",
  },
  {
    year: "2025",
    text: "Scarlet at last. He joins Scuderia Ferrari and wins the Shanghai sprint within weeks of arriving.",
  },
];

const RECORDS = [
  { label: "Grand prix wins", value: "105" },
  { label: "Pole positions", value: "104", accent: true },
  { label: "Podium finishes", value: "202" },
  { label: "Consecutive points finishes", value: "48" },
  { label: "Wins at one grand prix", value: "9" },
  { label: "Straight seasons with a win", value: "18" },
] as const;

function Index() {
  const heroRef = useHeroProgress();

  return (
    <main className="lh-page" id="top">
      <SiteNav />

      <section aria-label="Lewis Hamilton" className="lh-hero" ref={heroRef}>
        <div className="lh-hero__pin">
          <div className="lh-hero__media">
            <img
              alt="A scarlet grand prix car standing in a dark studio, lit by a single red rim light"
              className="lh-hero__img"
              fetchPriority="high"
              src="/assets/story/hero.jpg"
            />
            <div aria-hidden="true" className="lh-hero__grade" />
          </div>
          <div className="lh-hero__copy">
            <p className="lh-kicker">One flying lap</p>
            <h1 className="lh-hero__title">
              Lewis
              <br />
              Hamilton
            </h1>
            <p className="lh-hero__sub">
              Seven world championships. More wins than any driver in history.
              And one last mountain, in red.
            </p>
            <LapLink />
          </div>
        </div>
      </section>

      <section aria-labelledby="numbers-title" className="lh-numbers" id="numbers">
        <img
          alt=""
          aria-hidden="true"
          className="lh-numbers__plate"
          loading="lazy"
          src="/assets/story/plate-macro.jpg"
        />
        <div className="lh-numbers__inner">
          <p className="lh-eyebrow">Career in numbers</p>
          <h2 className="lh-visually-hidden" id="numbers-title">
            Career in numbers
          </h2>
          <svg
            aria-hidden="true"
            className="lh-numbers__line"
            fill="none"
            preserveAspectRatio="none"
            viewBox="0 0 1200 120"
          >
            <path d="M0 96 C 220 96, 260 24, 470 24 S 760 96, 940 96 S 1160 40, 1200 40" />
          </svg>
          <dl className="lh-numbers__grid">
            {METRICS.map(([value, label]) => (
              <div className="lh-numbers__cell" key={label}>
                <dd>{value}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
          <p className="lh-footnote">All figures through the 2025 season.</p>
        </div>
      </section>

      <section aria-labelledby="seasons-title" className="lh-seasons" id="seasons">
        <h2 className="lh-h2" id="seasons-title">
          The seasons
        </h2>
        <div className="lh-seasons__layout">
          <ol className="lh-seasons__list">
            {SEASONS.map((row) => (
              <li
                className={row.accent ? "lh-seasons__row lh-seasons__row--accent" : "lh-seasons__row"}
                key={row.year}
              >
                <span aria-hidden="true" className="lh-seasons__node" />
                <span className="lh-seasons__year">{row.year}</span>
                <p className="lh-seasons__text">{row.text}</p>
              </li>
            ))}
          </ol>
          <aside aria-label="Stills from the film" className="lh-seasons__stills">
            <figure>
              <img
                alt="Front wing of the scarlet car emerging from darkness, carbon weave catching the light"
                loading="lazy"
                src="/assets/story/origins.jpg"
              />
              <figcaption>Sector one. Where it starts.</figcaption>
            </figure>
            <figure>
              <img
                alt="The cockpit halo of the scarlet car under a warm key light"
                loading="lazy"
                src="/assets/story/dynasty.jpg"
              />
              <figcaption>Sector two. The dynasty years.</figcaption>
            </figure>
          </aside>
        </div>
      </section>

      <section aria-labelledby="red-title" className="lh-red" id="red">
        <div className="lh-red__media">
          <img
            alt="Rear three quarter view of the scarlet car, rain light glowing through red haze"
            loading="lazy"
            src="/assets/story/red.jpg"
          />
        </div>
        <div className="lh-red__panel">
          <div className="lh-red__block">
            <span aria-hidden="true" className="lh-red__rule" />
            <h2 className="lh-h2" id="red-title">
              Now in red
            </h2>
            <p>
              In January 2025 the most decorated driver in the sport walked
              into Maranello. The project is plain: bring Ferrari its first
              drivers title since 2007, and take his own eighth.
            </p>
            <p className="lh-caption">Scuderia Ferrari · since 2025</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="beyond-title" className="lh-beyond" id="beyond">
        <p className="lh-eyebrow">Beyond the grid</p>
        <h2 className="lh-h2" id="beyond-title">
          More than a driver
        </h2>
        <div className="lh-beyond__grid">
          <article className="lh-beyond__cell lh-beyond__cell--image">
            <img
              alt="The scarlet car seen from above the engine cover, rear wing ahead"
              loading="lazy"
              src="/assets/story/beyond.jpg"
            />
            <div className="lh-beyond__overlay">
              <h3>Mission 44</h3>
              <p>
                His foundation backs young people from underrepresented
                backgrounds into education, motorsport and STEM careers.
              </p>
              <a
                className="lh-view-cta"
                href="https://mission44.org"
                rel="noreferrer noopener"
                target="_blank"
              >
                <span aria-hidden="true" className="lh-view-cta__c lh-view-cta__c--tl" />
                <span aria-hidden="true" className="lh-view-cta__c lh-view-cta__c--tr" />
                <span aria-hidden="true" className="lh-view-cta__c lh-view-cta__c--bl" />
                <span aria-hidden="true" className="lh-view-cta__c lh-view-cta__c--br" />
                Visit Mission 44
              </a>
            </div>
          </article>
          <article className="lh-beyond__cell lh-beyond__cell--scarlet">
            <h3>Film and fashion</h3>
            <p>
              Co-producer of the 2025 Formula 1 feature film. Met Gala
              co-chair. A decade of design work from Tommy Hilfiger
              collections to his own lines.
            </p>
          </article>
          <article className="lh-beyond__cell lh-beyond__cell--carbon">
            <h3>The portfolio</h3>
            <p>
              Part-owner of the Denver Broncos. Founder of Almave, a
              non-alcoholic agave spirit. An investor across sport, food and
              media.
            </p>
          </article>
        </div>
      </section>

      <section aria-labelledby="records-title" className="lh-records" id="records">
        <h2 className="lh-h2 lh-h2--center" id="records-title">
          The record book
        </h2>
        <dl className="lh-records__table">
          {RECORDS.map((row) => (
            <div
              className={
                "accent" in row && row.accent
                  ? "lh-records__row lh-records__row--accent"
                  : "lh-records__row"
              }
              key={row.label}
            >
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="lh-footnote lh-footnote--center">
          Records held outright in Formula 1, through the 2025 season.
        </p>
      </section>

      <footer className="lh-footer">
        <a
          className="lh-band-cta"
          href="https://www.lewishamilton.com"
          rel="noreferrer noopener"
          target="_blank"
        >
          <span className="lh-band-cta__note">The official site</span>
          <span className="lh-band-cta__label">lewishamilton.com</span>
          <span aria-hidden="true" className="lh-band-cta__arrow">
            →
          </span>
        </a>
        <div className="lh-footer__base">
          <Monogram className="lh-footer__mark" />
          <p className="lh-footer__legal">
            An unofficial fan tribute. Not affiliated with Lewis Hamilton,
            Scuderia Ferrari or Formula 1. Imagery is generated concept art,
            not photography.
          </p>
          <p className="lh-footer__made">Made by a fan. 2026.</p>
        </div>
      </footer>
    </main>
  );
}
