// Little robot: drops onto the first word, hops word to word, cannonballs into the pool,
// splashes around, then climbs back out and does it again. Click it for a dance.
(() => {
  const bot = document.getElementById('bot');
  const pool = document.getElementById('pool');
  if (!bot || !pool) return;

  const dir = bot.querySelector('.dir');
  const spin = bot.querySelector('.spin');
  const eyes = bot.querySelector('.eyes');
  const words = [...document.querySelectorAll('[data-word]')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPEED = 85;

  let W = 62, H = 77;
  let x = 0, y = 0, facing = 1, plat = null, sink = 0, poked = false, dancing = false;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const frame = () => new Promise(requestAnimationFrame);
  const ctx = document.createElement('canvas').getContext('2d');

  // Robot scales with the headline so it always fits between the lines.
  function sizeBot() {
    const fs = parseFloat(getComputedStyle(words[0]).fontSize);
    W = clamp(fs * 0.55, 38, 90);
    H = W * 1.24;
    bot.style.width = `${W}px`;
    bot.style.height = `${H}px`;
  }

  // Where the robot stands: the top of the capital letters, or the water surface.
  function surface(el) {
    const r = el.getBoundingClientRect();
    let top;
    if (el === pool) {
      top = el.querySelector('.water').getBoundingClientRect().top;
    } else {
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText('H');
      const fs = parseFloat(cs.fontSize);
      const asc = m.fontBoundingBoxAscent ?? fs * 0.9;
      const desc = m.fontBoundingBoxDescent ?? fs * 0.25;
      const cap = m.actualBoundingBoxAscent || fs * 0.72;
      top = r.top + (r.height - (asc + desc)) / 2 + asc - cap;
    }
    const pad = el === pool ? W * 0.55 : W * 0.35;
    let l = r.left + pad, rr = r.right - pad;
    if (rr < l) l = rr = (r.left + r.right) / 2;
    return { el, l: l + scrollX, r: rr + scrollX, t: top + scrollY };
  }

  function render() {
    bot.style.transform = `translate(${x - W / 2}px, ${y - H}px)`;
    dir.style.transform = `scaleX(${facing})`;
  }

  function refresh() {
    sizeBot();
    plat = surface(plat.el);
    y = plat.t + sink;
    x = clamp(x, plat.l, plat.r);
    render();
  }

  async function walkTo(tx) {
    facing = tx >= x ? 1 : -1;
    bot.classList.add('walking');
    let last = performance.now();
    while (Math.abs(tx - x) > 0.5 && !poked) {
      const now = await frame();
      const step = SPEED * Math.min(0.05, (now - last) / 1000);
      last = now;
      x += clamp(tx - x, -step, step);
      render();
    }
    bot.classList.remove('walking');
  }

  async function jumpTo(el, tx, { flip = false, into = 0, crouch = true } = {}) {
    const target = surface(el);
    tx = tx ?? rand(target.l, target.r);
    facing = tx >= x ? 1 : -1;
    render();
    if (crouch) {
      bot.classList.add('crouch');
      await sleep(200);
      bot.classList.remove('crouch');
    }
    bot.classList.remove('swim', 'happy');
    bot.classList.add('air');

    const x0 = x, y0 = y, y1 = target.t + into;
    const arc = Math.max(H * 0.9, (y0 - y1) / 2 + H);
    const dur = Math.min(1150, 460 + Math.hypot(tx - x0, y1 - y0) * 0.85);
    const start = performance.now();
    let t = 0;
    while (t < 1) {
      t = Math.min(1, (await frame() - start) / dur);
      x = x0 + (tx - x0) * t;
      y = y0 + (y1 - y0) * t - 4 * arc * t * (1 - t);
      if (flip) spin.style.transform = `rotate(${360 * (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t))}deg)`;
      render();
    }
    spin.style.transform = '';
    plat = target;
    sink = into;
    bot.classList.remove('air');
    if (el !== pool) {
      el.animate(
        [{ transform: 'translateY(0)' }, { transform: `translateY(${H * 0.08}px)` }, { transform: 'translateY(0)' }],
        { duration: 360, easing: 'ease-out' }
      );
      bot.classList.add('land');
      await sleep(170);
      bot.classList.remove('land');
    }
  }

  function splash() {
    const wr = pool.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.left = `${x - scrollX - wr.left}px`;
    pool.appendChild(ripple);
    setTimeout(() => ripple.remove(), 1000);

    const sx = x, sy = plat.t;
    for (let i = 0; i < 16; i++) {
      const d = document.createElement('span');
      const size = rand(4, 10);
      d.className = 'drop';
      d.style.width = d.style.height = `${size}px`;
      d.style.left = `${sx - size / 2 + rand(-W * 0.3, W * 0.3)}px`;
      d.style.top = `${sy - size / 2}px`;
      if (Math.random() < 0.4) d.style.background = '#ffffff';
      document.body.appendChild(d);
      const dx = rand(-1, 1) * W * 1.6, up = rand(0.8, 2.2) * H;
      d.animate([
        { transform: 'translate(0, 0)', easing: 'cubic-bezier(.2,.7,.4,1)' },
        { transform: `translate(${dx * 0.5}px, ${-up}px)`, easing: 'cubic-bezier(.6,0,.8,.6)' },
        { transform: `translate(${dx}px, 10px)`, opacity: 0 },
      ], { duration: rand(650, 950), fill: 'forwards' }).finished.then(() => d.remove());
    }
  }

  // Bounce in place without leaving the current spot (works in the pool too).
  async function hopInPlace(flip) {
    const y0 = y, h = H * 0.9, start = performance.now();
    let t = 0;
    bot.classList.add('air');
    while (t < 1) {
      t = Math.min(1, (await frame() - start) / 650);
      y = y0 - 4 * h * t * (1 - t);
      if (flip) spin.style.transform = `rotate(${360 * t}deg)`;
      render();
    }
    spin.style.transform = '';
    bot.classList.remove('air');
    y = y0;
    render();
  }

  async function coolDance() {
    dancing = true;
    const wasSwimming = bot.classList.contains('swim');
    bot.classList.remove('swim', 'walking');
    bot.classList.add('cool');
    await sleep(350);
    bot.classList.add('dance');
    for (let beat = 0; beat < 8; beat++) {
      facing = -facing;
      render();
      await sleep(380);
    }
    bot.classList.remove('dance');
    // Moonwalk: face one way, glide the other.
    if (!wasSwimming) {
      facing = x > (plat.l + plat.r) / 2 ? 1 : -1;
      const tx = clamp(x - facing * W * 1.4, plat.l, plat.r);
      bot.classList.add('walking');
      while (Math.abs(tx - x) > 0.5) {
        await frame();
        x += clamp(tx - x, -1.1, 1.1);
        render();
      }
      bot.classList.remove('walking');
    }
    await hopInPlace(true);
    if (wasSwimming) splash();
    await sleep(500);
    bot.classList.remove('cool');
    if (wasSwimming) bot.classList.add('swim', 'happy');
    dancing = false;
  }

  async function checkPoke() {
    if (!poked) return;
    poked = false;
    await coolDance();
  }

  async function wait(ms) {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      await sleep(80);
      await checkPoke();
    }
  }

  async function run() {
    sizeBot();
    plat = surface(words[0]);
    x = rand(plat.l, plat.r);
    y = plat.t;
    render();
    bot.style.opacity = 1;
    if (reduceMotion) return;

    // Drop in from above.
    y = scrollY - H - 20;
    render();
    await sleep(900);
    await jumpTo(words[0], x, { crouch: false });

    for (;;) {
      for (let i = 0; i < words.length; i++) {
        refresh();
        await wait(rand(300, 700));
        await walkTo(rand(plat.l, plat.r));
        await checkPoke();
        if (Math.random() < 0.3) {
          bot.classList.add('look');
          await wait(700);
          bot.classList.remove('look');
        }
        if (i < words.length - 1) await jumpTo(words[i + 1], null, { flip: Math.random() < 0.3 });
      }

      // Cannonball!
      refresh();
      await walkTo(plat.r);
      await checkPoke();
      await jumpTo(pool, null, { flip: true, into: H * 0.42 });
      splash();
      bot.classList.add('swim', 'happy');
      await wait(900);
      splash();
      await wait(2600);

      // Climb out and start over.
      refresh();
      await jumpTo(words[0], null, { flip: true });
      bot.classList.remove('happy');
    }
  }

  // Blink every few seconds.
  (async () => {
    for (;;) {
      await sleep(rand(2200, 5000));
      bot.classList.add('blink');
      await sleep(130);
      bot.classList.remove('blink');
    }
  })();

  // Eyes follow the cursor a little.
  addEventListener('pointermove', e => {
    const r = bot.getBoundingClientRect();
    const dx = clamp((e.clientX - (r.left + r.width / 2)) / 150, -1, 1) * 3 * facing;
    const dy = clamp((e.clientY - (r.top + r.height / 3)) / 150, -1, 1) * 2;
    eyes.style.transform = `translate(${dx}px, ${dy}px)`;
  });

  bot.addEventListener('click', () => { if (!dancing && !reduceMotion) poked = true; });
  addEventListener('resize', () => { if (plat && !bot.classList.contains('air')) refresh(); });

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => sleep(50)).then(run);
})();
