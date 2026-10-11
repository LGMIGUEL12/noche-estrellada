(() => {
  'use strict';

  // Mundo lógico: la altura es fija (814, como el video). El ancho crece con la
  // pantalla para que en PC la escena ocupe todo el ancho sin deformarse.
  const BASE_W = 576;
  const H = 814;
  let W = BASE_W;
  let k = 1; // factor de expansión horizontal (W / BASE_W)
  const X = (x) => x * k;

  const stage = document.getElementById('stage');
  const layers = {};
  ['sky', 'flow', 'lights', 'land', 'fx'].forEach((id) => {
    const canvas = document.getElementById(id);
    layers[id] = { canvas, ctx: canvas.getContext('2d') };
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Utilidades ---------- */

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash(x, y) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

  /* ---------- Paleta ---------- */

  const PAL = {
    deep: ['#0a1738', '#0e1f4a', '#132a5e', '#0c1a42'],
    dark: ['#16336f', '#1b3d82', '#1f468f', '#183a7a'],
    mid: ['#2b5aa8', '#3467b6', '#3d76c4', '#2f60ad', '#4a83cc'],
    light: ['#7fa9de', '#a5c6ec', '#c8dcf3', '#e3eef9', '#94b9e6'],
    warm: ['#f2b866', '#f7d08a', '#e89a52', '#d9774a'],
    dusk: ['#3b4f8c', '#5a5f9a', '#8a6f98', '#2d4580'],
    foliage: ['#0d1b3a', '#11244a', '#16305a', '#1c3a64', '#0a1630'],
  };

  /* ---------- Composición base (coordenadas del video, 576 de ancho) ---------- */

  const BASE_VORTICES = [
    { x: 292, y: 380, r: 88, s: 2.6 },
    { x: 178, y: 432, r: 46, s: 1.8 },
    { x: 448, y: 398, r: 58, s: -1.7 },
    { x: 92, y: 330, r: 60, s: 1.3 },
    { x: 520, y: 250, r: 70, s: 1.1 },
    { x: 322, y: 148, r: 55, s: 0.9 },
  ];

  const BASE_ORBS = [
    { x: 322, y: 148, r: 27, type: 'moon' },
    { x: 52, y: 176, r: 13, type: 'pale' },
    { x: 550, y: 368, r: 30, type: 'gold' },
    { x: 400, y: 320, r: 13, type: 'ring' },
    { x: 400, y: 373, r: 13, type: 'ring' },
    { x: 176, y: 420, r: 12, type: 'ring' },
    { x: 212, y: 407, r: 7, type: 'ring' },
    { x: 192, y: 470, r: 17, type: 'pale' },
    { x: 70, y: 90, r: 4, type: 'ring' },
    { x: 108, y: 72, r: 3, type: 'ring' },
  ];

  const ORB_STYLE = {
    moon: { inner: '#fffbe3', outer: '#f1e19a', glow: '255,240,180', glowR: 3.4 },
    pale: { inner: '#fffaf0', outer: '#f2e8c0', glow: '255,245,210', glowR: 3 },
    gold: { inner: '#ffe08a', outer: '#f0a93a', glow: '255,190,90', glowR: 2.8 },
    ring: { inner: '#fff7d6', outer: '#f3dc8a', glow: '255,233,166', glowR: 3.2 },
  };

  const SPARK_KINDS = [
    { c: '#f4a640', glow: '255,170,70', pts: 8 },
    { c: '#fff6d8', glow: '255,250,220', pts: 5 },
    { c: '#ffe9a8', glow: '255,235,170', pts: 4 },
  ];

  const BASE_SPARKS = [
    { x: 208, y: 57, r: 16, c: '#f4a640', glow: '255,170,70', pts: 8 },
    { x: 416, y: 80, r: 7, c: '#f2b45a', glow: '255,190,100', pts: 8 },
    { x: 404, y: 70, r: 5, c: '#f2b45a', glow: '255,190,100', pts: 8 },
    { x: 366, y: 222, r: 8, c: '#fff6d8', glow: '255,250,220', pts: 5 },
    { x: 236, y: 456, r: 12, c: '#eef4ff', glow: '220,235,255', pts: 5 },
    { x: 150, y: 335, r: 6, c: '#f4c060', glow: '255,200,110', pts: 4 },
    { x: 370, y: 298, r: 6, c: '#ffe9a8', glow: '255,235,170', pts: 4 },
    { x: 330, y: 268, r: 5, c: '#ffe9a8', glow: '255,235,170', pts: 4 },
  ];

  const BASE_WINDOWS = [
    { x: 364, y: 644, w: 8, h: 11 },
    { x: 364, y: 664, w: 8, h: 11 },
    { x: 366, y: 612, w: 4, h: 7 },
    { x: 404, y: 682, w: 10, h: 12 },
    { x: 436, y: 682, w: 10, h: 12 },
    { x: 421, y: 699, w: 8, h: 13 },
    { x: 310, y: 700, w: 5, h: 6 },
    { x: 326, y: 698, w: 5, h: 6 },
    { x: 470, y: 702, w: 5, h: 6 },
    { x: 282, y: 708, w: 4, h: 5 },
    { x: 344, y: 704, w: 4, h: 5 },
  ];

  const BASE_LAMPS = [
    { x: 60, y: 702, r: 3 },
    { x: 96, y: 688, r: 2.5 },
    { x: 112, y: 722, r: 3 },
    { x: 142, y: 704, r: 2.5 },
    { x: 30, y: 668, r: 2 },
    { x: 172, y: 728, r: 2 },
    { x: 238, y: 724, r: 2 },
  ];

  /* ---------- Escena adaptada al ancho actual ---------- */

  let VORTICES = [];
  let ORBS = [];
  let SPARKS = [];
  let DOTS = [];
  let WINDOWS = [];
  let LAMPS = [];
  let HAMLET = [];
  let BIRDS = [];
  let EMBERS = [];
  let PARTICLES = [];
  let villageDx = 0;

  function farFrom(list, x, y, gap) {
    return list.every((o) => Math.hypot(o.x - x, o.y - y) > (o.r || 0) + gap);
  }

  function buildScene() {
    const rng = mulberry32(1889);
    const extra = Math.max(0, k - 1);

    VORTICES = BASE_VORTICES.map((v) => ({ ...v, x: X(v.x) }));
    const nV = Math.round(extra * 4);
    for (let i = 0; i < nV; i++) {
      const x = ((i + 0.5) / nV) * W + (rng() - 0.5) * 80;
      const y = 300 + rng() * 180;
      if (!farFrom(VORTICES, x, y, 90)) continue;
      VORTICES.push({ x, y, r: 45 + rng() * 40, s: (rng() < 0.5 ? -1 : 1) * (1.3 + rng() * 0.9) });
    }

    ORBS = BASE_ORBS.map((o) => ({ ...o, x: X(o.x) }));
    const nO = Math.round(extra * 5);
    for (let i = 0, tries = 0; i < nO && tries < 200; tries++) {
      const r = 5 + rng() * 10;
      const x = 20 + rng() * (W - 40);
      const y = 70 + rng() * 440;
      if (!farFrom(ORBS, x, y, r + 50)) continue;
      ORBS.push({ x, y, r, type: rng() < 0.75 ? 'ring' : 'pale' });
      i++;
    }
    ORBS.forEach((o) => {
      o.ph = rng() * Math.PI * 2;
      o.sp = 0.6 + rng() * 0.8;
    });

    SPARKS = BASE_SPARKS.map((s) => ({ ...s, x: X(s.x) }));
    const nS = Math.round(extra * 5);
    for (let i = 0, tries = 0; i < nS && tries < 200; tries++) {
      const x = 20 + rng() * (W - 40);
      const y = 30 + rng() * 480;
      if (!farFrom(ORBS, x, y, 40) || !farFrom(SPARKS, x, y, 40)) continue;
      const kind = pick(rng, SPARK_KINDS);
      SPARKS.push({ x, y, r: 5 + rng() * 8, ...kind });
      i++;
    }
    SPARKS.forEach((s) => {
      s.ph = rng() * Math.PI * 2;
      s.sp = 0.8 + rng() * 1.2;
    });

    DOTS = [];
    for (let i = 0; i < Math.round(230 * k); i++) {
      DOTS.push({
        x: rng() * W,
        y: Math.pow(rng(), 1.6) * 560,
        r: 0.5 + rng() * 1.3,
        c: rng() < 0.75 ? '255,255,255' : '255,225,150',
        ph: rng() * Math.PI * 2,
        sp: 0.5 + rng() * 2,
      });
    }

    // El pueblo conserva su tamaño y se centra en su nueva posición
    villageDx = X(400) - 400;
    WINDOWS = BASE_WINDOWS.map((w) => ({ ...w, x: w.x + villageDx }));
    LAMPS = BASE_LAMPS.map((l) => ({ ...l, x: l.x + X(62) - 62 }));

    // Caserío extra en pantallas anchas, entre los árboles y el pueblo
    HAMLET = [];
    if (k > 1.35) {
      const from = X(190) + 60;
      const to = 272 + villageDx - 40;
      const n = Math.max(2, Math.floor((to - from) / 90));
      for (let i = 0; i < n; i++) {
        const w = 22 + rng() * 22;
        const h = 14 + rng() * 14;
        const x = from + ((i + 0.5) / n) * (to - from) - w / 2;
        HAMLET.push({ x, w, h, roof: 8 + rng() * 10 });
        WINDOWS.push({ x: x + w * 0.3, y: 716 - h * 0.7, w: 4, h: 5 });
        if (w > 32) WINDOWS.push({ x: x + w * 0.65, y: 716 - h * 0.7, w: 4, h: 5 });
        LAMPS.push({ x: x + w + 10 + rng() * 20, y: 718 + rng() * 10, r: 2 });
      }
    }

    BIRDS = [];
    for (let i = 0; i < Math.round(8 * k); i++) {
      BIRDS.push({
        x: X(170) + rng() * X(260),
        y: 590 + rng() * 120,
        s: 4 + rng() * 3,
        vx: (0.15 + rng() * 0.25) * (rng() < 0.3 ? -1 : 1),
        ph: rng() * Math.PI * 2,
        flap: 0.8 + rng() * 0.6,
      });
    }

    EMBERS = [];
    for (let i = 0; i < Math.round(18 * k); i++) {
      EMBERS.push({ x: rng() * W, y: 700 + rng() * 60, ph: rng() * 10, sp: 0.1 + rng() * 0.2 });
    }

    PARTICLES = [];
    for (let i = 0; i < Math.min(1500, Math.round(650 * k)); i++) {
      const p = {};
      spawn(p, true);
      PARTICLES.push(p);
    }
  }

  /* ---------- Campo de flujo (los remolinos) ---------- */

  const pointer = { x: 0, y: 0, s: 0 };
  const FV = [0, 0];

  function field(x, y, live) {
    let vx = 1;
    let vy = 0.4 * Math.sin(x * 0.011 + y * 0.007) + 0.5 * (noise(x * 0.008 + 10, y * 0.008) - 0.5);
    if (y < 250) vy += 0.15;

    for (let i = 0; i < VORTICES.length; i++) {
      const v = VORTICES[i];
      const dx = x - v.x;
      const dy = y - v.y;
      const d2 = dx * dx + dy * dy;
      const d = Math.sqrt(d2) + 0.001;
      const w = Math.exp(-d2 / (v.r * v.r)) * v.s;
      vx += (-dy / d) * w * 1.8 - (dx / d) * Math.abs(w) * 0.35;
      vy += (dx / d) * w * 1.8 - (dy / d) * Math.abs(w) * 0.35;
    }

    if (live && pointer.s > 0.01) {
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const d2 = dx * dx + dy * dy;
      const d = Math.sqrt(d2) + 0.001;
      const w = Math.exp(-d2 / 3600) * 3 * pointer.s;
      vx += (-dy / d) * w;
      vy += (dx / d) * w;
    }

    const m = Math.hypot(vx, vy) || 1;
    FV[0] = vx / m;
    FV[1] = vy / m;
    return FV;
  }

  function bandCenter(x) {
    return 400 + 30 * Math.sin(x * 0.011 + 0.6) - (0.05 * (x - W / 2)) / k;
  }

  function skyLightness(x, y) {
    let t = Math.exp(-(((y - bandCenter(x)) / 70) ** 2)) * 0.95;
    for (let i = 0; i < 3; i++) {
      const v = VORTICES[i];
      const d2 = (x - v.x) ** 2 + (y - v.y) ** 2;
      t += Math.exp(-d2 / (v.r * v.r * 1.4)) * 0.45;
    }
    t += (noise(x * 0.02, y * 0.02) - 0.5) * 0.55;
    if (y < 300) {
      const c = noise(x * 0.012 + 5, y * 0.018);
      if (c > 0.6) t += c - 0.45;
    }
    return t;
  }

  function skyColor(x, y, rng) {
    if (y > H * 0.66) {
      const p = (y - H * 0.66) / (H * 0.14);
      if (rng() < p * 0.8) return pick(rng, p > 0.6 ? PAL.warm : PAL.dusk);
    }
    const t = skyLightness(x, y) + (rng() - 0.5) * 0.2;
    if (t > 0.78) return pick(rng, PAL.light);
    if (t > 0.5) return pick(rng, PAL.mid);
    if (t > 0.22) return pick(rng, PAL.dark);
    return pick(rng, PAL.deep);
  }

  /* ---------- Capa: cielo pintado (estático) ---------- */

  function paintSky(ctx) {
    const rng = mulberry32(7);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1636');
    g.addColorStop(0.3, '#132c66');
    g.addColorStop(0.5, '#24509a');
    g.addColorStop(0.64, '#1b3a7a');
    g.addColorStop(0.8, '#2a3f7c');
    g.addColorStop(0.86, '#c27a4e');
    g.addColorStop(0.9, '#f0a85a');
    g.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Pinceladas base que siguen los remolinos
    const nBase = Math.round(9000 * k);
    for (let i = 0; i < nBase; i++) {
      let x = rng() * (W + 40) - 20;
      let y = rng() * (H * 0.9);
      const steps = 4 + Math.floor(rng() * 8);
      ctx.strokeStyle = skyColor(x, y, rng);
      ctx.globalAlpha = 0.65 + rng() * 0.35;
      ctx.lineWidth = (1.6 + rng() * 2.6) * (y > H * 0.7 ? 0.8 : 1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < steps; s++) {
        const v = field(x, y, false);
        x += v[0] * 3;
        y += v[1] * 3;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Trazos finos de luz en la banda del remolino
    const nLight = Math.round(3200 * k);
    for (let i = 0; i < nLight; i++) {
      let x = rng() * W;
      let y = 220 + rng() * 360;
      if (skyLightness(x, y) < 0.6) continue;
      ctx.strokeStyle = pick(rng, PAL.light);
      ctx.globalAlpha = 0.5 + rng() * 0.5;
      ctx.lineWidth = 0.8 + rng() * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 6 + Math.floor(rng() * 8);
      for (let s = 0; s < steps; s++) {
        const v = field(x, y, false);
        x += v[0] * 2.5;
        y += v[1] * 2.5;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Halos de pinceladas alrededor de los astros
    ORBS.forEach((o) => {
      const rings = o.type === 'moon' || o.type === 'gold' ? 4 : o.r > 6 ? 3 : 1;
      for (let ring = 0; ring < rings; ring++) {
        const rad = o.r * (1.5 + 0.5 * ring) + 2;
        const segs = Math.floor(rad * 0.9) + 6;
        for (let s = 0; s < segs; s++) {
          const a0 = (s / segs) * Math.PI * 2 + rng() * 0.2;
          const a1 = a0 + ((Math.PI * 2) / segs) * (0.8 + rng() * 0.5);
          ctx.strokeStyle =
            rng() < 0.2 && o.type !== 'pale' ? pick(rng, PAL.warm) : pick(rng, ring < 2 ? PAL.light : PAL.mid);
          ctx.globalAlpha = (0.55 + rng() * 0.3) * (1 - ring * 0.18);
          ctx.lineWidth = 1.6 + rng() * 1.4;
          ctx.beginPath();
          ctx.arc(o.x, o.y, rad + (rng() - 0.5) * 2, a0, a1);
          ctx.stroke();
        }
      }
    });

    ctx.globalAlpha = 1;
  }

  /* ---------- Capa: paisaje (estático) ---------- */

  function texture(ctx, rng, path, box, count, colors, dir) {
    ctx.save();
    ctx.clip(path);
    for (let i = 0; i < count; i++) {
      const x = box.x + rng() * box.w;
      const y = box.y + rng() * box.h;
      const len = 4 + rng() * 9;
      const a = dir + (rng() - 0.5) * 0.9;
      ctx.strokeStyle = pick(rng, colors);
      ctx.globalAlpha = 0.6 + rng() * 0.4;
      ctx.lineWidth = 1.2 + rng() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(a) * len * 0.5 + (rng() - 0.5) * 3,
        y + Math.sin(a) * len * 0.5 + (rng() - 0.5) * 3,
        x + Math.cos(a) * len,
        y + Math.sin(a) * len
      );
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function polyPath(points) {
    const p = new Path2D();
    p.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) p.lineTo(points[i][0], points[i][1]);
    p.closePath();
    return p;
  }

  function cypress(ctx, rng, cx, top, base, half) {
    const n = 48;
    const right = [];
    const left = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = top + (base - top) * t;
      const shape = Math.pow(Math.sin(Math.min(t * 1.15, 1) * (Math.PI / 2)), 1.7);
      const sway = Math.sin(t * 7 + cx) * 3 * t;
      right.push([cx + sway + half * shape * (0.8 + 0.4 * noise(i * 0.6, cx)), y]);
      left.push([cx + sway - half * shape * (0.8 + 0.4 * noise(i * 0.6 + 50, cx)), y]);
    }
    const path = polyPath(right.concat(left.reverse()));
    ctx.fillStyle = '#071026';
    ctx.fill(path);
    texture(ctx, rng, path, { x: cx - half - 6, y: top, w: half * 2 + 12, h: base - top }, 900, PAL.foliage, -Math.PI / 2);
    // Brillos fríos en el borde derecho
    texture(
      ctx,
      rng,
      path,
      { x: cx + half * 0.2, y: top + 60, w: half, h: base - top - 60 },
      140,
      ['#24426e', '#2e5282'],
      -Math.PI / 2.4
    );
  }

  function blob(ctx, rng, cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const rr = r * (0.8 + 0.35 * noise(i * 0.5, cx * 0.1));
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9]);
    }
    const path = polyPath(pts);
    ctx.fillStyle = '#0a1530';
    ctx.fill(path);
    texture(ctx, rng, path, { x: cx - r * 1.2, y: cy - r * 1.2, w: r * 2.4, h: r * 2.4 }, Math.floor(r * 9), PAL.foliage, -Math.PI / 3);
  }

  function pine(ctx, rng, cx, top, base, half) {
    const m = 18;
    const right = [];
    const left = [];
    for (let i = 0; i <= m; i++) {
      const t = i / m;
      const y = top + (base - top) * t;
      const w = half * Math.pow(t, 0.85) * (i % 2 ? 1 : 0.7) * (0.85 + 0.3 * rng());
      right.push([cx + w, y]);
      left.push([cx - w, y]);
    }
    const path = polyPath(right.concat(left.reverse()));
    ctx.fillStyle = '#081128';
    ctx.fill(path);
    texture(ctx, rng, path, { x: cx - half, y: top, w: half * 2, h: base - top }, Math.floor((base - top) * 2.2), PAL.foliage, Math.PI * 0.85);
  }

  function house(path, x, w, h, roof) {
    path.rect(x, 716 - h, w, h);
    path.moveTo(x - 4, 716 - h + 2);
    path.lineTo(x + w / 2, 716 - h - roof);
    path.lineTo(x + w + 4, 716 - h + 2);
    path.closePath();
  }

  function paintLand(ctx) {
    const rng = mulberry32(42);
    ctx.lineCap = 'round';
    const peakX = X(440);

    // Montañas lejanas: perfil suave con un pico principal iluminado
    const farPts = [];
    for (let x = 0; x <= W + 30; x += 30) {
      const hills = 590 - 30 * noise(x * 0.008, 3) + 12 * Math.sin(x * 0.03);
      farPts.push([x, Math.min(hills, 518 + Math.abs(x - peakX) * 0.55)]);
    }
    farPts.push([W + 30, 730], [0, 730]);
    const far = polyPath(farPts);
    let g = ctx.createLinearGradient(0, 515, 0, 730);
    g.addColorStop(0, '#3a5590');
    g.addColorStop(1, '#1c2e60');
    ctx.fillStyle = g;
    ctx.fill(far);
    texture(ctx, rng, far, { x: 0, y: 515, w: W, h: 215 }, Math.round(1300 * k), ['#2a4583', '#34508f', '#243a72', '#4a5f98'], 0.35);
    // Crestas iluminadas por el atardecer
    ctx.save();
    ctx.clip(far);
    for (let i = 0; i < 160; i++) {
      const x = peakX - 80 + rng() * 170;
      const y = 520 + Math.abs(x - peakX) * 0.55 + rng() * 26;
      ctx.strokeStyle = pick(rng, ['#d9a98f', '#b48a92', '#e8bb92', '#8f7aa0']);
      ctx.globalAlpha = 0.55 + rng() * 0.4;
      ctx.lineWidth = 1.2 + rng() * 1.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6 + rng() * 6, y + 3 + rng() * 4);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Montañas cercanas
    const nearPts = [];
    for (let x = 0; x <= W + 40; x += 40) {
      nearPts.push([x, 646 + 12 * Math.sin(x * 0.021 + 1) + 10 * (noise(x * 0.01, 9) - 0.5)]);
    }
    nearPts.push([W + 40, 740], [0, 740]);
    const near = polyPath(nearPts);
    ctx.fillStyle = '#18284f';
    ctx.fill(near);
    texture(ctx, rng, near, { x: 0, y: 630, w: W, h: 110 }, Math.round(700 * k), ['#1d3160', '#16264c', '#22386a'], 0.2);

    // Resplandor naranja del horizonte (elipse que se estira con el ancho)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(X(240), 735);
    ctx.scale(k, 1);
    g = ctx.createRadialGradient(0, 0, 10, 0, 0, 280);
    g.addColorStop(0, 'rgba(255,170,80,0.85)');
    g.addColorStop(0.35, 'rgba(240,120,60,0.45)');
    g.addColorStop(1, 'rgba(200,80,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-280, -95, 560, 120);
    ctx.restore();
    for (let i = 0; i < Math.round(220 * k); i++) {
      const x = X(20) + rng() * X(460);
      const y = 712 + rng() * 26;
      ctx.strokeStyle = pick(rng, PAL.warm);
      ctx.globalAlpha = 0.4 + rng() * 0.5;
      ctx.lineWidth = 1 + rng() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6 + rng() * 10, y + (rng() - 0.5) * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Pueblo
    ctx.fillStyle = '#0c1430';
    const village = new Path2D();
    // Iglesia
    village.rect(358, 630, 22, 86);
    village.moveTo(355, 632);
    village.lineTo(369, 588);
    village.lineTo(383, 632);
    village.closePath();
    village.rect(368, 556, 2, 34);
    // Casa grande con tejado a dos aguas
    village.rect(395, 668, 62, 48);
    village.moveTo(388, 670);
    village.lineTo(426, 638);
    village.lineTo(464, 670);
    village.closePath();
    // Casitas
    village.rect(296, 692, 42, 24);
    village.moveTo(292, 694);
    village.lineTo(317, 680);
    village.lineTo(342, 694);
    village.closePath();
    village.rect(272, 702, 26, 14);
    village.rect(338, 698, 20, 18);
    village.rect(462, 694, 30, 22);
    village.moveTo(458, 696);
    village.lineTo(477, 684);
    village.lineTo(496, 696);
    village.closePath();
    village.rect(312, 676, 4, 10);

    ctx.save();
    ctx.translate(villageDx, 0);
    ctx.fill(village);
    texture(ctx, rng, village, { x: 270, y: 556, w: 230, h: 160 }, 260, ['#141f44', '#1b2a56', '#101a3a'], -Math.PI / 2);
    // Bordes cálidos en los tejados
    ctx.strokeStyle = 'rgba(240,170,100,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(388, 670);
    ctx.lineTo(426, 638);
    ctx.lineTo(464, 670);
    ctx.moveTo(355, 632);
    ctx.lineTo(369, 588);
    ctx.stroke();
    ctx.restore();

    // Caserío extra (solo en pantallas anchas)
    if (HAMLET.length) {
      const hamlet = new Path2D();
      HAMLET.forEach((hs) => house(hamlet, hs.x, hs.w, hs.h, hs.roof));
      ctx.fillStyle = '#0c1430';
      ctx.fill(hamlet);
      texture(ctx, rng, hamlet, { x: HAMLET[0].x - 10, y: 660, w: W, h: 60 }, 120 * HAMLET.length, ['#141f44', '#1b2a56'], -Math.PI / 2);
    }

    WINDOWS.forEach((w) => {
      ctx.fillStyle = '#f5b450';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#ffe2a0';
      ctx.fillRect(w.x + 1, w.y + 1, w.w - 2, w.h * 0.45);
    });

    // Suelo y agua
    g = ctx.createLinearGradient(0, 714, 0, H);
    g.addColorStop(0, '#111c3c');
    g.addColorStop(1, '#050a1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 714, W, H - 714);
    const water = polyPath(
      [[90, 752], [200, 746], [360, 750], [470, 744], [560, 752], [560, 776], [90, 780]].map(([x, y]) => [X(x), y])
    );
    ctx.fillStyle = '#16264c';
    ctx.fill(water);
    texture(ctx, rng, water, { x: X(90), y: 744, w: X(470), h: 36 }, Math.round(220 * k), ['#1e3462', '#284275', '#16264c'], 0);
    ctx.save();
    ctx.clip(water);
    for (let i = 0; i < Math.round(90 * k); i++) {
      const x = X(170) + rng() * X(300);
      const y = 748 + rng() * 28;
      ctx.strokeStyle = pick(rng, PAL.warm);
      ctx.globalAlpha = 0.35 + rng() * 0.5;
      ctx.lineWidth = 1 + rng() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 5 + rng() * 9, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Árboles redondos a la izquierda
    // El grupo se mantiene junto a los cipreses; en pantallas anchas se rellena hacia el borde
    const leftDx = X(62) - 62;
    const extraBlobs = Math.ceil(leftDx / 45);
    for (let i = 0; i < extraBlobs; i++) blob(ctx, rng, (i / extraBlobs) * (leftDx + 20), 670 + rng() * 50, 38 + rng() * 18);
    [[30, 640, 52], [100, 612, 44], [150, 680, 40], [20, 720, 48], [88, 700, 50], [190, 715, 30]].forEach(([x, y, r]) =>
      blob(ctx, rng, x + leftDx, y, r)
    );

    // Pinos a la derecha (más pinos cuanto más ancha la pantalla)
    const rightStart = 496 + villageDx + 50;
    const extraPines = Math.round((k - 1) * 3);
    for (let i = 0; i < extraPines; i++) {
      const cx = rightStart + rng() * Math.max(10, W - rightStart - 80);
      blob(ctx, rng, cx + 20, 712, 30 + rng() * 20);
      pine(ctx, rng, cx, 520 + rng() * 110, 735, 22 + rng() * 18);
    }
    blob(ctx, rng, X(545), 700, 58);
    pine(ctx, rng, X(492), 590, 735, 28);
    pine(ctx, rng, X(545), 440, 745, 50);

    // Cipreses (la pareja se mantiene junta)
    const cyX = X(62);
    cypress(ctx, rng, cyX + 50, 225, 770, 22);
    cypress(ctx, rng, cyX, 160, 780, 28);

    // Hierba en primer plano
    for (let i = 0; i < Math.round(900 * k); i++) {
      const x = rng() * W;
      const y = H - rng() * 50;
      ctx.strokeStyle = pick(rng, ['#060c1e', '#0b1530', '#101d3e', '#0d1836']);
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1 + rng() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (rng() - 0.5) * 6, y - 6, x + (rng() - 0.3) * 10, y - 8 - rng() * 14);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Viñeta
    ctx.save();
    ctx.translate(W / 2, H * 0.47);
    ctx.scale(k, 1);
    g = ctx.createRadialGradient(0, 0, H * 0.35, 0, 0, H * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(2,6,20,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(-BASE_W / 2 - 10, -H * 0.47, BASE_W + 20, H);
    ctx.restore();
  }

  /* ---------- Capa: pinceladas vivas ---------- */

  const TRAIL = 14;
  const rngLive = mulberry32(2024);

  function spawn(p, initial) {
    p.x = rngLive() * W;
    p.y = rngLive() * 600;
    p.life = 80 + rngLive() * 140;
    p.age = initial ? Math.floor(rngLive() * p.life) : 0;
    p.speed = 0.5 + rngLive() * 0.7;
    p.width = 0.8 + rngLive() * 1.6;
    const l = skyLightness(p.x, p.y);
    p.color = l > 0.7 ? pick(rngLive, ['#e3eef9', '#c8dcf3', '#fff4d6']) : pick(rngLive, ['#7fa9de', '#5d8fd4', '#a5c6ec']);
    p.hist = [];
  }

  function drawFlow(ctx, dt) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < PARTICLES.length; i++) {
      const p = PARTICLES[i];
      const v = field(p.x, p.y, true);
      p.x += v[0] * p.speed * dt;
      p.y += v[1] * p.speed * dt;
      p.hist.push(p.x, p.y);
      if (p.hist.length > TRAIL * 2) p.hist.splice(0, 2);
      p.age += dt;
      if (p.age > p.life || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > 640) {
        spawn(p, false);
        continue;
      }
      if (p.hist.length < 4) continue;
      const life = p.age / p.life;
      ctx.globalAlpha = Math.sin(life * Math.PI) * 0.55;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width;
      ctx.beginPath();
      ctx.moveTo(p.hist[0], p.hist[1]);
      for (let j = 2; j < p.hist.length; j += 2) ctx.lineTo(p.hist[j], p.hist[j + 1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Capa: luces del cielo ---------- */

  function starPath(ctx, x, y, outer, inner, pts, rot) {
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const r = i % 2 ? inner : outer;
      const a = rot + (i * Math.PI) / pts;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  let shooting = null;
  let nextShooting = 4000;

  function drawLights(ctx, t, dt) {
    ctx.clearRect(0, 0, W, H);

    // Resplandores
    ctx.globalCompositeOperation = 'lighter';
    ORBS.forEach((o) => {
      const st = ORB_STYLE[o.type];
      const pulse = 1 + 0.1 * Math.sin(t * 0.0012 * o.sp + o.ph);
      const R = o.r * st.glowR * pulse;
      const g = ctx.createRadialGradient(o.x, o.y, o.r * 0.6, o.x, o.y, R);
      g.addColorStop(0, `rgba(${st.glow},0.55)`);
      g.addColorStop(0.4, `rgba(${st.glow},0.18)`);
      g.addColorStop(1, `rgba(${st.glow},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(o.x - R, o.y - R, R * 2, R * 2);
    });
    SPARKS.forEach((s) => {
      const pulse = 1 + 0.25 * Math.sin(t * 0.002 * s.sp + s.ph);
      const R = s.r * 2.6 * pulse;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R);
      g.addColorStop(0, `rgba(${s.glow},0.6)`);
      g.addColorStop(1, `rgba(${s.glow},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(s.x - R, s.y - R, R * 2, R * 2);
    });
    // Brillo naranja que asoma en el borde superior
    const topX = X(455);
    const tg = ctx.createRadialGradient(topX, -4, 0, topX, -4, 46);
    tg.addColorStop(0, 'rgba(255,180,80,0.9)');
    tg.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(topX - 55, 0, 110, 50);
    ctx.globalCompositeOperation = 'source-over';

    // Núcleos de luna y estrellas
    ORBS.forEach((o) => {
      const st = ORB_STYLE[o.type];
      const g = ctx.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.1, o.x, o.y, o.r);
      g.addColorStop(0, st.inner);
      g.addColorStop(1, st.outer);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
      if (o.type === 'moon') {
        ctx.fillStyle = 'rgba(214,190,110,0.35)';
        [[-8, -4, 6], [7, 6, 5], [-2, 11, 3.5], [10, -9, 3]].forEach(([dx, dy, r]) => {
          ctx.beginPath();
          ctx.arc(o.x + dx, o.y + dy, r, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    SPARKS.forEach((s) => {
      const pulse = 1 + 0.18 * Math.sin(t * 0.002 * s.sp + s.ph);
      const inner = s.pts === 8 ? 0.32 : s.pts === 5 ? 0.45 : 0.3;
      ctx.fillStyle = s.c;
      starPath(ctx, s.x, s.y, s.r * pulse, s.r * inner * pulse, s.pts, -Math.PI / 2 + t * 0.00005 * s.sp);
      ctx.fill();
    });

    // Estrellitas que titilan
    DOTS.forEach((d) => {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.002 * d.sp + d.ph));
      ctx.fillStyle = `rgba(${d.c},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Estrella fugaz ocasional
    if (dt > 0) {
      nextShooting -= dt * 16.67;
      if (!shooting && nextShooting <= 0) {
        shooting = { x: 40 + Math.random() * (W - 300), y: 20 + Math.random() * 120, life: 0 };
        nextShooting = 7000 + Math.random() * 9000;
      }
    }
    if (shooting) {
      shooting.life += dt;
      const p = shooting.life / 45;
      const hx = shooting.x + p * 220;
      const hy = shooting.y + p * 90;
      const g = ctx.createLinearGradient(hx - 80, hy - 33, hx, hy);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, `rgba(255,250,230,${(1 - p).toFixed(3)})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(hx - 80, hy - 33);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      if (p >= 1) shooting = null;
    }
  }

  /* ---------- Capa: pájaros y luces del pueblo ---------- */

  function drawFx(ctx, t, dt) {
    ctx.clearRect(0, 0, W, H);

    // Ventanas y faroles que parpadean
    ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, R, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `rgba(255,190,90,${a.toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
    };
    WINDOWS.forEach((w, i) => {
      const f = 0.45 + 0.15 * Math.sin(t * 0.004 + i * 1.7) + 0.08 * Math.sin(t * 0.013 + i);
      glow(w.x + w.w / 2, w.y + w.h / 2, Math.max(w.w, w.h) * 2.2, f);
    });
    LAMPS.forEach((l, i) => {
      const f = 0.6 + 0.2 * Math.sin(t * 0.005 + i * 2.3);
      glow(l.x, l.y, l.r * 6, f);
      ctx.fillStyle = 'rgba(255,220,150,0.9)';
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    });
    // Chispas que suben
    EMBERS.forEach((e) => {
      e.y -= e.sp * dt;
      e.x += Math.sin(t * 0.001 + e.ph) * 0.2 * dt;
      if (e.y < 600) {
        e.y = 740;
        e.x = Math.random() * W;
      }
      const a = Math.min(1, (e.y - 600) / 80) * (0.5 + 0.5 * Math.sin(t * 0.006 + e.ph));
      ctx.fillStyle = `rgba(255,200,120,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';

    // Pájaros
    ctx.strokeStyle = '#eef2fb';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    BIRDS.forEach((b) => {
      b.x += b.vx * dt;
      b.y += Math.sin(t * 0.001 + b.ph) * 0.05 * dt;
      if (b.x > W + 10) b.x = -10;
      if (b.x < -10) b.x = W + 10;
      const f = Math.sin(t * 0.008 * b.flap + b.ph);
      const s = b.s;
      ctx.beginPath();
      ctx.moveTo(b.x - s, b.y - f * s * 0.5);
      ctx.quadraticCurveTo(b.x - s * 0.4, b.y - s * 0.35 - f * s * 0.2, b.x, b.y);
      ctx.quadraticCurveTo(b.x + s * 0.4, b.y - s * 0.35 - f * s * 0.2, b.x + s, b.y - f * s * 0.5);
      ctx.stroke();
    });
  }

  /* ---------- Tamaño, interacción y bucle ---------- */

  function resize() {
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    let scale;
    if (vw / vh >= BASE_W / H) {
      // Pantalla ancha (PC): llena la altura y extiende el mundo a lo ancho
      scale = vh / H;
      W = vw / scale;
    } else {
      // Pantalla angosta (móvil): composición original completa
      scale = vw / BASE_W;
      W = BASE_W;
    }
    k = W / BASE_W;

    const cssW = Math.round(W * scale);
    const cssH = Math.round(H * scale);
    stage.style.width = cssW + 'px';
    stage.style.height = cssH + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    Object.values(layers).forEach(({ canvas, ctx }) => {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    });

    buildScene();
    paintSky(layers.sky.ctx);
    paintLand(layers.land.ctx);
    // Pre-calienta las partículas para que las estelas existan desde el primer frame
    for (let i = 0; i < TRAIL; i++) drawFlow(layers.flow.ctx, 1);
    if (reduceMotion) renderFrame(performance.now(), 0);
  }

  function toWorld(e) {
    const rect = stage.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * W, ((e.clientY - rect.top) / rect.height) * H];
  }

  stage.addEventListener('pointermove', (e) => {
    const [x, y] = toWorld(e);
    pointer.x = x;
    pointer.y = y;
    pointer.s = 1;
  });
  stage.addEventListener('pointerleave', () => {
    pointer.s = Math.min(pointer.s, 0.6);
  });

  function renderFrame(t, dt) {
    if (dt > 0) drawFlow(layers.flow.ctx, dt);
    drawLights(layers.lights.ctx, t, dt);
    drawFx(layers.fx.ctx, t, dt);
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  resize();

  if (!reduceMotion) {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - last) / 16.67, 3);
      last = now;
      pointer.s *= 0.985;
      renderFrame(now, dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
})();
