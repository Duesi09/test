// Coming-soon scene: the robot lives on top of "COMING", plays all of its animations,
// and now and then cannonballs into the pool. Click it to make it dance.
(() => {
  const { CELL, clips, draw, blend, normalize } = RobotRig;
  const canvas = document.getElementById('bot');
  const word = document.getElementById('word');
  const pool = document.getElementById('pool');
  const ctx = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BLEND_MS = 200;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const frame = () => new Promise(requestAnimationFrame);
  const measure = document.createElement('canvas').getContext('2d');

  // ---------- World state ----------
  let scale = 1;
  let x = 0, ground = 0;            // page position of the robot's feet
  let flip = false;
  let inWater = false;
  let clicked = false, busy = false;

  // Current animation
  let clip = clips.Idle, clipName = 'Idle', clipStart = 0, speed = 1;
  let override = null;              // function(pose, frame) -> pose, for jumps along an arc
  let lastPose = clip.pose(0), blendFrom = null, blendStart = 0;

  function play(name, { rate = 1, mod = null } = {}) {
    blendFrom = normalize(lastPose);
    blendStart = performance.now();
    clipName = name;
    clip = clips[name];
    clipStart = performance.now();
    speed = rate;
    override = mod;
  }
  const clipFrame = now => (now - clipStart) / 1000 * clip.fps * speed;
  const clipDuration = (name, rate = 1) => clips[name].frames / clips[name].fps / rate * 1000;
  async function playOnce(name, opts = {}) {
    play(name, opts);
    await sleep(clipDuration(name, opts.rate));
  }

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
    return r.top + scrollY + (r.height - (asc + desc)) / 2 + asc - cap;
  }

  function surfaces() {
    const wr = word.getBoundingClientRect();
    const pad = 46 * scale;
    const pr = pool.getBoundingClientRect();
    const water = pool.querySelector('.water').getBoundingClientRect();
    return {
      top: { l: wr.left + scrollX + pad, r: wr.right + scrollX - pad, y: capTop(word) },
      pool: { l: pr.left + scrollX + 40 * scale, r: pr.right + scrollX - 40 * scale, y: water.top + scrollY },
    };
  }

  function resize() {
    const fs = parseFloat(getComputedStyle(word).fontSize);
    scale = clamp(fs * 0.9, 92, 200) / 182;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(CELL.w * scale * dpr);
    canvas.height = Math.round(CELL.h * scale * dpr);
    canvas.style.width = `${CELL.w * scale}px`;
    canvas.style.height = `${CELL.h * scale}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = surfaces();
    if (!inWater && !busy) ground = s.top.y;
    x = clamp(x, s.top.l, s.top.r);
  }

  // ---------- Render loop ----------
  function render(now) {
    const f = clip.loop ? clipFrame(now) % clip.frames : Math.min(clipFrame(now), clip.frames - 1);
    let pose = clip.pose(f);
    if (override) pose = override(pose, f);
    if (inWater) pose = Object.assign({}, pose, { eyes: pose.eyes === 'normal' ? 'happy' : pose.eyes, fx: [] });
    if (blendFrom) {
      const t = (now - blendStart) / BLEND_MS;
      if (t >= 1) blendFrom = null;
      else pose = blend(blendFrom, pose, t * t * (3 - 2 * t));
    }
    lastPose = pose;

    canvas.style.transform = `translate(${x - CELL.groundX * scale}px, ${ground - CELL.groundY * scale}px)`;
    ctx.clearRect(0, 0, CELL.w * scale, CELL.h * scale);
    draw(ctx, pose, {
      x: CELL.groundX * scale, y: CELL.groundY * scale, scale,
      flip, shadow: !inWater && !override,
    });
    requestAnimationFrame(render);
  }

  // ---------- Moves ----------
  async function moveTo(tx, run) {
    const s = surfaces().top;
    tx = clamp(tx, s.l, s.r);
    if (Math.abs(tx - x) < 4) return;
    flip = tx < x;
    play(run ? 'Run' : 'Walk', { rate: run ? 1 : 1.5 });
    const v = (run ? 150 : 40) * scale;           // px per second, matched to the stride
    let last = performance.now();
    while (Math.abs(tx - x) > 1 && !clicked) {
      const now = await frame();
      const step = v * Math.min(0.05, (now - last) / 1000);
      last = now;
      x += clamp(tx - x, -step, step);
    }
    play('Idle');
  }

  // Play a jump-style clip while flying along an arc from here to (tx, ty).
  // takeoff/land: clip frames where the feet leave and touch the ground.
  async function arcTo(name, tx, ty, takeoff, land, rate) {
    const x0 = x, y0 = ground;
    const peak = Math.min(y0, ty) - 120 * scale;
    flip = tx < x0;
    const c = clips[name];
    play(name, {
      rate,
      mod: (pose, f) => {
        const t = clamp((f - takeoff) / (land - takeoff), 0, 1);
        // Quadratic Bezier through the peak height.
        const cx = (x0 + tx) / 2, cy = 2 * peak - (y0 + ty) / 2;
        x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * tx;
        ground = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * ty;
        return f > takeoff && f < land ? Object.assign({}, pose, { y: 0 }) : pose;
      },
    });
    await sleep(c.frames / c.fps / rate * 1000);
    override = null;
  }

  function splash() {
    const pr = pool.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.left = `${x - scrollX - pr.left}px`;
    pool.appendChild(ripple);
    setTimeout(() => ripple.remove(), 1000);
    for (let i = 0; i < 18; i++) {
      const d = document.createElement('span');
      const size = rand(5, 11);
      d.className = 'drop';
      d.style.width = d.style.height = `${size}px`;
      d.style.left = `${x - size / 2 + rand(-30, 30) * scale}px`;
      d.style.top = `${ground - size / 2}px`;
      if (Math.random() < 0.4) d.style.background = '#ffffff';
      document.body.appendChild(d);
      const dx = rand(-1, 1) * 110 * scale, up = rand(0.6, 1.4) * 150 * scale;
      d.animate([
        { transform: 'translate(0, 0)', easing: 'cubic-bezier(.2,.7,.4,1)' },
        { transform: `translate(${dx * 0.5}px, ${-up}px)`, easing: 'cubic-bezier(.6,0,.8,.6)' },
        { transform: `translate(${dx}px, 10px)`, opacity: 0 },
      ], { duration: rand(650, 950), fill: 'forwards' }).finished.then(() => d.remove());
    }
  }

  async function poolTrip() {
    const s = surfaces();
    await moveTo(s.top.r, true);
    // Jump in (the Jump clip's airborne frames ride the arc)
    const tx = rand(s.pool.l, s.pool.r);
    await arcTo('Jump', tx, s.pool.y + 70 * scale, 9, 40, 1.6);
    inWater = true;
    ground = s.pool.y + 70 * scale;
    splash();
    play('Idle', { rate: 1.4 });
    await sleep(900);
    splash();
    await sleep(2200);
    // Backflip back out onto the word
    const back = surfaces().top;
    inWater = false;
    await arcTo('Backflip', back.r - 20 * scale, back.y, 9, 48, 1.5);
    ground = back.y;
    play('Idle');
    await sleep(600);
    await moveTo((back.l + back.r) / 2, false);
  }

  async function fallAndGetUp() {
    await playOnce('FallOver');
    await sleep(900);
    await playOnce('StandUp');
    play('Idle');
  }

  async function dance() {
    play('Dance');
    await sleep(clipDuration('Dance'));
    play('Idle');
  }

  const actions = {
    walk: async () => { const s = surfaces().top; await moveTo(rand(s.l, s.r), false); },
    run: async () => { const s = surfaces().top; await moveTo(x < (s.l + s.r) / 2 ? s.r : s.l, true); await sleep(300); await moveTo((s.l + s.r) / 2, true); },
    jump: () => playOnce('Jump').then(() => play('Idle')),
    backflip: () => playOnce('Backflip').then(() => play('Idle')),
    dance,
    fall: fallAndGetUp,
    pool: poolTrip,
  };
  const order = ['walk', 'jump', 'run', 'dance', 'backflip', 'pool', 'walk', 'fall', 'run', 'backflip', 'pool', 'jump', 'dance', 'walk', 'fall'];

  async function handleClick() {
    clicked = false;
    if (inWater) return;
    await dance();
  }

  async function run() {
    resize();
    const s = surfaces().top;
    x = (s.l + s.r) / 2;
    ground = s.y;
    play('Idle');
    blendFrom = null;
    requestAnimationFrame(render);
    canvas.style.opacity = 1;
    if (reduceMotion) return;

    await sleep(2500);
    for (let i = 0; ; i = (i + 1) % order.length) {
      busy = true;
      await actions[order[i]]();
      busy = false;
      if (clicked) await handleClick();
      // Rest a moment between tricks, but react to clicks straight away.
      const until = performance.now() + rand(1800, 3200);
      while (performance.now() < until) {
        if (clicked) { busy = true; await handleClick(); busy = false; }
        await sleep(100);
      }
    }
  }

  canvas.addEventListener('click', () => { clicked = true; });
  addEventListener('resize', resize);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => sleep(60)).then(run);
})();
