// Coming-soon scene. The robot loops through a little story:
// 3 steps and a wave, a backflip off the letters into an invisible pool, out again at the bottom,
// bonked by a portal gun, portals on the N and the ceiling, a tumbling fall,
// a superhero landing and a happy jump. Clicking it makes it Floss or Dab.
(() => {
  const { clips, draw, blend, normalize } = RobotRig;
  const canvas = document.getElementById('bot');
  const word = document.getElementById('word');
  const soon = document.getElementById('soon');
  const ctx = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BLEND_MS = 180;
  const CENTER = 90;                 // body centre height above the feet (rig units)

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const ease = t => t * t * (3 - 2 * t);
  const frame = () => new Promise(requestAnimationFrame);
  const measure = document.createElement('canvas').getContext('2d');

  // ---------- State ----------
  let scale = 0.5, vw = 0, vh = 0;
  let x = 0, ground = 0, flip = false;   // feet position (page px)
  let spinRot = 0;                       // extra whole-body rotation (deg) around the body centre
  let hasGun = false, happy = false;
  let portal = null;                     // {ax, ay, bx, by}: entry plane x = ax, exit through the ceiling at (bx, by)
  let clipRect = null;                   // {maxY} hides everything below a line (the hidden pool)
  let canDance = false, clicked = false;

  let clip = clips.Idle, clipStart = 0, rate = 1, override = null;
  let lastPose = clip.pose(0), blendFrom = null, blendStart = 0;

  function play(name, opts = {}) {
    blendFrom = normalize(lastPose);
    blendStart = performance.now();
    clip = clips[name];
    clipStart = performance.now();
    rate = opts.rate || 1;
    override = opts.mod || null;
  }
  const duration = (name, r = 1) => clips[name].frames / clips[name].fps / r * 1000;

  // ---------- Layout ----------
  function lineOf(el) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = measure.measureText('H');
    const fs = parseFloat(cs.fontSize);
    const asc = m.fontBoundingBoxAscent ?? fs * 0.9;
    const desc = m.fontBoundingBoxDescent ?? fs * 0.25;
    const cap = m.actualBoundingBoxAscent || fs * 0.72;
    const base = r.top + (r.height - (asc + desc)) / 2 + asc;
    return { l: r.left, r: r.right, top: base - cap, base };
  }

  function spots() {
    const c = lineOf(word), s = lineOf(soon);
    const pad = 34 * scale;
    return {
      top: { l: c.l + pad, r: c.r - pad, y: c.top, home: (c.l + c.r) / 2 },
      // Hidden pool: clear of every letter, level with the bottom line.
      pool: { x: Math.min(Math.max(c.r, s.r) + 95 * scale, vw - 30 * scale), y: s.base },
      // Standing spot at the bottom, just right of the N in SOON.
      bottom: { x: s.r + 58 * scale, y: s.base },
      n: { x: s.r - 0.12 * (s.base - s.top), top: s.top, base: s.base },
    };
  }

  function resize() {
    const fs = parseFloat(getComputedStyle(word).fontSize);
    scale = clamp(fs * 0.55, 62, 120) / 182;
    vw = innerWidth; vh = innerHeight;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- Render ----------
  function currentPose(now) {
    const fpos = (now - clipStart) / 1000 * clip.fps * rate;
    const f = clip.loop ? fpos % clip.frames : Math.min(fpos, clip.frames - 1);
    let pose = clip.pose(f);
    if (override) pose = override(pose, f);
    if (hasGun) pose = Object.assign({}, pose, { gun: 1 });
    if (happy) pose = Object.assign({}, pose, { eyes: 'happy', mouth: 'grin' });
    if (blendFrom) {
      const t = (now - blendStart) / BLEND_MS;
      if (t >= 1) blendFrom = null;
      else pose = blend(blendFrom, pose, ease(t));
    }
    return (lastPose = pose);
  }

  function drawRobot(pose) {
    ctx.save();
    ctx.translate(x, ground);
    if (spinRot) {
      ctx.translate(0, -CENTER * scale);
      ctx.rotate(spinRot * Math.PI / 180);
      ctx.translate(0, CENTER * scale);
    }
    draw(ctx, pose, { x: 0, y: 0, scale, flip });
    ctx.restore();
  }

  function render(now) {
    const pose = currentPose(now);
    ctx.clearRect(0, 0, vw, vh);
    if (portal) {
      // Part still on this side of the N portal...
      ctx.save();
      ctx.beginPath(); ctx.rect(portal.ax, -1e4, 2e4, 3e4); ctx.clip();
      drawRobot(pose);
      ctx.restore();
      // ...and the part that went in, already coming out of the ceiling (rotated 90 degrees).
      ctx.save();
      ctx.beginPath(); ctx.rect(0, portal.by, vw, vh); ctx.clip();
      ctx.translate(portal.bx, portal.by);
      ctx.rotate(-Math.PI / 2);
      ctx.translate(-portal.ax, -portal.ay);
      ctx.beginPath(); ctx.rect(-2e4, -1e4, 2e4 + portal.ax, 3e4); ctx.clip();
      drawRobot(pose);
      ctx.restore();
    } else if (clipRect) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, vw, clipRect.maxY); ctx.clip();
      drawRobot(pose);
      ctx.restore();
    } else {
      drawRobot(pose);
    }
    requestAnimationFrame(render);
  }

  // ---------- Click to dance ----------
  function hit(px, py) {
    return !portal && !clipRect && Math.abs(px - x) < 45 * scale && py < ground + 5 && py > ground - 190 * scale;
  }

  async function maybeDance() {
    if (!clicked) return false;
    clicked = false;
    if (!canDance) return false;
    const prev = { clip, rate, override };
    play(Math.random() < 0.6 ? 'Floss' : 'Dab');
    await sleep(3600);
    play(Object.keys(clips).find(k => clips[k] === prev.clip), { rate: prev.rate, mod: prev.override });
    return true;
  }

  async function wait(ms) {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      if (await maybeDance()) return;
      await sleep(60);
    }
  }

  // ---------- Moves ----------
  async function walk(tx, run, speedMul = 1) {
    if (Math.abs(tx - x) < 2) return;
    flip = tx < x;
    const restart = () => play(run ? 'Run' : 'Walk', { rate: run ? 1 : 1.5 });
    restart();
    const v = (run ? 150 : 34) * scale * speedMul;
    let last = performance.now();
    while (Math.abs(tx - x) > 0.5) {
      if (await maybeDance()) { restart(); last = performance.now(); }
      const now = await frame();
      const step = v * Math.min(0.05, (now - last) / 1000);
      last = now;
      x += clamp(tx - x, -step, step);
    }
    play('Idle');
  }

  // Ride a jump-style clip along path(t) -> {x, y}. Frames between takeoff and land fly the path.
  async function fly(name, path, takeoff, land, r, onT) {
    play(name, {
      rate: r,
      mod: (pose, f) => {
        const t = clamp((f - takeoff) / (land - takeoff), 0, 1);
        const p = path(t);
        x = p.x; ground = p.y;
        if (onT) onT(t);
        return f > takeoff && f < land ? Object.assign({}, pose, { y: 0 }) : pose;
      },
    });
    await sleep(duration(name, r));
    override = null;
  }

  const arc = (x0, y0, x1, y1, lift) => {
    const peak = Math.min(y0, y1) - lift;
    const cx = (x0 + x1) / 2, cy = 2 * peak - (y0 + y1) / 2;
    return t => ({ x: (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, y: (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1 });
  };

  function drop(px, py, size, color, keyframes, ms) {
    const d = document.createElement('span');
    d.className = 'drop';
    d.style.width = d.style.height = `${size}px`;
    d.style.left = `${px - size / 2}px`;
    d.style.top = `${py - size / 2}px`;
    if (color) d.style.background = color;
    document.body.appendChild(d);
    d.animate(keyframes, { duration: ms, fill: 'forwards' }).finished.then(() => d.remove());
  }

  function splash(px, py, n = 16, power = 1) {
    const ring = document.createElement('span');
    ring.className = 'ripple';
    ring.style.left = `${px}px`;
    ring.style.top = `${py}px`;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 1000);
    for (let i = 0; i < n; i++) {
      const size = rand(4, 10) * Math.max(0.7, scale * 1.6);
      const dx = rand(-1, 1) * 110 * scale, up = rand(0.6, 1.4) * 190 * scale * power;
      drop(px + rand(-25, 25) * scale, py, size, Math.random() < 0.4 ? '#ffffff' : null, [
        { transform: 'translate(0, 0)', easing: 'cubic-bezier(.2,.7,.4,1)' },
        { transform: `translate(${dx * 0.5}px, ${-up}px)`, easing: 'cubic-bezier(.6,0,.8,.6)' },
        { transform: `translate(${dx}px, 6px)`, opacity: 0 },
      ], rand(650, 1000));
    }
  }

  async function bubbles(px, py, ms) {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      splash(px + rand(-20, 20) * scale, py, 3, 0.35);
      await sleep(rand(250, 500));
    }
  }

  function poof(px, py) {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      drop(px, py, rand(6, 12) * Math.max(0.7, scale * 1.6), '#ffffff',
        [{ transform: 'scale(1)' }, { transform: `translate(${Math.cos(a) * 26}px, ${Math.sin(a) * 26}px) scale(0.2)`, opacity: 0 }], 500);
    }
  }

  function makePortal(cx, cy, w, h, color) {
    const p = document.createElement('div');
    p.className = `portal ${color}`;
    p.style.width = `${w}px`;
    p.style.height = `${h}px`;
    p.style.left = `${cx - w / 2}px`;
    p.style.top = `${cy - h / 2}px`;
    document.body.appendChild(p);
    requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('open')));
    return p;
  }

  function closePortal(p) {
    p.classList.remove('open');
    p.classList.add('closing');
    setTimeout(() => p.remove(), 500);
  }

  async function fireAt(sx, sy, px, py, color) {
    const shot = document.createElement('span');
    shot.className = 'shot';
    const c = color === 'orange' ? '255, 154, 60' : '79, 216, 255';
    shot.style.background = `rgb(${c})`;
    shot.style.boxShadow = `0 0 12px 4px rgba(${c}, 0.8)`;
    shot.style.left = `${sx}px`;
    shot.style.top = `${sy}px`;
    document.body.appendChild(shot);
    await shot.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${px - sx}px, ${py - sy}px)` }],
      { duration: 360, easing: 'ease-in', fill: 'forwards' }).finished;
    shot.remove();
  }

  // ---------- The story ----------
  async function story() {
    let s = spots();
    const home = s.top.home;
    canDance = true;
    play('Idle');
    await wait(1600);

    // 1. Three goofy steps to the right, then wave at the camera
    await walk(Math.min(s.top.r, x + 102 * scale), false);
    flip = false;
    play('Wave');
    await wait(2600);
    play('Idle');
    await wait(400);

    // 2. Run to the edge and backflip off the letters into the hidden pool.
    //    Up and out past the last letter first, then straight down, so it never crosses a letter.
    s = spots();
    await walk(s.top.r, true);
    canDance = false;
    const pool = s.pool, x0 = x, y0 = ground;
    const bottomY = pool.y + 175 * scale;
    let splashed = false;
    clipRect = { maxY: pool.y };
    await fly('Cannonball', t => {
      if (t < 0.45) {
        const u = t / 0.45;
        return { x: x0 + (pool.x - x0) * (1 - (1 - u) * (1 - u)), y: y0 - 80 * scale * Math.sin(Math.PI * u) - 10 * scale * u };
      }
      const u = (t - 0.45) / 0.55;
      return { x: pool.x, y: y0 - 10 * scale + (bottomY - y0 + 10 * scale) * u * u };
    }, 6, 47, 1.2, () => {
      if (!splashed && ground > pool.y - 20 * scale && ground > y0 + 30 * scale) {
        splashed = true;
        splash(pool.x, pool.y, 22, 1.2);
      }
    });
    await bubbles(pool.x, pool.y, 1700);

    // 3. Jump out of the water, landing at the bottom next to the N
    s = spots();
    flip = true;
    let popped = false;
    await fly('Jump', arc(pool.x, bottomY, s.bottom.x, s.bottom.y, 40 * scale), 8, 40, 1.35, t => {
      if (!popped && ground < pool.y + 30 * scale) { popped = true; splash(pool.x, pool.y, 18, 1); }
      if (t > 0.7) clipRect = null;
    });
    clipRect = null;
    play('Idle');
    await sleep(250);
    play('Shake');
    await sleep(duration('Shake'));
    play('Idle');
    canDance = true;
    await wait(500);

    // 4. Bonk! A portal gun falls from the sky
    canDance = false;
    flip = false;
    play('FindGun');
    await sleep(duration('FindGun'));
    hasGun = true;
    play('Idle');
    await sleep(400);

    // 5. Portal on the N, portal on the ceiling
    flip = true;
    s = spots();
    const nH = s.n.base - s.n.top;
    const ph = Math.max(nH * 1.05, 150 * scale), pw = ph * 0.34;
    const A = { x: s.n.x, y: s.n.base - ph / 2 };
    const B = { x: home, y: 6 + pw / 2 };
    play('Shoot');
    let pA, pB;
    const shots = (async () => {
      await sleep(8 / 16 * 1000);
      await fireAt(x - 50 * scale, ground - 84 * scale, A.x, A.y, 'cyan');
      pA = makePortal(A.x, A.y, pw, ph, 'cyan');
      await sleep(Math.max(0, 22 / 16 * 1000 - 8 / 16 * 1000 - 360));
      await fireAt(x - 10 * scale, ground - 152 * scale, B.x, B.y, 'orange');
      pB = makePortal(B.x, B.y, ph, pw, 'orange');
    })();
    await sleep(duration('Shoot'));
    await shots;
    await sleep(300);

    // 6. Step into the N portal: the part that goes in is already falling out of the ceiling
    portal = { ax: A.x, ay: s.n.base - 0.5 * ph, bx: B.x, by: B.y };
    await walk(A.x - 70 * scale, false, 1.6);

    // Hand over to the ceiling copy: same picture, now expressed in ceiling coordinates
    const fx = portal.bx + (ground - portal.ay), fy = portal.by - (x - portal.ax);
    const C0 = { x: fx - CENTER * scale, y: fy };          // body centre after the 90 degree turn
    portal = null;
    spinRot = -90;                                         // same quarter turn the portal applied
    x = C0.x; ground = C0.y + CENTER * scale;
    closePortal(pA);

    // 7. Tumble down uncontrollably onto "COMING"
    play('Tumble');
    s = spots();
    const end = { x: home, y: s.top.y };
    const startX = x, startY = ground, T = 1300;
    const t0 = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / T);
      x = startX + (end.x - startX) * ease(t) + Math.sin(t * 14) * 6 * scale * (1 - t);
      ground = startY + (end.y - startY) * t * t;
      spinRot = -90 - 630 * t;                             // keeps spinning the same way, ends upright
      if (t >= 1) break;
      await frame();
    }
    spinRot = 0;
    closePortal(pB);

    // 8. Superhero landing, then a happy jump
    play('SuperheroLanding');
    await sleep(duration('SuperheroLanding') * 0.8);
    flip = false;
    happy = true;
    play('Jump', { rate: 1.3 });
    await sleep(duration('Jump', 1.3));
    happy = false;
    play('Idle');
    await sleep(300);
    poof(x - 14 * scale, ground - 50 * scale);
    hasGun = false;
    canDance = true;
    await wait(1200);
  }

  async function run() {
    resize();
    const s = spots();
    x = s.top.home;
    ground = s.top.y;
    play('Idle');
    blendFrom = null;
    requestAnimationFrame(render);
    canvas.style.opacity = 1;
    if (reduceMotion) return;
    await sleep(900);
    for (;;) {
      await story();
      const top = spots().top;
      x = clamp(x, top.l, top.r);
      ground = top.y;
    }
  }

  addEventListener('click', e => { if (hit(e.clientX, e.clientY)) clicked = true; });
  addEventListener('pointermove', e => { document.body.style.cursor = hit(e.clientX, e.clientY) ? 'pointer' : ''; });
  addEventListener('resize', () => {
    resize();
    if (!override && !clipRect && !portal && !spinRot) {
      const s = spots().top;
      ground = s.y;
      x = clamp(x, s.l, s.r);
    }
  });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => sleep(60)).then(run);
})();
