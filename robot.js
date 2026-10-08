// Little robot that wanders, jumps between platforms and does cute stuff.
(() => {
  const bot = document.getElementById('bot');
  if (!bot) return;

  const dir = bot.querySelector('.dir');
  const spin = bot.querySelector('.spin');
  const bubble = bot.querySelector('.bubble');
  const eyes = bot.querySelector('.eyes');
  const W = 62, H = 77, SPEED = 80;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let x = 0, y = 0, facing = 1, plat = null, poked = false;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const frame = () => new Promise(requestAnimationFrame);

  // Every [data-platform] element's top edge is somewhere the robot can stand.
  function platforms() {
    return [...document.querySelectorAll('[data-platform]')].map(el => {
      const r = el.getBoundingClientRect();
      return { el, l: r.left + scrollX + W / 2, r: r.right + scrollX - W / 2, t: r.top + scrollY };
    }).filter(p => p.r > p.l);
  }
  const inView = p => p.t > scrollY + H + 20 && p.t < scrollY + innerHeight + 10;

  function render() {
    bot.style.transform = `translate(${x - W / 2}px, ${y - H}px)`;
    dir.style.transform = `scaleX(${facing})`;
  }

  // Re-read the current platform (layout may have shifted after fonts load or a resize).
  function refresh() {
    const ps = platforms();
    plat = ps.find(p => plat && p.el === plat.el) || ps.find(p => p.el.hasAttribute('data-ground'));
    y = plat.t;
    x = clamp(x, plat.l, plat.r);
    render();
    return ps;
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

  async function jumpTo(target, tx, flip) {
    facing = tx >= x ? 1 : -1;
    render();
    bot.classList.add('crouch');
    await sleep(220);
    bot.classList.remove('crouch');
    bot.classList.add('air');

    const x0 = x, y0 = y, y1 = target.t;
    const arc = Math.max(55, (y0 - y1) / 2 + 65);
    const dur = Math.min(1100, 480 + Math.hypot(tx - x0, y1 - y0) * 0.9);
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
    bot.classList.remove('air');
    bot.classList.add('land');
    await sleep(180);
    bot.classList.remove('land');
  }

  async function say(text, ms = 1800) {
    bubble.textContent = text;
    bubble.classList.add('show');
    await sleep(ms);
    bubble.classList.remove('show');
  }

  async function pose(cls, ms) {
    bot.classList.add(cls);
    await sleep(ms);
    bot.classList.remove(cls);
  }

  function hearts() {
    for (let i = 0; i < 3; i++) {
      const h = document.createElement('span');
      h.className = 'heart';
      h.textContent = '♥';
      h.style.setProperty('--dx', `${rand(-24, 24)}px`);
      h.style.animationDelay = `${i * 120}ms`;
      bot.appendChild(h);
      setTimeout(() => h.remove(), 1400);
    }
  }

  const tricks = [
    async () => { bot.classList.add('wave'); await say(pick(['hi! 👋', 'hello!', 'hey there'])); bot.classList.remove('wave'); },
    () => pose('dance', 2200),
    async () => { await pose('look', 900); await pose('look2', 900); },
    () => say(pick(['beep boop', 'almost ready!', 'building stuff…', 'check back soon', 'loading… 87%'])),
    () => jumpTo(plat, x, true),
    async () => { await pose('look', 500); await say('zzz…', 1400); },
  ];

  async function hop(ps) {
    const options = ps.filter(p => p.el !== plat.el && inView(p) && Math.abs(p.t - y) < 520);
    if (!options.length) return walkTo(rand(plat.l, plat.r));
    const target = pick(options);
    // Walk toward the closest point first, then jump at most ~260px sideways.
    const near = clamp((target.l + target.r) / 2, plat.l, plat.r);
    await walkTo(clamp(near + rand(-40, 40), plat.l, plat.r));
    if (poked) return;
    const lo = Math.max(target.l, x - 260), hi = Math.min(target.r, x + 260);
    const tx = lo <= hi ? rand(lo, hi) : clamp(x, target.l, target.r);
    await jumpTo(target, tx, Math.random() < 0.2);
  }

  async function loop() {
    let ps = platforms();
    // Start on the lowest platform that's visible, so it's on screen on phones too.
    plat = ps.filter(inView).sort((a, b) => b.t - a.t)[0] || ps.find(p => p.el.hasAttribute('data-ground'));
    x = rand(plat.l, plat.r);
    refresh();
    bot.style.opacity = 1;

    if (reduceMotion) return;
    await sleep(600);
    await tricks[0]();

    for (;;) {
      ps = refresh();
      if (poked) {
        poked = false;
        hearts();
        say(pick(['hehe', 'that tickles!', ':)', 'boop!']), 1300);
        await jumpTo(plat, x, true);
      } else {
        const r = Math.random();
        if (r < 0.35) await walkTo(rand(plat.l, plat.r));
        else if (r < 0.7) await hop(ps);
        else await pick(tricks)();
      }
      await sleep(rand(300, 1100));
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

  bot.addEventListener('click', () => { poked = true; });
  addEventListener('resize', () => { if (!bot.classList.contains('air')) refresh(); });

  bot.style.opacity = 0;
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(loop);
})();
