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
  let uid = 0, enabled = false, observer = null, timer = null, root = null;
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
  const SLIME = {
    // calibrated against reference pixels (orange mid ~#e96c1a, rim ~#9e4817; green mid ~#6cc338)
    orange: { hi: '#f08a2a', mid: '#e8650a', lo: '#b84a08', rim: '#6e2a06' },
    green:  { hi: '#7fdc3a', mid: '#5cc41f', lo: '#3c8f16', rim: '#3d5a12' },
    purple: { hi: '#d9b8ff', mid: '#9b5cf0', lo: '#5a2ca8', rim: '#3a1a70', glow: '#9b5cf0' }
  };
  function dripSVG(w, color, seed, { band = 10, maxLen = 40, density = 1, fall = true, side = 0, wave = 0.35, taper = 0, fat = 1 } = {}) {
    const mix = color === 'mix', id = ++uid, r = rng(seed * 7919 + 13);
    const c = SLIME[mix ? 'orange' : color];
    // colour for a drip at x (mix: noisy smoothstep orange→green across a wide middle zone)
    const pick = x => { if (!mix) return `url(#g${id})`; const f = x / w + (r() - .5) * .22;
      const t = Math.min(1, Math.max(0, (f - .34) / .32)); return r() < t * t * (3 - 2 * t) ? `url(#gG${id})` : `url(#gO${id})`; };
    const H = band + maxLen + 12 + side;
    // band with a wavy lower edge (top is flush with y=0, extended above to hide the goo blur edge)
    const th = xx => taper ? Math.max(0.12, Math.min(1, xx / (taper * w))) : 1; // band thickness ramp
    let d = `M-2,0 L${w + 3},0 L${w + 3},${band + side}`;
    if (side) d += ` C${w - 2},${band + side * 0.7} ${w - 3},${band + 4} ${w - 8},${band}`;
    const steps = Math.max(3, Math.round(w / 18));
    for (let i = steps - 1; i >= 0; i--) {
      const x = (i / steps) * w, y = band * th(x) * (1 - wave / 2 + r() * wave);
      d += ` Q${x + w / steps / 2},${y + band * th(x) * 0.25} ${x},${y}`;
    }
    d += ` L-2,${band * th(0)} Z`;
    let drips = '', drops = '', streaks = '';
    let x = 3 + r() * 6, n = 0;
    const xmax = w - (side ? 10 : 3);
    while (x < xmax) {
      const roll = (n++ % 4 === 2) ? 0.95 : r();
      const len = (roll < 0.45 ? 0.08 + r() * 0.2 : roll < 0.8 ? 0.3 + r() * 0.35 : 0.7 + r() * 0.3) * maxLen;
      const t = Math.min(band * 0.6, (2.6 + r() * 2.8) * fat + len * 0.05) * (taper ? Math.max(.5, th(x)) : 1); // half-width at root (thin streams)
      const tip = t * (0.55 + r() * 0.2); // teardrop end, only a little wider than the stream
      const y0 = band * th(x) * 0.6, yE = band * th(x) + len * (taper ? th(x) : 1);
      drips += `<path fill="${pick(x)}" d="M${x - t * 1.6},${y0} C${x - t * 0.6},${y0 + 2} ${x - t * 0.55},${yE - tip * 2} ${x - tip},${yE - tip * 0.6}
        A${tip},${tip * 1.15} 0 1 0 ${x + tip},${yE - tip * 0.6} C${x + t * 0.55},${yE - tip * 2} ${x + t * 0.6},${y0 + 2} ${x + t * 1.6},${y0} Z"/>`;
      if (len > maxLen * 0.3) streaks += `<path d="M${x - t * 0.35},${band + 1} L${x - tip * 0.35},${yE - tip * 0.9}" />`;
      if (fall && len > maxLen * 0.6 && r() < 0.35)
        drops += `<ellipse class="hw-drop" cx="${x}" cy="${yE + 1}" rx="${tip * 0.8}" ry="${tip}" fill="${mix ? (x / w > .5 ? SLIME.green.mid : SLIME.orange.mid) : c.mid}" style="animation-duration:${(6 + r() * 7).toFixed(1)}s;animation-delay:${(-r() * 9).toFixed(1)}s"/>`;
      x += (2 * t + 4 + r() * (len > maxLen * 0.5 ? 14 : 8)) / density;
    }
    const dur = (6 + r() * 4).toFixed(1);
    return `<svg xmlns="${NS}" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" style="overflow:visible">
    <defs>
      <linearGradient id="g${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${band + maxLen * 0.6}">
        <stop offset="0" stop-color="${c.hi}"/><stop offset=".25" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.lo}"/></linearGradient>
      ${['O', 'G'].map(k => { const q = SLIME[k === 'O' ? 'orange' : 'green']; return `<linearGradient id="g${k}${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${band + maxLen * 0.6}">
        <stop offset="0" stop-color="${q.hi}"/><stop offset=".25" stop-color="${q.mid}"/><stop offset="1" stop-color="${q.lo}"/></linearGradient>`; }).join('')}
      <linearGradient id="gH${id}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#e8650a"/><stop offset=".14" stop-color="#ee7a1c"/><stop offset=".26" stop-color="#e05f08"/>
        <stop offset=".37" stop-color="#ea6c10"/><stop offset=".43" stop-color="#b9a120"/><stop offset=".47" stop-color="#e3700e"/>
        <stop offset=".52" stop-color="#8fbf1f"/><stop offset=".56" stop-color="#d2861a"/><stop offset=".6" stop-color="#a9a21c"/><stop offset=".66" stop-color="#62c41f"/>
        <stop offset=".76" stop-color="#55b81c"/><stop offset=".88" stop-color="#6fd030"/><stop offset="1" stop-color="#5cc41f"/></linearGradient>
      <linearGradient id="sh${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${band * 1.1}">
        <stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a0d00" stop-opacity=".35"/></linearGradient>
      <filter id="f${id}" x="-5%" y="-30%" width="110%" height="160%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="b"/>
        <feColorMatrix in="b" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -9" result="goo"/>
        <feComposite in="SourceGraphic" in2="goo" operator="atop" result="body"/>
        <feOffset in="goo" dy="-2.5" result="up"/>
        <feComposite in="goo" in2="up" operator="out" result="rimA"/>
        <feGaussianBlur in="rimA" stdDeviation=".8" result="rimB"/>
        <feFlood flood-color="${mix ? '#5a3a0a' : c.rim}" flood-opacity=".9"/><feComposite in2="rimB" operator="in" result="rim"/>
        <feGaussianBlur in="goo" stdDeviation="1.8" result="bump"/>
        <feSpecularLighting in="bump" surfaceScale="4" specularConstant=".42" specularExponent="55" lighting-color="#fff" result="spec">
          <feDistantLight azimuth="240" elevation="30"/></feSpecularLighting>
        <feComposite in="spec" in2="goo" operator="in" result="specIn"/>
        <feGaussianBlur in="body" stdDeviation="2.2" result="gl"/>
        <feColorMatrix in="gl" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .32 0" result="glow"/>
        <feMerge><feMergeNode in="glow"/><feMergeNode in="body"/><feMergeNode in="rim"/><feMergeNode in="specIn"/></feMerge>
      </filter>
    </defs>
    <g filter="url(#f${id})" fill="url(#g${id})"><g class="hw-goo" style="animation-duration:${dur}s"><path d="${d}" fill="${mix ? `url(#gH${id})` : `url(#g${id})`}"/>${mix ? tongues(w, band, r, id) : ''}<path d="${d}" fill="url(#sh${id})"/>${drips}</g>${drops}</g>
    <g stroke="#fff" fill="none" stroke-linecap="round" pointer-events="none">
      <path d="M${taper ? w * taper * 0.6 : 2},${(band * 0.3).toFixed(1)} Q${w * 0.55},${band * 0.18} ${w * 0.55},${band * 0.34} T${w - 4},${band * 0.3}" stroke-opacity=".28" stroke-width=".9"/>
      <g class="hw-goo" style="animation-duration:${dur}s" stroke-opacity=".22" stroke-width=".8">${streaks}</g></g></svg>`;
  }

  // irregular interleaving blobs of the opposite colour near the orange/green boundary
  function tongues(w, band, r, id) {
    let o = '';
    for (let i = 0; i < 9; i++) {
      const f = .34 + r() * .32, green = r() < (f - .3) / .4;
      o += `<ellipse cx="${(f * w).toFixed(0)}" cy="${(band * (.35 + r() * .4)).toFixed(1)}" rx="${(10 + r() * 22).toFixed(0)}" ry="${(band * (.3 + r() * .3)).toFixed(1)}"
        fill="${green ? SLIME.green.mid : SLIME.orange.mid}" fill-opacity="${(.8 + r() * .2).toFixed(2)}"/>`;
    }
    return o;
  }
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

  const spiderSVG = () => `<svg xmlns="${NS}" width="30" height="30" viewBox="0 0 30 30" overflow="visible">
    <g stroke="#2a2a2a" stroke-width="1.8" fill="none" stroke-linecap="round">
    <g class="hw-legs hw-legs-l"><path d="M12 14 L4 8 L1 13 M12 18 L5 23 L3 28"/></g><g class="hw-legs hw-legs-l2"><path d="M12 16 L3 16 L1 21"/></g>
    <g class="hw-legs hw-legs-r"><path d="M18 14 L26 8 L29 13 M18 18 L25 23 L27 28"/></g><g class="hw-legs hw-legs-r2"><path d="M18 16 L27 16 L29 21"/></g></g>
    <ellipse cx="15" cy="18" rx="6" ry="7" fill="#151515" stroke="#3a3a3a" stroke-width=".6"/><circle cx="15" cy="10.5" r="4" fill="#1d1d1d"/>
    <circle cx="13.6" cy="10" r="1" fill="#ff3b1a"/><circle cx="16.4" cy="10" r="1" fill="#ff3b1a"/><ellipse cx="13" cy="16" rx="1.5" ry="2.5" fill="#fff" opacity=".18"/></svg>`;

  /* ---------- spider motion: seeded, JS-driven, transform-only ---------- */
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spiders = []; let rafId = 0;
  function addHanging(x, len, seed) {
    const n = el('div', 'hw-spider', `<div class="hw-thread"></div><div class="hw-sp-body">${spiderSVG()}</div>`, `left:${x}%`);
    root.appendChild(n);
    const sp = { kind: 'hang', n, thread: n.firstChild, body: n.lastChild, r: rng(seed), len, target: len, min: 25, max: 60 + (x % 30) * 4,
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
  function stepSpiders(now, dt) {
    for (const sp of spiders) {
      const r = sp.r;
      if (now > sp.next && !sp.moving) { // pick a new action
        if (sp.kind === 'hang') {
          const a = r();
          if (a < 0.42) sp.target = Math.min(sp.max, sp.len + 8 + r() * 28);        // short drop burst
          else if (a < 0.7) sp.target = Math.max(sp.min, sp.len - 10 - r() * 35);   // climb back up
          else { sp.next = now + 1200 + r() * 3200; sp.rotT = (r() - .5) * 16; continue; } // rest, slight turn
          sp.speed = sp.target > sp.len ? 40 + r() * 50 : 18 + r() * 18;            // px/s; climbing is slower
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
            sp.next = now + 500 + r() * 2500; sp.n.classList.remove('hw-moving'); }
        }
        // damped pendulum; longer thread → slower swing
        const k = 9000 / (sp.len + 60) / 60, damp = 1.6;
        sp.av += (-k * sp.ang - damp * sp.av) * dt; sp.ang += sp.av * dt * 4;
        sp.rot += (sp.rotT - sp.rot) * Math.min(1, dt * 2);
        applyHang(sp);
      } else if (sp.moving) {
        sp.t += sp.dir * sp.speed * dt;
        if ((sp.dir > 0 && sp.t >= sp.goal) || (sp.dir < 0 && sp.t <= sp.goal)) { sp.t = sp.goal; sp.moving = false;
          sp.next = now + 700 + r() * 3000; sp.n.classList.remove('hw-moving'); }
        applyCrawl(sp);
      }
    }
  }
  function startSpiders() {
    if (reduceMotion || rafId) return;
    let last = performance.now();
    const loop = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; stepSpiders(now, dt); rafId = requestAnimationFrame(loop); };
    rafId = requestAnimationFrame(loop);
  }
  function stopSpiders() { cancelAnimationFrame(rafId); rafId = 0; spiders.length = 0; }

  function webSVG(s, flip) {
    const spokes = 7, rings = 6; let p = '';
    for (let i = 0; i <= spokes; i++) { const a = (i / spokes) * Math.PI / 2; p += `M0,0 L${Math.cos(a) * s},${Math.sin(a) * s} `; }
    for (let k = 1; k <= rings; k++) {
      const rr = (k / rings) * s * 0.95; p += 'M';
      for (let i = 0; i <= spokes; i++) {
        const a = (i / spokes) * Math.PI / 2, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (i === 0) p += `${x},${y} `; else { const am = ((i - 0.5) / spokes) * Math.PI / 2, sag = rr * 0.86;
          p += `Q${Math.cos(am) * sag},${Math.sin(am) * sag} ${x},${y} `; }
      }
    }
    return `<svg xmlns="${NS}" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="transform:${flip}"><path d="${p}" stroke="#d8d8e0" stroke-width=".8" fill="none" opacity=".55"/></svg>`;
  }
  const ghostSVG = (s, op = 0.12) => `<svg xmlns="${NS}" width="${s}" height="${s * 1.2}" viewBox="0 0 50 60" opacity="${op}">
    <path d="M5 55 V24 C5 10 14 3 25 3 C36 3 45 10 45 24 V55 L39 50 L33 56 L27 50 L21 56 L15 50 L10 56Z" fill="#e8e8f0"/>
    <ellipse cx="18" cy="24" rx="3.5" ry="5" fill="#222"/><ellipse cx="32" cy="24" rx="3.5" ry="5" fill="#222"/><ellipse cx="25" cy="36" rx="3" ry="4" fill="#222"/></svg>`;
  const batSVG = (s, op) => `<svg xmlns="${NS}" width="${s}" height="${s / 2}" viewBox="0 0 60 30" opacity="${op}">
    <g class="hw-wings"><path d="M30 12 C25 4 15 2 2 6 C8 9 9 13 8 17 C13 14 17 16 18 21 C22 16 26 17 30 20 C34 17 38 16 42 21 C43 16 47 14 52 17 C51 13 52 9 58 6 C45 2 35 4 30 12Z" fill="#0d0a10"/></g>
    <circle cx="30" cy="13" r="3.5" fill="#0d0a10"/></svg>`;
  const tombSVG = (s, op) => `<svg xmlns="${NS}" width="${s}" height="${s * 1.1}" viewBox="0 0 40 44" opacity="${op}">
    <path d="M6 42 V16 C6 6 13 2 20 2 C27 2 34 6 34 16 V42Z" fill="#8a8a96"/><path d="M14 18 H26 M20 12 V28" stroke="#55555f" stroke-width="2.5"/><rect x="2" y="40" width="36" height="4" rx="2" fill="#3c4a30"/></svg>`;
  const hauntedSVG = (w, h) => `<svg xmlns="${NS}" width="${w}" height="${h}" viewBox="0 0 400 90" preserveAspectRatio="xMidYMax meet">
    <g fill="#08070a">
    <path d="M0 90 V82 Q60 74 120 80 T260 78 T400 80 V90Z"/>
    <path d="M14 82 V64 Q14 56 22 56 Q30 56 30 64 V82Z"/><path d="M44 82 V70 H56 V82Z"/><path d="M68 80 V58 H72 V64 H80 V68 H72 V80Z"/>
    <path d="M95 82 V66 Q95 60 101 60 Q107 60 107 66 V82Z"/>
    <path d="M250 80 V40 L262 30 V22 L266 18 L270 22 V30 L280 40 V48 L300 48 L312 36 L324 48 V80Z"/>
    <path d="M300 80 V20 L308 6 L316 20 V80Z"/><path d="M228 82 V66 H240 V82Z"/><path d="M340 82 V62 Q340 55 348 55 Q356 55 356 62 V82Z"/>
    <path d="M370 82 V60 H374 V66 H382 V70 H374 V82Z"/>
    <path d="M190 82 L196 50 L188 46 L198 44 L194 30 L204 42 L210 26 L208 46 L216 40 L206 52 L204 82Z"/></g>
    <g fill="#ff9a2a" class="hw-window"><rect x="304" y="26" width="6" height="8"/><rect x="258" y="54" width="7" height="8"/><rect x="290" y="56" width="7" height="8"/><rect x="266" y="36" width="5" height="6"/></g></svg>`;

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
    // top band
    const w = innerWidth, band = el('div', 'hw-topband');
    band.appendChild(el('div', 'hw-seg', dripSVG(w + 2, 'mix', 3, { band: 22, maxLen: 46, density: 0.7, wave: .65, fat: 1.5 }), 'left:-1px'));
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
    // peeking ghost
    root.appendChild(el('div', 'hw-peek', ghostSVG(44, .9), 'right:6px;top:205px'));
    document.documentElement.appendChild(root);
  }

  /* ---------- heuristics ---------- */
  function isCard(e, cs, r) {
    if (r.width < 160 || r.height < 60 || r.width > innerWidth * 0.95 || r.height > 900) return false;
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

  function decorateCards() {
    let count = document.querySelectorAll('.hw-card-deco').length;
    const all = document.body.querySelectorAll('div,section,article,aside,main,form,header,fieldset');
    const cards = [];
    for (const e of all) {
      if (count + cards.length >= MAX_CARDS) break;
      if (decorated.has(e) || e.closest('.hw-root')) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 160 || r.height < 60) continue;
      const cs = getComputedStyle(e);
      if (!isCard(e, cs, r)) continue;
      // skip if an ancestor is already a decorated card (avoid nested slime soup)
      let p = e.parentElement, nested = false;
      while (p && p !== document.body) { if (decorated.has(p)) { nested = true; break; } p = p.parentElement; }
      if (nested) continue;
      cards.push([e, cs, r]);
      decorated.add(e);
    }
    cards.forEach(([e, cs, r]) => {
      const i = count++;
      ensurePositioned(e, cs);
      touched.push([e, e.style.cssText]);
      if (isDashed(cs)) { // empty-state card → haunted house + graveyard
        const h = el('div', 'hw-card-deco hw-haunt', hauntedSVG(r.width - 4, Math.min(90, r.height * 0.55)));
        e.appendChild(h); added.push(h); e.classList.add('hw-carded'); return;
      }
      const kind = ['orange', 'purple', 'green', 'orange', 'green', 'orange', 'purple'][i % 7];
      e.style.setProperty('border-color', COLORS[kind].mid, 'important');
      e.style.setProperty('box-shadow', `0 0 0 1px ${COLORS[kind].mid}55, 0 0 14px ${COLORS[kind].glow}33`, 'important');
      e.classList.add('hw-carded');
      const deco = el('div', 'hw-card-deco');
      if (kind !== 'purple') {
        const sw = Math.round(Math.min(300, Math.max(110, r.width * (0.36 + (i % 3) * 0.06))));
        deco.appendChild(el('div', 'hw-card-slime', dripSVG(sw, kind, i + 11, { maxLen: Math.min(44, r.height * 0.42), density: 0.75, side: Math.min(22, r.height * 0.22), taper: .3, band: 15, fat: 1.3 })));
      }
      if (i % 3 !== 1) deco.appendChild(el('div', 'hw-pumpkin', `<div class="hw-pk-halo"></div>${pumpkinSVG(i % 2 ? 26 : 30)}`, `--d:${(2.6 + ((i * 0.37) % 1.4)).toFixed(2)}s;--dl:${(-(i * 1.13) % 3).toFixed(2)}s`));
      else if (kind === 'purple') deco.appendChild(el('div', 'hw-mini-ghost', ghostSVG(22, .9)));
      if (i % 4 === 2) deco.appendChild(el('div', 'hw-card-web', webSVG(60, 'scaleX(-1)')));
      e.appendChild(deco); added.push(deco);
    });
  }

  function barFill(b) {
    // Return [fillElement|null, fraction]
    if (b.tagName === 'PROGRESS') return [null, b.max ? b.value / b.max : 0];
    const now = parseFloat(b.getAttribute('aria-valuenow'));
    const max = parseFloat(b.getAttribute('aria-valuemax') || 100), min = parseFloat(b.getAttribute('aria-valuemin') || 0);
    const kid = b.firstElementChild;
    const br = b.getBoundingClientRect();
    if (kid) { const kr = kid.getBoundingClientRect(); if (kr.height > 0 && kr.width <= br.width + 1) return [kid, kr.width / br.width]; }
    if (!isNaN(now)) return [null, (now - min) / (max - min || 1)];
    return [null, 0];
  }
  function decorateBars() {
    let count = document.querySelectorAll('.hw-bar-slime').length;
    const cands = new Set(document.querySelectorAll('progress,[role=progressbar]'));
    document.querySelectorAll('.hw-carded div, .hw-carded span').forEach(e => {
      if (cands.size > 200) return;
      const r = e.getBoundingClientRect();
      if (r.height >= 3 && r.height <= 14 && r.width >= 80 && e.firstElementChild && e.children.length <= 2) {
        const cs = getComputedStyle(e);
        if (parseFloat(cs.borderTopLeftRadius) >= 1 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') cands.add(e);
      }
    });
    for (const b of cands) {
      if (count >= MAX_BARS) break;
      if (barsDone.has(b) || b.closest('.hw-root')) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 60 || r.height > 40) continue;
      barsDone.add(b); count++;
      const [, frac] = barFill(b);
      const card = b.closest('.hw-carded');
      let kind = 'orange';
      if (card) { const bc = card.style.borderColor; kind = /107, 224|6be03a/i.test(bc) ? 'green' : /155, 92|9b5cf0/i.test(bc) ? 'purple' : 'orange'; }
      if (kind === 'purple') kind = count % 2 ? 'green' : 'orange';
      const fw = Math.max(0, Math.round(r.width * Math.min(1, frac)));
      if (fw < 8) continue;
      const host = b.tagName === 'PROGRESS' ? b.parentElement : b;
      const hcs = getComputedStyle(host); ensurePositioned(host, hcs);
      const o = el('div', 'hw-bar-slime', dripSVG(fw, kind, count + 101, { band: Math.max(10, r.height + 5), maxLen: 14, density: .55, fat: 1.25, fall: true, wave: .25 }));
      if (host !== b) { o.style.left = b.offsetLeft + 'px'; o.style.top = (b.offsetTop - 3) + 'px'; } else { o.style.left = '0'; o.style.top = '-3px'; }
      host.appendChild(o); added.push(o);
    }
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
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!enabled) return; root.remove(); buildRoot(); }, 400); });
  }
  function disable() {
    if (!enabled) return; enabled = false;
    observer && observer.disconnect(); observer = null;
    root && root.remove(); stopSpiders();
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
