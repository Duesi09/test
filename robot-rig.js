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
  const LW = 3;              // outline width
  const HIP_Y = -36;           // hip joint height
  const THIGH = 13, SHIN = 13; // leg segments
  const UPPER = 11, FORE = 13; // arm segments
  const NECK_Y = -86;

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
    mouth: 'none',               // none | smile | grin | o
    gun: 0,                      // > 0.5 = holding the portal gun
    mirror: false,               // instant left/right swap (used by Dab)
    eq: 0,                       // phase of the little equaliser on the chest screen
    front: 0,                    // 0 = three-quarter view, 1 = facing the camera
    reachF: 1, reachB: 1,        // cartoon arm stretch (1 = normal length)
    behindF: false, behindB: false, // front view: draw that arm behind the body
    hat: 0, hatY: 0,             // construction hard hat (1 = on), hatY lifts it for the drop-in
    hammer: 0,                   // > 0.5 = holding a hammer in the near hand
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
    const f = legPoints(-15, p.hipF, p.kneeF), b = legPoints(15, p.hipB, p.kneeB);
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
      rrect(ctx, -15, -4, 33, 15, 7.5);
      ctx.restore();
    };
    const W = 27;
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
    // toe shine
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(fa);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(5, -1); ctx.lineTo(12, -1); ctx.stroke();
    ctx.restore();
    // sole
    ctx.save();
    footPath();
    ctx.clip();
    ctx.fillStyle = back ? COL.navyBack : COL.navy;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(fa);
    ctx.fillRect(-17, 7, 38, 6);
    ctx.restore();
    ctx.restore();
  }

  // Portal gun, drawn along +x with the grip at the origin.
  function drawGun(ctx) {
    ctx.lineJoin = 'round';
    rrect(ctx, -6, -9, 44, 18, 8);
    ctx.lineWidth = LW * 2; ctx.strokeStyle = COL.out; ctx.stroke();
    ctx.fillStyle = COL.navy; ctx.fill();
    ctx.save();
    ctx.shadowColor = COL.cyan; ctx.shadowBlur = 8;
    ctx.fillStyle = COL.cyan;
    rrect(ctx, 4, -3, 26, 6, 3); ctx.fill();
    ctx.restore();
    rrect(ctx, 34, -11, 10, 22, 4);
    ctx.lineWidth = LW * 2; ctx.stroke();
    ctx.fillStyle = '#f3f5fc'; ctx.fill();
    ctx.save();
    ctx.shadowColor = COL.cyan; ctx.shadowBlur = 10;
    ctx.fillStyle = COL.cyan;
    ctx.beginPath(); ctx.arc(48, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Hammer, drawn along +x with the grip at the origin.
  function drawHammer(ctx) {
    ctx.lineJoin = 'round';
    rrect(ctx, -6, -4, 40, 8, 4);
    ctx.lineWidth = LW * 2; ctx.strokeStyle = COL.out; ctx.stroke();
    ctx.fillStyle = '#c98a4b'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(4, -1.5); ctx.lineTo(26, -1.5); ctx.stroke();
    rrect(ctx, 30, -16, 14, 32, 4);
    ctx.lineWidth = LW * 2; ctx.strokeStyle = COL.out; ctx.stroke();
    ctx.fillStyle = '#8d9bc4'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    rrect(ctx, 33, -13, 3, 26, 1.5); ctx.fill();
  }

  function drawArm(ctx, sx, sy, ang, elb, back, gun, reach = 1, hammer = false) {
    const a = rad(ang);
    const ex = sx + UPPER * reach * Math.sin(a), ey = sy + UPPER * reach * Math.cos(a);
    const b = rad(ang + elb);
    const hx = ex + FORE * reach * Math.sin(b), hy = ey + FORE * reach * Math.cos(b);
    const W = 23;
    seg(ctx, sx, sy, ex, ey, W + 2 + LW * 2, COL.out);
    seg(ctx, ex, ey, hx, hy, W + LW * 2, COL.out);
    ctx.beginPath();
    ctx.arc(hx, hy, 13 + LW, 0, Math.PI * 2);
    ctx.fillStyle = COL.out;
    ctx.fill();
    seg(ctx, sx, sy, ex, ey, W + 2, back ? COL.navyBack : COL.navy);
    seg(ctx, ex, ey, hx, hy, W, back ? COL.bodyBack : COL.body);
    if (gun || hammer) {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(Math.atan2(Math.cos(b), Math.sin(b)));
      if (hammer) drawHammer(ctx); else drawGun(ctx);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(hx, hy, 13 + LW / 2, 0, Math.PI * 2);
      ctx.lineWidth = LW; ctx.strokeStyle = COL.out; ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(hx, hy, 13, 0, Math.PI * 2);
    ctx.fillStyle = back ? COL.bodyBack : COL.body;
    ctx.fill();
    return { hx, hy };
  }

  let eqPhase = 0;
  let torsoFront = 0;
  function drawTorso(ctx) {
    const sdx = -9 * torsoFront;
    const path = () => rrect(ctx, -38, -92, 76, 60, 28);
    path();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COL.out;
    ctx.lineWidth = LW * 2;
    ctx.stroke();
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = COL.shade;
    ctx.fillRect(-42, -96, 84, 66);
    rrect(ctx, -30, -96, 74, 58, 28);
    ctx.fillStyle = COL.body;
    ctx.fill();
    // belly shine
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(4, -60, 26, Math.PI * 1.08, Math.PI * 1.32); ctx.stroke();
    // navy hips / shorts
    ctx.fillStyle = COL.navy;
    ctx.beginPath();
    ctx.moveTo(-42, -50);
    ctx.quadraticCurveTo(0, -43, 42, -50);
    ctx.lineTo(42, -28);
    ctx.lineTo(-42, -28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COL.out;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-42, -50);
    ctx.quadraticCurveTo(0, -43, 42, -50);
    ctx.stroke();
    // navy side panel (near side)
    ctx.fillStyle = COL.navy;
    ctx.beginPath();
    ctx.globalAlpha = 1 - torsoFront;
    ctx.ellipse(-39, -70, 11, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    // chest display
    ctx.save();
    rrect(ctx, -6 + sdx, -79, 30, 16, 5);
    ctx.shadowColor = COL.cyan;
    ctx.shadowBlur = 8;
    ctx.fillStyle = COL.cyan;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = COL.out;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    rrect(ctx, -2 + sdx, -76, 10, 3, 1.5);
    ctx.fill();
    ctx.fillStyle = COL.cyanDeep;
    for (let i = 0; i < 4; i++) {
      const h = 2.5 + 5 * Math.abs(Math.sin(eqPhase * 6 + i * 1.7));
      rrect(ctx, 0 + sdx + i * 5.5, -66 - h, 3.4, h, 1.2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEyes(ctx, p) {
    const fdx = -23 * clamp(p.front, 0, 1);
    const e1 = { x: 7 + fdx + p.look * 4, y: -130 }, e2 = { x: 39 + fdx + p.look * 4, y: -130 };
    ctx.save();
    ctx.shadowColor = COL.cyan;
    ctx.shadowBlur = 9;
    ctx.fillStyle = COL.cyan;
    ctx.strokeStyle = COL.cyan;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const oval = (e, rx, ry) => { ctx.beginPath(); ctx.ellipse(e.x, e.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
    const blinkY = 1 - 0.9 * clamp(p.blink, 0, 1);
    const glint = (e, big) => {
      if (blinkY < 0.6) return;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      const tw = 1 + 0.18 * Math.sin(p.eq * 5 + (big ? 0 : 1.3));   // gentle twinkle
      ctx.beginPath(); ctx.ellipse(e.x + 2.2, e.y - 3.8 * blinkY, (big ? 3 : 2.6) * tw, (big ? 3.4 : 3) * blinkY * tw, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(e.x - 2.6, e.y + 4 * blinkY, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
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
        oval(e1, 8, 11.5 * blinkY);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(e2.x + 6, e2.y - 7); ctx.lineTo(e2.x - 5, e2.y); ctx.lineTo(e2.x + 6, e2.y + 7);
        ctx.stroke();
        break;
      case 'determined':
        oval(e1, 8, 11.5 * blinkY);
        oval(e2, 7.4, 11.5 * blinkY);
        glint(e1, true); glint(e2, false);
        ctx.shadowBlur = 0;
        ctx.fillStyle = COL.visor;
        ctx.beginPath();
        ctx.moveTo(e1.x - 10, e1.y - 16); ctx.lineTo(e1.x + 9, e1.y - 16); ctx.lineTo(e1.x + 9, e1.y - 3);
        ctx.closePath();
        ctx.moveTo(e2.x + 10, e2.y - 16); ctx.lineTo(e2.x - 9, e2.y - 16); ctx.lineTo(e2.x - 9, e2.y - 3);
        ctx.closePath();
        ctx.fill();
        break;
      case 'bright':
        ctx.shadowBlur = 22;
        oval(e1, 9.5, 12.5);
        oval(e2, 9, 12.5);
        ctx.shadowBlur = 0;
        glint(e1, true); glint(e2, true);
        ctx.fillStyle = '#ffffff';
        for (const e of [e1, e2]) { ctx.beginPath(); ctx.arc(e.x - 3, e.y + 5, 2, 0, Math.PI * 2); ctx.fill(); }
        break;
      case 'derp':
        oval({ x: e1.x - 1, y: e1.y + 1 }, 9.5, 12.5);
        oval({ x: e2.x + 1, y: e2.y - 4 }, 4.5, 5.5);
        glint({ x: e1.x, y: e1.y + 1 }, true);
        break;
      case 'stars':
        for (const e of [e1, e2]) {
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.2 : 10.5;
            const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        }
        break;
      default:
        oval(e1, 8, 11.5 * blinkY);
        oval(e2, 7.4, 11.5 * blinkY);
        glint(e1, true); glint(e2, false);
    }
    ctx.shadowBlur = 0;
    const happyFace = p.eyes === 'happy' || p.eyes === 'stars' || p.mouth === 'grin';
    ctx.fillStyle = `rgba(255, 128, 176, ${happyFace ? 0.5 : 0.28})`;
    ctx.beginPath(); ctx.ellipse(e1.x - 6, e1.y + 12, 6.5, 3.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(e2.x + 6, e2.y + 12, 5.5, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.cyan;
    ctx.shadowBlur = 9;
    const mx = 23 + fdx + p.look * 4, my = -114;
    ctx.lineWidth = 2.6;
    if (p.mouth === 'smile') {
      ctx.beginPath(); ctx.moveTo(mx - 6, my - 2); ctx.quadraticCurveTo(mx, my + 5, mx + 6, my - 2); ctx.stroke();
    } else if (p.mouth === 'grin') {
      ctx.beginPath(); ctx.moveTo(mx - 7, my - 3); ctx.lineTo(mx + 7, my - 3);
      ctx.quadraticCurveTo(mx + 7, my + 6, mx, my + 6); ctx.quadraticCurveTo(mx - 7, my + 6, mx - 7, my - 3);
      ctx.fill();
    } else if (p.mouth === 'o') {
      ctx.beginPath(); ctx.ellipse(mx, my + 1, 3.4, 4.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawHead(ctx, p) {
    const cy = -132;
    // far ear cup peeks out behind the head
    const F = clamp(p.front, 0, 1);
    const fcx = 57 + 4 * F, fey = cy + 3 + 1 * F + p.phone * 0.5;
    outlined(ctx, () => { ctx.beginPath(); ctx.ellipse(fcx, fey, 10 + 8 * F, 22 + 5 * F, 0, 0, Math.PI * 2); }, F > 0.5 ? COL.navy : COL.navyBack);
    if (F > 0.05) {
      ctx.save();
      ctx.globalAlpha = F;
      ctx.shadowColor = COL.cyan; ctx.shadowBlur = 8;
      ctx.strokeStyle = COL.cyan; ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.ellipse(fcx + 5, fey, 10, 20, 0, -Math.PI * 0.45, Math.PI * 0.45); ctx.stroke();
      ctx.restore();
    }

    const head = () => squircle(ctx, 0, cy, 63, 54, 2.15);
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
    squircle(ctx, 5, cy - 4, 61, 51, 2.15);
    ctx.fillStyle = COL.body;
    ctx.fill();
    // headband over the top
    ctx.lineCap = 'round';
    const band = () => { ctx.beginPath(); ctx.moveTo(-52, cy - 12); ctx.quadraticCurveTo(-40, cy - 50, 6, cy - 54); ctx.quadraticCurveTo(40, cy - 56, 70, cy - 40); };
    band(); ctx.strokeStyle = COL.out; ctx.lineWidth = 12 + LW * 2; ctx.stroke();
    band(); ctx.strokeStyle = COL.navy; ctx.lineWidth = 12; ctx.stroke();
    // soft gloss and a panel seam give the shell some shape
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.ellipse(18, cy - 40, 15, 5.5, 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(40, cy - 37, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(25,32,74,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-30, cy + 38); ctx.quadraticCurveTo(-42, cy + 10, -34, cy - 16); ctx.stroke();
    // visor
    rrect(ctx, -27 - 18.5 * F, cy - 27, 91, 54, 25);
    ctx.fillStyle = COL.visor;
    ctx.fill();
    ctx.restore();

    // visor shine
    ctx.save();
    rrect(ctx, -27 - 18.5 * F, cy - 27, 91, 54, 25);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-12 - 18.5 * F, cy - 14);
    ctx.quadraticCurveTo(-4 - 18.5 * F, cy - 21, 10 - 18.5 * F, cy - 21);
    ctx.stroke();
    ctx.restore();

    drawEyes(ctx, p);

    // near ear cup
    const ey = cy + 4 + p.phone;
    const nx = -8 * F;
    outlined(ctx, () => { ctx.beginPath(); ctx.ellipse(-52 + nx, ey, 18, 27, 0, 0, Math.PI * 2); }, COL.navy);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-55 + nx, ey, 11, 21, 0, 0, Math.PI * 2);
    ctx.fillStyle = COL.navyDark;
    ctx.fill();
    ctx.shadowColor = COL.cyan;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = COL.cyan;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.ellipse(-57 + nx, ey, 10, 20, 0, Math.PI * 0.55, Math.PI * 1.45);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(128, 242, 255, 0.18)';
    ctx.beginPath(); ctx.ellipse(-54 + nx, ey, 6, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8fa2e0';
    ctx.beginPath(); ctx.arc(-50 + nx, ey - 19, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (p.hat > 0.02) {
      ctx.save();
      ctx.globalAlpha = clamp(p.hat, 0, 1);
      ctx.translate(-4 * F, cy - 30 - p.hatY);
      ctx.lineJoin = 'round';
      // dome
      ctx.beginPath();
      ctx.moveTo(-50, 4);
      ctx.bezierCurveTo(-50, -42, 50, -42, 50, 4);
      ctx.closePath();
      ctx.lineWidth = LW * 2; ctx.strokeStyle = COL.out; ctx.stroke();
      ctx.fillStyle = '#ffc83d'; ctx.fill();
      // ridge + shine
      ctx.fillStyle = '#f3a91f';
      rrect(ctx, -7, -30, 14, 34, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath(); ctx.ellipse(-26, -16, 10, 5, -0.6, 0, Math.PI * 2); ctx.fill();
      // brim
      rrect(ctx, -64, 0, 132, 11, 5.5);
      ctx.lineWidth = LW * 2; ctx.strokeStyle = COL.out; ctx.stroke();
      ctx.fillStyle = '#ffc83d'; ctx.fill();
      ctx.fillStyle = '#f3a91f';
      rrect(ctx, -60, 6, 124, 4, 2); ctx.fill();
      ctx.restore();
    }
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
        case 'gun': {
          ctx.translate(e.x, e.y);
          ctx.rotate(e.r || 0);
          ctx.translate(-14, 0);
          drawGun(ctx);
          break;
        }
        case 'flash': {
          const t = e.t, r = 6 + t * 14;
          ctx.globalAlpha = (e.a ?? 1) * (1 - t);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = COL.cyan; ctx.shadowBlur = 14;
          ctx.beginPath();
          for (let i = 0; i < 16; i++) {
            const a = i * Math.PI / 8, rr = i % 2 ? r * 0.45 : r;
            const x = e.x + Math.cos(a) * rr, y = e.y + Math.sin(a) * rr;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'drops': {
          for (let i = 0; i < 10; i++) {
            const a = i * 2.4 + 0.3, d = 30 + ((e.k * 3 + i * 0.37) % 1) * 60;
            ctx.globalAlpha = (e.a ?? 1) * (1 - ((e.k * 3 + i * 0.37) % 1));
            ctx.beginPath();
            ctx.arc(e.x + Math.cos(a) * d * 1.3, e.y + Math.sin(a) * d * 0.7, 3 + (i % 3), 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'stars': {
          ctx.fillStyle = '#ffe27a';
          for (let i = 0; i < 3; i++) {
            const a = e.k * Math.PI * 2 + i * 2.1;
            const x = e.x + Math.cos(a) * 30, y = e.y + Math.sin(a) * 9;
            ctx.save();
            ctx.translate(x, y);
            ctx.beginPath();
            for (let j = 0; j < 10; j++) {
              const b = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? 2.6 : 6.5;
              j ? ctx.lineTo(Math.cos(b) * r, Math.sin(b) * r) : ctx.moveTo(Math.cos(b) * r, Math.sin(b) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          break;
        }
        case 'lasso': {
          // rope from the raised hand up to a spinning loop
          const a = e.k * TAU, lx = e.x - 8 + Math.cos(a) * 6, ly = e.y - 52;
          ctx.strokeStyle = '#c98a4b';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.quadraticCurveTo(e.x + 6, e.y - 26, lx, ly + 6); ctx.stroke();
          ctx.lineWidth = 3.4;
          ctx.beginPath(); ctx.ellipse(lx, ly, 30, 9, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.ellipse(lx, ly, 30, 9, 0, a, a + 1.4); ctx.stroke();
          ctx.globalAlpha = 0.5; ctx.strokeStyle = COL.fx; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(lx, ly, 40, -0.6 + a, 0.6 + a); ctx.stroke();
          break;
        }
        case 'uplines': {
          ctx.lineWidth = 2.6;
          ctx.globalAlpha = (e.a ?? 1) * 0.85;
          for (const [dx, len] of [[-14, 16], [0, 22], [14, 14]]) {
            ctx.beginPath();
            ctx.moveTo(e.x + dx, e.y + 6);
            ctx.lineTo(e.x + dx, e.y + 6 + len);
            ctx.stroke();
          }
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
   * opt.scale: px per unit, opt.flip: face left, opt.shadow: draw a ground shadow (off by default)
   */
  function draw(ctx, pose, opt = {}) {
    const p = resolve(pose);
    const s = opt.scale ?? 1;
    ctx.save();
    ctx.translate(opt.x ?? 0, opt.y ?? 0);
    ctx.scale(s * (opt.flip ? -1 : 1), s);

    if (opt.shadow === true) {
      const lift = Math.max(0, -(p.rootY));
      const w = 48 * p.shadowW * clamp(1 - lift / 260, 0.45, 1);
      ctx.fillStyle = COL.shadow;
      ctx.beginPath();
      ctx.ellipse(p.x, 1, w, 7 * clamp(1 - lift / 260, 0.5, 1), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(p.x, p.rootY);
    ctx.scale(p.sx * p.spin * (p.mirror ? -1 : 1), p.sy);
    ctx.translate(p.px, p.py);
    ctx.rotate(rad(p.rot));
    ctx.translate(-p.px, -p.py);

    drawLeg(ctx, 15, p.hipB, p.kneeB, p.footB, true);

    ctx.save();
    ctx.translate(0, HIP_Y);
    ctx.rotate(rad(p.lean));
    ctx.translate(0, -HIP_Y);
    if (p.front <= 0.5 || p.behindB) drawArm(ctx, 36, -79, p.armB, p.elbB, p.front <= 0.5, false, p.reachB);
    if (p.front > 0.5 && p.behindF) drawArm(ctx, -36, -78, p.armF, p.elbF, false, p.gun > 0.5, p.reachF);
    ctx.restore();

    ctx.save();
    ctx.translate(0, HIP_Y);
    ctx.rotate(rad(p.lean));
    ctx.translate(0, -HIP_Y);
    eqPhase = p.eq;
    torsoFront = clamp(p.front, 0, 1);
    drawTorso(ctx);
    ctx.restore();

    drawLeg(ctx, -15, p.hipF, p.kneeF, p.footF, false);

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
    if (p.front > 0.5 && !p.behindB) drawArm(ctx, 36, -79, p.armB, p.elbB, false, false, p.reachB);
    if (!(p.front > 0.5 && p.behindF)) drawArm(ctx, -36, -78, p.armF, p.elbF, false, p.gun > 0.5 && p.hammer <= 0.5, p.reachF, p.hammer > 0.5);
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
          const A = 34;
          if (q < 0.3) {
            const t = smooth(q / 0.3);
            return { hip: lerp(-A, A, t), knee: 46 * Math.sin(Math.PI * q / 0.3), foot: 12 * Math.sin(Math.PI * q / 0.3) };
          }
          const t = (q - 0.3) / 0.7;
          // heel strike (toes up) -> flat -> push off the toes
          const foot = t < 0.12 ? 14 * (1 - t / 0.12) : t > 0.8 ? -16 * (t - 0.8) / 0.2 : 0;
          return { hip: lerp(A, -A, t), knee: t < 0.15 ? 10 * (1 - t / 0.15) + 4 : 4, foot };
        };
        const L = legAt(p), R = legAt((p + 0.5) % 1);
        const swing = Math.cos(TAU * (p - 0.27));
        return {
          hipF: L.hip, kneeF: L.knee, footF: L.foot,
          hipB: R.hip, kneeB: R.knee, footB: R.foot,
          armB: 32 * swing, armF: -32 * swing, elbF: 18, elbB: 18,
          lean: 4,
          // body is highest mid-stride and dips as each foot lands; the head stays steady
          y: -3.5 * Math.pow(Math.sin(TAU * (p - 0.3)), 2),
          rot: 3 * Math.sin(TAU * (p - 0.05)), px: 0, py: 0,   // little chibi waddle
          headRot: 2 * Math.sin(TAU * p) + 2,
          headY: 1.2 * Math.cos(TAU * 2 * (p - 0.35)),
          mouth: 'smile',
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
          [12, { y: -38, sy: 1.16, sx: 0.9, hipF: -6, hipB: -10, kneeF: 6, kneeB: 4, armF: -150, armB: 140, elbF: 10, elbB: 10, lean: -4, headRot: -6 }],
          [20, { y: -86, sy: 1.04, sx: 0.97, hipF: 24, hipB: 8, kneeF: 50, kneeB: 30, armF: -125, armB: 105, elbF: 6, elbB: 6, lean: 0, headRot: -4 }],
          [28, { y: -100, sy: 1, sx: 1, hipF: 30, hipB: 14, kneeF: 56, kneeB: 36, armF: -115, armB: 98, lean: 0, headRot: 2 }],
          [32, { y: -96, sy: 1, sx: 1 }],
          [39, { y: -22, sy: 1.1, sx: 0.94, hipF: 4, hipB: 2, kneeF: 6, kneeB: 6, armF: -140, armB: 132, elbF: 8, elbB: 8, lean: -2, headRot: -2 }],
          [41, { y: 0, sy: 0.8, sx: 1.16, hipF: 30, hipB: 28, kneeF: 60, kneeB: 58, armF: 40, armB: 30, elbF: 30, elbB: 30, lean: 12, headRot: 8 }],
          [44, { y: 0, sy: 1.05, sx: 0.97, hipF: 6, hipB: 6, kneeF: 10, kneeB: 10, armF: 10, armB: -4, lean: -2, headRot: -3 }],
          [47, { y: 0, sy: 1, sx: 1, hipF: 0, hipB: 0, kneeF: 0, kneeB: 0, armF: -18, armB: 12, elbF: 8, elbB: 8, lean: 0, headRot: 0 }],
        ], f);
        k.eyes = f >= 14 && f < 40 ? 'happy' : 'normal';
        k.phone = f > 9 && f < 40 ? (f < 26 ? 3 : -3) : 0;
        k.fx = [];
        if (f >= 40 && f <= 47) k.fx.push({ type: 'dust', x: 0, t: (f - 40) / 7 });
        if (f >= 8 && f <= 13) k.fx.push({ type: 'dust', x: 0, t: (f - 8) / 5, a: 0.6 });
        if (f >= 11 && f <= 24) k.fx.push({ type: 'uplines', x: 0, y: k.y, a: 1 - Math.abs(f - 16) / 9 });
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
        if (f >= 49 && f < 64) { const c = Math.cos(Math.PI * 2 * (f - 48) / 16); k.spin = Math.sign(c || 1) * Math.max(0.55, Math.abs(c)); }
        k.eyes = f >= 84 && f < 92 ? (f >= 86 && f < 90 ? 'wink' : 'happy') : f >= 16 && f < 32 ? 'happy' : 'normal';
        k.phone = 2 * Math.sin(Math.PI * f / 4);
        k.blink = blinkAt(f, 40, 3);
        k.front = f >= 49 && f < 64 ? 0 : 0.9;                // dances for the viewer (the spin turns away)
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

    // ----- Extra moves for the coming-soon scene -----

    Wave: {
      frames: 32, fps: 16, loop: true,
      pose(f) {
        const p = f / 32;
        const w = Math.sin(TAU * 4 * p);
        const hop = Math.abs(Math.sin(TAU * 2 * p));
        return {
          armB: 104 + 6 * w, elbB: 42 + 26 * w, reachB: 1.9,   // stretchy wave beside the head
          armF: -14, elbF: 14,
          headRot: 9 + 3 * w, headY: -1.5 * hop,
          y: -4 * hop, sy: 1 + 0.03 * (1 - hop),
          lean: -3,
          kneeF: 6 * (1 - hop), kneeB: 6 * (1 - hop),
          phone: 1.5 * w,
          eyes: 'happy', mouth: 'grin', front: 1,
        };
      },
    },

    Floss: {
      frames: 32, fps: 16, loop: true,
      pose(f) {
        const s = Math.sin(TAU * f / 16);
        const c = Math.cos(TAU * f / 16);
        return {
          armF: 48 * s, armB: 48 * s, elbF: 0, elbB: 0,
          x: -9 * s, lean: 7 * s,
          hipF: -6 * s, hipB: -6 * s,
          kneeF: 10 + 8 * Math.abs(c), kneeB: 10 + 8 * Math.abs(c),
          y: -3 * Math.abs(c),
          headRot: -7 * s, headX: 2 * s,
          phone: 2 * s,
          eyes: 'happy', mouth: 'grin', front: 1,
          behindB: s > 0.15, behindF: s < -0.15,    // the real floss: one arm in front, one behind
        };
      },
    },

    Dab: {
      frames: 32, fps: 16, loop: true,
      pose(f) {
        const N = { armF: -18, armB: 12, elbF: 8, elbB: 8, headRot: 0, lean: 0, headY: 0, y: 0, kneeF: 0, kneeB: 0 };
        const D = { armF: 118, elbF: 105, armB: 138, elbB: 0, headRot: 24, lean: 9, headY: 4, y: 0, kneeF: 14, kneeB: 6 };
        const k = keys([[0, N], [5, D], [11, D], [16, N], [21, D], [27, D], [31, N]], f);
        k.y = -5 * Math.abs(Math.sin(Math.PI * f / 8));
        k.mirror = f >= 16;
        k.eyes = (f >= 5 && f < 12) || (f >= 21 && f < 28) ? 'happy' : 'normal';
        k.mouth = 'grin';
        k.front = 1;
        return k;
      },
    },

    Cannonball: {
      frames: 48, fps: 16, loop: false,
      pose(f) {
        const k = keys([
          [0, { y: 0, rot: 0, sy: 1, sx: 1, hipF: 0, hipB: 0, kneeF: 0, kneeB: 0, armF: -18, armB: 12, elbF: 8, elbB: 8, lean: 0, headRot: 0 }],
          [6, { y: 0, sy: 0.84, sx: 1.1, hipF: 32, hipB: 30, kneeF: 66, kneeB: 64, armF: -40, armB: -50, lean: 14, headRot: 6 }],
          [11, { y: -50, sy: 1.15, sx: 0.9, hipF: -6, hipB: -10, kneeF: 6, kneeB: 6, armF: 160, armB: 150, elbF: 6, elbB: 6, lean: -6, headRot: -8 }],
          [16, { y: -86, sy: 1, sx: 1, rot: -40, hipF: 105, hipB: 100, kneeF: 140, kneeB: 135, armF: 70, elbF: 75, armB: 60, elbB: 75, lean: 18, headRot: 18 }],
          [24, { y: -100, rot: -160 }],
          [32, { y: -62, rot: -280 }],
          [40, { y: -12, rot: -400 }],
          [47, { y: 0, rot: -470 }],
        ], f);
        k.py = -80;
        k.eyes = f < 11 ? 'normal' : 'happy';
        k.mouth = f < 6 ? 'smile' : f < 16 ? 'grin' : 'o';
        k.phone = f > 10 ? 3 : 0;
        k.fx = f >= 18 && f <= 44 ? [{ type: 'arcs', x: 0, y: k.y - 80, a0: -rad(k.rot) + 1.2, a: 0.6 }] : [];
        return k;
      },
    },

    Shake: {
      frames: 24, fps: 24, loop: false,
      pose(f) {
        const s = Math.sin(TAU * f / 6);
        const env = f < 18 ? 1 : (23 - f) / 5;
        return {
          lean: 13 * s * env, headRot: -20 * s * env, x: 3 * s * env,
          armF: -18 + 45 * s * env, armB: 12 - 45 * s * env, elbF: 20, elbB: 20,
          kneeF: 10 * env, kneeB: 10 * env,
          phone: 4 * s * env,
          eyes: f < 14 ? 'squint' : 'derp', mouth: f < 14 ? 'o' : 'grin',
          front: f < 12 ? 0 : 0.8 * Math.sin(Math.PI * Math.min(1, (f - 12) / 12)) + (f >= 18 ? 0.8 * (1 - Math.sin(Math.PI * Math.min(1, (f - 12) / 12))) : 0),
          fx: f < 18 ? [{ type: 'drops', x: 0, y: -100, k: f / 24 }] : [],
        };
      },
    },

    FindGun: {
      frames: 56, fps: 16, loop: false,
      pose(f) {
        const k = keys([
          [0, { headRot: 0, headY: 0, sy: 1, armF: -18, elbF: 8, armB: 12, elbB: 8, lean: 0, y: 0, front: 0 }],
          [7, { headRot: -16, armF: -26 }],
          [12, { headRot: 8, headY: 7, sy: 0.88 }],
          [16, { headRot: -4, headY: 0, sy: 1.03, lean: -4 }],
          [21, { headRot: -14, armF: 194, elbF: 0, armB: 24, sy: 1, lean: 0 }],
          [24, { armF: 196, sy: 0.94 }],
          [28, { sy: 1, front: 0 }],
          [33, { armF: 186, elbF: 0, armB: 150, elbB: 0, headRot: -8, y: -6, front: 0.85 }],
          [38, { y: 0 }],
          [43, { y: -6, front: 0.85 }],
          [49, { armF: 52, elbF: 42, armB: 6, elbB: 10, headRot: 0, y: 0, front: 0 }],
          [55, { armF: 52, elbF: 42, armB: 6, elbB: 10 }],
        ], f);
        k.gun = f >= 24 ? 1 : 0;
        k.eyes = f < 5 ? 'normal' : f < 12 ? 'surprised' : f < 19 ? 'derp' : f < 30 ? 'surprised' : f < 46 ? 'stars' : 'happy';
        k.mouth = f < 5 ? 'none' : f < 12 ? 'o' : f < 19 ? 'grin' : f < 30 ? 'o' : 'grin';
        k.fx = [];
        if (f < 12) {
          const t = f / 12;
          k.fx.push({ type: 'gun', x: 4, y: lerp(-290, -192, t * t), r: t * 4 });
        } else if (f < 24) {
          const t = (f - 12) / 12;
          k.fx.push({ type: 'gun', x: lerp(4, -36, t), y: lerp(-192, -112, t) - 70 * Math.sin(Math.PI * t), r: 4 + t * 7.5 });
        }
        if (f >= 12 && f < 24) k.fx.push({ type: 'stars', x: 0, y: -196, k: (f - 12) / 12 });
        if (f >= 30 && f < 46) {
          const t = (f - 30) / 16;
          k.fx.push({ type: 'sparkle', x: -70, y: -160 - t * 10, s: 0.5 + 0.4 * Math.sin(Math.PI * t), a: Math.sin(Math.PI * t) });
          k.fx.push({ type: 'sparkle', x: -10, y: -205 + t * 8, s: 0.4 + 0.3 * Math.sin(Math.PI * t), a: Math.sin(Math.PI * t) });
        }
        return k;
      },
    },

    Shoot: {
      frames: 40, fps: 16, loop: false,
      pose(f) {
        const k = keys([
          [0, { armF: 52, elbF: 42, lean: 0, headRot: 0, x: 0 }],
          [5, { armF: 88, elbF: 0, lean: -2 }],
          [8, { armF: 102, lean: -9, headRot: -7, x: -4 }],
          [12, { armF: 88, lean: -2, headRot: 0, x: 0 }],
          [18, { armF: 150, elbF: 0, headRot: -16, lean: -6 }],
          [22, { armF: 160, lean: -12, headRot: -20, x: -4 }],
          [26, { armF: 150, lean: -6, headRot: -16, x: 0 }],
          [33, { armF: 52, elbF: 42, lean: 0 }],
          [39, { armF: 52, elbF: 42 }],
        ], f);
        k.gun = 1;
        k.eyes = f >= 4 && f < 30 ? 'determined' : 'happy';
        k.mouth = f >= 30 ? 'grin' : 'none';
        k.fx = [];
        if (f >= 8 && f < 12) k.fx.push({ type: 'flash', x: 50, y: -84, t: (f - 8) / 4 });
        if (f >= 22 && f < 26) k.fx.push({ type: 'flash', x: 10, y: -152, t: (f - 22) / 4 });
        return k;
      },
    },

    Tumble: {
      frames: 16, fps: 24, loop: true,
      pose(f) {
        const a = Math.sin(TAU * f / 8), b = Math.cos(TAU * f / 8);
        return {
          armF: 70 + 110 * a, armB: -60 - 110 * a, elbF: 20 + 30 * b, elbB: 20 - 30 * b,
          hipF: 35 * b, hipB: -35 * b, kneeF: 50 + 35 * a, kneeB: 50 - 35 * a,
          headRot: 12 * a, lean: 6 * b, phone: 4 * a,
          eyes: 'surprised', mouth: 'o',
        };
      },
    },

    SuperheroLanding: {
      frames: 40, fps: 16, loop: false,
      pose(f) {
        const LAND = { g: 0, x: -12, y: 16, lean: 16, headRot: 6, headY: 3, hipF: -30, kneeF: 112, hipB: 80, kneeB: 92, footF: 0, footB: 0, armF: 26, elbF: 0, armB: -125, elbB: 0, sx: 1.06, sy: 0.94 };
        const k = keys([
          [0, Object.assign({}, LAND, { y: 20, sx: 1.14, sy: 0.84, front: 0 })],
          [4, LAND],
          [16, Object.assign({}, LAND, { front: 0 })],
          [22, Object.assign({}, LAND, { headRot: -8, sx: 1, sy: 1, front: 0.7 })],
          [30, { g: 1, x: 0, y: 0, lean: 6, headRot: -4, headY: 0, hipF: 10, kneeF: 22, hipB: 14, kneeB: 24, armF: -10, elbF: 10, armB: 20, elbB: 10, sx: 1, sy: 1 }],
          [39, { g: 1, y: 0, lean: 0, headRot: 0, hipF: 0, kneeF: 0, hipB: 0, kneeB: 0, armF: -18, elbF: 8, armB: 12, elbB: 8, front: 0.9 }],
        ], f);
        k.eyes = f < 18 ? 'determined' : f < 26 ? 'normal' : 'happy';
        k.mouth = f >= 26 ? 'grin' : 'none';
        k.fx = [];
        if (f < 10) {
          k.fx.push({ type: 'impact', x: 0, y: -6, t: f / 10 });
          k.fx.push({ type: 'dust', x: 0, t: f / 10 });
        }
        return k;
      },
    },

    Hammer: {
      frames: 12, fps: 18, loop: true,
      pose(f) {
        const k = keys([
          [0, { armF: 175, elbF: -20, lean: -4, headRot: -6, y: 0 }],
          [5, { armF: 40, elbF: 30, lean: 12, headRot: 8, y: 1 }],
          [7, { armF: 55, elbF: 20, lean: 10, headRot: 6, y: 0 }],
          [11, { armF: 172, elbF: -18, lean: -3, headRot: -5, y: 0 }],
        ], f, 12);
        k.hammer = 1;
        k.armB = 30; k.elbB = 40;
        k.kneeF = 12; k.kneeB = 12;
        k.eyes = f >= 4 && f < 8 ? 'squint' : 'determined';
        k.mouth = 'grin';
        return k;
      },
    },

    // Gangnam Style "horse riding" dance: wrists crossed like holding reins, bouncy
    // side-step hops, and every other bar one hand twirls an invisible lasso overhead.
    Gangnam: {
      frames: 64, fps: 16, loop: true,
      pose(f) {
        const beat = (f % 8) / 8;                         // one hop per 8 frames
        const hop = Math.pow(Math.sin(Math.PI * beat), 1.5);
        const side = Math.floor(f / 8) % 2 ? -1 : 1;      // alternate the leading foot
        const lasso = f >= 32;                            // second half: lasso twirl
        const tw = TAU * (f % 16) / 16;
        const k = {
          front: 1,
          y: -9 * hop,
          sy: 1 + 0.06 * hop - 0.05 * (1 - hop),
          sx: 1 - 0.03 * hop + 0.04 * (1 - hop),
          x: 3 * side * Math.sin(Math.PI * beat),
          hipF: side > 0 ? 18 * hop : -4, kneeF: side > 0 ? 36 * hop : 6,
          hipB: side < 0 ? 18 * hop : -4, kneeB: side < 0 ? 36 * hop : 6,
          footF: side > 0 ? 10 * hop : 0, footB: side < 0 ? 10 * hop : 0,
          // reins: both forearms cross in front of the chest and bounce with the beat
          armF: 62 + 8 * hop, elbF: 58,
          armB: lasso ? 150 + 6 * Math.sin(tw) : -62 - 8 * hop,
          elbB: lasso ? 30 + 12 * Math.cos(tw) : -58,
          reachB: lasso ? 2.4 : 1,
          headRot: 6 * Math.sin(TAU * f / 16), headY: 2 * hop,
          lean: 3 * Math.sin(TAU * f / 16),
          phone: 3 * hop,
          eyes: lasso ? 'happy' : 'determined', mouth: 'grin',
          fx: [],
        };
        if (f % 8 === 0) k.fx.push({ type: 'dust', x: 0, t: 0.3, a: 0.5 });
        if (lasso) k.fx.push({ type: 'lasso', x: 46, y: -150 - 9 * hop, k: (f % 16) / 16 });
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

  // Speech-bubble style emotes drawn above the head, never mirrored.
  function emote(ctx, type, x, y, s, t) {
    const pop = t < 0.15 ? 0.4 + 4 * t : t > 0.85 ? (1 - t) / 0.15 : 1;
    const bob = Math.sin(t * Math.PI * 4) * 2;
    ctx.save();
    ctx.translate(x, y + bob * s);
    ctx.scale(s * pop, s * pop);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (type === 'exclaim' || type === 'question') {
      ctx.fillStyle = type === 'exclaim' ? '#ffd166' : '#ffffff';
      ctx.strokeStyle = COL.out;
      ctx.lineWidth = 5;
      ctx.font = '900 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const g = type === 'exclaim' ? '!' : '?';
      ctx.strokeText(g, 0, 0);
      ctx.fillText(g, 0, 0);
    } else if (type === 'sweat') {
      ctx.fillStyle = '#9fdcff';
      ctx.strokeStyle = COL.out;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.bezierCurveTo(9, 0, 8, 10, 0, 10);
      ctx.bezierCurveTo(-8, 10, -9, 0, 0, -12);
      ctx.stroke(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(-2.5, 3, 1.8, 3, 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'idea') {
      // glowing light bulb with rays
      ctx.save();
      ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 18;
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.42, r0 = 22 + 3 * Math.sin(t * 20 + i), r1 = r0 + 9;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, -4 + Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, -4 + Math.sin(a) * r1); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = COL.out; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -6, 14, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(6, 12); ctx.lineTo(-6, 12); ctx.closePath();
      ctx.fillStyle = '#ffe27a';
      ctx.save(); ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 16; ctx.fill(); ctx.restore();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.ellipse(-5, -11, 3, 5, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8d9bc4';
      rrect(ctx, -7, 12, 14, 9, 3); ctx.fill(); ctx.stroke();
    } else if (type === 'note') {
      ctx.fillStyle = '#79d8ff';
      ctx.strokeStyle = COL.out;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(-4, 8, 7, 5.5, -0.4, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(14, 4, 7, 5.5, -0.4, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(2, 7); ctx.lineTo(2, -14); ctx.lineTo(20, -18); ctx.lineTo(20, 3); ctx.stroke();
      ctx.strokeStyle = '#79d8ff'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(2, 7); ctx.lineTo(2, -14); ctx.lineTo(20, -18); ctx.lineTo(20, 3); ctx.stroke();
    } else if (type === 'sparkles') {
      ctx.fillStyle = '#ffe27a';
      for (const [dx, dy, r] of [[-22, -4, 9], [20, -12, 7], [4, 12, 5]]) {
        ctx.beginPath();
        ctx.moveTo(dx, dy - r); ctx.quadraticCurveTo(dx + r * 0.18, dy - r * 0.18, dx + r, dy);
        ctx.quadraticCurveTo(dx + r * 0.18, dy + r * 0.18, dx, dy + r);
        ctx.quadraticCurveTo(dx - r * 0.18, dy + r * 0.18, dx - r, dy);
        ctx.quadraticCurveTo(dx - r * 0.18, dy - r * 0.18, dx, dy - r);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  const api = { CELL, BASE, clips, draw, blend, normalize, resolve, COL, emote };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RobotRig = api;
})(typeof window !== 'undefined' ? window : globalThis);
