/*
 * Duesify robot: a 2D cartoon rig plus all of its animation clips.
 * Used by the website (live canvas) and by tools/export to bake GIFs and sprite sheets,
 * so both always show the exact same character.
 *
 * Units: 1 unit = 1px at scale 1. The origin (0, 0) is the ground point under the robot.
 * The robot faces right. Mirror it with opt.flip.
 */
(function (root) {
  'use strict';

  const COL = {
    out: '#19204a',
    body: '#e7eaf8',
    shade: '#c3cae9',
    bodyBack: '#cdd3ee',
    navy: '#2b3573',
    navyBack: '#222a5e',
    navyDark: '#1d2453',
    visor: '#131a3d',
    cyan: '#80f2ff',
    cyanDeep: '#38c6e6',
    shadow: 'rgba(118, 140, 205, 0.32)',
    fx: '#79d8ff',
  };
  const LW = 2.7;              // outline width
  const HIP_Y = -39;           // hip joint height
  const THIGH = 15, SHIN = 14; // leg segments
  const UPPER = 13, FORE = 15; // arm segments
  const NECK_Y = -88;

  // Cell used for exported frames (units). Ground sits near the bottom.
  const CELL = { w: 256, h: 320, groundX: 128, groundY: 296 };

  const BASE = {
    x: 0, y: 0, g: 1,            // root offset; g = how much auto-grounding applies (0..1)
    rot: 0, px: 0, py: -85,      // whole-body rotation (deg) around pivot (px, py)
    sx: 1, sy: 1, spin: 1,       // squash/stretch; spin = horizontal flip amount (-1..1)
    lean: 0,                     // torso lean around the hips (deg, + = forward)
    headRot: 0, headX: 0, headY: 0,
    armF: -18, armB: 12,           // shoulder angles (deg, + = forward). F = near arm, B = far arm
    elbF: 12, elbB: 12,          // elbow bend (+ = forearm forward)
    hipF: 0, hipB: 0,            // hip angles (+ = leg forward)
    kneeF: 0, kneeB: 0,          // knee bend (+ = shin backward)
    footF: 0, footB: 0,          // foot tilt (+ = toes up)
    phone: 0,                    // headphone lag (units)
    eyes: 'normal', blink: 0, look: 0,
    shadowW: 1,
  };
  const NUMERIC = Object.keys(BASE).filter(k => typeof BASE[k] === 'number');

  const rad = d => d * Math.PI / 180;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);

  // ---------- Kinematics ----------

  function legPoints(hx, hip, knee) {
    const a = rad(hip);
    const kx = hx + THIGH * Math.sin(a), ky = HIP_Y + THIGH * Math.cos(a);
    const g = rad(hip - knee);
    return { kx, ky, ax: kx + SHIN * Math.sin(g), ay: ky + SHIN * Math.cos(g) };
  }

  // Lowest foot bottom (local units, before root transform).
  function footBottom(p) {
    const f = legPoints(-13, p.hipF, p.kneeF), b = legPoints(13, p.hipB, p.kneeB);
    return Math.max(f.ay, b.ay) + 10;
  }

  function resolve(pose) {
    const p = Object.assign({}, BASE, pose);
    p.rootY = p.y - p.g * footBottom(p) * p.sy;
    return p;
  }

  // ---------- Drawing helpers ----------

  function seg(ctx, x1, y1, x2, y2, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 + 0.01, y2);
    ctx.stroke();
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function squircle(ctx, cx, cy, a, b, n) {
    ctx.beginPath();
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const c = Math.cos(t), s = Math.sin(t);
      const x = cx + a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const y = cy + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  function outlined(ctx, pathFn, fill) {
    pathFn();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COL.out;
    ctx.lineWidth = LW * 2;
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  // ---------- Body parts ----------

  function drawLeg(ctx, hx, hip, knee, foot, back) {
    const { kx, ky, ax, ay } = legPoints(hx, hip, knee);
    const fa = -rad(foot);
    const footPath = () => {
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(fa);
      rrect(ctx, -13, -3, 30, 13, 6.5);
      ctx.restore();
    };
    const W = 23;
    seg(ctx, hx, HIP_Y, kx, ky, W + LW * 2, COL.out);
    seg(ctx, kx, ky, ax, ay, W + LW * 2, COL.out);
    footPath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COL.out;
    ctx.lineWidth = LW * 2;
    ctx.stroke();
    seg(ctx, hx, HIP_Y, kx, ky, W, back ? COL.navyBack : COL.navy);
    seg(ctx, kx, ky, ax, ay, W - 1, back ? COL.bodyBack : COL.body);
    footPath();
    ctx.fillStyle = back ? COL.bodyBack : COL.body;
    ctx.fill();
    // sole
    ctx.save();
    footPath();
    ctx.clip();
    ctx.fillStyle = back ? COL.navyBack : COL.navy;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(fa);
    ctx.fillRect(-15, 6, 34, 6);
    ctx.restore();
    ctx.restore();
  }

  function drawArm(ctx, sx, sy, ang, elb, back) {
    const a = rad(ang);
    const ex = sx + UPPER * Math.sin(a), ey = sy + UPPER * Math.cos(a);
    const b = rad(ang + elb);
    const hx = ex + FORE * Math.sin(b), hy = ey + FORE * Math.cos(b);
    const W = 20;
    seg(ctx, sx, sy, ex, ey, W + 2 + LW * 2, COL.out);
    seg(ctx, ex, ey, hx, hy, W + LW * 2, COL.out);
    ctx.beginPath();
    ctx.arc(hx, hy, 11.5 + LW, 0, Math.PI * 2);
    ctx.fillStyle = COL.out;
    ctx.fill();
    seg(ctx, sx, sy, ex, ey, W + 2, back ? COL.navyBack : COL.navy);
    seg(ctx, ex, ey, hx, hy, W, back ? COL.bodyBack : COL.body);
    ctx.beginPath();
    ctx.arc(hx, hy, 11.5, 0, Math.PI * 2);
    ctx.fillStyle = back ? COL.bodyBack : COL.body;
    ctx.fill();
    return { hx, hy };
  }

  function drawTorso(ctx) {
    const path = () => rrect(ctx, -32, -94, 64, 58, 20);
    path();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COL.out;
    ctx.lineWidth = LW * 2;
    ctx.stroke();
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = COL.shade;
    ctx.fillRect(-36, -98, 72, 64);
    rrect(ctx, -25, -98, 62, 56, 20);
    ctx.fillStyle = COL.body;
    ctx.fill();
    // navy hips / shorts
    ctx.fillStyle = COL.navy;
    ctx.beginPath();
    ctx.moveTo(-36, -52);
    ctx.quadraticCurveTo(0, -46, 36, -52);
    ctx.lineTo(36, -30);
    ctx.lineTo(-36, -30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COL.out;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-36, -52);
    ctx.quadraticCurveTo(0, -46, 36, -52);
    ctx.stroke();
    // navy side panel (near side)
    ctx.fillStyle = COL.navy;
    ctx.beginPath();
    ctx.ellipse(-33, -72, 10, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // chest display
    ctx.save();
    rrect(ctx, -6, -80, 30, 16, 4);
    ctx.shadowColor = COL.cyan;
    ctx.shadowBlur = 8;
    ctx.fillStyle = COL.cyan;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = COL.out;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    rrect(ctx, -2, -77, 10, 3, 1.5);
    ctx.fill();
    ctx.restore();
  }

  function drawEyes(ctx, p) {
    const e1 = { x: 7 + p.look * 4, y: -130 }, e2 = { x: 39 + p.look * 4, y: -130 };
    ctx.save();
    ctx.shadowColor = COL.cyan;
    ctx.shadowBlur = 9;
    ctx.fillStyle = COL.cyan;
    ctx.strokeStyle = COL.cyan;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const oval = (e, rx, ry) => { ctx.beginPath(); ctx.ellipse(e.x, e.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
    const blinkY = 1 - 0.9 * clamp(p.blink, 0, 1);
    switch (p.eyes) {
      case 'happy':
        ctx.lineWidth = 4.2;
        for (const e of [e1, e2]) {
          ctx.beginPath();
          ctx.moveTo(e.x - 7, e.y + 3);
          ctx.quadraticCurveTo(e.x, e.y - 9, e.x + 7, e.y + 3);
          ctx.stroke();
        }
        break;
      case 'squint':
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(e1.x - 6, e1.y - 7); ctx.lineTo(e1.x + 5, e1.y); ctx.lineTo(e1.x - 6, e1.y + 7);
        ctx.moveTo(e2.x + 6, e2.y - 7); ctx.lineTo(e2.x - 5, e2.y); ctx.lineTo(e2.x + 6, e2.y + 7);
        ctx.stroke();
        break;
      case 'surprised':
        oval(e1, 9, 11.5);
        oval(e2, 8.5, 11.5);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(e1.x + 3, e1.y - 4, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2.x + 3, e2.y - 4, 2.6, 0, Math.PI * 2); ctx.fill();
        break;
      case 'dizzy':
        ctx.lineWidth = 2.6;
        for (const e of [e1, e2]) {
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const t = i / 40, a = t * Math.PI * 4.2, r = 1 + t * 8;
            const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
        break;
      case 'wink':
        oval(e1, 7, 10 * blinkY);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(e2.x + 6, e2.y - 7); ctx.lineTo(e2.x - 5, e2.y); ctx.lineTo(e2.x + 6, e2.y + 7);
        ctx.stroke();
        break;
      case 'determined':
        oval(e1, 7, 10 * blinkY);
        oval(e2, 6.5, 10 * blinkY);
        ctx.shadowBlur = 0;
        ctx.fillStyle = COL.visor;
        ctx.beginPath();
        ctx.moveTo(e1.x - 10, e1.y - 16); ctx.lineTo(e1.x + 9, e1.y - 16); ctx.lineTo(e1.x + 9, e1.y - 3);
        ctx.closePath();
        ctx.moveTo(e2.x + 10, e2.y - 16); ctx.lineTo(e2.x - 9, e2.y - 16); ctx.lineTo(e2.x - 9, e2.y - 3);
        ctx.closePath();
        ctx.fill();
        break;
      default:
        oval(e1, 7, 10 * blinkY);
        oval(e2, 6.5, 10 * blinkY);
    }
    ctx.restore();
  }

  function drawHead(ctx, p) {
    const cy = -132;
    // far ear cup peeks out behind the head
    outlined(ctx, () => { ctx.beginPath(); ctx.ellipse(57, cy + 3 + p.phone * 0.5, 10, 22, 0, 0, Math.PI * 2); }, COL.navyBack);

    const head = () => squircle(ctx, 0, cy, 62, 49, 2.6);
    head();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COL.out;
    ctx.lineWidth = LW * 2;
    ctx.stroke();
    ctx.save();
    head();
    ctx.clip();
    ctx.fillStyle = COL.shade;
    ctx.fillRect(-70, cy - 60, 140, 120);
    squircle(ctx, 5, cy - 4, 60, 46, 2.6);
    ctx.fillStyle = COL.body;
    ctx.fill();
    // headband over the top
    ctx.lineCap = 'round';
    const band = () => { ctx.beginPath(); ctx.moveTo(-52, cy - 12); ctx.quadraticCurveTo(-40, cy - 50, 6, cy - 54); ctx.quadraticCurveTo(40, cy - 56, 70, cy - 40); };
    band(); ctx.strokeStyle = COL.out; ctx.lineWidth = 12 + LW * 2; ctx.stroke();
    band(); ctx.strokeStyle = COL.navy; ctx.lineWidth = 12; ctx.stroke();
    // visor
    rrect(ctx, -24, cy - 25, 84, 50, 23);
    ctx.fillStyle = COL.visor;
    ctx.fill();
    ctx.restore();

    // visor shine
    ctx.save();
    rrect(ctx, -24, cy - 25, 84, 50, 23);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-12, cy - 14);
    ctx.quadraticCurveTo(-4, cy - 21, 10, cy - 21);
    ctx.stroke();
    ctx.restore();

    drawEyes(ctx, p);

    // near ear cup
    const ey = cy + 4 + p.phone;
    outlined(ctx, () => { ctx.beginPath(); ctx.ellipse(-52, ey, 18, 27, 0, 0, Math.PI * 2); }, COL.navy);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-55, ey, 11, 21, 0, 0, Math.PI * 2);
    ctx.fillStyle = COL.navyDark;
    ctx.fill();
    ctx.shadowColor = COL.cyan;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = COL.cyan;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.ellipse(-57, ey, 10, 20, 0, Math.PI * 0.55, Math.PI * 1.45);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- Effects (drawn in ground space, not rotated with the body) ----------

  function note(ctx, x, y, s, a) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = COL.fx;
    ctx.strokeStyle = COL.fx;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 3.8, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4.4, -1); ctx.lineTo(4.4, -18); ctx.quadraticCurveTo(10, -14, 11, -8); ctx.stroke();
    ctx.restore();
  }

  function drawFx(ctx, fx) {
    for (const e of fx || []) {
      ctx.save();
      ctx.globalAlpha = e.a ?? 1;
      ctx.strokeStyle = COL.fx;
      ctx.fillStyle = COL.fx;
      ctx.lineCap = 'round';
      switch (e.type) {
        case 'speed': {
          ctx.lineWidth = 3;
          const lines = [[-112, 18, e.k], [-96, 28, e.k + 0.33], [-70, 14, e.k + 0.66]];
          for (const [y, len, ph] of lines) {
            const off = ((ph % 1) * 18);
            ctx.beginPath();
            ctx.moveTo(e.x - 62 - off, y);
            ctx.lineTo(e.x - 62 - off - len, y);
            ctx.stroke();
          }
          break;
        }
        case 'dust': {
          const t = e.t;
          ctx.globalAlpha = (e.a ?? 1) * (1 - t) * 0.8;
          ctx.fillStyle = '#c9d3f2';
          for (const s of [-1, 1]) {
            for (let i = 0; i < 3; i++) {
              const r = 4 + i * 1.6 + t * 4;
              ctx.beginPath();
              ctx.arc(e.x + s * (24 + i * 10 + t * 22), -3 - i * 3 - t * 6, r, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
        }
        case 'impact': {
          ctx.lineWidth = 3;
          ctx.globalAlpha = (e.a ?? 1) * (1 - e.t);
          for (const a of [-150, -120, -60, -30]) {
            const r0 = 20 + e.t * 16, r1 = r0 + 12;
            const c = Math.cos(rad(a)), s = Math.sin(rad(a));
            ctx.beginPath();
            ctx.moveTo(e.x + c * r0 * 1.6, e.y + s * r0);
            ctx.lineTo(e.x + c * r1 * 1.6, e.y + s * r1);
            ctx.stroke();
          }
          break;
        }
        case 'notes':
          note(ctx, e.x, e.y, 1, e.a ?? 1);
          break;
        case 'swirl': {
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          for (let i = 0; i <= 50; i++) {
            const t = i / 50, a = t * Math.PI * 5 + e.k * Math.PI * 2, r = 2 + t * 9;
            const x = e.x + Math.cos(a) * r * 1.4, y = e.y + Math.sin(a) * r * 0.6 - t * 10;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
          break;
        }
        case 'arcs': {
          ctx.lineWidth = 3;
          for (const [r, a0, a1] of [[92, e.a0, e.a0 + 0.9], [80, e.a0 + 3.1, e.a0 + 3.9]]) {
            ctx.beginPath();
            ctx.arc(e.x, e.y, r, a0, a1);
            ctx.stroke();
          }
          break;
        }
        case 'sparkle': {
          const s = e.s ?? 1;
          ctx.translate(e.x, e.y);
          ctx.scale(s, s);
          ctx.fillStyle = COL.cyan;
          ctx.beginPath();
          ctx.moveTo(0, -9); ctx.quadraticCurveTo(1.5, -1.5, 9, 0); ctx.quadraticCurveTo(1.5, 1.5, 0, 9);
          ctx.quadraticCurveTo(-1.5, 1.5, -9, 0); ctx.quadraticCurveTo(-1.5, -1.5, 0, -9);
          ctx.fill();
          break;
        }
        case 'bounce': {
          ctx.lineWidth = 2.6;
          ctx.globalAlpha = (e.a ?? 1) * 0.8;
          for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(e.x + s * 52, -12, 10, s > 0 ? -0.6 : Math.PI - 0.6, s > 0 ? 0.6 : Math.PI + 0.6);
            ctx.stroke();
          }
          break;
        }
      }
      ctx.restore();
    }
  }

  // ---------- Main draw ----------

  /**
   * Draw a pose.
   * opt.x, opt.y: where the ground origin lands on the canvas (px)
   * opt.scale: px per unit, opt.flip: face left, opt.shadow: draw the ground shadow (default true)
   */
  function draw(ctx, pose, opt = {}) {
    const p = resolve(pose);
    const s = opt.scale ?? 1;
    ctx.save();
    ctx.translate(opt.x ?? 0, opt.y ?? 0);
    ctx.scale(s * (opt.flip ? -1 : 1), s);

    if (opt.shadow !== false) {
      const lift = Math.max(0, -(p.rootY));
      const w = 48 * p.shadowW * clamp(1 - lift / 260, 0.45, 1);
      ctx.fillStyle = COL.shadow;
      ctx.beginPath();
      ctx.ellipse(p.x, 1, w, 7 * clamp(1 - lift / 260, 0.5, 1), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(p.x, p.rootY);
    ctx.scale(p.sx * p.spin, p.sy);
    ctx.translate(p.px, p.py);
    ctx.rotate(rad(p.rot));
    ctx.translate(-p.px, -p.py);

    drawLeg(ctx, 13, p.hipB, p.kneeB, p.footB, true);

    ctx.save();
    ctx.translate(0, HIP_Y);
    ctx.rotate(rad(p.lean));
    ctx.translate(0, -HIP_Y);
    drawArm(ctx, 31, -82, p.armB, p.elbB, true);
    ctx.restore();

    ctx.save();
    ctx.translate(0, HIP_Y);
    ctx.rotate(rad(p.lean));
    ctx.translate(0, -HIP_Y);
    drawTorso(ctx);
    ctx.restore();

    drawLeg(ctx, -13, p.hipF, p.kneeF, p.footF, false);

    ctx.save();
    ctx.translate(0, HIP_Y);
    ctx.rotate(rad(p.lean));
    ctx.translate(0, -HIP_Y);
    ctx.save();
    ctx.translate(p.headX, NECK_Y + p.headY);
    ctx.rotate(rad(p.headRot));
    ctx.translate(0, -NECK_Y);
    drawHead(ctx, p);
    ctx.restore();
    drawArm(ctx, -31, -81, p.armF, p.elbF, false);
    ctx.restore();

    ctx.restore();
    drawFx(ctx, pose.fx);
    ctx.restore();
  }

  // ---------- Animation helpers ----------

  // Cubic (Catmull-Rom style) interpolation over keyframes [[frame, {params}], ...].
  function keys(list, f, loopLen) {
    const out = {};
    const n = list.length;
    const names = new Set();
    list.forEach(([, v]) => Object.keys(v).forEach(k => names.add(k)));
    for (const name of names) {
      const pts = list.filter(([, v]) => name in v).map(([t, v]) => [t, v[name]]);
      if (typeof pts[0][1] !== 'number') {
        let val = pts[0][1];
        for (const [t, v] of pts) if (t <= f) val = v;
        out[name] = val;
        continue;
      }
      if (loopLen) {
        const first = pts[0], last = pts[pts.length - 1];
        pts.unshift([last[0] - loopLen, last[1]]);
        pts.push([first[0] + loopLen, first[1]]);
      }
      if (f <= pts[0][0]) { out[name] = pts[0][1]; continue; }
      if (f >= pts[pts.length - 1][0]) { out[name] = pts[pts.length - 1][1]; continue; }
      let i = 0;
      while (pts[i + 1][0] < f) i++;
      const [t0, p0] = pts[i], [t1, p1] = pts[i + 1];
      const prev = pts[i - 1] || pts[i], next = pts[i + 2] || pts[i + 1];
      const dt = t1 - t0;
      const m0 = i > 0 ? (p1 - prev[1]) / (t1 - prev[0]) * dt : 0;
      const m1 = i + 2 < pts.length ? (next[1] - p0) / (next[0] - t0) * dt : 0;
      const t = (f - t0) / dt, t2 = t * t, t3 = t2 * t;
      out[name] = (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
    }
    void n;
    return out;
  }

  const blinkAt = (f, at, len = 4) => {
    const d = Math.abs(f - at);
    return d < len / 2 ? 1 - d / (len / 2) : 0;
  };
  const TAU = Math.PI * 2;

  // ---------- Clips ----------
  // Each clip: frames, fps, loop, pose(f) -> pose object (f = 0 .. frames-1)

  const LYING = {
    g: 0, rot: -90, px: 0, py: -38, y: 0, x: 58,
    headRot: 56, lean: 0,
    armF: 150, elbF: 30, armB: 120, elbB: 20,
    hipF: 30, kneeF: 25, hipB: 10, kneeB: 10, footF: 20,
    shadowW: 2.1,
  };

  const clips = {
    Idle: {
      frames: 48, fps: 12, loop: true,
      pose(f) {
        const p = f / 48;
        const br = Math.sin(TAU * 2 * p);
        const sway = Math.sin(TAU * p);
        return {
          headY: -1.6 * br - 0.6,
          sy: 1 + 0.018 * br,
          sx: 1 - 0.01 * br,
          headRot: 3.5 * Math.sin(TAU * p + 0.6),
          lean: 1.5 * sway,
          x: 2 * sway,
          hipF: 3 * sway, hipB: -3 * sway,
          kneeF: Math.max(0, -sway) * 8, kneeB: Math.max(0, sway) * 8,
          armF: -18 + 3 * Math.sin(TAU * 2 * p + 1), armB: 12 - 3 * Math.sin(TAU * 2 * p + 1), elbF: 8, elbB: 8,
          phone: 0.8 * br,
          blink: blinkAt(f, 18) + blinkAt(f, 38) + blinkAt(f, 43),
          look: 0.4 * Math.sin(TAU * p),
        };
      },
    },

    Walk: {
      frames: 48, fps: 16, loop: true,
      pose(f) {
        const p = f / 48;
        const legAt = (q) => {           // q: 0..1 in this leg's cycle; swing first 30%
          const A = 28;
          if (q < 0.3) {
            const t = smooth(q / 0.3);
            return { hip: lerp(-A, A, t), knee: 46 * Math.sin(Math.PI * q / 0.3), foot: 12 * Math.sin(Math.PI * q / 0.3) };
          }
          const t = (q - 0.3) / 0.7;
          return { hip: lerp(A, -A, t), knee: 4, foot: t > 0.85 ? -10 * (t - 0.85) / 0.15 : 0 };
        };
        const L = legAt(p), R = legAt((p + 0.5) % 1);
        const swing = Math.cos(TAU * (p - 0.27));
        return {
          hipF: L.hip, kneeF: L.knee, footF: L.foot,
          hipB: R.hip, kneeB: R.knee, footB: R.foot,
          armB: 32 * swing, armF: -32 * swing, elbF: 18, elbB: 18,
          lean: 4,
          headRot: 2.5 * Math.sin(TAU * p) + 2,
          headY: 1.4 * Math.cos(TAU * 2 * (p - 0.27)),
          phone: 1.2 * Math.sin(TAU * 2 * p),
          blink: blinkAt(f, 30),
        };
      },
    },

    Run: {
      frames: 48, fps: 24, loop: true,
      pose(f) {
        const p = f / 48;
        const q = (p * 2) % 1;         // two strides per loop
        const legAt = (u) => {
          const A = 40;
          if (u < 0.55) {
            const t = smooth(u / 0.55);
            return { hip: lerp(-A, A + 6, t), knee: 100 * Math.sin(Math.PI * Math.min(1, u / 0.5)) + 6, foot: 15 * Math.sin(Math.PI * u / 0.55) };
          }
          const t = (u - 0.55) / 0.45;
          return { hip: lerp(A + 6, -A, t), knee: 10 + 14 * t, foot: -14 * t };
        };
        const L = legAt(q), R = legAt((q + 0.5) % 1);
        const pump = Math.cos(TAU * (q - 0.3));
        const bounce = Math.pow(Math.sin(Math.PI * ((q * 2 + 0.85) % 1)), 2);
        return {
          hipF: L.hip, kneeF: L.knee, footF: L.foot,
          hipB: R.hip, kneeB: R.knee, footB: R.foot,
          armB: 55 * pump - 5, armF: -55 * pump - 5, elbF: 85, elbB: 85,
          lean: 14,
          y: -9 * bounce,
          headRot: 4 + 2 * Math.sin(TAU * 2 * q),
          headY: 2 * Math.cos(TAU * 2 * q),
          phone: 3 * Math.sin(TAU * 2 * q - 1),
          sy: 1 + 0.03 * Math.cos(TAU * 2 * q),
          eyes: 'determined',
          fx: [{ type: 'speed', x: 0, k: p * 4, a: 0.9 }],
        };
      },
    },

    Jump: {
      frames: 48, fps: 16, loop: false,
      pose(f) {
        const k = keys([
          [0, { y: 0, sy: 1, sx: 1, hipF: 0, hipB: 0, kneeF: 0, kneeB: 0, armF: -18, armB: 12, elbF: 8, elbB: 8, lean: 0, headRot: 0 }],
          [7, { y: 0, sy: 0.84, sx: 1.1, hipF: 32, hipB: 30, kneeF: 66, kneeB: 64, armF: -40, armB: -50, elbF: 20, elbB: 20, lean: 14, headRot: 6 }],
          [12, { y: -38, sy: 1.16, sx: 0.9, hipF: -6, hipB: -10, kneeF: 6, kneeB: 4, armF: 150, armB: 140, elbF: 10, elbB: 10, lean: -4, headRot: -6 }],
          [20, { y: -86, sy: 1.04, sx: 0.97, hipF: 24, hipB: 8, kneeF: 50, kneeB: 30, armF: 110, armB: 100, elbF: 6, elbB: 6, lean: 0, headRot: -4 }],
          [28, { y: -100, sy: 1, sx: 1, hipF: 30, hipB: 14, kneeF: 56, kneeB: 36, armF: 100, armB: 92, lean: 0, headRot: 2 }],
          [32, { y: -96, sy: 1, sx: 1 }],
          [39, { y: -22, sy: 1.1, sx: 0.94, hipF: 4, hipB: 2, kneeF: 6, kneeB: 6, armF: 140, armB: 132, elbF: 8, elbB: 8, lean: -2, headRot: -2 }],
          [41, { y: 0, sy: 0.8, sx: 1.16, hipF: 30, hipB: 28, kneeF: 60, kneeB: 58, armF: 40, armB: 30, elbF: 30, elbB: 30, lean: 12, headRot: 8 }],
          [44, { y: 0, sy: 1.05, sx: 0.97, hipF: 6, hipB: 6, kneeF: 10, kneeB: 10, armF: 10, armB: -4, lean: -2, headRot: -3 }],
          [47, { y: 0, sy: 1, sx: 1, hipF: 0, hipB: 0, kneeF: 0, kneeB: 0, armF: -18, armB: 12, elbF: 8, elbB: 8, lean: 0, headRot: 0 }],
        ], f);
        k.eyes = f >= 14 && f < 40 ? 'happy' : 'normal';
        k.phone = f > 9 && f < 40 ? (f < 26 ? 3 : -3) : 0;
        k.fx = [];
        if (f >= 40 && f <= 47) k.fx.push({ type: 'dust', x: 0, t: (f - 40) / 7 });
        if (f >= 8 && f <= 13) k.fx.push({ type: 'dust', x: 0, t: (f - 8) / 5, a: 0.6 });
        return k;
      },
    },

    FallOver: {
      frames: 64, fps: 16, loop: false,
      pose(f) {
        const k = keys([
          [0, { x: 0, rot: 0, py: 0, px: 0, lean: 0, armF: -18, armB: 12, elbF: 8, elbB: 8, hipF: 0, hipB: 0, kneeF: 0, kneeB: 0, headRot: 0, y: 0, g: 1, shadowW: 1, footF: 0 }],
          [5, { rot: 6, lean: 6, armF: 40, armB: 60, headRot: 6 }],
          [10, { rot: -7, lean: -6, armF: 120, armB: -30, headRot: -8 }],
          [14, { rot: 8, lean: 8, armF: -20, armB: 140, headRot: 8 }],
          [18, { rot: -10, lean: -4, armF: 160, armB: 20, elbF: 30, headRot: -10 }],
          [22, { rot: -6, armF: 30, armB: 170, elbB: 30 }],
          [26, { x: 6, rot: -12, lean: -10, hipF: -24, kneeF: 30, hipB: 10, armF: 150, armB: 60, headRot: -6 }],
          [30, { x: 12, rot: -9, hipF: 2, kneeF: 4, hipB: -26, kneeB: 34, armF: 60, armB: 160 }],
          [34, { x: 18, rot: -14, hipF: -28, kneeF: 34, hipB: 4, kneeB: 4, armF: 170, armB: 90, headRot: -12 }],
          [38, { x: 24, rot: -18, hipF: 0, kneeF: 6, hipB: -18, kneeB: 20, armF: 140, armB: 150, lean: -12 }],
          [42, { x: 28, rot: -30, py: 0, hipF: 22, kneeF: 10, hipB: 12, armF: 160, armB: 165, elbF: 20, elbB: 20, headRot: -18, lean: -8 }],
          [48, { x: 44, y: 6, rot: -70, g: 0.3, hipF: 34, kneeF: 22, hipB: 18, kneeB: 12, armF: 165, armB: 150, headRot: 10, lean: 0, shadowW: 1.7 }],
          [51, Object.assign({}, LYING, { y: LYING.y - 5, rot: -94, armF: 170, armB: 140, hipF: 40, kneeF: 30 })],
          [54, Object.assign({}, LYING, { y: LYING.y + 1, rot: -88 })],
          [57, Object.assign({}, LYING, { rot: -91 })],
          [63, LYING],
        ], f);
        k.eyes = f < 22 ? 'normal' : f < 51 ? 'squint' : 'surprised';
        k.blink = blinkAt(f, 8, 3);
        k.phone = f > 40 && f < 52 ? 4 : 0;
        k.fx = [];
        if (f >= 51 && f <= 58) k.fx.push({ type: 'impact', x: -20, y: -20, t: (f - 51) / 7 });
        if (f >= 51) k.fx.push({ type: 'dust', x: 20, t: Math.min(1, (f - 51) / 10) });
        if (f >= 56) k.fx.push({ type: 'swirl', x: -46, y: -104, k: f / 16, a: Math.min(1, (f - 56) / 4) });
        return k;
      },
    },

    Dance: {
      frames: 96, fps: 12, loop: true,
      pose(f) {
        const k = keys([
          // 1–16 sway
          [0, { lean: 0, x: 0, armF: 30, armB: -30, elbF: 30, elbB: 30, headRot: 0, hipF: 0, hipB: 0, kneeF: 0, kneeB: 0, spin: 1, y: 0 }],
          [4, { lean: 9, x: 5, armF: -20, armB: 40, headRot: 9, hipF: 6, hipB: -4, kneeB: 14 }],
          [8, { lean: -9, x: -5, armF: 40, armB: -20, headRot: -9, hipF: -4, hipB: 6, kneeF: 14, kneeB: 0 }],
          [12, { lean: 9, x: 5, armF: -20, armB: 40, headRot: 9, hipF: 6, hipB: -4, kneeF: 0, kneeB: 14 }],
          [16, { lean: 0, x: 0, armF: 120, armB: 120, elbF: 10, elbB: 10, headRot: 0, hipF: 0, hipB: 0, kneeF: 0, kneeB: 0 }],
          // 17–32 arms up + bounce
          [20, { armF: 165, armB: 150, headRot: 5 }],
          [24, { armF: 150, armB: 165, headRot: -5 }],
          [28, { armF: 165, armB: 150, headRot: 5 }],
          [32, { armF: 70, armB: 70, elbF: 60, elbB: 60, headRot: 0, x: 0 }],
          // 33–48 side steps
          [36, { x: 14, hipF: -18, kneeF: 30, hipB: 14, kneeB: 0, lean: -6, armF: 20, armB: 100, headRot: 6 }],
          [40, { x: 16, hipF: 0, kneeF: 0, hipB: 0, kneeB: 0, lean: 0, armF: 70, armB: 70 }],
          [44, { x: -14, hipF: 14, kneeF: 0, hipB: -18, kneeB: 30, lean: 6, armF: 100, armB: 20, headRot: -6 }],
          [48, { x: 0, hipF: 0, kneeF: 0, hipB: 0, kneeB: 0, lean: 0, armF: 90, armB: 90, elbF: 10, elbB: 10, headRot: 0, spin: 1 }],
          // 49–64 spin
          [52, { spin: 0.05, armF: 95, armB: 95, y: -8 }],
          [56, { spin: -1, y: -12 }],
          [60, { spin: 0.05, y: -8 }],
          [64, { spin: 1, y: 0, armF: 20, armB: -10, elbF: 40, elbB: 40 }],
          // 65–80 foot taps + head bobs
          [68, { hipF: 22, kneeF: 18, footF: 22, headRot: 10, headY: 2, armF: 40, armB: -30 }],
          [72, { hipF: 0, kneeF: 0, footF: 0, headRot: -4, headY: 0, armF: -10, armB: 20 }],
          [76, { hipB: 22, kneeB: 18, footB: 22, headRot: -10, headY: 2, armF: 40, armB: -30 }],
          [80, { hipB: 0, kneeB: 0, footB: 0, headRot: 4, headY: 0, armF: 30, armB: -30 }],
          // 81–96 happy pose, back to start
          [84, { armF: 155, armB: 150, elbF: 0, elbB: 0, lean: -6, headRot: -8, y: -6 }],
          [90, { armF: 160, armB: 155, lean: -6, headRot: -8, y: -6 }],
          [95, { lean: 0, x: 0, armF: 30, armB: -30, elbF: 30, elbB: 30, headRot: 0, y: 0 }],
        ], f, 96);
        // beat bounce
        const beat = Math.abs(Math.sin(Math.PI * f / 4));
        if (f >= 16 && f < 32) { k.y = (k.y || 0) - 10 * beat; k.sy = 1 + 0.06 * (1 - beat) - 0.03; }
        else if (f < 16 || (f >= 64 && f < 80)) { k.y = (k.y || 0) - 3 * beat; }
        if (f >= 49 && f < 64) { const c = Math.cos(Math.PI * 2 * (f - 48) / 16); k.spin = Math.sign(c || 1) * Math.max(0.35, Math.abs(c)); }
        k.eyes = f >= 84 && f < 92 ? (f >= 86 && f < 90 ? 'wink' : 'happy') : f >= 16 && f < 32 ? 'happy' : 'normal';
        k.phone = 2 * Math.sin(Math.PI * f / 4);
        k.blink = blinkAt(f, 40, 3);
        const notes = [];
        for (let i = 0; i < 3; i++) {
          const t = ((f / 96) * 3 + i / 3) % 1;
          notes.push({ type: 'notes', x: (i % 2 ? 62 : -78) + Math.sin(t * 6 + i) * 6, y: -150 - t * 70 + i * 10, a: Math.sin(Math.PI * t) });
        }
        k.fx = notes;
        if (f >= 16 && f < 32) k.fx.push({ type: 'bounce', x: 0, a: 1 - beat });
        return k;
      },
    },

    Backflip: {
      frames: 64, fps: 16, loop: false,
      pose(f) {
        const k = keys([
          [0, { y: 0, rot: 0, sy: 1, sx: 1, hipF: 0, hipB: 0, kneeF: 0, kneeB: 0, armF: -18, armB: 12, elbF: 8, elbB: 8, lean: 0, headRot: 0, g: 1 }],
          [7, { y: 0, rot: 0, sy: 0.84, sx: 1.1, hipF: 34, hipB: 32, kneeF: 68, kneeB: 66, armF: -50, armB: -60, lean: 12, headRot: 8 }],
          [12, { y: -46, rot: -18, sy: 1.14, sx: 0.92, hipF: -8, hipB: -10, kneeF: 6, kneeB: 6, armF: 160, armB: 150, elbF: 6, elbB: 6, lean: -12, headRot: -12 }],
          [16, { y: -72, rot: -45, sy: 1.04, sx: 1, hipF: 40, hipB: 34, kneeF: 70, kneeB: 64, armF: 120, armB: 110 }],
          [24, { y: -98, rot: -100, sy: 1, hipF: 80, hipB: 74, kneeF: 120, kneeB: 115, armF: 60, armB: 50, elbF: 40, elbB: 40, lean: 6, headRot: 10 }],
          [32, { y: -106, rot: -180 }],
          [40, { y: -84, rot: -270 }],
          [46, { y: -26, rot: -350, hipF: 10, hipB: 6, kneeF: 14, kneeB: 10, armF: 140, armB: 130, elbF: 10, elbB: 10, lean: -2, headRot: -4 }],
          [48, { y: -6, rot: -360, hipF: 6, hipB: 4, kneeF: 8, kneeB: 8 }],
          [51, { y: 0, rot: -360, sy: 0.8, sx: 1.16, hipF: 34, hipB: 32, kneeF: 66, kneeB: 64, armF: 60, armB: 50, elbF: 30, elbB: 30, lean: 14, headRot: 10 }],
          [56, { y: 0, rot: -360, sy: 1.04, sx: 0.98, hipF: 4, hipB: 4, kneeF: 6, kneeB: 6, armF: 20, armB: 10, lean: -2, headRot: -4 }],
          [60, { sy: 1, sx: 1, hipF: 8, hipB: -4, kneeF: 0, kneeB: 0, armF: 170, armB: -20, elbF: 40, elbB: 50, lean: -8, headRot: -10 }],
          [63, { sy: 1, sx: 1, hipF: 8, hipB: -4, kneeF: 0, kneeB: 0, armF: 168, armB: -18, elbF: 40, elbB: 50, lean: -8, headRot: -10 }],
        ], f);
        k.py = -88;
        k.eyes = f >= 56 ? 'happy' : f >= 16 && f < 46 ? 'squint' : 'normal';
        k.phone = f > 10 && f < 48 ? 3 : 0;
        k.fx = [];
        if (f >= 18 && f <= 44) k.fx.push({ type: 'arcs', x: 0, y: k.y - 88 - 6, a0: -rad(k.rot) + 1.2, a: 0.75 });
        if (f >= 49 && f <= 57) k.fx.push({ type: 'dust', x: 0, t: (f - 49) / 8 });
        if (f >= 58) {
          const t = (f - 58) / 5;
          k.fx.push({ type: 'sparkle', x: -50, y: -178 - t * 6, s: 0.6 + t * 0.5, a: Math.min(1, t * 2) });
          k.fx.push({ type: 'sparkle', x: 52, y: -190 + t * 4, s: 0.4 + t * 0.4, a: Math.min(1, t * 2) });
        }
        return k;
      },
    },

    StandUp: {
      frames: 64, fps: 16, loop: false,
      pose(f) {
        const SIT = { g: 0, rot: 0, px: 0, py: -38, x: 18, y: 24, lean: 4, headRot: 0, armF: -20, elbF: 20, armB: -30, elbB: 20, hipF: 80, kneeF: 6, hipB: 74, kneeB: 4, footF: 10, footB: 10, shadowW: 1.4 };
        const k = keys([
          [0, LYING],
          [5, Object.assign({}, LYING, { headRot: 30 })],
          [9, Object.assign({}, LYING, { headRot: 46 })],
          [13, Object.assign({}, LYING, { headRot: 32, armF: 120 })],
          [16, Object.assign({}, LYING, { headRot: 38, armF: 100 })],
          [22, { g: 0, rot: -60, x: 46, y: 40, headRot: 20, armF: 40, armB: 60, hipF: 50, kneeF: 30, hipB: 30, kneeB: 20, shadowW: 1.8 }],
          [27, { rot: -20, x: 30, y: 36, headRot: 6 }],
          [32, SIT],
          [37, Object.assign({}, SIT, { armF: -40, armB: -50, elbF: 40, elbB: 40, hipF: 70, kneeF: 110, hipB: 64, kneeB: 104, lean: 18, headRot: 6 })],
          [42, { g: 1, y: 0, x: 8, rot: 0, hipF: 46, kneeF: 92, hipB: 40, kneeB: 84, armF: -30, armB: -40, elbF: 30, elbB: 30, lean: 26, headRot: 8, shadowW: 1, footF: 0, footB: 0 }],
          [48, { g: 1, y: 0, x: 2, hipF: 14, kneeF: 26, hipB: 10, kneeB: 20, armF: 0, armB: -10, elbF: 20, elbB: 20, lean: 6, headRot: 2 }],
          [53, { hipF: 0, kneeF: 0, hipB: 0, kneeB: 0, armF: 150, elbF: 100, armB: -8, lean: 0, headRot: -10 }],
          [57, { armF: 160, elbF: 96, headRot: -14 }],
          [60, { armF: 150, elbF: 100, headRot: -6 }],
          [63, { armF: -18, armB: 12, elbF: 8, elbB: 8, headRot: 0, lean: 0, hipF: 0, hipB: 0, kneeF: 0, kneeB: 0, x: 0, y: 0, g: 1, rot: 0, shadowW: 1 }],
        ], f);
        k.eyes = f < 4 ? 'surprised' : f < 18 ? 'dizzy' : f >= 58 ? 'happy' : 'normal';
        k.blink = blinkAt(f, 20, 4) + blinkAt(f, 26, 4);
        k.phone = f >= 53 && f < 60 ? -3 : 0;
        k.fx = [];
        if (f < 16) k.fx.push({ type: 'swirl', x: -46, y: -104, k: f / 16, a: 1 - f / 16 });
        if (f >= 30 && f <= 38) k.fx.push({ type: 'dust', x: 0, t: (f - 30) / 8, a: 0.6 });
        return k;
      },
    },
  };

  // Blend two poses (numeric params interpolate, the rest switch halfway).
  function blend(a, b, t) {
    const out = Object.assign({}, BASE, a, t >= 0.5 ? b : {});
    const A = Object.assign({}, BASE, a), B = Object.assign({}, BASE, b);
    for (const k of NUMERIC) out[k] = lerp(A[k], B[k], t);
    out.fx = t < 0.5 ? a.fx : b.fx;
    return out;
  }

  function normalize(pose) {
    const p = Object.assign({}, pose);
    if (typeof p.rot === 'number') p.rot = ((p.rot % 360) + 540) % 360 - 180;
    return p;
  }

  const api = { CELL, BASE, clips, draw, blend, normalize, resolve, COL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RobotRig = api;
})(typeof window !== 'undefined' ? window : globalThis);
