/* Haunted Slime Overlay – original SVG art, no external assets. */
(() => {
  if (window.__hwLoaded) return; window.__hwLoaded = true;
  const NS = 'http://www.w3.org/2000/svg';
  const MAX_CARDS = 24, MAX_BARS = 20;
  const COLORS = {
    orange: { hi: '#ffc27a', mid: '#ff7a1a', lo: '#c94a05', glow: '#ff7a1a' },
    green:  { hi: '#c9ff8a', mid: '#6be03a', lo: '#2f9a12', glow: '#6be03a' },
    purple: { hi: '#d9b8ff', mid: '#9b5cf0', lo: '#5a2ca8', glow: '#9b5cf0' }
  };
  let uid = 0, cardSeq = 0, cardLayer = null, syncTimer = 0, enabled = false, observer = null, timer = null, root = null;
  const decorated = new WeakSet(), barsDone = new WeakSet();
  const added = []; // nodes we inserted into page elements
  const touched = []; // [el, prevStyleText]

  const rng = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  /* ---------- SVG builders ---------- */
  function defs(c, id) {
    return `<defs>
      <linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.hi}"/><stop offset=".35" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.lo}"/></linearGradient>
      <radialGradient id="b${id}" cx=".35" cy=".3" r=".75">
        <stop offset="0" stop-color="${c.hi}"/><stop offset=".5" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.lo}"/></radialGradient>
      <filter id="f${id}" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>`;
  }
  // Gooey slime: one continuous band + dense tapered drips fused by an alpha-threshold "goo" filter,
  // then shaded (dark lower rim, specular highlight, colored glow).
  // Colours sampled from the reference slime pixels.
  const SLIME = {
    orange: { hi: '#f7a04e', mid: '#e96c1a', lo: '#c2520c', glow: '233,108,26' },
    green:  { hi: '#9ee070', mid: '#6cc338', lo: '#4c9724', glow: '108,195,56' },
    purple: { hi: '#d9b8ff', mid: '#9b5cf0', lo: '#5a2ca8', glow: '155,92,240' }
  };
  const f1 = v => v.toFixed(1);
  /* Seeded drip layout. Returns [{x, hw, len}] spaced irregularly like the reference. */
  function layoutDrips(w, r, { spacing = [24, 46], hw = [2.6, 3.6], len = [8, 30], start = 8, end = 8, long = .35 } = {}) {
    const out = []; let x = start + r() * spacing[0] * .5;
    while (x < w - end) {
      const L = r() < long ? len[1] * (.7 + r() * .3) : len[0] + r() * (len[1] - len[0]) * .45;
      out.push({ x, hw: hw[0] + r() * (hw[1] - hw[0]), len: L });
      x += spacing[0] + r() * (spacing[1] - spacing[0]);
    }
    return out;
  }
  /* One continuous smooth slime path: wavy band + drips with concave shoulders, tapered necks and round bulbs.
     thick(x) gives band thickness at x (lets card slime thin out to the left). side = length it wraps down the right edge. */
  function slimePath(w, drips, thick, r, side = 0) {
    let d = `M0,0 L${f1(w)},0`;
    if (side) { const t = thick(w); d += ` L${f1(w)},${f1(t + side)} C${f1(w)},${f1(t + side + 4)} ${f1(w - t * .9)},${f1(t + side + 4)} ${f1(w - t * .9)},${f1(t + side - 2)} C${f1(w - t * .9)},${f1(t + 4)} ${f1(w - t * 1.2)},${f1(t)} ${f1(w - t * 1.8)},${f1(t)}`; }
    else d += ` L${f1(w)},${f1(thick(w))}`;
    let cx = side ? w - thick(w) * 1.8 : w, cy = thick(cx);
    const ds = [...drips].sort((p, q) => q.x - p.x);
    const scallopTo = (x2) => { // smooth wavy band edge between drips (bulges down slightly, like goo sagging)
      const y2 = thick(x2), mx = (cx + x2) / 2, sag = Math.min(4.5, Math.abs(cx - x2) * .14) * (r() < .75 ? 1 : -.4);
      d += ` C${f1(cx - (cx - x2) * .35)},${f1(cy + sag)} ${f1(x2 + (cx - x2) * .35)},${f1(y2 + sag)} ${f1(x2)},${f1(y2)}`;
      cx = x2; cy = y2; void mx;
    };
    for (const { x, hw, len } of ds) {
      if (x + hw * 2.4 > cx) continue;
      const b = thick(x), sh = hw * 2.3, neck = hw * .78, rb = hw * 1.05, yE = b + len;
      scallopTo(x + sh);
      // right shoulder (concave) into neck, neck tapers down, swells into bulb
      d += ` C${f1(x + hw * 1.1)},${f1(b)} ${f1(x + neck)},${f1(b + 1.5)} ${f1(x + neck)},${f1(b + Math.min(len * .45, 6))}`;
      d += ` C${f1(x + neck)},${f1(b + len * .7)} ${f1(x + rb)},${f1(yE - rb * 1.9)} ${f1(x + rb)},${f1(yE - rb * .2)}`;
      d += ` C${f1(x + rb)},${f1(yE + rb * .75)} ${f1(x - rb)},${f1(yE + rb * .75)} ${f1(x - rb)},${f1(yE - rb * .2)}`;
      d += ` C${f1(x - rb)},${f1(yE - rb * 1.9)} ${f1(x - neck)},${f1(b + len * .7)} ${f1(x - neck)},${f1(b + Math.min(len * .45, 6))}`;
      d += ` C${f1(x - neck)},${f1(b + 1.5)} ${f1(x - hw * 1.1)},${f1(b)} ${f1(x - sh)},${f1(b)}`;
      cx = x - sh; cy = b;
    }
    scallopTo(0);
    return d + ' Z';
  }
  /* Build a slime strip SVG. kind: 'top' | 'card' | 'bar'. */
  function slimeSVG(w, color, seed, kind, { h = 10, side = 0, maxLen } = {}) {
    const c = SLIME[color], id = ++uid, r = rng(seed * 7919 + 13);
    let drips, thick;
    if (kind === 'top') {
      drips = layoutDrips(w, r, { spacing: [20, 40], hw: [3, 4.4], len: [1.5, maxLen || 34], long: .34 });
      const ph = r() * 6; thick = x => h + Math.sin(x / 31 + ph) * 1.8 + Math.sin(x / 11 + ph * 2) * .9;
    } else if (kind === 'card') {
      drips = layoutDrips(w, r, { spacing: [w * .11, w * .2], hw: [3.4, 6],  len: [10, maxLen || 38], start: w * .28, end: h * 2.2, long: .5 });
      thick = x => { const t = Math.min(1, Math.max(0, x / (w * .4))); return 1.2 + (h - 1.2) * (t * t * (3 - 2 * t)) + (Math.sin(x / 11) * 1.6 + Math.sin(x / 5.3) * .8) * t; };
    } else { // bar: fill becomes goo, short regular drips
      drips = layoutDrips(w, r, { spacing: [24, 40], hw: [2.4, 3.2], len: [5, maxLen || 13], start: 10, end: 8, long: .3 });
      thick = x => h + Math.sin(x / 19) * .5;
    }
    const d = slimePath(w, drips, thick, r, side);
    const maxD = Math.max(...drips.map(q => q.len), 0), H = h + maxD + side + 8;
    const hl = kind === 'card' ? w * .45 : 3;
    // drops that occasionally detach from the longest drips
    const drops = drips.filter(q => q.len > maxD * .7).slice(0, 2).map(q =>
      `<ellipse class="hw-drop" cx="${f1(q.x)}" cy="${f1(thick(q.x) + q.len)}" rx="${f1(q.hw * .8)}" ry="${f1(q.hw * 1)}" fill="${c.mid}" style="animation-duration:${(7 + r() * 6).toFixed(1)}s;animation-delay:${(-r() * 9).toFixed(1)}s"/>`).join('');
    const bulbs = drips.filter(q => q.len > 9).map(q => `<ellipse cx="${f1(q.x - q.hw * .35)}" cy="${f1(thick(q.x) + q.len - q.hw * .3)}" rx="${f1(q.hw * .3)}" ry="${f1(q.hw * .5)}" fill="#fff" opacity=".35"/>`).join('');
    return `<svg xmlns="${NS}" width="${f1(w)}" height="${f1(H)}" viewBox="0 0 ${f1(w)} ${f1(H)}" style="overflow:visible;--gc:${c.glow}" shape-rendering="geometricPrecision">
      <defs>
        <linearGradient id="g${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${f1(h + maxD)}">
          <stop offset="0" stop-color="${c.hi}"/><stop offset="${f1(Math.min(.6, h / (h + maxD) * .9))}" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.lo}"/></linearGradient>
        <radialGradient id="in${id}" cx=".5" cy=".2" r=".7"><stop offset="0" stop-color="#fff2c0" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <filter id="hb${id}" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="1.3"/></filter>
      </defs>
      <g class="hw-goo">
        <path d="${d}" fill="url(#g${id})"/>
        <path d="${d}" fill="url(#in${id})"/>
        <path d="M${f1(hl)},${f1(thick(hl) * .35)} ${Array.from({ length: 8 }, (_, i) => { const x = hl + (w - hl - 4) * (i + 1) / 8; return `L${f1(x)},${f1(thick(x) * .35)}`; }).join(' ')}"
          stroke="#fff" stroke-opacity=".22" stroke-width="${f1(Math.max(1.2, h * .28))}" stroke-linecap="round" fill="none" filter="url(#hb${id})"/>
        ${bulbs}
      </g>${drops}</svg>`;
  }
  // backwards-compatible wrapper
  const dripSVG = (w, color, seed, o = {}) => slimeSVG(w, color, seed, o.kind || 'card', o);

  const pumpkinSVG = (s = 30) => `<svg xmlns="${NS}" width="${s}" height="${s}" viewBox="0 0 40 40">
    <defs><radialGradient id="pk${++uid}" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffb347"/><stop offset=".6" stop-color="#f26b0f"/><stop offset="1" stop-color="#9c3c00"/></radialGradient></defs>
    <path d="M19 9 C19 5 21 3 24 2 L25 4 C22 5 21 7 21 9Z" fill="#4b7a1e"/>
    <g fill="url(#pk${uid})"><ellipse cx="12" cy="24" rx="9" ry="12"/><ellipse cx="28" cy="24" rx="9" ry="12"/><ellipse cx="20" cy="24" rx="9" ry="13"/></g>
    <path d="M20 11 V37 M12 13 Q8 24 12 35 M28 13 Q32 24 28 35" stroke="#a84300" stroke-opacity=".5" fill="none"/>
    <g class="hw-face" fill="#ffe36b"><path d="M11 20 L15 16 L17 21Z"/><path d="M29 20 L25 16 L23 21Z"/><path d="M19 23 L21 23 L20 26Z"/>
    <path d="M10 27 Q20 34 30 27 L27 28 L25 31 L23 29 L20 32 L17 29 L15 31 L13 28Z"/></g>
    <defs><filter id="pf${uid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4"/></filter></defs>
    <g class="hw-face-glow" fill="#fff7c0" filter="url(#pf${uid})"><path d="M11 20 L15 16 L17 21Z"/><path d="M29 20 L25 16 L23 21Z"/>
    <path d="M10 27 Q20 34 30 27 L27 28 L25 31 L23 29 L20 32 L17 29 L15 31 L13 28Z"/></g>
    <ellipse cx="14" cy="15" rx="2.5" ry="4" fill="#fff" opacity=".22"/></svg>`;

  // small spider with thin, bent legs; green variant glows like the ones under the reference's top band
  const spiderSVG = (green = false) => { const body = green ? '#5fc22e' : '#121212', leg = green ? '#5fc22e' : '#1c1c1c';
    return `<svg xmlns="${NS}" width="26" height="26" viewBox="0 0 30 30" overflow="visible">
    <g stroke="${leg}" stroke-width="1.05" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g class="hw-legs hw-legs-l"><path d="M13 14 L7 9 L4 13 M13 18 L7 21 L5 27"/></g><g class="hw-legs hw-legs-l2"><path d="M13 16 L6 15 L2 19 M13 15 L8 11.5 L3 9"/></g>
    <g class="hw-legs hw-legs-r"><path d="M17 14 L23 9 L26 13 M17 18 L23 21 L25 27"/></g><g class="hw-legs hw-legs-r2"><path d="M17 16 L24 15 L28 19 M17 15 L22 11.5 L27 9"/></g></g>
    <ellipse cx="15" cy="18" rx="3.6" ry="4.4" fill="${body}"/><circle cx="15" cy="12.6" r="2.6" fill="${body}"/>
    <ellipse cx="14" cy="16.5" rx="1" ry="1.6" fill="#fff" opacity="${green ? .35 : .15}"/></svg>`; };

  /* ---------- spider motion: seeded, JS-driven, transform-only ---------- */
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spiders = []; let rafId = 0;
  function addHanging(x, len, seed) {
    const n = el('div', 'hw-spider' + (seed % 2 ? ' hw-green-sp' : ''), `<div class="hw-thread"></div><div class="hw-sp-body">${spiderSVG(seed % 2 === 1)}</div>`, `left:${x}%`);
    root.appendChild(n);
    const sp = { kind: 'hang', n, thread: n.firstChild, body: n.lastChild, r: rng(seed), len, target: len, home: len, min: 25, max: 60 + (x % 30) * 4,
      ang: 0, av: 0, rot: 0, rotT: 0, next: 0, moving: false };
    spiders.push(sp); applyHang(sp);
  }
  function applyHang(sp) {
    sp.n.style.transform = `rotate(${sp.ang.toFixed(2)}deg)`;
    sp.thread.style.transform = `scaleY(${(sp.len / 100).toFixed(3)})`;
    sp.body.style.transform = `translate(-15px,${sp.len.toFixed(1)}px) rotate(${sp.rot.toFixed(1)}deg)`;
  }
  function addCrawler(seed) {
    // walks along the top-right cobweb's diagonal strands
    const n = el('div', 'hw-crawler', `<div class="hw-sp-body">${spiderSVG()}</div>`);
    root.appendChild(n);
    const sp = { kind: 'crawl', n, r: rng(seed), t: .35, dir: 1, speed: 0, next: 0, moving: false, heading: 0 };
    spiders.push(sp); applyCrawl(sp);
  }
  function crawlPos(t) { // point on a strand from the corner (right,top) inward, slightly curved
    const L = 150; return [innerWidth - 8 - t * L * 0.78, 6 + t * L * 0.62 + Math.sin(t * 6) * 3];
  }
  function applyCrawl(sp) {
    const [x, y] = crawlPos(sp.t); const [x2, y2] = crawlPos(sp.t + .01 * sp.dir);
    sp.heading = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI + 90;
    sp.n.style.transform = `translate(${(x - 15).toFixed(1)}px,${(y - 15).toFixed(1)}px) rotate(${sp.heading.toFixed(1)}deg)`;
  }
  // document-level pointer tracking (passive, rAF-throttled); decorations themselves stay pointer-events:none
  const ptr = { x: -9999, y: -9999, raw: null, queued: false };
  function onPointer(e) { ptr.raw = e; if (!ptr.queued) { ptr.queued = true; requestAnimationFrame(() => { ptr.queued = false; ptr.x = ptr.raw.clientX; ptr.y = ptr.raw.clientY; }); } }
  function stepSpiders(now, dt) {
    for (const sp of spiders) {
      const r = sp.r;
      // flee the cursor
      if (sp.kind === 'hang' && !sp.fleeing) {
        const sx = sp.n.offsetLeft, sy = sp.len + 12;
        if (Math.hypot(ptr.x - sx, ptr.y - sy) < 120) {
          sp.fleeing = true; sp.moving = true; sp.target = 12; sp.speed = 260 + r() * 80; sp.rotT = 0;
          sp.n.classList.add('hw-moving', 'hw-fleeing');
        }
      } else if (sp.kind === 'crawl' && !sp.scared) {
        const [cx, cy] = crawlPos(sp.t);
        if (Math.hypot(ptr.x - cx, ptr.y - cy) < 120) {
          const [ax] = crawlPos(Math.min(.95, sp.t + .05)); sp.dir = (Math.abs(ax - ptr.x) > Math.abs(cx - ptr.x)) ? 1 : -1;
          sp.goal = sp.dir > 0 ? .95 : .1; sp.speed = .5; sp.moving = true; sp.scared = true; sp.n.classList.add('hw-moving', 'hw-fleeing');
        }
      }
      if (now > sp.next && !sp.moving) { // pick a new action
        if (sp.kind === 'hang') {
          const a = r();
          if (a < 0.42) sp.target = Math.min(sp.max, sp.len + 8 + r() * 28);        // short drop burst
          else if (a < 0.7) sp.target = Math.max(sp.min, sp.len - 10 - r() * 35);   // climb back up
          else { sp.next = now + 1200 + r() * 3200; sp.rotT = (r() - .5) * 16; continue; } // rest, slight turn
          sp.speed = sp.target > sp.len ? 40 + r() * 50 : 18 + r() * 18;            // px/s; climbing is slower
          if (sp.creep) { sp.creep = false; sp.target = sp.home; sp.speed = 14 + r() * 8; }
          sp.moving = true;
        } else {
          if (r() < .35) sp.dir *= -1;
          sp.goal = Math.min(.95, Math.max(.1, sp.t + sp.dir * (.08 + r() * .25)));
          sp.dir = Math.sign(sp.goal - sp.t) || 1; sp.speed = .05 + r() * .06; sp.moving = true;
        }
        sp.n.classList.add('hw-moving');
      }
      if (sp.kind === 'hang') {
        if (sp.moving) {
          const d = sp.target - sp.len, st = Math.sign(d) * Math.min(Math.abs(d), sp.speed * dt);
          sp.len += st;
          if (Math.abs(sp.target - sp.len) < .3) { sp.moving = false; sp.av += (st > 0 ? 1 : -1) * (6 + r() * 10); // kick → pendulum
            sp.n.classList.remove('hw-moving', 'hw-fleeing');
            if (sp.fleeing) { sp.fleeing = false; sp.next = now + 3000 + r() * 3000; // hide a while, then creep down slowly
              sp.creep = true; } else sp.next = now + 500 + r() * 2500; }
        }
        // damped pendulum; longer thread → slower swing
        const k = 9000 / (sp.len + 60) / 60, damp = 1.6;
        sp.av += (-k * sp.ang - damp * sp.av) * dt; sp.ang += sp.av * dt * 4;
        sp.rot += (sp.rotT - sp.rot) * Math.min(1, dt * 2);
        applyHang(sp);
      } else if (sp.moving) {
        sp.t += sp.dir * sp.speed * dt;
        if ((sp.dir > 0 && sp.t >= sp.goal) || (sp.dir < 0 && sp.t <= sp.goal)) { sp.t = sp.goal; sp.moving = false;
          sp.next = now + 700 + r() * 3000; sp.scared = false; sp.n.classList.remove('hw-moving', 'hw-fleeing'); }
        applyCrawl(sp);
      }
    }
  }
  function startSpiders() {
    if (reduceMotion || rafId) return;
    let last = performance.now();
    let lastCat = 0;
    const loop = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; stepSpiders(now, dt);
      if (now - lastCat > 120) { lastCat = now; turnCats(); }
      rafId = requestAnimationFrame(loop); };
    rafId = requestAnimationFrame(loop);
  }
  // cats glance toward the cursor; the dangling skeleton chatters when it's close
  function turnCats() {
    if (ptr.x < -1000) return;
    document.querySelectorAll('.hw-eyes, .hw-mummy').forEach(eg => {
      const r = eg.getBoundingClientRect(); if (!r.width) return;
      const dx = ptr.x - (r.left + r.width / 2), dy = ptr.y - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, m = eg.classList.contains('hw-mummy') ? 1.6 : 3.2;
      const tf = `translate(${(dx / d * m).toFixed(2)}px,${(dy / d * m * .6).toFixed(2)}px)`;
      eg.querySelectorAll('.hw-pupil').forEach(p => { p.style.transform = tf; });
    });
    const sk = document.querySelector('.hw-skel-hang');
    if (sk) { const r = sk.getBoundingClientRect(); sk.classList.toggle('hw-chatter', Math.hypot(ptr.x - (r.left + r.width / 2), ptr.y - (r.top + r.height * .6)) < 130); }
    document.querySelectorAll('.hw-cat').forEach(c => {
      const r = c.getBoundingClientRect(); if (!r.width) return;
      const dx = ptr.x - (r.left + r.width / 2), dy = ptr.y - r.top;
      const ang = Math.max(-14, Math.min(14, dx / 25)), tilt = Math.max(-4, Math.min(4, dy / 80));
      const h = c.querySelector('.hw-cat-head'); if (h) h.style.transform = `rotate(${(ang + tilt).toFixed(1)}deg)`;
    });
  }
  let boltTimer = 0;
  function scheduleLightning(first) {
    if (reduceMotion) return;
    boltTimer = setTimeout(() => {
      if (!enabled || !root) return;
      const f = root.querySelector('.hw-flash'), b = root.querySelector('.hw-bolt');
      if (b) b.style.left = (15 + Math.random() * 65).toFixed(0) + '%';
      [f, b].forEach(n => { if (!n) return; n.classList.remove('hw-strike'); void n.offsetWidth; n.classList.add('hw-strike'); });
      scheduleLightning(false);
    }, first ? 6000 + Math.random() * 6000 : 30000 + Math.random() * 30000);
  }
  function stopSpiders() { cancelAnimationFrame(rafId); rafId = 0; spiders.length = 0; }

  function webSVG(s, flip) { // fine radial corner web with sagging concentric threads
    const spokes = 9, rings = 8; let p = '';
    const ang = i => (i / spokes) * Math.PI / 2;
    for (let i = 0; i <= spokes; i++) p += `M0,0 L${f1(Math.cos(ang(i)) * s)},${f1(Math.sin(ang(i)) * s)} `;
    for (let k = 1; k <= rings; k++) {
      const rr = Math.pow(k / rings, 1.15) * s * .97; p += 'M';
      for (let i = 0; i <= spokes; i++) {
        const x = Math.cos(ang(i)) * rr, y = Math.sin(ang(i)) * rr;
        if (i === 0) { p += `${f1(x)},${f1(y)} `; continue; }
        const am = ang(i - .5), sag = rr * (.8 + (k % 3) * .03);
        p += `Q${f1(Math.cos(am) * sag)},${f1(Math.sin(am) * sag)} ${f1(x)},${f1(y)} `;
      }
    }
    return `<svg xmlns="${NS}" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="transform:${flip}"><path d="${p}" stroke="#c9c9d2" stroke-width=".6" fill="none" opacity=".42"/></svg>`;
  }
  // small white cartoon ghost: round head, little arms, wavy tail, dark oval eyes + mouth
  const miniGhostSVG = (s = 24) => `<svg xmlns="${NS}" width="${s}" height="${s}" viewBox="0 0 40 40">
    <defs><radialGradient id="mg${++uid}" cx=".45" cy=".35" r=".7"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#dcdcf0"/></radialGradient></defs>
    <path d="M20 4 C28.5 4 32.5 10.5 32.5 18.5 L36.5 16.5 C38.6 15.6 39.6 18.6 37.8 19.8 L32.5 23.5 L32.5 30.5 C32.5 33.8 30 35 28.6 32.8 C27 35.8 23.8 35.8 22.8 33.4 C21.2 36.6 18.4 36.6 17.2 33.4 C15.8 35.8 12.8 35.6 11.4 32.8 C9.6 34.4 7.5 33 7.5 30.5 L7.5 23.5 L2.2 19.8 C0.4 18.6 1.4 15.6 3.5 16.5 L7.5 18.5 C7.5 10.5 11.5 4 20 4Z" fill="url(#mg${uid})"/>
    <ellipse cx="16.3" cy="16" rx="2" ry="3" fill="#1b1622"/><ellipse cx="23.7" cy="16" rx="2" ry="3" fill="#1b1622"/><ellipse cx="20" cy="24" rx="2.1" ry="3" fill="#1b1622"/></svg>`;
  // large faint gray background ghost with a flowing, wispy tail
  const ghostSVG = (s, op = 0.12) => `<svg xmlns="${NS}" width="${s}" height="${f1(s * .9)}" viewBox="0 0 100 90" opacity="${op}">
    <path d="M28 12 C40 1 64 3 70 24 C74 38 70 50 78 60 C84 68 92 72 100 74 C88 80 74 78 64 72 C60 79 50 84 41 80 C36 78 33 72 26 74 C17 77 8 72 3 64 C11 64 15 60 17 52 C20 38 16 22 28 12Z" fill="#cfcfd8"/>
    <ellipse cx="38" cy="30" rx="4" ry="6.5" transform="rotate(-18 38 30)" fill="#141218"/><ellipse cx="54" cy="27" rx="4" ry="6.5" transform="rotate(-18 54 27)" fill="#141218"/>
    <ellipse cx="47" cy="45" rx="3.5" ry="5" transform="rotate(-15 47 45)" fill="#141218"/></svg>`;
  // witch on a broomstick: pointy hat, flowing cape, bristles
  const witchSVG = () => `<svg xmlns="${NS}" width="120" height="70" viewBox="0 0 120 70">
    <g fill="#0c0a10">
      <path d="M8 46 L92 38 L93 41 L9 49Z"/>
      <path d="M90 36 C98 33 106 34 116 30 C110 37 104 41 92 43Z"/>
      <path d="M8 44 C2 42 -2 45 -4 48 C1 48 4 50 9 50Z M6 46 C0 49 -3 53 -4 56 M7 47 C2 52 1 56 1 60" stroke="#0c0a10" stroke-width="1.3"/>
      <path class="hw-cape" d="M44 22 C36 28 30 38 20 42 C14 44 6 40 2 34 C10 34 16 32 22 26 C28 20 34 16 44 16Z"/>
      <path d="M40 16 C40 8 48 6 52 12 L56 30 C54 38 46 42 40 40 C36 32 38 24 40 16Z"/>
      <circle cx="50" cy="12" r="5"/>
      <path d="M40 9 L64 6 L60 9 L46 11Z"/><path d="M47 8 L52 -14 L56 7Z"/>
      <path d="M52 30 L66 38 L62 40 L50 34Z"/><path d="M48 38 L54 46 L50 47 L45 40Z"/>
    </g></svg>`;
  // black cat with glowing eyes; tail and head are separate groups for animation
  const catSVG = (s = 46) => `<svg xmlns="${NS}" width="${s}" height="${s}" viewBox="0 0 50 50" overflow="visible">
    <g fill="#060508">
      <path class="hw-cat-tail" d="M33 44 C42 44 46 38 44 30 C43 25 46 22 48 23 C45 26 47 32 48 36 C49 44 42 49 33 48Z"/>
      <path d="M14 48 C10 40 12 28 20 24 C27 21 34 26 35 34 C36 41 35 46 33 48Z"/>
      <g class="hw-cat-head"><path d="M13 22 C11 14 12 9 14 4 L19 10 C22 9 25 9 28 10 L33 4 C35 9 36 14 34 22 C32 28 16 28 13 22Z"/>
      <g class="hw-cat-eyes"><ellipse cx="19" cy="17" rx="2.6" ry="2.2" fill="#c8f03c"/><ellipse cx="28" cy="17" rx="2.6" ry="2.2" fill="#c8f03c"/>
      <ellipse cx="19" cy="17" rx=".8" ry="2" fill="#0a0a0a"/><ellipse cx="28" cy="17" rx=".8" ry="2" fill="#0a0a0a"/></g></g>
    </g></svg>`;
  // purple string of lights around the whole viewport border: wire flush to the edges, small sags between clip points
  function lightsSVG(W, H) {
    const cols = ['#a855f7', '#c084fc', '#d946ef', '#8b5cf6', '#a855f7', '#e879f9'], SAG = 7, CLIP = 150, GAP = 40;
    let k = 0, out = '';
    // an edge from (x0,y0) to (x1,y1); (nx,ny) = inward normal
    const edge = (x0, y0, x1, y1, nx, ny, cls) => {
      const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      const segs = Math.max(1, Math.round(L / CLIP)), sl = L / segs;
      const at = t => { const local = (t % sl) / sl, sag = SAG * 4 * local * (1 - local); // parabola between clips
        return [x0 + ux * t + nx * (1.5 + sag), y0 + uy * t + ny * (1.5 + sag)]; };
      let d = ''; for (let i = 0, n = Math.ceil(L / 6); i <= n; i++) { const [x, y] = at(Math.min(L, i * L / n)); d += (i ? 'L' : 'M') + f1(x) + ',' + f1(y); }
      const nb = Math.max(1, Math.round(L / GAP)), step = L / nb, rot = Math.atan2(ny, nx) * 180 / Math.PI - 90;
      let bulbs = '';
      for (let i = 0; i < nb; i++) {
        const [x, y] = at(step * (i + .5)), c = cols[k % cols.length];
        bulbs += `<g transform="translate(${f1(x)},${f1(y)}) rotate(${f1(rot)})"><rect x="-1.6" y="0" width="3.2" height="3.5" rx=".6" fill="#2a2030"/>
          <ellipse class="hw-bulb" cx="0" cy="7.5" rx="3.3" ry="4.4" fill="${c}" style="animation-duration:${(2.2 + (k * 0.71) % 2.4).toFixed(2)}s;animation-delay:${(-(k * 1.37) % 3).toFixed(2)}s"/>
          <ellipse cx="-1" cy="6" rx=".9" ry="1.5" fill="#fff" opacity=".55"/></g>`; k++;
      }
      return `<g class="hw-ledge ${cls}"><path d="${d}" stroke="#241c2a" stroke-width="1.3" fill="none"/>${bulbs}</g>`;
    };
    out += edge(0, 0, W, 0, 0, 1, 'hw-ledge-t') + edge(W, 0, W, H, -1, 0, 'hw-ledge-r') + edge(W, H, 0, H, 0, -1, 'hw-ledge-b') + edge(0, H, 0, 0, 1, 0, 'hw-ledge-l');
    // corner clips so the wire wraps naturally
    const clip = (x, y) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#241c2a"/>`;
    out += clip(1.5, 1.5) + clip(W - 1.5, 1.5) + clip(W - 1.5, H - 1.5) + clip(1.5, H - 1.5);
    return `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${out}</svg>`;
  }
  // cartoon skeleton: off-white bones, soft gray shading, dark sockets; arm + jaw are separate groups for animation
  const skeletonSVG = (s = 60, legs = true) => `<svg xmlns="${NS}" width="${s}" height="${f1(s * (legs ? 1.6 : 1.15))}" viewBox="0 0 60 ${legs ? 96 : 69}" overflow="visible">
    <defs><radialGradient id="sk${++uid}" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#f6f3ea"/><stop offset=".7" stop-color="#e2ddd0"/><stop offset="1" stop-color="#b9b3a6"/></radialGradient></defs>
    <g stroke="#e9e5da" stroke-linecap="round" fill="none">
      <path d="M30 30 V58" stroke-width="3.2"/>
      <path d="M21 36 Q30 33 39 36 M20 41 Q30 38 40 41 M21 46 Q30 43.5 39 46 M23 51 Q30 49 37 51" stroke-width="2.2"/>
      <path d="M21 33 L14 44 L12 54" stroke-width="2.4"/><circle cx="11.5" cy="56" r="2.2" fill="#e9e5da" stroke="none"/>
      <g class="hw-skel-arm"><path d="M39 33 L47 25 L52 15" stroke-width="2.4"/><path d="M52 15 L50 10 M52 15 L53 9.5 M52 15 L55.5 11" stroke-width="1.4"/></g>
      ${legs ? '<path d="M25 64 L23 78 L24 92 M35 64 L37 78 L36 92" stroke-width="2.6"/><path d="M24 92 L19 94 M36 92 L41 94" stroke-width="2.2"/>' : ''}
    </g>
    ${legs ? '<path d="M22 58 C22 55 38 55 38 58 C38 63 34 66 30 64 C26 66 22 63 22 58Z" fill="#e2ddd0"/>' : ''}
    <path d="M17 15 C17 6 23 1 30 1 C37 1 43 6 43 15 C43 20 41 23 38 24 L22 24 C19 23 17 20 17 15Z" fill="url(#sk${uid})"/>
    <ellipse cx="24.5" cy="14" rx="3.6" ry="4.2" fill="#17131c"/><ellipse cx="35.5" cy="14" rx="3.6" ry="4.2" fill="#17131c"/>
    <ellipse cx="24" cy="13" rx="1" ry="1.2" fill="#c8f03c" opacity=".55"/><ellipse cx="35" cy="13" rx="1" ry="1.2" fill="#c8f03c" opacity=".55"/>
    <path d="M30 17.5 L28.4 21 H31.6Z" fill="#2a2430"/>
    <g class="hw-skel-jaw"><path d="M22 24 H38 C38 28 35 30 30 30 C25 30 22 28 22 24Z" fill="#dcd7c9"/>
      <path d="M25 24 V26.5 M28.3 24 V27 M31.7 24 V27 M35 24 V26.5" stroke="#8d877c" stroke-width=".8"/></g>
    <ellipse cx="25" cy="6" rx="4" ry="2" fill="#fff" opacity=".45"/></svg>`;
  // --- zombie hand bursting from the ground, with dirt
  const zHandSVG = () => `<svg xmlns="${NS}" width="44" height="70" viewBox="0 0 44 70" overflow="visible">
    <path d="M14 70 V40 C12 34 8 30 6 24 C5 21 8 19 10 22 L14 29 L13 12 C13 9 17 9 17 12 L18 26 L19 8 C19 5 23 5 23 8 L23.5 26 L25 11 C25 8 29 8 29 11 L28.5 28 L31 18 C32 15 35.5 16 35 19 L32 38 C31 44 30 50 30 70Z" fill="#6f9a3e"/>
    <path d="M14 70 V44 C15 52 19 56 22 56 M17 40 L20 44" stroke="#4d6e27" stroke-width="1.4" fill="none"/>
    <path d="M18 34 C20 33 22 35 21 37" stroke="#8e3a2a" stroke-width="1.6" fill="none"/>
    <path d="M12 52 H32" stroke="#e8e2d0" stroke-width="3" opacity=".55"/></svg>`;
  const dirtHTML = () => Array.from({ length: 8 }, (_, i) => `<i style="--dx:${(i - 3.5) * 9}px;--dy:${-18 - (i % 3) * 10}px;animation-delay:${(i * .03).toFixed(2)}s"></i>`).join('');
  // --- shuffling zombie (cartoon silhouette with green skin, arms out)
  const zombieSVG = () => `<svg xmlns="${NS}" width="54" height="86" viewBox="0 0 54 86" overflow="visible">
    <g class="hw-z-legs"><path d="M20 58 L16 84 M32 58 L36 84" stroke="#2a2e24" stroke-width="6" stroke-linecap="round"/></g>
    <path d="M16 30 C16 26 36 26 37 30 L38 60 H15Z" fill="#3d4a5c"/><path d="M15 60 L20 54 L24 60 L29 55 L33 60 L38 55 V60Z" fill="#2c3646"/>
    <g class="hw-z-arms"><path d="M34 33 L54 35 M33 40 L53 42" stroke="#6f9a3e" stroke-width="5" stroke-linecap="round"/></g>
    <circle cx="27" cy="18" r="10" fill="#7aa645"/><path d="M19 12 C22 6 33 6 36 13" stroke="#3a4a22" stroke-width="3" fill="none"/>
    <circle cx="31" cy="17" r="2.6" fill="#f2f0d8"/><circle cx="31.5" cy="17.5" r="1" fill="#1a1a1a"/><circle cx="24" cy="18" r="1.6" fill="#1a1a1a"/>
    <path d="M24 24 L33 23" stroke="#2a3418" stroke-width="1.5"/></svg>`;
  // --- cauldron with bubbling goo
  const cauldronSVG = () => `<svg xmlns="${NS}" width="78" height="66" viewBox="0 0 78 66" overflow="visible">
    <ellipse cx="39" cy="22" rx="34" ry="8" fill="#5cc41f"/><ellipse cx="33" cy="20" rx="14" ry="3" fill="#a6ec6a" opacity=".6"/>
    ${[[24, 4.5, 0], [42, 3.5, .8], [54, 4, 1.6], [33, 3, 2.3]].map(([x, r, d]) => `<circle class="hw-bubble" cx="${x}" cy="20" r="${r}" fill="#7fdc3a" style="animation-delay:${d}s"/>`).join('')}
    <path d="M4 22 C4 46 16 60 39 60 C62 60 74 46 74 22 C66 28 12 28 4 22Z" fill="#141216"/>
    <path d="M10 30 C14 46 24 54 34 56" stroke="#3a3540" stroke-width="2" fill="none" opacity=".8"/>
    <path d="M14 58 L10 66 M64 58 L68 66" stroke="#141216" stroke-width="4" stroke-linecap="round"/>
    <path d="M2 22 C2 18 76 18 76 22 C76 26 2 26 2 22Z" fill="none" stroke="#25222a" stroke-width="3"/></svg>`;
  // --- candy
  const candyCornSVG = (s = 16, rot = 0) => `<svg xmlns="${NS}" width="${s}" height="${s}" viewBox="0 0 20 20" style="transform:rotate(${rot}deg)">
    <path d="M10 1 C13 6 17 13 17 16 C17 19 3 19 3 16 C3 13 7 6 10 1Z" fill="#f7f3e6"/><path d="M5.2 10 C8 9.2 12 9.2 14.8 10 C16 12.5 17 14.5 17 16 C17 19 3 19 3 16 C3 14.5 4 12.5 5.2 10Z" fill="#f08a2a"/>
    <path d="M3.6 14.4 C7 13.6 13 13.6 16.4 14.4 L17 16 C17 19 3 19 3 16Z" fill="#f2c94c"/></svg>`;
  const wrappedCandySVG = (s = 22, c = '#a855f7', rot = 0) => `<svg xmlns="${NS}" width="${s}" height="${f1(s * .55)}" viewBox="0 0 40 22" style="transform:rotate(${rot}deg)">
    <path d="M10 11 L1 3 L3 11 L1 19Z M30 11 L39 3 L37 11 L39 19Z" fill="${c}" opacity=".85"/><ellipse cx="20" cy="11" rx="10.5" ry="8" fill="${c}"/>
    <path d="M14 5 L18 17 M20 4 L24 17 M26 6 L28 13" stroke="#fff" stroke-opacity=".45" stroke-width="2"/><ellipse cx="16" cy="7.5" rx="3" ry="1.6" fill="#fff" opacity=".5"/></svg>`;
  // --- mummy wraps for a card corner (overlay layer); eyes peek between the wraps
  const mummySVG = () => `<svg xmlns="${NS}" width="70" height="70" viewBox="0 0 70 70" overflow="visible">
    <defs><linearGradient id="mw${++uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe9d8"/><stop offset="1" stop-color="#c9c1aa"/></linearGradient></defs>
    <g fill="url(#mw${uid})" stroke="#a69c84" stroke-width=".6">
      <path d="M-2 26 L26 -2 L36 -2 L-2 36Z"/><path d="M-2 48 L48 -2 L56 2 L2 56Z"/><path d="M8 62 L62 8 L64 16 L16 64Z" opacity=".95"/></g>
    <g class="hw-blinker"><ellipse cx="22" cy="31" rx="4" ry="3.2" fill="#fff6c8"/><ellipse cx="33" cy="20" rx="4" ry="3.2" fill="#fff6c8"/>
      <circle class="hw-pupil" cx="22" cy="31" r="1.7" fill="#1c1410"/><circle class="hw-pupil" cx="33" cy="20" r="1.7" fill="#1c1410"/></g>
    <path d="M-2 40 L40 -2" stroke="#16121a" stroke-width="2.4" opacity=".7"/></svg>`;
  // --- a pair of glowing eyes (pupils track the cursor)
  const eyesSVG = (col = '#ffd84a', blood = false) => `<svg xmlns="${NS}" width="46" height="20" viewBox="0 0 46 20" overflow="visible">
    <g class="hw-blinker">${[11, 35].map(x => `<ellipse cx="${x}" cy="10" rx="8.5" ry="6.5" fill="${blood ? '#f4efe6' : col}"/>
      ${blood ? `<path d="M${x - 8} 9 L${x - 4} 10 L${x - 2} 8 M${x + 8} 11 L${x + 4} 10 L${x + 5} 12" stroke="#c0392b" stroke-width=".6" fill="none"/>` : ''}
      <g class="hw-pupil"><ellipse cx="${x}" cy="10" rx="${blood ? 3.4 : 1.8}" ry="${blood ? 3.4 : 5}" fill="${blood ? '#3b7fd1' : '#120c06'}"/>${blood ? `<circle cx="${x}" cy="10" r="1.7" fill="#0c0c10"/>` : ''}</g>`).join('')}</g></svg>`;
  // --- lightning bolt
  const boltSVG = () => `<svg xmlns="${NS}" width="120" height="300" viewBox="0 0 120 300"><path d="M70 0 L42 110 L66 112 L30 220 L54 222 L22 300 L96 180 L70 178 L102 80 L78 78 L104 0Z" fill="#e9dcff" opacity=".7"/></svg>`;
  const batSVG = (s, op) => `<svg xmlns="${NS}" width="${s}" height="${s / 2}" viewBox="0 0 60 30" opacity="${op}">
    <g class="hw-wings"><path d="M30 12 C25 4 15 2 2 6 C8 9 9 13 8 17 C13 14 17 16 18 21 C22 16 26 17 30 20 C34 17 38 16 42 21 C43 16 47 14 52 17 C51 13 52 9 58 6 C45 2 35 4 30 12Z" fill="#0d0a10"/></g>
    <circle cx="30" cy="13" r="3.5" fill="#0d0a10"/></svg>`;
  const tombSVG = (s, op) => `<svg xmlns="${NS}" width="${s}" height="${s * 1.1}" viewBox="0 0 40 44" opacity="${op}">
    <path d="M6 42 V16 C6 6 13 2 20 2 C27 2 34 6 34 16 V42Z" fill="#8a8a96"/><path d="M14 18 H26 M20 12 V28" stroke="#55555f" stroke-width="2.5"/><rect x="2" y="40" width="36" height="4" rx="2" fill="#3c4a30"/></svg>`;
  // low-contrast graveyard (left) + haunted house (right) silhouette, drawn behind card content
  const hauntedSVG = (w, h) => `<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="0 0 400 64" preserveAspectRatio="none">
    <g fill="#08070a" opacity=".95">
    <path d="M0 64 V52 C40 46 80 50 130 53 C190 56 240 50 300 51 C340 52 370 48 400 50 V64Z"/>
    <path d="M8 56 V36 C8 30 12 27 17 27 C22 27 26 30 26 36 V56Z"/><path d="M15.5 27 V18 M12 21 H19" stroke="#0b0a0e" stroke-width="2.2"/>
    <path d="M34 56 V44 C34 41 36 40 39 40 H46 C49 40 51 41 51 44 V56Z"/><path d="M58 50 L66 38 M58 42 L66 46" stroke="#0b0a0e" stroke-width="2"/>
    <path d="M76 55 V45 C76 42 78 41 81 41 C84 41 86 42 86 45 V55Z"/>
    <path d="M296 54 V44 H300 V40 H303 V44 H307 V54Z"/><path d="M316 53 V40 M311 45 H321" stroke="#0b0a0e" stroke-width="1.8"/>
    <path d="M334 52 V30 L340 24 V12 L344 4 L348 12 V24 L354 30 V36 H362 V26 L367 18 L372 26 V36 L380 36 L380 52Z"/>
    <path d="M386 52 V40 L390 34 L394 40 V52Z"/></g>
    <g fill="#3a2a18" opacity=".7" class="hw-window"><rect x="342.5" y="16" width="3" height="4"/><rect x="365.5" y="30" width="3" height="4"/><rect x="345" y="38" width="4" height="5"/></g></svg>`;

  /* ---------- page-level layer ---------- */
  function el(tag, cls, html, style) {
    const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; if (style) e.style.cssText = style; return e;
  }
  function buildRoot() {
    root = el('div', 'hw-root'); root.setAttribute('aria-hidden', 'true');
    root.appendChild(el('div', 'hw-grade'));
    root.appendChild(el('div', 'hw-fog hw-fog1')); root.appendChild(el('div', 'hw-fog hw-fog2'));
    root.appendChild(el('div', 'hw-vignette')); root.appendChild(el('div', 'hw-grain'));
    const bg = el('div', 'hw-bg');
    const bgItems = [
      ['ghost', 63, 46, 110, .13], ['ghost', 67, 84, 120, .12], ['ghost', 8, 40, 70, .08],
      ['bat', 74, 50, 120, .45], ['bat', 82, 47, 60, .4], ['bat', 25, 23, 40, .35], ['bat', 52, 60, 45, .3],
      ['tomb', 3, 88, 40, .12], ['tomb', 93, 90, 34, .1]
    ];
    bgItems.forEach(([k, x, y, s, op], i) => {
      const html = k === 'ghost' ? ghostSVG(s, op) : k === 'bat' ? batSVG(s, op) : tombSVG(s, op);
      bg.appendChild(el('div', `hw-${k} hw-float`, html, `left:${x}%;top:${y}%;animation-delay:${-i * 1.7}s`));
    });
    bg.appendChild(el('div', 'hw-bat hw-flyer', batSVG(46, .7), 'top:22%'));
    root.appendChild(bg);
    cardLayer = el('div', 'hw-cardlayer'); root.appendChild(cardLayer);
    // top band
    const w = innerWidth, band = el('div', 'hw-topband');
    const split = Math.round(w * .52), gapPx = 6; // orange left → ~middle, green right, clean separation
    band.appendChild(el('div', 'hw-seg hw-glow', slimeSVG(split, 'orange', 3, 'top', { h: 7, maxLen: 34 }), 'left:0'));
    band.appendChild(el('div', 'hw-seg hw-glow', slimeSVG(w - split - gapPx, 'green', 4, 'top', { h: 7, maxLen: 36 }), `left:${split + gapPx}px`));
    root.appendChild(band);
    // corner webs
    root.appendChild(el('div', 'hw-web', webSVG(170, 'scaleX(-1)'), 'right:0;top:0'));
    root.appendChild(el('div', 'hw-web', webSVG(150, 'none'), 'left:0;top:0'));
    root.appendChild(el('div', 'hw-web', webSVG(180, 'scale(-1,-1)'), 'right:0;bottom:0'));
    root.appendChild(el('div', 'hw-web', webSVG(150, 'scaleY(-1)'), 'left:0;bottom:0'));
    // spiders
    stopSpiders();
    [[8, 70], [39, 50], [70, 70], [85, 82]].forEach(([x, len], i) => addHanging(x, len, 101 + i * 37)); // fixed seeds
    addCrawler(977);
    startSpiders();
    // purple string of lights just under the slime band
    // sized to the layout viewport (clientWidth/Height exclude scrollbars, so they stay uncovered)
    root.appendChild(el('div', 'hw-lights', lightsSVG(document.documentElement.clientWidth, document.documentElement.clientHeight)));
    // faint moon + witch crossing on an arc every ~20-40s (pure CSS keyframes)
    root.insertBefore(el('div', 'hw-moon'), root.querySelector('.hw-bg').nextSibling);
    const sparks = Array.from({ length: 7 }, (_, i) => `<i style="left:${-8 - i * 12}px;top:${44 + (i % 3) * 4}px;animation-delay:${(i * .12).toFixed(2)}s"></i>`).join('');
    root.querySelector('.hw-bg').appendChild(el('div', 'hw-witch', `${witchSVG()}<div class="hw-sparks">${sparks}</div>`));
    // skeleton peeking up from the bottom edge (CSS cycle: rises, waves, sinks)
    root.appendChild(el('div', 'hw-skel hw-skel-peek', skeletonSVG(64, false)));
    // small skeleton dangling from the top border lights; chatters + waves when the cursor comes near
    root.appendChild(el('div', 'hw-skel hw-skel-hang', `<div class="hw-skel-cord"></div>${skeletonSVG(38, true)}`));
    // zombie hand bursting from the bottom edge (CSS cycle) + shuffling zombie (CSS cycle)
    root.appendChild(el('div', 'hw-zhand', `${zHandSVG()}<div class="hw-dirt">${dirtHTML()}</div>`));
    root.appendChild(el('div', 'hw-zombie', zombieSVG()));
    // cauldron in the bottom-right corner (clear of the cat at left and the peeker at 62%)
    root.appendChild(el('div', 'hw-cauldron', `<div class="hw-steam"></div>${cauldronSVG()}`));
    // a little candy scattered along the bottom edge + one that occasionally tumbles down
    [['corn', 19, 14, -20], ['wrap', 47, 22, 10, '#a855f7'], ['corn', 54, 13, 25], ['wrap', 78, 20, -15, '#f08a2a']].forEach(([k, x, sz, rot, c]) =>
      root.appendChild(el('div', 'hw-candy', k === 'corn' ? candyCornSVG(sz, rot) : wrappedCandySVG(sz, c, rot), `left:${x}%`)));
    root.appendChild(el('div', 'hw-candy-fall', candyCornSVG(16, 0)));
    // eyes in dark spots that follow the cursor (capped at 3 pairs)
    [['6%', '52%', '#ffd84a', false], ['91%', '58%', '#9cff4a', false], ['30%', '74%', '', true]].forEach(([x, y, c, b], i) =>
      root.appendChild(el('div', 'hw-eyes', eyesSVG(c, b), `left:${x};top:${y};--bd:${(4 + i * 1.7).toFixed(1)}s`)));
    // lightning: flash overlay + faint bolt (scheduled in JS, randomised 30-60s)
    root.insertBefore(el('div', 'hw-bolt', boltSVG()), root.querySelector('.hw-bg').nextSibling);
    root.appendChild(el('div', 'hw-flash'));
    // black cat sitting in the bottom-left corner
    root.appendChild(el('div', 'hw-cat hw-cat-corner', catSVG(52)));
    // peeking ghost
    root.appendChild(el('div', 'hw-peek', miniGhostSVG(30), 'right:22px;top:118px'));
    document.documentElement.appendChild(root);
  }

  /* ---------- heuristics ---------- */
  function isCard(e, cs, r) {
    if (r.width < 160 || r.height < (r.width > 500 ? 28 : 60) || r.width > innerWidth * 0.95 || r.height > 900) return false;
    if (parseFloat(cs.borderTopLeftRadius) < 3) return false;
    const border = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(cs.borderTopColor);
    const shadow = cs.boxShadow && cs.boxShadow !== 'none';
    if (!border && !shadow) return false;
    if (/^(BUTTON|INPUT|SELECT|TEXTAREA|A|IMG|svg|LABEL|LI|TD|TR|NAV|HTML|BODY)$/i.test(e.tagName)) return false;
    if (cs.position === 'fixed' || cs.position === 'sticky') return false;
    return true;
  }
  const isDashed = cs => cs.borderTopStyle === 'dashed' || cs.borderTopStyle === 'dotted';
  function ensurePositioned(e, cs) {
    if (cs.position === 'static') { touched.push([e, e.style.cssText]); e.style.position = 'relative'; }
  }

  /* ---------- overlay layer: decorations live outside cards so overflow:hidden never clips them ---------- */
  const tracked = []; // {target, node, kind:'card'|'bar', clipEl, h}
  let syncQueued = false;
  function scrollClipOf(e) { // nearest ancestor that clips (scroll container / overflow hidden)
    for (let p = e.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const o = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(o.overflowY + o.overflowX)) return p;
    }
    return null;
  }
  // hidden menus/popovers (opacity 0, visibility hidden, display none) must not show decorations
  const shown = e => (e.checkVisibility ? e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : e.offsetParent !== null);
  function syncOverlay() {
    syncQueued = false; if (!enabled) return;
    for (let k = tracked.length - 1; k >= 0; k--) {
      const t = tracked[k];
      if (!t.target.isConnected) { t.node.remove(); tracked.splice(k, 1); continue; }
      const r = t.target.getBoundingClientRect();
      const vis = r.width > 0 && r.height > 0 && r.bottom > -60 && r.top < innerHeight + 60 && shown(t.target);
      t.node.style.display = vis ? '' : 'none'; if (!vis) continue;
      if (t.kind === 'bar') { // re-measure fill each sync so changing progress updates the slime
        const f = measureFill(t.target, r);
        if (Math.abs(f.w - t.fw) > 2) { t.fw = f.w; renderBar(t); }
        t.node.style.transform = `translate(${f.x.toFixed(1)}px,${(r.top + (r.height - t.h) / 2).toFixed(1)}px)`;
      } else t.node.style.transform = `translate(${r.left.toFixed(1)}px,${r.top.toFixed(1)}px)`;
      t.node.style.width = r.width + 'px'; t.node.style.height = r.height + 'px';
      if (t.clipEl) { // clip to the scroll container, with headroom for overhanging toppers
        const c = t.clipEl.getBoundingClientRect(), top = c.top - r.top + (c.top > 1 ? 0 : -60);
        t.node.style.clipPath = `inset(${Math.max(-60, top).toFixed(0)}px ${Math.max(-40, r.right - c.right).toFixed(0)}px ${Math.max(-60, r.bottom - c.bottom).toFixed(0)}px ${Math.max(-40, c.left - r.left).toFixed(0)}px)`;
      }
    }
  }
  const queueSync = () => { if (!syncQueued) { syncQueued = true; requestAnimationFrame(syncOverlay); } };
  let ro = null;
  function track(target, node, kind, extra = {}) {
    const t = { target, node, kind, clipEl: scrollClipOf(target), ...extra };
    cardLayer.appendChild(node); tracked.push(t);
    ro = ro || new ResizeObserver(queueSync); ro.observe(target);
    return t;
  }

  function decorateCards() {
    let count = document.querySelectorAll('.hw-card-deco').length;
    const all = document.body.querySelectorAll('div,section,article,aside,main,form,header,fieldset');
    const cards = [];
    for (const e of all) {
      if (count + cards.length >= MAX_CARDS) break;
      if (decorated.has(e) || e.closest('.hw-root')) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 160 || r.height < 28) continue;
      const cs = getComputedStyle(e);
      if (!isCard(e, cs, r) || !shown(e)) continue;
      let p = e.parentElement, nested = false;
      while (p && p !== document.body) { if (decorated.has(p)) { nested = true; break; } p = p.parentElement; }
      if (nested) continue;
      cards.push([e, cs, r]);
      decorated.add(e);
    }
    cards.forEach(([e, cs, r]) => {
      const i = count++;
      touched.push([e, e.style.cssText]);
      if (isDashed(cs)) { // empty-state card → graveyard silhouette stays INSIDE, behind content
        ensurePositioned(e, cs);
        const h = el('div', 'hw-card-deco hw-haunt', hauntedSVG(r.width - 2, Math.min(r.height * .55, (r.width - 2) * .2)));
        e.style.setProperty('isolation', 'isolate'); e.insertBefore(h, e.firstChild); added.push(h); e.classList.add('hw-carded'); return;
      }
      const deco = el('div', 'hw-card-deco hw-ov');
      const pumpkin = (sz, extra = '') => el('div', 'hw-pumpkin' + extra, `<div class="hw-pk-halo"></div>${pumpkinSVG(sz)}`, `--d:${(2.6 + ((i * 0.37) % 1.4)).toFixed(2)}s;--dl:${(-(i * 1.13) % 3).toFixed(2)}s`);
      if (r.height < 72 && r.width > 500) { // banner/alert
        e.style.setProperty('border-color', COLORS.orange.mid, 'important');
        deco.appendChild(i % 2 ? el('div', 'hw-mini-ghost hw-in-banner', miniGhostSVG(26)) : pumpkin(28, ' hw-in-banner'));
        if (i === 0) deco.appendChild(el('div', 'hw-mummy', mummySVG()));
        e.classList.add('hw-carded'); e.dataset.hwSlime = 'orange'; track(e, deco, 'card'); return;
      }
      const ci = cardSeq++;
      const [border, slime, topper] = [['orange', 'orange', 'pumpkin'], ['purple', null, 'ghost+pumpkin'], ['green', 'green', 'none'],
        ['orange', 'orange', 'pumpkin'], ['purple', 'green', 'tomb'], ['green', 'green', 'pumpkin'], ['orange', 'orange', 'bat']][ci % 7];
      e.style.setProperty('border-color', COLORS[border].mid, 'important');
      e.classList.add('hw-carded'); e.dataset.hwSlime = slime || 'none';
      if (slime) {
        const sw = Math.round(Math.min(300, Math.max(110, r.width * (0.36 + (ci % 3) * 0.05))));
        deco.appendChild(el('div', 'hw-card-slime hw-glow', slimeSVG(sw, slime, ci + 11, 'card', { h: 13, maxLen: Math.min(40, r.height * .4), side: Math.min(16, r.height * .16) })));
      }
      if (topper.includes('pumpkin')) deco.appendChild(pumpkin(ci % 2 ? 26 : 30));
      if (topper.includes('ghost')) deco.appendChild(el('div', 'hw-mini-ghost', miniGhostSVG(24)));
      if (topper === 'tomb') deco.appendChild(el('div', 'hw-card-tomb', tombSVG(22, .95)));
      if (topper === 'bat') deco.appendChild(el('div', 'hw-card-bat', batSVG(30, .85)));
      if (topper === 'none') deco.appendChild(el('div', 'hw-cat hw-cat-card', catSVG(40)));
      if (ci === 1 || ci === 6) deco.appendChild(el('div', 'hw-mummy', mummySVG()));
      if (ci % 3 === 2) deco.appendChild(el('div', 'hw-card-web', webSVG(60, 'scaleX(-1)')));
      track(e, deco, 'card');
    });
  }

  const opaque = c => c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c);
  /* Measure the FILLED part of a progress track. Returns {x, w} in viewport px. */
  function measureFill(b, br = b.getBoundingClientRect()) {
    if (b.tagName === 'PROGRESS') return { x: br.left, w: br.width * (b.max ? Math.min(1, b.value / b.max) : 0) };
    const aria = b.getAttribute('aria-valuenow'), trackBg = getComputedStyle(b).backgroundColor;
    // find the coloured fill: a descendant with its own background whose rendered box (incl. transform scaleX) is inside the track
    let best = null;
    for (const d of b.querySelectorAll('*')) {
      if (d.closest('.hw-root')) continue;
      const dr = d.getBoundingClientRect(); if (dr.height < br.height * .4 || dr.height > br.height + 2) continue;
      const ds = getComputedStyle(d);
      if (!(opaque(ds.backgroundColor) && ds.backgroundColor !== trackBg) && ds.backgroundImage === 'none') continue;
      const w = Math.max(0, Math.min(br.right, dr.right) - Math.max(br.left, dr.left));
      if (!best || w > best.w) best = { x: Math.max(br.left, dr.left), w };
    }
    if (best) return best;
    if (aria != null && aria !== '') {
      const min = parseFloat(b.getAttribute('aria-valuemin') || 0), max = parseFloat(b.getAttribute('aria-valuemax') || 100);
      return { x: br.left, w: br.width * Math.min(1, Math.max(0, (parseFloat(aria) - min) / (max - min || 1))) };
    }
    return { x: br.left, w: 0 };
  }
  function renderBar(t) {
    t.node.innerHTML = t.fw >= 8 ? slimeSVG(t.fw, t.color, t.seed, 'bar', { h: t.h, maxLen: 12 }) : '';
  }
  function decorateBars() {
    let count = tracked.filter(t => t.kind === 'bar').length;
    const cands = new Set(document.querySelectorAll('progress,[role=progressbar]'));
    document.querySelectorAll('.hw-carded div, .hw-carded span').forEach(e => {
      if (cands.size > 200) return;
      const r = e.getBoundingClientRect();
      if (r.height >= 3 && r.height <= 14 && r.width >= 80 && e.firstElementChild && e.children.length <= 3) {
        const cs = getComputedStyle(e);
        if (parseFloat(cs.borderTopLeftRadius) >= 1 && opaque(cs.backgroundColor)) cands.add(e);
      }
    });
    // keep only outermost tracks: drop any candidate that sits inside another candidate (that's a fill, not a track)
    const list = [...cands].filter(c => ![...cands].some(o => o !== c && o.contains(c)));
    for (const b of list) {
      if (count >= MAX_BARS) break;
      if (barsDone.has(b) || b.closest('.hw-root')) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 60 || r.height > 24) continue;
      const card = b.closest('.hw-carded');
      let color = 'orange';
      if (card) { color = card.dataset.hwSlime || 'orange'; if (color === 'none') { barsDone.add(b); continue; } }
      barsDone.add(b); count++;
      const h = Math.min(11, Math.max(6, r.height + 2)); // goo thickness stays near the real bar height
      const node = el('div', 'hw-bar-slime hw-glow hw-ov');
      const t = track(b, node, 'bar', { color, seed: count + 101, h, fw: -99 });
      const f = measureFill(b, r); t.fw = f.w; renderBar(t);
      new MutationObserver(queueSync).observe(b, { attributes: true, subtree: true, attributeFilter: ['style', 'class', 'aria-valuenow', 'value'] });
    }
    queueSync();
  }

  function run() {
    if (!enabled || !document.body) return;
    observer && observer.disconnect();
    try { decorateCards(); decorateBars(); } catch (e) { /* never break the page */ }
    observer && observer.observe(document.body, { childList: true, subtree: true });
  }
  const schedule = () => { if (timer) return; timer = setTimeout(() => { timer = null; (window.requestIdleCallback || setTimeout)(run); }, 800); };

  function enable() {
    if (enabled) return; enabled = true;
    document.documentElement.classList.add('hw-on');
    buildRoot(); run();
    observer = new MutationObserver(muts => { if (muts.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && !(n.className + '').includes('hw-')))) schedule(); });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('scroll', queueSync, { capture: true, passive: true });
    if (!reduceMotion) document.addEventListener('pointermove', onPointer, { passive: true });
    scheduleLightning(true);
    addEventListener('resize', queueSync);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!enabled) return; root.remove(); buildRoot(); tracked.forEach(t => cardLayer.appendChild(t.node)); queueSync(); }, 400); });
    syncTimer = setInterval(queueSync, 500); // catches layout shifts that move cards without resizing them
  }
  function disable() {
    if (!enabled) return; enabled = false;
    observer && observer.disconnect(); observer = null;
    root && root.remove(); stopSpiders(); clearInterval(syncTimer); clearTimeout(boltTimer); tracked.splice(0);
    added.splice(0).forEach(n => n.remove());
    touched.reverse().splice(0).forEach(([e, s]) => { e.style.cssText = s; });
    document.querySelectorAll('.hw-carded').forEach(e => e.classList.remove('hw-carded'));
    document.documentElement.classList.remove('hw-on');
    location.reload(); // simplest way to reset WeakSets cleanly
  }
  function apply(d) {
    const off = d.hwGlobalOff || (d.hwDisabledHosts || []).includes(location.hostname);
    off ? disable() : enable();
  }
  chrome.storage.sync.get(['hwDisabledHosts', 'hwGlobalOff'], apply);
  chrome.storage.onChanged.addListener(() => chrome.storage.sync.get(['hwDisabledHosts', 'hwGlobalOff'], apply));
})();
