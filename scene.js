// Coming-soon scene. The robot loops through a little story:
// 3 steps and a wave, a backflip off the letters into an invisible pool, out again at the bottom,
// bonked by a portal gun, portals on the N and the ceiling, a tumbling fall,
// a superhero landing and a happy jump. Clicking it makes it Floss or Dab.
(() => {
  const { clips, draw, blend, normalize, emote } = RobotRig;
  const canvas = document.getElementById('bot');
  const word = document.getElementById('word');
  const soon = document.getElementById('soon');
  const ctx = canvas.getContext('2d');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BLEND_MS = 180;
  const CENTER = 90;                 // body centre height above the feet (rig units)
  const SPEED = 1.3;                 // global tempo: everything plays a bit faster
  const GRAVITY = 2600;              // rig units / s^2 (the robot is ~180 units tall)
  const JUMP_G = 1500;               // gentler gravity for jumps and dives

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const ease = t => t * t * (3 - 2 * t);
  const frame = () => new Promise(requestAnimationFrame);
  const measure = document.createElement('canvas').getContext('2d');

  // ---------- State ----------
  let scale = 0.5, vw = 0, vh = 0;
  let x = 0, ground = 0, flip = false;   // feet position (page px)
  let turnStart = -1e9;                  // facing changes play a quick body turn instead of snapping
  const TURN_MS = 170;
  const emotes = [];                    // {type, start, dur}: chibi speech-bubble reactions
  let fidget = null, nextFidget = 0, dancing = false;
  const eyes = { hover: 0, look: 0, target: 0, nextLook: 0, nextBlink: 0, blinkAt: -1e9, mx: -1e4, my: -1e4, mt: -1e9 };
  let spinRot = 0;                       // extra whole-body rotation (deg) around the body centre
  let hasGun = false, happy = false;
  let hatOn = 0, hatDrop = 0, hammerOn = false, shrink = 1;   // finale gear + teleport squeeze
  const boards = [];
  let portal = null;                     // {ax, ay, bx, by}: entry plane x = ax, exit through the ceiling at (bx, by)
  let clipRect = null;                   // {maxY} hides everything below a line (the hidden pool)
  let canDance = false, clicked = false;
  let leanFx = 0, leanTarget = 0;     // extra lean from speeding up / slowing down
  // Follow-through: a small damped spring the head and headphones ride on, driven by the
  // body's acceleration, so they lag, overshoot and settle like they have real weight.
  const jig = { x: 0, vx: 0, y: 0, vy: 0, px: 0, py: 0, pvx: 0, pvy: 0, t: 0 };

  let clip = clips.Idle, clipStart = 0, rate = 1, override = null;
  let lastPose = clip.pose(0), blendFrom = null, blendStart = 0;

  function play(name, opts = {}) {
    blendFrom = normalize(lastPose);
    blendStart = performance.now();
    clip = clips[name];
    clipStart = performance.now();
    rate = (opts.rate || 1) * SPEED;
    override = opts.mod || null;
  }
  const duration = (name, r = 1) => clips[name].frames / clips[name].fps / (r * SPEED) * 1000;

  function say(type, delay = 0, dur = 1100) {
    emotes.push({ type, start: performance.now() + delay, dur });
  }

  function face(left) {
    if (left === flip) return;
    flip = left;
    turnStart = performance.now();
  }

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
      edge: Math.max(c.r, s.r),
      // Hidden pool: clear of every letter, level with the bottom line.
      pool: { x: Math.min(Math.max(c.r, s.r) + 95 * scale, vw - 48), y: s.base },
      // Standing spot at the bottom, just right of the N in SOON.
      bottom: { x: Math.min(s.r + 115 * scale, Math.min(Math.max(c.r, s.r) + 95 * scale, vw - 48) - 40 * scale), y: s.base },
      n: { x: s.r - 0.12 * (s.base - s.top), top: s.top, base: s.base },
      coming: c, soon: s,
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
    if (hammerOn) pose = Object.assign({}, pose, { hammer: 1, gun: 0 });
    if (hatOn) pose = Object.assign({}, pose, { hat: hatOn, hatY: hatDrop });
    if (happy) pose = Object.assign({}, pose, { eyes: 'happy', mouth: 'grin', front: 1 });
    leanFx += (leanTarget - leanFx) * 0.15;
    if (Math.abs(leanFx) > 0.05) pose = Object.assign({}, pose, { lean: (pose.lean || 0) + leanFx });
    pose = followThrough(pose, now);
    pose = liveEyes(pose, now);
    pose = fidgets(pose, now);
    pose = Object.assign({}, pose, { eq: now / 1000 * (dancing ? 3 : 1) });
    if (blendFrom) {
      const t = (now - blendStart) / BLEND_MS;
      if (t >= 1) blendFrom = null;
      else pose = blend(blendFrom, pose, ease(t));
    }
    return (lastPose = pose);
  }

  function followThrough(pose, now) {
    const dt = Math.min(0.05, (now - (jig.t || now)) / 1000) || 1 / 60;
    jig.t = now;
    if (portal || spinRot) { jig.px = x; jig.py = ground; jig.pvx = jig.pvy = 0; return pose; }
    const vx = (x - jig.px) / dt, vy = (ground - jig.py) / dt;
    const ax = (vx - jig.pvx) / dt, ay = (vy - jig.pvy) / dt;
    jig.px = x; jig.py = ground; jig.pvx = vx; jig.pvy = vy;
    const K = 170, D = 11;                               // stiffness, damping
    const sx = scale || 1;
    jig.vx += (-K * jig.x - D * jig.vx - clamp(ax / sx, -6000, 6000) * 0.012) * dt;
    jig.vy += (-K * jig.y - D * jig.vy + clamp(ay / sx, -9000, 9000) * 0.0016) * dt;
    jig.x += jig.vx * dt;
    jig.y += jig.vy * dt;
    const dir = flip ? -1 : 1;
    return Object.assign({}, pose, {
      headRot: (pose.headRot || 0) + clamp(jig.x, -14, 14) * dir,
      headY: (pose.headY || 0) + clamp(jig.y, -6, 8),
      phone: (pose.phone || 0) + clamp(jig.y * 0.8 + Math.abs(jig.x) * 0.15, -5, 6),
    });
  }

  // Little idle fidgets so it never stands frozen: a head tilt, a tiny happy hop, a peek at you.
  function fidgets(pose, now) {
    if (reduceMotion) return pose;                       // keep it calm for reduced-motion users
    const idle = clip === clips.Idle && canDance && !override && !blendFrom;
    if (!fidget && idle && now > nextFidget) {
      fidget = { type: ['tilt', 'hop', 'peek', 'stretch', 'hum', 'tilt', 'hop'][Math.floor(Math.random() * 7)], start: now };
      if (fidget.type === 'hum') say('note', 150, 1300);
      nextFidget = now + rand(1800, 3600);
    }
    if (!idle) { fidget = null; nextFidget = Math.max(nextFidget, now + 900); return pose; }
    if (!fidget) return pose;
    const dur = { tilt: 1000, hop: 520, peek: 1200, stretch: 1500, hum: 1500 }[fidget.type];
    const t = (now - fidget.start) / dur;
    if (t >= 1) { fidget = null; return pose; }
    const k = Math.sin(Math.PI * t);
    const p = Object.assign({}, pose);
    if (fidget.type === 'tilt') {
      p.headRot = (p.headRot || 0) - 14 * k;
      p.armB = (p.armB || 0) + 25 * k;
      p.front = 0.7 * k;
      if (k > 0.5) { p.eyes = 'happy'; p.mouth = 'smile'; }
    } else if (fidget.type === 'hop') {
      const air = Math.max(0, Math.sin(Math.PI * Math.min(1, t / 0.75)));
      p.y = (p.y || 0) - 9 * air;
      const squash = t < 0.18 ? Math.sin(Math.PI * t / 0.18) : t > 0.75 ? Math.sin(Math.PI * (t - 0.75) / 0.25) : 0;
      p.sy = (p.sy || 1) * (1 - 0.1 * squash);
      p.sx = (p.sx || 1) * (1 + 0.07 * squash);
      p.armF = (p.armF || 0) - 30 * air; p.armB = (p.armB || 0) + 30 * air;
      p.eyes = 'happy'; p.mouth = 'grin';
    } else if (fidget.type === 'stretch') {
      // reach up high with a big yawn, a little wobble at the top
      const up = Math.min(1, k * 1.4);
      p.armF = -18 + (-150) * up; p.elbF = 0;
      p.armB = 12 + 150 * up; p.elbB = 0;
      p.y = (p.y || 0) - 3 * up;
      p.sy = (p.sy || 1) * (1 + 0.05 * up);
      p.headRot = (p.headRot || 0) - 6 * up + Math.sin(t * 20) * 1.5 * up;
      p.front = 0.8 * up;
      if (up > 0.6) { p.eyes = 'squint'; p.mouth = 'o'; }
    } else if (fidget.type === 'hum') {
      const sway = Math.sin(t * Math.PI * 4);
      p.lean = (p.lean || 0) + 5 * sway * k;
      p.headRot = (p.headRot || 0) - 7 * sway * k;
      p.armF = (p.armF || 0) - 10 * sway * k; p.armB = (p.armB || 0) - 10 * sway * k;
      p.front = 0.6 * k;
      p.eyes = 'happy'; p.mouth = 'smile';
    } else {
      p.headRot = (p.headRot || 0) + 8 * k;
      p.headY = (p.headY || 0) + 2 * k;
      p.front = 0.95 * k;
      p.lean = (p.lean || 0) + 4 * k;
      p.mouth = 'smile';
    }
    return p;
  }

  function liveEyes(pose, now) {
    if (now > eyes.nextBlink) {
      eyes.blinkAt = now;
      eyes.nextBlink = now + (Math.random() < 0.2 ? 260 : rand(2200, 5200));   // sometimes a double blink
    }
    const cursorNear = now - eyes.mt < 2500 && Math.hypot(eyes.mx - x, eyes.my - (ground - 120 * scale)) < 380;
    if (cursorNear) eyes.target = clamp((eyes.mx - x) / 160, -1, 1) * (flip ? -1 : 1);
    else if (now > eyes.nextLook) {
      eyes.target = Math.random() < 0.5 ? 0 : rand(-0.9, 0.9);
      eyes.nextLook = now + rand(1200, 3500);
    }
    eyes.look += (eyes.target - eyes.look) * 0.12;
    // hovering over it makes it happy: it smiles and leans in toward you
    const hovered = now - eyes.mt < 1500 && hit(eyes.mx, eyes.my);
    eyes.hover += ((hovered ? 1 : 0) - eyes.hover) * 0.12;
    if (eyes.hover > 0.02 && (!pose.eyes || pose.eyes === 'normal')) {
      pose = Object.assign({}, pose, {
        lean: (pose.lean || 0) + 5 * eyes.hover,
        headRot: (pose.headRot || 0) + 6 * eyes.hover,
        front: Math.max(pose.front || 0, 0.6 * eyes.hover),
      });
      if (eyes.hover > 0.5) pose = Object.assign({}, pose, { eyes: 'happy', mouth: 'grin' });
    }
    if (pose.eyes && pose.eyes !== 'normal') return pose;
    const b = (now - eyes.blinkAt) / 140;
    const blink = b < 1 ? Math.sin(Math.PI * b) : 0;
    return Object.assign({}, pose, { blink: Math.max(pose.blink || 0, blink), look: (pose.look || 0) + eyes.look });
  }

  function drawRobot(pose) {
    ctx.save();
    ctx.translate(x, ground);
    if (spinRot || shrink < 1) {
      ctx.translate(0, -CENTER * scale);
      ctx.rotate((spinRot + (1 - shrink) * 300) * Math.PI / 180);
      ctx.scale(shrink, shrink);
      ctx.translate(0, CENTER * scale);
    }
    const tt = (performance.now() - turnStart) / TURN_MS;
    let shownFlip = flip;
    if (tt < 1) {
      if (tt < 0.5) shownFlip = !flip;
      pose = Object.assign({}, pose, { spin: (pose.spin ?? 1) * Math.max(0.25, Math.abs(Math.cos(Math.PI * tt))) });
    }
    draw(ctx, pose, { x: 0, y: 0, scale, flip: shownFlip });
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
    for (let i = emotes.length - 1; i >= 0; i--) {
      const e = emotes[i], t = (now - e.start) / e.dur;
      if (t >= 1) { emotes.splice(i, 1); continue; }
      if (t < 0 || portal) continue;
      emote(ctx, e.type, x + (flip ? -1 : 1) * 30 * scale, ground - 230 * scale, scale * 1.4, t);
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
    const r = Math.random();
    const move = r < 0.45 ? 'Floss' : r < 0.8 ? 'Dab' : 'Dance';
    play(move);
    dancing = true;
    say('sparkles', 100, 1200);
    await sleep(move === 'Dance' ? duration('Dance') * 0.75 : 3600);
    dancing = false;
    play(Object.keys(clips).find(k => clips[k] === prev.clip), { rate: prev.rate, mod: prev.override });
    return true;
  }

  async function wait(ms) {
    const end = performance.now() + ms / SPEED;
    while (performance.now() < end) {
      if (await maybeDance()) return;
      await sleep(60);
    }
  }

  // ---------- Moves ----------
  // Speeds are matched to the stride so the feet don't slide; it eases in and out
  // and leans into the acceleration like a real little body would.
  async function walk(tx, run, speedMul = 1, stopAtEnd = true) {
    if (Math.abs(tx - x) < 2) return;
    face(tx < x);
    const clipRate = run ? 2 : 2;
    const restart = () => play(run ? 'Run' : 'Walk', { rate: clipRate });
    if (run) {
      // wind-up: sink and lean back for a beat before dashing off
      leanTarget = -9;
      play('Idle', { mod: p => Object.assign({}, p, { kneeF: 22, kneeB: 22, hipF: 10, hipB: 10, armF: 30, armB: -40, eyes: 'determined' }) });
      await sleep(170);
      override = null;
    }
    restart();
    const vmax = (run ? 76 : 14) * clipRate * SPEED * scale * speedMul;
    const accel = vmax / 0.22;
    let v = 0, last = performance.now();
    while (Math.abs(tx - x) > 0.5) {
      if (await maybeDance()) { restart(); last = performance.now(); v = 0; }
      const now = await frame();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dist = Math.abs(tx - x);
      const brake = stopAtEnd ? Math.sqrt(2 * accel * dist) : vmax;
      const nv = Math.min(vmax, v + accel * dt, brake + 4);
      leanTarget = clamp((nv - v) / dt / accel, -1, 1) * (run ? 7 : 4);
      v = nv;
      x += clamp(tx - x, -v * dt, v * dt);
    }
    leanTarget = stopAtEnd ? (run ? -11 : -4) : 0;
    if (stopAtEnd && run) skidDust();
    if (stopAtEnd) {
      play('Idle');
      setTimeout(() => { leanTarget = 0; }, 160);
    }
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

  function ripple(px, py, delay = 0, size = 1) {
    const ring = document.createElement('span');
    ring.className = 'ripple';
    ring.style.left = `${px}px`;
    ring.style.top = `${py}px`;
    ring.style.width = `${70 * size}px`;
    ring.style.height = `${14 * size}px`;
    ring.style.margin = `${-7 * size}px 0 0 ${-35 * size}px`;
    ring.style.animationDelay = `${delay}ms`;
    ring.style.opacity = delay ? 0 : 1;
    ring.style.animationFillMode = 'both';
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 1000 + delay);
  }

  function splash(px, py, n = 16, power = 1) {
    ripple(px, py);
    if (n > 6) {
      ripple(px, py, 260, 0.75);
      // a few drops fall back in and make their own tiny rings
      for (let i = 0; i < 3; i++) {
        const dx = rand(-70, 70) * scale;
        setTimeout(() => ripple(px + dx, py, 0, 0.35), rand(650, 950));
      }
    }
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

  // The word the robot lands on dips under its weight and springs back.
  function squishWord(amount = 1) {
    word.animate([
      { transform: 'translateY(0) scaleY(1)' },
      { transform: `translateY(${5 * amount}px) scaleY(${1 - 0.04 * amount})` },
      { transform: `translateY(${-1.5 * amount}px) scaleY(1)` },
      { transform: 'translateY(0) scaleY(1)' },
    ], { duration: 380, easing: 'ease-out', composite: 'add' });
  }

  function skidDust() {
    const dir = flip ? 1 : -1;                          // dust kicks up behind the feet
    for (let i = 0; i < 6; i++) {
      const size = rand(5, 10) * Math.max(0.7, scale * 1.6);
      drop(x + dir * rand(5, 25) * scale, ground - 3, size, '#c9d3f2', [
        { transform: 'translate(0, 0) scale(0.6)', opacity: 0.85 },
        { transform: `translate(${dir * rand(15, 40) * scale}px, ${-rand(6, 18) * scale}px) scale(1.3)`, opacity: 0 },
      ], rand(380, 600));
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
    const anim = shot.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${px - sx}px, ${py - sy}px)` }],
      { duration: 360, easing: 'ease-in', fill: 'forwards' });
    // glowing trail behind the shot
    const trail = setInterval(() => {
      const t = Math.min(1, (anim.currentTime || 0) / 360), k = t * t;
      drop(sx + (px - sx) * k, sy + (py - sy) * k, rand(4, 8), `rgb(${c})`,
        [{ transform: 'scale(1)', opacity: 0.8 }, { transform: 'scale(0.2)', opacity: 0 }], 320);
    }, 22);
    await anim.finished;
    clearInterval(trail);
    shot.remove();
  }

  // ---------- The story ----------
  async function story() {
    let s = spots();
    const home = s.top.home;
    canDance = true;

    // 1. Wave at the camera straight away (last loop's construction comes down), then three goofy steps
    clearBuild();
    face(false);
    play('Wave');
    await wait(2600);
    play('Idle');
    await wait(250);
    await walk(Math.min(s.top.r, x + 62 * scale), false);
    await wait(300);

    // 2. Run to the edge and backflip off the letters into the hidden pool.
    //    A real gravity arc whose peak is already past the last letter, so it never touches one.
    s = spots();
    await walk(s.top.r, true);
    canDance = false;
    say('sparkles', 0, 900);
    const pool = s.pool, x0 = x, y0 = ground;
    const gj = JUMP_G * scale;
    const bottomY = pool.y + 175 * scale;
    const apexX = Math.max(x0 + 40 * scale, s.edge + 60 * scale);
    let H = 70 * scale, vx, entryX;
    for (;;) {
      vx = (apexX - x0) / Math.sqrt(2 * H / gj);
      entryX = apexX + vx * Math.sqrt(2 * (H + pool.y - y0) / gj);
      if (entryX < vw - 48 || H > 340 * scale) break;
      H += 10 * scale;                                   // narrow screens: jump higher, travel less
    }
    const vy = Math.sqrt(2 * gj * H);
    const Tdive = (vy + Math.sqrt(vy * vy + 2 * gj * (bottomY - y0))) / gj;
    let splashed = false;
    clipRect = { maxY: pool.y };
    await fly('Cannonball', t => {
      const tau = t * Tdive;
      return { x: x0 + vx * tau, y: y0 - vy * tau + 0.5 * gj * tau * tau };
    }, 6, 47, 41 / (16 * SPEED * Tdive), () => {
      if (!splashed && ground > pool.y - 15 * scale && ground > y0 + 30 * scale) {
        splashed = true;
        splash(x, pool.y, 22, 1.2);
      }
    });
    await bubbles(entryX, pool.y, 1700);

    // 3. Jump out of the water, landing at the bottom next to the N
    s = spots();
    face(true);
    let popped = false;
    const apexY = s.bottom.y - 45 * scale;
    const vUp = Math.sqrt(2 * gj * (bottomY - apexY));
    const Tout = vUp / gj + Math.sqrt(2 * (s.bottom.y - apexY) / gj);
    const vxOut = (s.bottom.x - entryX) / Tout;
    await fly('Jump', t => {
      const tau = t * Tout;
      return { x: entryX + vxOut * tau, y: bottomY - vUp * tau + 0.5 * gj * tau * tau };
    }, 8, 40, 32 / (16 * SPEED * Tout), t => {
      if (!popped && ground < pool.y + 30 * scale) { popped = true; splash(x, pool.y, 18, 1); }
      if (t > 0.7) clipRect = null;
    });
    clipRect = null;
    play('Idle');
    await sleep(250);
    play('Shake');
    say('sweat', 120, 900);
    await sleep(duration('Shake'));
    say('question', 200, 1200);
    play('Idle');
    canDance = true;
    await wait(500);

    // 4. Bonk! A portal gun falls from the sky
    canDance = false;
    face(false);
    play('FindGun');
    say('exclaim', 120, 700);
    say('sweat', 700, 900);
    await sleep(duration('FindGun'));
    hasGun = true;
    play('Idle');
    await sleep(400);

    // 5. Portal on the N, portal on the ceiling
    face(true);
    s = spots();
    const nH = s.n.base - s.n.top;
    const ph = Math.max(nH * 1.05, 150 * scale), pw = ph * 0.34;
    const A = { x: s.n.x, y: s.n.base - ph / 2 };
    const B = { x: home, y: 6 + pw / 2 };
    play('Shoot');
    let pA, pB;
    const shots = (async () => {
      await sleep(8 / 16 / SPEED * 1000);
      await fireAt(x - 50 * scale, ground - 84 * scale, A.x, A.y, 'cyan');
      pA = makePortal(A.x, A.y, pw, ph, 'cyan');
      await sleep(Math.max(0, (22 - 8) / 16 / SPEED * 1000 - 360));
      await fireAt(x - 10 * scale, ground - 152 * scale, B.x, B.y, 'orange');
      pB = makePortal(B.x, B.y, ph, pw, 'orange');
    })();
    await sleep(duration('Shoot'));
    await shots;
    await sleep(300);

    // 6. Step into the N portal. The part that goes in is already hanging out of the ceiling,
    //    and once it is halfway through gravity takes over and yanks it the rest of the way.
    portal = { ax: A.x, ay: s.n.base - 0.5 * ph, bx: B.x, by: B.y };
    await walk(A.x, false, 1, false);
    play('Tumble');
    hasGun = false;                                      // gun stowed while it tumbles
    say('exclaim', 0, 1000);
    say('sweat', 900, 1000);
    leanTarget = 0;
    const g = GRAVITY * scale;
    let v = 14 * 2 * SPEED * scale, last = performance.now();
    while (x > A.x - 75 * scale) {
      const now = await frame();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      v += g * dt * 0.75;                                  // most of the body is still on this side
      x -= v * dt;
    }

    // Hand over to the ceiling copy: same picture, now in ceiling coordinates
    const fx = portal.bx + (ground - portal.ay), fy = portal.by - (x - portal.ax);
    portal = null;
    spinRot = -90;                                         // same quarter turn the portal applied
    x = fx - CENTER * scale;
    ground = fy + CENTER * scale;
    closePortal(pA);

    // 7. Falls for real: keeps the speed it had, gravity does the rest, spinning out of control
    s = spots();
    const end = { x: home, y: s.top.y };
    const x1 = x, y1 = ground;
    const gf = g * 0.42;                                   // floatier, cartoon fall
    v = Math.min(v, 160 * scale);
    const T = (-v + Math.sqrt(v * v + 2 * gf * (end.y - y1))) / gf;  // time to reach the letters
    const t0 = performance.now();
    for (;;) {
      const t = Math.min(T, (performance.now() - t0) / 1000);
      const k = t / T;
      x = x1 + (end.x - x1) * ease(k);
      ground = y1 + v * t + 0.5 * gf * t * t;
      spinRot = -90 - 630 * k;                             // keeps spinning the same way, ends upright
      if (t >= T) break;
      await frame();
    }
    ground = end.y;
    spinRot = 0;
    closePortal(pB);

    // 8. Superhero landing
    play('SuperheroLanding');
    document.querySelector('h1').animate(
      [{ transform: 'translate(0, 0)' }, { transform: 'translate(-3px, 4px)' }, { transform: 'translate(3px, -2px)' }, { transform: 'translate(-1px, 1px)' }, { transform: 'translate(0, 0)' }],
      { duration: 260, easing: 'ease-out' });
    await sleep(duration('SuperheroLanding') * 0.8);
    face(false);

    await finale(home);
    canDance = true;
    await wait(1400);
  }

  // ---------- Finale: idea, hard hat, portal barrage, teleporting speed-build ----------
  function buildJobs() {
    const s = spots(), c = s.coming, o = s.soon;
    const hc = c.base - c.top, ho = o.base - o.top;
    return [
      // where it stands, which way it faces, and the board it nails up
      { x: c.l + 46 * scale, y: c.top, left: true, plank: { x: c.l + 0.12 * hc, y: c.top + 0.16 * hc, w: 1.2 * hc, rot: -24 } },
      { x: c.r - 46 * scale, y: c.top, left: false, plank: { x: c.r - 0.14 * hc, y: c.top + 0.2 * hc, w: 1.2 * hc, rot: 22 } },
      { x: Math.max(30 * scale, o.l - 48 * scale), y: o.base, left: false, plank: { x: o.l + 0.14 * ho, y: o.base - 0.3 * ho, w: 1.15 * ho, rot: 20 } },
      { x: s.bottom.x - 50 * scale, y: o.base, left: true, plank: { x: o.r - 0.12 * ho, y: o.base - 0.36 * ho, w: 1.15 * ho, rot: -26 } },
    ];
  }

  function aimAt(tx, ty) {
    const dx = tx - x;
    face(dx < 0);
    const dir = flip ? -1 : 1;
    const sx = x - dir * 36 * scale, sy = ground - 78 * scale;
    const a = Math.atan2((tx - sx) * dir, ty - sy) * 180 / Math.PI;
    play('Idle', { mod: p => Object.assign({}, p, { armF: a, elbF: 0, eyes: 'determined', mouth: 'grin', lean: -3 }) });
    blendFrom = null;
    const rad = a * Math.PI / 180;
    return { x: sx + dir * Math.sin(rad) * 62 * scale, y: sy + Math.cos(rad) * 62 * scale };
  }

  async function teleportOut() {
    const t0 = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / 150);
      shrink = 1 - t;
      if (t >= 1) break;
      await frame();
    }
  }

  async function teleportIn() {
    const t0 = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - t0) / 170);
      shrink = t < 0.7 ? t / 0.7 * 1.12 : 1.12 - 0.12 * (t - 0.7) / 0.3;
      if (t >= 1) break;
      await frame();
    }
    shrink = 1;
  }

  // A bright streak between two portals: the robot zipping through portal-space.
  function streak(a, b, color) {
    const len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:${a.x}px;top:${a.y - 3}px;width:${len}px;height:6px;border-radius:3px;z-index:19;pointer-events:none;transform-origin:0 50%;transform:rotate(${ang}rad);background:linear-gradient(90deg, rgba(${color},0), rgba(${color},0.95), #fff);box-shadow:0 0 14px rgba(${color},0.9);`;
    document.body.appendChild(el);
    el.animate([{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)', offset: 0.45 }, { opacity: 0, clipPath: 'inset(0 0 0 100%)' }],
      { duration: 260, easing: 'ease-out', fill: 'forwards' }).finished.then(() => el.remove());
  }

  function pulse(el) {
    if (el) el.animate([{ filter: 'brightness(1)', scale: '1' }, { filter: 'brightness(2.2)', scale: '1.25' }, { filter: 'brightness(1)', scale: '1' }], { duration: 260, easing: 'ease-out' });
  }

  function nailBoard(pl) {
    const b = document.createElement('div');
    b.className = 'plank';
    const h = Math.max(12, pl.w * 0.2);
    b.style.width = `${pl.w}px`;
    b.style.height = `${h}px`;
    b.style.left = `${pl.x - pl.w / 2}px`;
    b.style.top = `${pl.y - h / 2}px`;
    b.style.setProperty('--rot', `${pl.rot}deg`);
    document.body.appendChild(b);
    boards.push(b);
    // the board starts held up over its head, then gets slapped onto the letter
    const hx = x - pl.x, hy = ground - 150 * scale - pl.y;
    b.animate([
      { transform: `translate(${hx}px, ${hy}px) rotate(0deg) scale(0.7)`, opacity: 0 },
      { transform: `translate(${hx}px, ${hy - 6}px) rotate(0deg) scale(0.75)`, opacity: 1, offset: 0.35 },
      { transform: `rotate(${pl.rot - 4}deg) scale(1.04)`, opacity: 1, offset: 0.8, easing: 'ease-out' },
      { transform: `rotate(${pl.rot}deg) scale(1)`, opacity: 1 },
    ], { duration: 340, easing: 'ease-in' });
  }

  function sparks(px, py) {
    for (let i = 0; i < 7; i++) {
      const a = rand(-Math.PI, 0), d = rand(18, 40) * Math.max(0.8, scale * 1.6);
      drop(px, py, rand(3, 6), i % 2 ? '#ffe27a' : '#ffffff', [
        { transform: 'translate(0, 0)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(0.3)`, opacity: 0 },
      ], rand(240, 380));
    }
  }

  function clearBuild() {
    while (boards.length) {
      const b = boards.pop();
      const r = parseFloat(b.style.getPropertyValue('--rot')) || 0;
      b.animate([
        { transform: `rotate(${r}deg)`, opacity: 1 },
        { transform: `translate(${rand(-20, 20)}px, 90px) rotate(${r + rand(-60, 60)}deg)`, opacity: 0 },
      ], { duration: rand(600, 900), easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' }).finished.then(() => b.remove());
    }
    if (hatOn) {
      poof(x, ground - 175 * scale);
      hatOn = 0;
    }
  }

  async function finale(home) {
    canDance = false;
    // An idea! Bulb over the head, eyes light up
    say('idea', 80, 1500);
    play('Idle', { mod: p => Object.assign({}, p, { eyes: 'bright', mouth: 'o', front: 0.85, headRot: -8, armF: -40 }) });
    await sleep(700);
    play('Idle', { mod: p => Object.assign({}, p, { eyes: 'bright', mouth: 'grin', front: 0.85, headRot: -4, armF: -40, y: -6 }) });
    await sleep(500);

    // Hard hat drops on with a bounce
    hatOn = 1;
    const h0 = performance.now();
    for (;;) {
      const t = Math.min(1, (performance.now() - h0) / 420);
      hatDrop = t < 0.6 ? 150 * (1 - t / 0.6) * (1 - t / 0.6) : -6 * Math.sin(Math.PI * (t - 0.6) / 0.4);
      if (t >= 1) break;
      await frame();
    }
    hatDrop = 0;
    say('sparkles', 0, 800);
    await sleep(300);

    // ...and whips the portal gun back out, held up high
    poof(x - 40 * scale, ground - 120 * scale);
    hasGun = true;
    play('Idle', { mod: p => Object.assign({}, p, { armF: 192, elbF: 0, eyes: 'bright', mouth: 'grin', front: 0.6, y: -4 }) });
    await sleep(450);

    // Portal barrage: one portal for each job, plus one right next to it to jump into
    const jobs = buildJobs();
    const ph = 150 * scale, pw = ph * 0.34;
    const portals = [];
    const portalAt = [];                                 // portal element per spot index
    const entry = { x: x + 48 * scale, y: ground };
    const spots2 = [entry, ...jobs.map(j => ({ x: j.x + (j.left ? 1 : -1) * 34 * scale, y: j.y }))];
    for (let i = 0; i < spots2.length; i++) {
      const sp = spots2[i];
      const tip = aimAt(sp.x, sp.y - ph / 2);
      say(i % 2 ? 'exclaim' : 'sparkles', 0, 260);
      fireAt(tip.x, tip.y, sp.x, sp.y - ph / 2, i % 2 ? 'orange' : 'cyan').then(() => {
        const el = makePortal(sp.x, sp.y - ph / 2, pw, ph, i % 2 ? 'orange' : 'cyan');
        portals.push(el);
        portalAt[i] = el;
      });
      await sleep(190);
    }
    await sleep(420);

    // Gun away, hammer out
    poof(x + (flip ? -1 : 1) * 30 * scale, ground - 60 * scale);
    hasGun = false;
    hammerOn = true;
    face(false);
    play('Idle', { mod: p => Object.assign({}, p, { armF: 150, elbF: -10, eyes: 'determined', mouth: 'grin' }) });
    await sleep(320);

    // Speed-build: hop into the portal, pop out at each spot, slap a board on, bang bang bang, next!
    face(false);
    await walk(entry.x - 6 * scale, false, 3);
    pulse(portalAt[0]);
    await teleportOut();
    let from = spots2[0];
    for (let n = 0; n < jobs.length; n++) {
      const j = jobs[n], to = spots2[n + 1];
      streak({ x: from.x, y: from.y - ph / 2 }, { x: to.x, y: to.y - ph / 2 }, n % 2 ? '79, 216, 255' : '255, 154, 60');
      pulse(portalAt[n + 1]);
      from = to;
      x = j.x + (j.left ? 1 : -1) * 34 * scale;
      ground = j.y;
      face(j.left);
      play('Idle');
      blendFrom = null;
      await teleportIn();
      x = j.x;
      nailBoard(j.plank);
      play('Hammer', { rate: 1.5 });
      const hit = duration('Hammer', 1.5) * 6 / 12;
      for (let k = 0; k < 3; k++) {
        await sleep(hit);
        sparks(j.plank.x, j.plank.y);
        (n < 2 ? word : soon).animate(
          [{ transform: 'translate(0, 0)' }, { transform: `translate(${j.left ? -1.5 : 1.5}px, 2.5px)` }, { transform: 'translate(0, 0)' }],
          { duration: 110, easing: 'ease-out', composite: 'add' });
        await sleep(duration('Hammer', 1.5) - hit);
      }
      play('Idle');
      await sleep(60);
      face(!j.left);
      x = j.x + (j.left ? 1 : -1) * 34 * scale - (j.left ? 6 : -6) * scale;
      pulse(portalAt[n + 1]);
      await teleportOut();
    }
    streak({ x: from.x, y: from.y - ph / 2 }, { x: entry.x, y: entry.y - ph / 2 }, '255, 154, 60');
    pulse(portalAt[0]);

    // Back home through the first portal, proud happy jump
    x = entry.x;
    ground = entry.y;
    face(true);
    play('Idle');
    blendFrom = null;
    await teleportIn();
    await walk(home, false, 2.5);
    portals.forEach(closePortal);
    face(false);
    happy = true;
    say('sparkles', 120, 1300);
    play('Jump', { rate: 1.3 });
    setTimeout(() => squishWord(0.7), duration('Jump', 1.3) * 40 / 48);
    await sleep(duration('Jump', 1.3));
    happy = false;
    play('Idle');
    await sleep(250);
    poof(x - 14 * scale, ground - 50 * scale);
    hammerOn = false;
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

    // Entrance: drop in from above the screen onto "COMING" and land with a squishy bounce
    const landY = s.top.y;
    ground = -40;
    play('Tumble');
    say('exclaim', 0, 700);
    await sleep(700);                                   // wait for the words to rise in
    const g = GRAVITY * scale * 0.6, y0 = ground;
    const T = Math.sqrt(2 * (landY - y0) / g);
    play('Jump', { mod: (pose, f) => (f < 40 ? Object.assign({}, pose, { y: 0 }) : pose) });
    clipStart = performance.now() - (34 / (16 * SPEED)) * 1000 + T * 1000 - (6 / (16 * SPEED)) * 1000;
    const t0 = performance.now();
    for (;;) {
      const t = Math.min(T, (performance.now() - t0) / 1000);
      ground = y0 + 0.5 * g * t * t;
      if (t >= T) break;
      await frame();
    }
    ground = landY;
    override = null;
    squishWord(1);
    say('sparkles', 150, 1100);
    await sleep(duration('Jump') * 8 / 48 + 200);
    play('Idle');
    await sleep(700);
    for (;;) {
      await story();
      const top = spots().top;
      x = clamp(x, top.l, top.r);
      ground = top.y;
    }
  }

  addEventListener('click', e => { if (hit(e.clientX, e.clientY)) clicked = true; });
  addEventListener('pointermove', e => {
    document.body.style.cursor = hit(e.clientX, e.clientY) ? 'pointer' : '';
    eyes.mx = e.clientX; eyes.my = e.clientY; eyes.mt = performance.now();
  });
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
