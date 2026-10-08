// Coming-soon scene. The robot loops through a little story:
// walks 3 steps, waves, cannonballs off the letters into an invisible pool, pops back out,
// shakes off, gets bonked by a portal gun, and portals back to where it started.
// Clicking it makes it bust out the Floss or a Dab.
(() => {
  const { CELL, clips, draw, blend, normalize } = RobotRig;
  const canvas = document.getElementById('bot');
  const word = document.getElementById('word');
  const soon = document.getElementById('soon');
  const ctx = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BLEND_MS = 180;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const frame = () => new Promise(requestAnimationFrame);
  const measure = document.createElement('canvas').getContext('2d');

  // ---------- State ----------
  let scale = 0.5;
  let x = 0, ground = 0, flip = false;
  let hasGun = false;
  let clipRect = null;              // {minX, maxX, maxY} in page px: only this part of the robot is drawn
  let shadow = true;
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
  function capTop(el) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    measure.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = measure.measureText('H');
    const fs = parseFloat(cs.fontSize);
    const asc = m.fontBoundingBoxAscent ?? fs * 0.9;
    const desc = m.fontBoundingBoxDescent ?? fs * 0.25;
    const cap = m.actualBoundingBoxAscent || fs * 0.72;
    return { top: r.top + scrollY + (r.height - (asc + desc)) / 2 + asc - cap, base: r.top + scrollY + (r.height - (asc + desc)) / 2 + asc };
  }

  function spots() {
    const wr = word.getBoundingClientRect(), sr = soon.getBoundingClientRect();
    const pad = 34 * scale;
    const c = capTop(word), s = capTop(soon);
    return {
      top: { l: wr.left + scrollX + pad, r: wr.right + scrollX - pad, y: c.top, home: (wr.left + wr.right) / 2 + scrollX },
      // The invisible pool sits just right of "SOON", level with its baseline.
      pool: { x: Math.min(sr.right + scrollX + 60 * scale, wr.right + scrollX - 10 * scale), y: s.base },
    };
  }

  function resize() {
    const fs = parseFloat(getComputedStyle(word).fontSize);
    scale = clamp(fs * 0.55, 62, 120) / 182;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(CELL.w * scale * dpr);
    canvas.height = Math.round(CELL.h * scale * dpr);
    canvas.style.width = `${CELL.w * scale}px`;
    canvas.style.height = `${CELL.h * scale}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- Render loop ----------
  function render(now) {
    const fpos = (now - clipStart) / 1000 * clip.fps * rate;
    const f = clip.loop ? fpos % clip.frames : Math.min(fpos, clip.frames - 1);
    let pose = clip.pose(f);
    if (override) pose = override(pose, f);
    if (hasGun) pose = Object.assign({}, pose, { gun: 1 });
    if (blendFrom) {
      const t = (now - blendStart) / BLEND_MS;
      if (t >= 1) blendFrom = null;
      else pose = blend(blendFrom, pose, t * t * (3 - 2 * t));
    }
    lastPose = pose;

    const left = x - CELL.groundX * scale, top = ground - CELL.groundY * scale;
    canvas.style.transform = `translate(${left}px, ${top}px)`;
    const W = CELL.w * scale, H = CELL.h * scale;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (clipRect) {
      const x0 = clipRect.minX != null ? clipRect.minX - left : 0;
      const x1 = clipRect.maxX != null ? clipRect.maxX - left : W;
      const y1 = clipRect.maxY != null ? clipRect.maxY - top : H;
      ctx.beginPath();
      ctx.rect(x0, 0, Math.max(0, x1 - x0), Math.max(0, y1));
      ctx.clip();
    }
    draw(ctx, pose, { x: CELL.groundX * scale, y: CELL.groundY * scale, scale, flip, shadow: shadow && !override });
    ctx.restore();
    requestAnimationFrame(render);
  }

  // ---------- Click to dance ----------
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
  async function walk(tx, run) {
    if (Math.abs(tx - x) < 2) return;
    flip = tx < x;
    play(run ? 'Run' : 'Walk', { rate: run ? 1 : 1.5 });
    const v = (run ? 150 : 34) * scale;
    let last = performance.now();
    while (Math.abs(tx - x) > 0.5) {
      if (await maybeDance()) { play(run ? 'Run' : 'Walk', { rate: run ? 1 : 1.5 }); last = performance.now(); }
      const now = await frame();
      const step = v * Math.min(0.05, (now - last) / 1000);
      last = now;
      x += clamp(tx - x, -step, step);
    }
    play('Idle');
  }

  // Ride a jump-style clip along an arc to (tx, ty). onT(t) reports arc progress 0..1.
  async function arcTo(name, tx, ty, takeoff, land, r, onT) {
    const x0 = x, y0 = ground;
    const peak = Math.min(y0, ty) - 110 * scale;
    const cx = (x0 + tx) / 2, cy = 2 * peak - (y0 + ty) / 2;
    flip = tx < x0;
    play(name, {
      rate: r,
      mod: (pose, f) => {
        const t = clamp((f - takeoff) / (land - takeoff), 0, 1);
        x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * tx;
        ground = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * ty;
        if (onT) onT(t);
        return f > takeoff && f < land ? Object.assign({}, pose, { y: 0 }) : pose;
      },
    });
    await sleep(duration(name, r));
    override = null;
  }

  function splash(px, py, n = 16, power = 1) {
    const ring = document.createElement('span');
    ring.className = 'ripple';
    ring.style.left = `${px}px`;
    ring.style.top = `${py}px`;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 1000);
    for (let i = 0; i < n; i++) {
      const d = document.createElement('span');
      const size = rand(4, 10) * Math.max(0.7, scale * 1.6);
      d.className = 'drop';
      d.style.width = d.style.height = `${size}px`;
      d.style.left = `${px - size / 2 + rand(-25, 25) * scale}px`;
      d.style.top = `${py - size / 2}px`;
      if (Math.random() < 0.4) d.style.background = '#ffffff';
      document.body.appendChild(d);
      const dx = rand(-1, 1) * 120 * scale, up = rand(0.6, 1.4) * 200 * scale * power;
      d.animate([
        { transform: 'translate(0, 0)', easing: 'cubic-bezier(.2,.7,.4,1)' },
        { transform: `translate(${dx * 0.5}px, ${-up}px)`, easing: 'cubic-bezier(.6,0,.8,.6)' },
        { transform: `translate(${dx}px, 6px)`, opacity: 0 },
      ], { duration: rand(650, 1000), fill: 'forwards' }).finished.then(() => d.remove());
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
      const d = document.createElement('span');
      d.className = 'drop';
      d.style.background = '#ffffff';
      const size = rand(6, 12) * Math.max(0.7, scale * 1.6);
      d.style.width = d.style.height = `${size}px`;
      d.style.left = `${px - size / 2}px`;
      d.style.top = `${py - size / 2}px`;
      document.body.appendChild(d);
      const a = i / 8 * Math.PI * 2;
      d.animate([{ transform: 'scale(1)' }, { transform: `translate(${Math.cos(a) * 26}px, ${Math.sin(a) * 26}px) scale(0.2)`, opacity: 0 }],
        { duration: 500, easing: 'ease-out', fill: 'forwards' }).finished.then(() => d.remove());
    }
  }

  function makePortal(px, gy, color) {
    const p = document.createElement('div');
    p.className = `portal ${color}`;
    const w = 64 * scale * 1.6, h = 190 * scale;
    p.style.width = `${w}px`;
    p.style.height = `${h}px`;
    p.style.left = `${px - w / 2}px`;
    p.style.top = `${gy - h + 10 * scale}px`;
    document.body.appendChild(p);
    return p;
  }

  async function fireAt(px, py, color) {
    const dir = flip ? -1 : 1;
    const sx = x + dir * 50 * scale, sy = ground - 82 * scale;
    const shot = document.createElement('span');
    shot.className = 'shot';
    const c = color === 'orange' ? '255, 154, 60' : '79, 216, 255';
    shot.style.background = `rgb(${c})`;
    shot.style.boxShadow = `0 0 12px 4px rgba(${c}, 0.8)`;
    shot.style.left = `${sx}px`;
    shot.style.top = `${sy}px`;
    document.body.appendChild(shot);
    await shot.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${px - sx}px, ${py - sy}px)` }],
      { duration: 380, easing: 'ease-in', fill: 'forwards' }).finished;
    shot.remove();
  }

  // ---------- The story ----------
  async function story() {
    let s = spots();
    const home = s.top.home;

    canDance = true;
    play('Idle');
    await wait(1600);

    // 1. Three goofy steps to the right
    await walk(Math.min(s.top.r, x + 102 * scale), false);
    // 2. Wave at the camera
    flip = false;
    play('Wave');
    await wait(2600);
    play('Idle');
    await wait(400);

    // 3. Run to the edge and cannonball into the invisible pool
    s = spots();
    await walk(s.top.r, true);
    canDance = false;
    const pool = s.pool;
    clipRect = { maxY: pool.y };
    let splashed = false;
    await arcTo('Cannonball', pool.x, pool.y + 170 * scale, 6, 47, 1.25, () => {
      if (!splashed && ground > pool.y - 30 * scale && ground > s.top.y + 20 * scale) {
        splashed = true;
        splash(pool.x, pool.y, 22, 1.2);
      }
    });
    shadow = false;
    await bubbles(pool.x, pool.y, 1800);

    // 4. Pop back out onto the letters
    s = spots();
    let popped = false;
    await arcTo('Jump', s.top.r - 6 * scale, s.top.y, 8, 40, 1.35, t => {
      if (!popped && ground < pool.y + 40 * scale) {
        popped = true;
        splash(pool.x, pool.y, 18, 1);
      }
      if (t > 0.6) clipRect = null;
    });
    clipRect = null;
    shadow = true;
    flip = false;
    play('Idle');
    await sleep(250);
    play('Shake');
    await sleep(duration('Shake'));
    play('Idle');
    canDance = true;
    await wait(500);

    // 5. Bonk! A portal gun falls from the sky
    canDance = false;
    play('FindGun');
    await sleep(duration('FindGun'));
    hasGun = true;
    play('Idle');
    await sleep(400);

    // 6. Shoot two portals: one back home, one right in front
    flip = true;
    s = spots();
    const exitX = home + 45 * scale, nearX = x - 80 * scale;
    play('Shoot');
    let homePortal, nearPortal;
    const shots = (async () => {
      await sleep(8 / 16 * 1000);
      await fireAt(exitX, s.top.y - 90 * scale, 'orange');
      homePortal = makePortal(exitX, s.top.y, 'orange');
      requestAnimationFrame(() => homePortal.classList.add('open'));
      await sleep(Math.max(0, 22 / 16 * 1000 - 8 / 16 * 1000 - 380));
      await fireAt(nearX, s.top.y - 90 * scale, 'cyan');
      nearPortal = makePortal(nearX, s.top.y, 'cyan');
      requestAnimationFrame(() => nearPortal.classList.add('open'));
    })();
    await sleep(duration('Shoot'));
    await shots;
    await sleep(300);

    // 7. Walk into the near portal, come out of the home one
    clipRect = { minX: nearX };
    shadow = false;
    await walk(nearX - 60 * scale, false);
    x = exitX + 60 * scale;
    clipRect = { maxX: exitX };
    await walk(home, false);
    clipRect = null;
    shadow = true;
    for (const p of [homePortal, nearPortal]) {
      p.classList.remove('open');
      p.classList.add('closing');
      setTimeout(() => p.remove(), 500);
    }
    await sleep(350);

    // Put the gun away (poof) and get ready to go again
    flip = false;
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
      const home = spots().top;
      x = clamp(x, home.l, home.r);
      ground = home.y;
    }
  }

  canvas.addEventListener('click', () => { clicked = true; });
  addEventListener('resize', () => {
    resize();
    if (!override && !clipRect) {
      const s = spots().top;
      ground = s.y;
      x = clamp(x, s.l, s.r);
    }
  });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => sleep(60)).then(run);
})();
