/* Explainer: narrated motion-graphics videos built from scene data (papers/*.json → chapter.video).
   Each scene type is a template that draws SVG and returns a GSAP timeline timed to the narration's
   sentence "beats" from assets/audio/<paper>/manifest.json. One audio file per chapter drives the clock. */
(() => {
const NS = 'http://www.w3.org/2000/svg';
const W = 1600, H = 900;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TONE = { thought: '#34d3c0', act: '#ff6b81', obs: '#a9b8cc', ink: '#eef2f7', muted: '#8d99ab' };
const ICON = {
  brain: 'M9 4a3 3 0 0 0-3 3v.5A3 3 0 0 0 4 10.5a3 3 0 0 0 1 5.5A3 3 0 0 0 9 20a2 2 0 0 0 3-1V5a2 2 0 0 0-3-1zM15 4a3 3 0 0 1 3 3v.5a3 3 0 0 1 2 3 3 3 0 0 1-1 5.5A3 3 0 0 1 15 20a2 2 0 0 1-3-1',
  hand: 'M9 11V5a1.5 1.5 0 0 1 3 0v5M12 10V4a1.5 1.5 0 0 1 3 0v6M15 10V6a1.5 1.5 0 0 1 3 0v7a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.6L9 14',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  check: 'M4 12l5 5L20 6',
  warn: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  house: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
  cart: 'M3 4h2l2.5 11h11L21 7H6.5M9 19.5h.01M18 19.5h.01',
  robot: 'M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM12 8V4M9 13v1M15 13v1M9 17h6',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 1 2-2h13',
  plan: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  x: 'M6 6l12 12M18 6L6 18'
};
const icon = (name, x, y, size, color, sw = 2) => ICON[name] ? `<g transform="translate(${x - size / 2} ${y - size / 2}) scale(${size / 24})"><path d="${ICON[name]}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></g>` : '';
const words = (txt, cls) => txt.split(' ').map(w => `<tspan class="${cls || 'w'}">${esc(w)} </tspan>`).join('');

/* ---------- scene templates: (scene, g, beats, dur) => timeline ---------- */
const T = {};

T.title = (s, g, B, dur) => {
  g.innerHTML = `
    <g class="orb"><circle cx="800" cy="450" r="330" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="2" stroke-dasharray="4 14"/>
      <circle cx="800" cy="120" r="9" fill="${TONE.thought}"/><circle cx="1086" cy="615" r="9" fill="${TONE.act}"/><circle cx="514" cy="615" r="9" fill="${TONE.obs}"/></g>
    <text class="kick" x="800" y="330" text-anchor="middle">${esc(s.kicker || '')}</text>
    <text class="h1" x="800" y="460" text-anchor="middle">${words(s.title)}</text>
    <path class="ul" d="M560 510 H1040" stroke="${TONE.thought}" stroke-width="6" stroke-linecap="round"/>
    <text class="sub" x="800" y="590" text-anchor="middle">${esc(s.sub || '')}</text>`;
  const tl = gsap.timeline();
  tl.fromTo(g.querySelector('.orb'), { rotation: -30, svgOrigin: '800 450' }, { rotation: 30, svgOrigin: '800 450', duration: Math.max(dur, 2), ease: 'none' }, 0)
    .from(g.querySelector('.orb'), { opacity: 0, duration: 1.2 }, 0)
    .from(g.querySelector('.kick'), { opacity: 0, y: 20, duration: .5 }, .1)
    .from(g.querySelector('.h1'), { y: 40, duration: .9, ease: 'power3.out' }, .25)
    .from(g.querySelectorAll('.h1 .w'), { opacity: 0, stagger: .08, duration: .5 }, .25)
    .fromTo(g.querySelector('.ul'), { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: .8, ease: 'power2.inOut' }, .7)
    .from(g.querySelector('.sub'), { opacity: 0, y: 16, duration: .5 }, .9);
  return tl;
};

T.items = (s, g, B, dur) => {
  const n = s.items.length, gap = 1200 / n, x0 = 800 - gap * (n - 1) / 2;
  g.innerHTML = `<text class="h2" x="800" y="200" text-anchor="middle">${esc(s.title)}</text>
    <path class="wire" d="M${x0} 450 H${x0 + gap * (n - 1)}" stroke="rgba(255,255,255,.18)" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>` +
    s.items.map((it, i) => { const x = x0 + gap * i, c = TONE[it.tone] || TONE.ink; return `<g class="it" data-i="${i}">
      <circle class="ring" cx="${x}" cy="450" r="96" fill="none" stroke="${c}" stroke-width="2" opacity=".5"/>
      <circle cx="${x}" cy="450" r="84" fill="${c}22" stroke="${c}" stroke-width="3"/>${icon(it.icon, x, 450, 74, c, 1.7)}
      ${wrapText(it.label, x, 610, s.mono ? 22 : 19, s.mono ? 'lab mono' : 'lab')}</g>`; }).join('');
  const tl = gsap.timeline();
  tl.from(g.querySelector('.h2'), { opacity: 0, y: -20, duration: .6 }, .1)
    .from(g.querySelector('.wire'), { drawSVG: 0, duration: 1.2, ease: 'power1.inOut' }, .3);
  g.querySelectorAll('.it').forEach((el, i) => {
    const t = B(s.from + i), [cx] = [x0 + gap * i];
    tl.from(el, { opacity: 0, scale: .4, svgOrigin: `${cx} 450`, duration: .6, ease: 'back.out(1.8)' }, t)
      .fromTo(el.querySelector('.ring'), { attr: { r: 84 }, opacity: .8 }, { attr: { r: 150 }, opacity: 0, duration: 1.2, ease: 'power2.out' }, t + .1);
  });
  return tl;
};

T.split = (s, g, B, dur) => {
  const panel = (p, x, side) => { const c = TONE[p.tone] || TONE.ink; return `<g class="pn ${side}">
    <rect x="${x}" y="190" width="560" height="520" rx="36" fill="rgba(255,255,255,.035)" stroke="${c}" stroke-width="2.5"/>
    <circle cx="${x + 100}" cy="290" r="52" fill="${c}22"/>${icon(p.icon, x + 100, 290, 56, c)}
    <text class="h3" x="${x + 180}" y="306">${esc(p.title)}</text>
    ${p.lines.map((l, i) => `<g class="ln"><circle cx="${x + 70}" cy="${418 + i * 92}" r="7" fill="${c}"/><text class="body" x="${x + 96}" y="${430 + i * 92}">${esc(l)}</text></g>`).join('')}</g>`; };
  g.innerHTML = panel(s.left, 180, 'l') + panel(s.right, 860, 'r') + `<text class="vsx" x="800" y="468" text-anchor="middle">vs</text>`;
  const tl = gsap.timeline(), bl = s.beats || [0, 1];
  [['.l', -80, bl[0]], ['.r', 80, bl[1]]].forEach(([sel, dx, b]) => {
    const t = B(b), el = g.querySelector('.pn' + sel);
    tl.from(el, { opacity: 0, x: dx, duration: .7, ease: 'power3.out' }, t)
      .from(el.querySelectorAll('.ln'), { opacity: 0, x: 24, stagger: .35, duration: .5 }, t + .4);
  });
  tl.from(g.querySelector('.vsx'), { opacity: 0, scale: .3, svgOrigin: '800 450', duration: .5, ease: 'back.out(2)' }, B(bl[1]) + .2);
  return tl;
};

T.loop = (s, g, B, dur) => {
  const P = { thought: [800, 210], act: [1170, 620], obs: [430, 620] };
  const arc = 'M800 210 C1060 210 1250 430 1170 620 C1080 800 520 800 430 620 C350 430 540 210 800 210';
  const node = (k, label, txt) => { const [x, y] = P[k], c = TONE[k]; return `<g class="nd ${k}">
    <circle class="halo" cx="${x}" cy="${y}" r="92" fill="${c}" opacity="0"/>
    <circle cx="${x}" cy="${y}" r="78" fill="#0d1218" stroke="${c}" stroke-width="4"/>
    ${icon(k === 'thought' ? 'brain' : k === 'act' ? 'hand' : 'eye', x, y - 8, 50, c)}
    <text class="nlab" x="${x}" y="${y + 40}" text-anchor="middle" fill="${c}">${label}</text>
    <text class="mono ex" x="${x}" y="${y + (k === 'thought' ? -112 : 128)}" text-anchor="middle">${esc(txt)}</text></g>`; };
  g.innerHTML = `<path class="cyc" d="${arc}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="3"/>
    <text class="h2 ctr" x="800" y="470" text-anchor="middle">Reason + Act</text>
    ${node('thought', 'Thought', s.labels.thought)}${node('act', 'Action', s.labels.act)}${node('obs', 'Observation', s.labels.obs)}
    <circle class="pk" r="13" fill="#fff"/>`;
  const tl = gsap.timeline(), pk = g.querySelector('.pk'), cyc = g.querySelector('.cyc');
  tl.from(g.querySelector('.ctr'), { opacity: 0, scale: .8, svgOrigin: '800 450', duration: .6 }, .1)
    .from(g.querySelector('.cyc'), { drawSVG: 0, duration: 1.6, ease: 'power2.inOut' }, .2)
    .set(pk, { opacity: 0 }, 0);
  ['thought', 'act', 'obs'].forEach((k, i) => {
    const el = g.querySelector('.nd.' + k), t = B(i + 1), [x, y] = P[k];
    tl.from(el, { opacity: 0, scale: .5, svgOrigin: `${x} ${y}`, duration: .55, ease: 'back.out(1.8)' }, t)
      .fromTo(el.querySelector('.halo'), { opacity: .5, attr: { r: 80 } }, { opacity: 0, attr: { r: 150 }, duration: 1 }, t + .1)
      .from(el.querySelector('.ex'), { opacity: 0, y: 10, duration: .5 }, t + .35);
  });
  const t4 = B(4), laps = Math.max(1, Math.floor((dur - t4) / 2.6));
  tl.set(pk, { opacity: 1 }, t4)
    .to(pk, { motionPath: { path: cyc, align: cyc, alignOrigin: [.5, .5] }, duration: 2.6, ease: 'none', repeat: laps - 1 }, t4);
  return tl;
};

T.trace = (s, g, B, dur) => {
  const n = s.lines.length, top = 250, lh = Math.min(62, 440 / n), maxLen = Math.max(...s.lines.map(l => l[1].length));
  const fs = Math.min(23, 860 / (maxLen * .6));
  const tag = { thought: 'THOUGHT', act: 'ACTION', obs: 'OBS', answer: 'ANSWER', edit: 'EDITED' };
  const col = k => k === 'edit' ? '#ffd479' : k === 'answer' ? TONE.ink : TONE[k];
  g.innerHTML = `<g class="win"><rect x="230" y="130" width="1140" height="${Math.max(420, top - 130 + n * lh + 110)}" rx="26" fill="#0c1117" stroke="rgba(255,255,255,.12)" stroke-width="2"/>
    <circle cx="272" cy="170" r="8" fill="#ff5f57"/><circle cx="298" cy="170" r="8" fill="#febc2e"/><circle cx="324" cy="170" r="8" fill="#28c840"/>
    <text class="mono ttl" x="800" y="177" text-anchor="middle">${esc(s.title)}</text></g>` +
    s.lines.map(([k, txt], i) => { const y = top + i * lh; return `<g class="tl" data-k="${k}">
      <clipPath id="c${s._id}_${i}"><rect class="cr" x="430" y="${y - 30}" width="0" height="44"/></clipPath>
      <rect x="270" y="${y - 22}" width="140" height="32" rx="8" fill="${col(k)}22"/><text class="mono tg" x="340" y="${y}" text-anchor="middle" fill="${col(k)}">${tag[k] || ''}</text>
      <text class="mono tx" x="440" y="${y}" font-size="${fs}" clip-path="url(#c${s._id}_${i})" fill="${k === 'obs' ? TONE.muted : TONE.ink}">${esc(txt)}</text>
      ${k === 'edit' ? '' : `<line class="strike" x1="440" x2="${440 + txt.length * fs * .6}" y1="${y - fs * .32}" y2="${y - fs * .32}" stroke="#ffd479" stroke-width="3" opacity="0"/>`}</g>`; }).join('') +
    (s.verdict ? (() => { const vw = 100 + s.verdict.text.length * 14.5, vx = 1340 - vw; return `<g class="vd"><rect x="${vx}" y="${top + n * lh + 14}" width="${vw}" height="64" rx="32" fill="${s.verdict.ok ? TONE.thought : TONE.act}"/>
      ${icon(s.verdict.ok ? 'check' : 'x', vx + 42, top + n * lh + 46, 30, '#0b0f14', 3)}
      <text class="vdt" x="${vx + 72}" y="${top + n * lh + 55}" fill="#0b0f14">${esc(s.verdict.text)}</text></g>`; })() : '');
  const tl = gsap.timeline(), lines = [...g.querySelectorAll('.tl')];
  tl.from(g.querySelector('.win'), { opacity: 0, y: 30, scale: .97, svgOrigin: '800 450', duration: .6, ease: 'power3.out' }, 0);
  const span = Math.max(1, dur * .8 - .8), step = span / n;
  lines.forEach((el, i) => {
    const t = .7 + i * step, k = el.dataset.k;
    tl.from(el, { opacity: 0, x: -14, duration: .3 }, t)
      .to(el.querySelector('.cr'), { attr: { width: 900 }, duration: Math.min(step * .85, 1.1), ease: 'none' }, t + .1);
    if (k === 'edit' && lines[i - 1]) tl.to(lines[i - 1].querySelector('.strike'), { opacity: 1, duration: .01 }, t - .05)
      .fromTo(lines[i - 1].querySelector('.strike'), { drawSVG: 0 }, { drawSVG: '100%', duration: .4 }, t - .05)
      .to(lines[i - 1], { opacity: .45, duration: .3 }, t);
  });
  const vd = g.querySelector('.vd');
  if (vd) { const t = Math.min(dur - 1.2, .7 + n * step + .2); tl.from(vd, { opacity: 0, scale: .6, svgOrigin: '1180 700', duration: .5, ease: 'back.out(2)' }, t);
    if (!s.verdict.ok) tl.to(vd, { x: 8, duration: .07, repeat: 5, yoyo: true }, t + .5); }
  return tl;
};

T.equation = (s, g, B, dur) => {
  const toks = (arr, x, c) => arr.map((t, i) => `<text class="mono tok" x="${x}" y="${420 + i * 56}" text-anchor="middle" fill="${c}">${esc(t)}</text>`).join('');
  g.innerHTML = `<text class="eq" x="800" y="190" text-anchor="middle">Â = A ∪ L</text>
    <g class="A"><circle cx="560" cy="470" r="230" fill="${TONE.act}14" stroke="${TONE.act}" stroke-width="3"/><text class="h3" x="560" y="330" text-anchor="middle" fill="${TONE.act}">A · actions</text>${toks(['search[…]', 'go to cabinet 1', 'finish[…]'], 560, TONE.ink)}</g>
    <g class="L"><circle cx="1040" cy="470" r="230" fill="${TONE.thought}14" stroke="${TONE.thought}" stroke-width="3"/><text class="h3" x="1040" y="330" text-anchor="middle" fill="${TONE.thought}">L · language</text>${toks(['“I need to…”', '“so the answer is…”', '“next, I…”'], 1040, TONE.ink)}</g>
    <g class="world"><rect x="1250" y="740" width="250" height="90" rx="20" fill="none" stroke="${TONE.obs}" stroke-width="2.5" stroke-dasharray="8 8"/><text class="body" x="1375" y="795" text-anchor="middle" fill="${TONE.obs}">the world</text>
      <path class="noarrow" d="M1180 640 Q1300 690 1330 735" fill="none" stroke="${TONE.obs}" stroke-width="3"/>${icon('x', 1290, 690, 44, TONE.act, 3.5)}</g>
    <g class="ctx"><rect x="120" y="740" width="420" height="90" rx="20" fill="${TONE.thought}18" stroke="${TONE.thought}" stroke-width="2.5"/><text class="body" x="330" y="782" text-anchor="middle" fill="${TONE.thought}">context += thought</text><text class="mono small" x="330" y="812" text-anchor="middle">a note to self</text>
      <path class="toctx" d="M900 640 Q700 760 545 785" fill="none" stroke="${TONE.thought}" stroke-width="3" stroke-dasharray="1 0"/></g>`;
  const tl = gsap.timeline(), A = g.querySelector('.A'), L = g.querySelector('.L');
  tl.from(g.querySelector('.eq'), { opacity: 0, scale: .7, svgOrigin: '800 170', duration: .7, ease: 'back.out(1.6)' }, B(0) + .1)
    .from(A, { opacity: 0, x: -160, duration: .7 }, B(1)).from(L, { opacity: 0, x: 160, duration: .7 }, B(1) + .3)
    .to(A, { x: 30, duration: 1, ease: 'power2.inOut' }, B(1) + 1.3).to(L, { x: -30, duration: 1, ease: 'power2.inOut' }, B(1) + 1.3)
    .from(g.querySelector('.world'), { opacity: 0, y: 30, duration: .6 }, B(2))
    .from(g.querySelector('.noarrow'), { drawSVG: 0, duration: .6 }, B(2) + .3)
    .from(g.querySelector('.ctx'), { opacity: 0, y: 30, duration: .6 }, B(3))
    .from(g.querySelector('.toctx'), { drawSVG: 0, duration: .8 }, B(3) + .2);
  return tl;
};

T.bars = (s, g, B, dur) => {
  const gs = s.groups, gw = gs.length > 1 ? 640 : 1000, gap = 80, x0 = 800 - (gw * gs.length + gap * (gs.length - 1)) / 2;
  g.innerHTML = `<text class="h2" x="800" y="170" text-anchor="middle">${esc(s.title)}</text>` + gs.map((G, gi) => {
    const gx = x0 + gi * (gw + gap), lw = gs.length > 1 ? 270 : 300, bw = gw - lw - 90, rh = Math.min(90, 480 / G.rows.length);
    return `<g class="grp"><text class="lab" x="${gx}" y="270">${esc(G.label)}</text>` + G.rows.map((r, i) => {
      const y = 320 + i * rh, c = r[2] === 1 ? TONE.thought : TONE.obs, w = bw * r[1] / G.max;
      return `<g class="row"><text class="body${r[2] === 1 ? ' b' : ''}" x="${gx}" y="${y + 30}" font-size="${gs.length > 1 ? 23 : 26}">${esc(r[0])}</text>
        <rect x="${gx + lw}" y="${y + 6}" width="${bw}" height="34" rx="8" fill="rgba(255,255,255,.05)"/>
        <rect class="bar" x="${gx + lw}" y="${y + 6}" width="${w}" height="34" rx="8" fill="${r[2] === 2 ? 'none' : c}" ${r[2] === 2 ? `stroke="${TONE.obs}" stroke-width="2.5" stroke-dasharray="7 6"` : ''} opacity="${r[2] === 1 ? 1 : .75}"/>
        <text class="num" x="${gx + lw + bw + 80}" y="${y + 33}" text-anchor="end" data-v="${r[1]}">0</text></g>`; }).join('') + '</g>';
  }).join('');
  const tl = gsap.timeline(), bl = s.beats || [0];
  tl.from(g.querySelector('.h2'), { opacity: 0, y: -16, duration: .5 }, .1);
  g.querySelectorAll('.grp').forEach((el, gi) => {
    const t = B(bl[gi] ?? bl[bl.length - 1]) + (gi === 0 ? .3 : 0);
    tl.from(el, { opacity: 0, y: 20, duration: .5 }, t);
    el.querySelectorAll('.row').forEach((row, i) => {
      const bar = row.querySelector('.bar'), num = row.querySelector('.num'), v = +num.dataset.v, o = { v: 0 };
      tl.from(bar, { attr: { width: 0 }, duration: 1, ease: 'power3.out' }, t + .25 + i * .18)
        .to(o, { v, duration: 1, ease: 'power3.out', onUpdate: () => num.textContent = (v % 1 ? o.v.toFixed(1) : Math.round(o.v)) }, t + .25 + i * .18);
    });
  });
  return tl;
};

T.stats = (s, g, B, dur) => {
  const n = s.stats.length, gap = 1300 / n, x0 = 800 - gap * (n - 1) / 2;
  g.innerHTML = s.stats.map((st, i) => { const x = x0 + gap * i, c = TONE[st.tone] || TONE.ink;
    return `<g class="st"><circle cx="${x}" cy="400" r="170" fill="${c}10"/><text class="big" x="${x}" y="440" text-anchor="middle" fill="${c}" font-size="${st.v.length > 5 ? 96 : 150}">${esc(st.v)}</text>
      ${wrapText(st.label, x, 640, 22, 'body')}</g>`; }).join('');
  const tl = gsap.timeline();
  g.querySelectorAll('.st').forEach((el, i) => {
    const t = B(s.from + i), big = el.querySelector('.big'), raw = s.stats[i].v, m = raw.match(/^([+]?)([\d,]+)(%?)$/);
    tl.from(el, { opacity: 0, y: 40, duration: .6, ease: 'power3.out' }, t);
    if (m) { const target = +m[2].replace(/,/g, ''), o = { v: 0 };
      tl.to(o, { v: target, duration: 1.1, ease: 'power2.out', onUpdate: () => big.textContent = m[1] + Math.round(o.v).toLocaleString('en-US') + m[3] }, t); }
  });
  return tl;
};
function wrapText(txt, x, y, maxCh, cls) {
  const out = []; let line = '';
  txt.split(' ').forEach(w => { if ((line + ' ' + w).trim().length > maxCh) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); });
  out.push(line);
  return out.map((l, i) => `<text class="${cls}" x="${x}" y="${y + i * 40}" text-anchor="middle">${esc(l)}</text>`).join('');
}

T.flow = (s, g, B, dur) => {
  const N = Object.fromEntries(s.nodes.map(n => [n.id, n]));
  const sz = n => n.shape === 'diamond' ? [130, 130] : [n.label.length * 15.5 + (n.icon ? 118 : 64), 104];
  const edge = (e, i) => {
    const a = N[e.from], b = N[e.to], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const ra = Math.min(sz(a)[0] / 2, Math.abs(uy) > .5 ? 70 : sz(a)[0] / 2) + 8, rb = Math.min(sz(b)[0] / 2, Math.abs(uy) > .5 ? 70 : sz(b)[0] / 2) + 18;
    const x1 = a.x + ux * ra, y1 = a.y + uy * ra, x2 = b.x - ux * rb, y2 = b.y - uy * rb, bend = e.bend || 0;
    const mx = (x1 + x2) / 2 - uy * bend, my = (y1 + y2) / 2 + ux * bend, d = `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
    return `<g class="ed" data-b="${e.beat}"><path id="e${s._id}_${i}" class="ep" d="${d}" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="3" marker-end="url(#ah${s._id})"/>
      ${e.label ? `<text class="mono elab" x="${(x1 + 2 * mx + x2) / 4}" y="${(y1 + 2 * my + y2) / 4 - 14}" text-anchor="middle">${esc(e.label)}</text>` : ''}
      <circle class="pk" r="9" fill="${TONE.thought}" opacity="0"/></g>`;
  };
  const node = n => { const c = TONE[n.tone] || TONE.ink, [w, h] = sz(n);
    const shape = n.shape === 'diamond' ? `<rect x="${n.x - 92}" y="${n.y - 92}" width="184" height="184" rx="18" transform="rotate(45 ${n.x} ${n.y})" fill="#0d1218" stroke="${c}" stroke-width="3"/>`
      : `<rect x="${n.x - w / 2}" y="${n.y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="#0d1218" stroke="${c}" stroke-width="3"/>`;
    const L = n.x - w / 2;
    return `<g class="nd" data-b="${n.beat}">${shape}${n.icon ? icon(n.icon, L + 48, n.y, 38, c) : ''}
      ${n.shape === 'diamond' ? wrapText(n.label, n.x, n.y - 6, 9, 'lab') : `<text class="lab" x="${n.icon ? L + 82 : n.x}" y="${n.y + 10}" text-anchor="${n.icon ? 'start' : 'middle'}">${esc(n.label)}</text>`}</g>`; };
  g.innerHTML = `<defs><marker id="ah${s._id}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="rgba(255,255,255,.7)"/></marker></defs>` +
    s.edges.map(edge).join('') + s.nodes.map(node).join('') + (s.note ? `<text class="h3 note" x="800" y="790" text-anchor="middle" fill="${TONE.act}">${esc(s.note.text)}</text>` : '');
  const tl = gsap.timeline();
  g.querySelectorAll('.nd').forEach(el => tl.from(el, { opacity: 0, scale: .6, transformOrigin: '50% 50%', duration: .55, ease: 'back.out(1.7)' }, B(+el.dataset.b) + .15));
  g.querySelectorAll('.ed').forEach(el => {
    const t = B(+el.dataset.b) + .45, p = el.querySelector('.ep'), pk = el.querySelector('.pk'), lab = el.querySelector('.elab');
    tl.from(p, { drawSVG: 0, duration: .7, ease: 'power2.inOut' }, t);
    if (lab) tl.from(lab, { opacity: 0, duration: .4 }, t + .4);
    const runs = Math.max(0, Math.floor((dur - t - 1) / 1.6));
    if (runs) tl.set(pk, { opacity: 1 }, t + .8).to(pk, { motionPath: { path: p, align: p, alignOrigin: [.5, .5] }, duration: 1.6, ease: 'power1.inOut', repeat: runs - 1 }, t + .8);
  });
  const note = g.querySelector('.note'); if (note) tl.from(note, { opacity: 0, y: 16, duration: .5 }, B(s.note.beat) + .2);
  return tl;
};

T.takeaway = (s, g, B, dur) => {
  const mc = Math.max(...s.lines.map(l => l.length)), fs = Math.min(s.small ? 50 : 88, 1500 / (mc * .53)), lh = fs * 1.3, y0 = 450 - (s.lines.length - 1) * lh / 2 + fs * .3;
  g.innerHTML = s.lines.map((l, i) => `<text class="tk" x="800" y="${y0 + i * lh}" text-anchor="middle" font-size="${fs}" ${i === s.lines.length - 1 && !s.small ? `fill="${TONE.thought}"` : ''}>${words(l)}</text>`).join('') +
    `<path class="ul" d="M600 ${y0 + (s.lines.length - 1) * lh + 40} H1000" stroke="${TONE.act}" stroke-width="6" stroke-linecap="round"/>`;
  const tl = gsap.timeline();
  g.querySelectorAll('.tk').forEach((el, i) => { const t = (s.small ? .2 + i * .5 : B(i)) + .1;
    tl.from(el, { y: 30, duration: .8, ease: 'power3.out' }, t).from(el.querySelectorAll('.w'), { opacity: 0, stagger: .09, duration: .5 }, t); });
  tl.fromTo(g.querySelector('.ul'), { drawSVG: '50% 50%' }, { drawSVG: '0% 100%', duration: .8 }, (s.small ? 1 : B(s.lines.length - 1)) + .6);
  return tl;
};

/* ---------- player ---------- */
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
let uid = 0;
async function mount(el, video, timing, opts = {}) {
  if (!window.gsap) { el.innerHTML = '<div class="vp-err">The animation library did not load.</div>'; return; }
  gsap.registerPlugin(DrawSVGPlugin, MotionPathPlugin);
  try { await document.fonts.ready; } catch {}
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.innerHTML = `<div class="vp fresh" tabindex="0" aria-label="${esc(video.title)} video">
    <svg class="vs" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><radialGradient id="glA"><stop offset="0" stop-color="${TONE.thought}" stop-opacity=".35"/><stop offset="1" stop-color="${TONE.thought}" stop-opacity="0"/></radialGradient>
      <radialGradient id="glB"><stop offset="0" stop-color="${TONE.act}" stop-opacity=".28"/><stop offset="1" stop-color="${TONE.act}" stop-opacity="0"/></radialGradient>
      <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="rgba(255,255,255,.035)"/></pattern></defs>
      <rect width="${W}" height="${H}" fill="#080b10"/><rect width="${W}" height="${H}" fill="url(#grid)"/>
      <circle class="blobA" cx="260" cy="180" r="420" fill="url(#glA)"/><circle class="blobB" cx="1360" cy="760" r="460" fill="url(#glB)"/>
      <g class="scenes" transform="translate(96 0) scale(.88)"></g></svg>
    <div class="vp-cap" aria-live="off"></div>
    <div class="vp-poster"><div class="vp-row"><button class="vp-big" aria-label="Play video"><svg viewBox="0 0 24 24" width="34" height="34"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></button>
      <div class="vp-meta"><b>${esc(video.title)}</b><span>${fmt(timing.dur)} · narrated explainer · captions on</span></div></div></div>
    <div class="vp-end" hidden><button class="vp-btn ghost" data-a="replay">Replay</button>${opts.onDone ? '<button class="vp-btn" data-a="done">Continue to the reading</button>' : ''}</div>
    <div class="vp-bar">
      <button class="vp-ic" data-a="play" aria-label="Play"><svg viewBox="0 0 24 24"><path class="ip" d="M8 5v14l11-7z" fill="currentColor"/></svg></button>
      <span class="vp-time">0:00 / ${fmt(timing.dur)}</span>
      <div class="vp-track" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="${Math.round(timing.dur)}"><div class="vp-fill"></div>${timing.scenes.map(sc => `<i style="left:${sc.start / timing.dur * 100}%"></i>`).join('')}</div>
      <button class="vp-ic txt" data-a="speed" aria-label="Playback speed">1×</button>
      <button class="vp-ic txt on" data-a="cc" aria-label="Captions" aria-pressed="true">CC</button>
      <button class="vp-ic" data-a="fs" aria-label="Full screen"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
    </div></div>`;
  const vp = el.querySelector('.vp'), root = el.querySelector('.scenes'), cap = el.querySelector('.vp-cap');
  if (!reduce) {
    gsap.to(el.querySelector('.blobA'), { attr: { cx: 520, cy: 320 }, duration: 9, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    gsap.to(el.querySelector('.blobB'), { attr: { cx: 1100, cy: 620 }, duration: 11, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }
  const master = gsap.timeline({ paused: true });
  video.scenes.forEach((s, i) => {
    const sc = timing.scenes[i]; if (!sc) return;
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'sc'); root.appendChild(g);
    s._id = ++uid; const dur = sc.end - sc.start, beats = sc.beats;
    const B = k => beats[Math.max(0, Math.min(k, beats.length - 1))] ?? 0;
    let tl; try { tl = (T[s.type] || T.takeaway)(s, g, B, dur); } catch (e) { console.error('scene', s.type, e); tl = gsap.timeline(); }
    gsap.set(g, { autoAlpha: 0 });
    const wrap = gsap.timeline();
    wrap.set(g, { autoAlpha: 1 }, 0).add(tl, 0).to(g, { autoAlpha: 0, duration: .35 }, Math.max(.1, dur - .35)).set(g, { autoAlpha: 0 }, dur);
    master.add(wrap, sc.start);
  });
  master.set({}, {}, timing.dur);

  const audio = new Audio(); audio.preload = 'metadata'; audio.src = timing.src;
  let useClock = false, clock0 = 0, clockT = 0, playing = false, rate = 1, ccOn = true, raf = 0;
  audio.addEventListener('error', () => { useClock = true; });
  const now = () => useClock ? (playing ? clockT + (performance.now() - clock0) / 1000 * rate : clockT) : audio.currentTime;
  const fill = el.querySelector('.vp-fill'), time = el.querySelector('.vp-time'), track = el.querySelector('.vp-track');
  const render = () => {
    const t = Math.min(now(), timing.dur);
    master.time(t);
    fill.style.width = (t / timing.dur * 100) + '%'; time.textContent = `${fmt(t)} / ${fmt(timing.dur)}`;
    track.setAttribute('aria-valuenow', Math.round(t));
    const cue = timing.cues.find(c => t >= c.t0 - .05 && t <= c.t1 + .25);
    const txt = ccOn && cue ? cue.text : '';
    if (cap.textContent !== txt) cap.textContent = txt;
    cap.classList.toggle('on', !!txt);
    if (t >= timing.dur - .02 && playing) end();
  };
  const loop = () => { render(); if (playing) raf = requestAnimationFrame(loop); };
  const setIcon = () => { el.querySelector('.ip').setAttribute('d', playing ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z'); el.querySelector('[data-a=play]').setAttribute('aria-label', playing ? 'Pause' : 'Play'); };
  async function play() {
    el.querySelector('.vp-poster').hidden = true; el.querySelector('.vp-end').hidden = true; vp.classList.remove('fresh'); vp.focus({ preventScroll: true });
    if (now() >= timing.dur - .05) seek(0);
    playing = true; setIcon(); vp.classList.add('playing');
    if (!useClock) { try { audio.playbackRate = rate; await audio.play(); } catch { useClock = true; clockT = audio.currentTime || clockT; } }
    clock0 = performance.now(); cancelAnimationFrame(raf); loop();
    opts.onPlay && opts.onPlay();
  }
  function pause() { if (useClock) clockT = now(); playing = false; audio.pause(); setIcon(); vp.classList.remove('playing'); render(); }
  function end() { pause(); el.querySelector('.vp-end').hidden = false; opts.onEnd && opts.onEnd(); }
  function seek(t) { t = Math.max(0, Math.min(timing.dur, t)); clockT = t; clock0 = performance.now(); if (!useClock) try { audio.currentTime = t; } catch {} if (!playing) { master.time(t); render(); } }
  const toggle = () => playing ? pause() : play();
  el.querySelector('.vp-big').onclick = play;
  el.querySelector('.vp-poster').onclick = e => { if (e.target === e.currentTarget) play(); };
  el.querySelector('.vs').addEventListener('click', toggle);
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = e => {
    e.stopPropagation(); const a = b.dataset.a;
    if (a === 'play') toggle();
    if (a === 'replay') { seek(0); play(); }
    if (a === 'done') opts.onDone();
    if (a === 'cc') { ccOn = !ccOn; b.classList.toggle('on', ccOn); b.setAttribute('aria-pressed', ccOn); render(); }
    if (a === 'speed') { const r = [1, 1.25, 1.5, .75]; const t = now(); rate = r[(r.indexOf(rate) + 1) % r.length]; clockT = t; clock0 = performance.now(); audio.playbackRate = rate; b.textContent = rate + '×'; }
    if (a === 'fs') { try { document.fullscreenElement ? document.exitFullscreen() : vp.requestFullscreen(); } catch {} }
  });
  const seekFromEvent = e => { const r = track.getBoundingClientRect(); seek((e.clientX - r.left) / r.width * timing.dur); };
  track.addEventListener('pointerdown', e => { track.setPointerCapture(e.pointerId); seekFromEvent(e); track.onpointermove = seekFromEvent; });
  track.addEventListener('pointerup', () => track.onpointermove = null);
  vp.addEventListener('keydown', e => {
    const k = e.key;
    if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); }
    else if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); seek(now() + (k === 'ArrowRight' ? 5 : -5)); }
    else if (k === 'c') el.querySelector('[data-a=cc]').click();
    else if (k === 'f') el.querySelector('[data-a=fs]').click();
    else return;
    e.stopPropagation();
  });
  render(); master.time(Math.min(timing.scenes[0].end - .6, 2.4)); cap.textContent = ''; cap.classList.remove('on');
  return { play, pause, toggle: () => (vp.classList.contains('fresh') ? play() : toggle()), destroy: () => { pause(); cancelAnimationFrame(raf); audio.src = ''; master.kill(); } };
}
window.Explainer = { mount };
})();
