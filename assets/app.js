/* Paperwalk: a guided reader that renders any paper file in papers/*.json */
{
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const strip = s => String(s).replace(/<[^>]+>/g, '');
const app = $('#app');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const G = window.gsap;
if (G && window.ScrollTrigger) G.registerPlugin(ScrollTrigger);
let P = null, S = null, KEY = '', AUD = {}, view = 0, player = null;

/* ---------- storage ---------- */
const blank = () => ({ seen: {}, ans: {}, pts: 0, pos: {} });
function load() { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch { return blank(); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

/* ---------- helpers ---------- */
const steps = c => (c.video && AUD[c.id] ? [{ t: 'video' }] : []).concat(c.steps);
const total = () => P.chapters.reduce((n, c) => n + steps(c).length, 0);
const chSeen = c => steps(c).filter((_, i) => S.seen[c.id + ':' + i]).length;
const isCheck = s => s.t === 'quiz' || s.t === 'predict';
const fmt = t => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;
const LABEL = { video: 'Watch', text: 'Read', predict: 'Guess first', quiz: 'Quick check', trace: 'Replay', bars: 'Evidence', match: 'Match up', order: 'Put in order' };
const stepTitle = (c, s) => s.t === 'video' ? 'Explainer video' : s.h || (s.q ? strip(s.q) : LABEL[s.t]);
const ICO = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 1 2-2h13"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12l5 5L20 6"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>'
};
function gloss(html) {
  return html.replace(/\{\{([^}|]+)(?:\|([^}]+))?\}\}/g, (_, label, key) => {
    const k = (key || label).trim().toLowerCase();
    return P.glossary[k] ? `<button class="gl" data-k="${esc(k)}">${label}</button>` : label;
  });
}
function toast(html) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; $('#toasts').appendChild(t);
  if (G && !reduce) G.from(t, { x: 40, opacity: 0, duration: .35, ease: 'power3.out' });
  setTimeout(() => G && !reduce ? G.to(t, { opacity: 0, y: -10, duration: .3, onComplete: () => t.remove() }) : t.remove(), 1800);
}
function addPts(n, why) {
  if (!n) return;
  S.pts += n; save(); $('#xp').textContent = S.pts + ' pts';
  if (why) toast(`<b>+${n}</b> ${esc(why)}`);
}
function updateMeter() {
  const pct = Math.round(Object.keys(S.seen).length / total() * 100);
  $('#pbar').style.width = pct + '%'; $('#ptext').textContent = pct + '%'; $('#xp').textContent = S.pts + ' pts';
}
function ring(frac) {
  const r = 19, C = 2 * Math.PI * r, done = frac >= 1;
  return `<svg class="ring" viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="${r}" fill="none" stroke="var(--line2)" stroke-width="4"/>
  <circle cx="23" cy="23" r="${r}" fill="none" stroke="var(--thought)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C * frac} ${C}" transform="rotate(-90 23 23)"/>
  ${done ? '<path d="M15 23.5l5.5 5.5 10-11" fill="none" stroke="var(--thought)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' : `<text x="23" y="27" text-anchor="middle" font-size="11" font-family="Geist Mono" fill="var(--muted)">${Math.round(frac * 100)}%</text>`}</svg>`;
}

/* ---------- confetti ---------- */
function confetti(el) {
  if (reduce) return;
  const cv = $('#fx'), ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const r = el.getBoundingClientRect(), cols = ['#34d3c0', '#ff6b81', '#a9b8cc', '#5b7cff', '#ffd479'];
  const ps = Array.from({ length: 70 }, () => ({ x: r.left + r.width / 2, y: r.top + r.height / 2, vx: (Math.random() - .5) * 12, vy: -Math.random() * 11 - 3, s: 4 + Math.random() * 5, c: cols[Math.random() * 5 | 0], a: Math.random() * 6, va: (Math.random() - .5) * .4 }));
  let f = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = Math.max(0, 1 - f / 70); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    if (++f < 70) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}

/* ---------- hero: living loop + console ---------- */
function heroLoop() {
  const node = (x, y, c, t, sub) => `<g class="hn" data-c="${c}"><circle class="hg" cx="${x}" cy="${y}" r="44" fill="var(--${c})" opacity="0"/>
    <rect x="${x - 72}" y="${y - 30}" width="144" height="60" rx="30" fill="var(--bg2)" stroke="var(--${c})" stroke-width="2"/>
    <text x="${x}" y="${y - 2}" text-anchor="middle" font-size="17" font-weight="700" fill="var(--ink)" font-family="Geist">${t}</text>
    <text x="${x}" y="${y + 16}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="Geist Mono">${sub}</text></g>`;
  return `<svg class="loop" viewBox="0 20 500 300" aria-label="The ReAct loop: Thought, Action, Observation">
    <path id="hp" d="M250 72 A150 122 0 1 1 249.9 72" fill="none" stroke="var(--line2)" stroke-width="1.5" stroke-dasharray="3 7"/>
    <circle class="hk" r="6" fill="var(--thought)"/><circle class="hk" r="6" fill="var(--act)"/><circle class="hk" r="6" fill="var(--obs)"/>
    <text x="250" y="178" text-anchor="middle" font-size="13" fill="var(--muted)" font-family="Geist Mono">repeat until</text>
    <text x="250" y="202" text-anchor="middle" font-size="17" fill="var(--ink)" font-family="Geist Mono">finish[answer]</text>
    ${node(250, 72, 'thought', 'Thought', 'note to self')}${node(390, 262, 'act', 'Action', 'touch the world')}${node(110, 262, 'obs', 'Observation', 'world replies')}</svg>`;
}
function animateHero(token) {
  const st = $('.stage'); if (!st) return;
  if (G && !reduce && window.MotionPathPlugin) {
    G.registerPlugin(MotionPathPlugin);
    $$('.hk', st).forEach((k, i) => G.to(k, { motionPath: { path: '#hp', align: '#hp', alignOrigin: [.5, .5], start: i / 3, end: i / 3 + 1 }, duration: 9, repeat: -1, ease: 'none' }));
    const hg = $$('.hg', st), tl = G.timeline({ repeat: -1 });
    [0, 1, 2].forEach(i => tl.fromTo(hg[i], { opacity: .45, attr: { r: 30 } }, { opacity: 0, attr: { r: 62 }, duration: 1.4, ease: 'power2.out' }, i * 1.1));
    tl.to({}, { duration: .4 });
    G.from('.hero-copy > *', { y: 24, opacity: 0, duration: .8, stagger: .08, ease: 'power3.out' });
    G.from('.stage', { scale: .96, opacity: 0, duration: 1, ease: 'power3.out' });
  }
  const demo = P.chapters.flatMap(c => c.steps).find(s => s.t === 'trace');
  const lines = demo ? demo.methods[demo.methods.length - 1].steps.filter(l => l[0] !== 'note') : [];
  const box = $('.console .lines'), K = { thought: 'Thought', act: 'Action', obs: 'Observ.', answer: 'Answer' };
  let i = 0;
  const next = () => {
    if (token !== view || !box) return;
    if (i >= lines.length) { i = 0; box.innerHTML = ''; }
    const [k, txt] = lines[i++], row = document.createElement('div');
    row.className = 'cl ' + k; row.innerHTML = `<span class="k">${K[k] || k}</span><span class="v"></span>`;
    box.appendChild(row); while (box.children.length > 4) box.firstChild.remove();
    const v = row.querySelector('.v'); let j = 0; const speed = k === 'obs' ? 6 : 16;
    if (reduce) { v.textContent = txt; return setTimeout(next, 1400); }
    (function type() { if (token !== view) return; v.innerHTML = esc(txt.slice(0, ++j)) + '<span class="caret"></span>'; if (j < txt.length) setTimeout(type, speed); else { v.textContent = txt; setTimeout(next, k === 'obs' ? 900 : 600); } })();
  };
  next();
}

/* ---------- views ---------- */
function home() {
  const token = ++view;
  document.title = P.short + ' · Paperwalk';
  const started = Object.keys(S.seen).length > 0;
  const next = P.chapters.find(c => chSeen(c) < steps(c).length) || P.chapters[0];
  const vidTotal = P.chapters.reduce((n, c) => n + (AUD[c.id]?.dur || 0), 0);
  const first = P.chapters[0], fd = AUD[first.id]?.dur;
  const spans = [3, 3, 2, 2, 2, 3];
  const glyphs = ['spark', 'book', 'play', 'check', 'arrow', 'spark'];
  app.innerHTML = `<div class="wrap">
    <section class="hero">
      <div class="hero-copy">
        <span class="pill"><b></b>${esc(P.venue)} · ${P.chapters.length} stops · ${vidTotal ? fmt(vidTotal) + ' of video' : P.minutes + ' min'}</span>
        <h1>${esc(P.short)}: <span class="grad">${esc(P.title.split(':').slice(1).join(':').trim() || P.title)}</span></h1>
        <p class="authors">${esc(P.authors)} · ${esc(P.affil)}</p>
        <p class="lede">${P.oneLiner} ${esc(P.why)}</p>
        <div class="cta">
          ${fd ? `<a class="btn glow" href="#ch-${first.id}" data-start="${first.id}"><span class="play-ic">${ICO.play}</span>Watch the ${fmt(fd)} intro</a>` : ''}
          <a class="btn ghost" href="#ch-${next.id}">${started ? 'Continue: ' + esc(next.title) : 'Start reading'} ${ICO.arrow}</a>
        </div>
      </div>
      <div class="stage">${heroLoop()}
        <div class="console"><div class="bar"><i></i><i></i><i></i><span>live trace · Figure 1</span></div><div class="lines"></div></div>
      </div>
    </section>
    <section class="stats">
      <div class="stat"><b data-n="34" data-p="+">+34</b><span>points over trained agents on ALFWorld</span></div>
      <div class="stat"><b data-n="10" data-p="+">+10</b><span>points on WebShop success rate</span></div>
      <div class="stat"><b>1–2</b><span>examples in the prompt, no training</span></div>
      <div class="stat"><b data-n="0" data-s="%">0%</b><span>of ReAct's HotpotQA failures were hallucinations</span></div>
    </section>
    <section class="flow">
      <h2 class="sh">How each stop works</h2>
      <p class="sp">Short, active, and never a wall of text. Your progress is saved in this browser.</p>
      <div class="steps4">
        <div class="s" style="color:var(--thought)">${ICO.play}<b style="color:var(--ink)">Watch</b><span>A narrated, animated explainer in about a minute.</span></div>
        <div class="s" style="color:var(--obs)">${ICO.book}<b style="color:var(--ink)">Read</b><span>Plain-language cards, with the paper's own words one tap away.</span></div>
        <div class="s" style="color:var(--act)">${ICO.check}<b style="color:var(--ink)">Check</b><span>Guess first, replay examples, match and order. Points for every win.</span></div>
        <div class="s" style="color:var(--thought)">${ICO.spark}<b style="color:var(--ink)">Recap</b><span>A cheat sheet of everything you learned, ready to copy.</span></div>
      </div>
    </section>
    <section class="road">
      <h2 class="sh">Your route through the paper</h2>
      <p class="sp">Pick any stop, or go in order. Press <kbd>Ctrl K</kbd> to jump anywhere or look up a term.</p>
      <div class="bento">${P.chapters.map((c, i) => `<a class="bx ${spans[i] === 3 ? 'wide' : ''}" href="#ch-${c.id}">
        <svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true">${ICO[glyphs[i % glyphs.length]].replace(/<\/?svg[^>]*>/g, '')}</svg>
        <span class="no">Stop ${i + 1} · ${esc(c.pages)}</span><h3>${esc(c.title)}</h3><p>${esc(c.sub)} · ${c.minutes} min</p>
        <div class="foot">${AUD[c.id] ? `<span class="chip">${ICO.play} ${fmt(AUD[c.id].dur)} video</span>` : '<span></span>'}${ring(chSeen(c) / steps(c).length)}</div></a>`).join('')}
        <a class="bx wide" href="#recap"><span class="no">Finish</span><h3>Recap and cheat sheet</h3><p>Everything you learned, on one page.</p><div class="foot"><span class="chip" style="background:var(--abg);color:var(--act)">${S.pts} pts</span>${ring(Object.keys(S.seen).length / total())}</div></a>
      </div>
      <p class="note">This PoC ships with one paper. Every stop is generated from one data file, so more papers can plug in.</p>
    </section></div>`;
  $$('[data-start]').forEach(a => a.onclick = () => { S.pos[a.dataset.start] = 0; save(); sessionStorage.setItem('autoplay', '1'); });
  $$('.bx').forEach(b => b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.setProperty('--mx', e.clientX - r.left + 'px'); b.style.setProperty('--my', e.clientY - r.top + 'px'); }));
  animateHero(token);
  if (G && window.ScrollTrigger && !reduce) {
    ScrollTrigger.getAll().forEach(t => t.kill());
    $$('.stats .stat, .steps4 .s, .bento .bx').forEach(el => { if (el.getBoundingClientRect().top < innerHeight) return; G.from(el, { y: 30, opacity: 0, duration: .7, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 96%', once: true } }); });
    $$('.stat b[data-n]').forEach(b => { const o = { v: 0 }, n = +b.dataset.n; G.to(o, { v: n, duration: 1.4, ease: 'power2.out', scrollTrigger: { trigger: b, start: 'top 95%' }, onUpdate: () => b.textContent = (b.dataset.p || '') + Math.round(o.v) + (b.dataset.s || '') }); });
  }
}

let cur = null;
function chapter(id) {
  const c = P.chapters.find(x => x.id === id);
  if (!c) return home();
  ++view;
  const i = Math.min(S.pos[id] || 0, steps(c).length - 1);
  cur = { c, i };
  document.title = c.title + ' · ' + P.short;
  renderStep(true);
}

function renderStep(fresh) {
  if (player) { player.destroy(); player = null; }
  const { c, i } = cur, all = steps(c), s = all[i], k = c.id + ':' + i;
  if (!S.seen[k]) { S.seen[k] = 1; addPts(5); }
  S.pos[c.id] = i; save(); updateMeter();
  const ci = P.chapters.indexOf(c), nextCh = P.chapters[ci + 1], last = i === all.length - 1;
  const seenN = all.filter((_, j) => S.seen[c.id + ':' + j]).length;
  const nextLabel = last ? (nextCh ? 'Next: ' + nextCh.title : 'Finish: your recap') : s.t === 'video' ? 'Start reading' : 'Next';
  app.innerHTML = `<div class="reader">
    <aside class="rail"><div class="crumb"><a href="#start" style="color:inherit">${esc(P.short)}</a> · Stop ${ci + 1}/${P.chapters.length} · ${esc(c.pages)}</div><h2>${esc(c.title)}</h2>
      <ol class="tl"><span class="prog" style="height:${all.length > 1 ? i / (all.length - 1) * 100 : 0}%"></span>${all.map((st, j) => `<li class="${j === i ? 'cur' : S.seen[c.id + ':' + j] ? 'seen' : ''}"><button data-j="${j}" ${j === i ? 'aria-current="step"' : ''}><span class="dot">${S.seen[c.id + ':' + j] && j !== i ? '✓' : j + 1}</span><span class="lbl">${esc(stepTitle(c, st))}</span></button></li>`).join('')}</ol></aside>
    <div class="main">
      <div class="mtop"><div class="crumb"><a href="#start" style="color:inherit">${esc(P.short)}</a> · Stop ${ci + 1}/${P.chapters.length}</div><h2>${esc(c.title)}</h2><div class="mdots">${all.map((_, j) => `<i class="${j === i ? 'cur' : S.seen[c.id + ':' + j] ? 'seen' : ''}"></i>`).join('')}</div></div>
      <article class="card ${s.t === 'video' ? 'vid' : ''}" id="card">${s.t === 'video' ? '' : `<div class="kind ${isCheck(s) ? 'q' : ''}">${LABEL[s.t]}</div>`}${body(s, k, c)}${src(s)}</article>
    </div></div>
    <nav class="dock" aria-label="Step navigation">
      <button class="btn ghost" id="prev" aria-label="Back" ${i === 0 && ci === 0 ? 'disabled' : ''}>${ICO.back}</button>
      <span class="pos">${i + 1} / ${all.length}</span>
      <button class="btn glow" id="next"><span>${esc(nextLabel)}</span>${ICO.arrow}</button>
    </nav>`;
  wire(s, k, c);
  gate(s, k);
  $$('.tl button').forEach(b => b.onclick = () => go(+b.dataset.j));
  $('#prev').onclick = () => i > 0 ? go(i - 1) : (S.pos[P.chapters[ci - 1].id] = steps(P.chapters[ci - 1]).length - 1, save(), location.hash = 'ch-' + P.chapters[ci - 1].id);
  $('#next').onclick = () => {
    if ($('#next').disabled) return;
    if (!last) return go(i + 1);
    if (nextCh) S.pos[nextCh.id] = S.pos[nextCh.id] || 0;
    location.hash = nextCh ? 'ch-' + nextCh.id : 'recap';
  };
  if (G && !reduce) G.from('#card', { y: 18, opacity: 0, duration: .45, ease: 'power3.out', clearProps: 'all' });
  if (!fresh) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}
function go(j) { cur.i = j; renderStep(); }

function gate(s, k) {
  const need = isCheck(s) || s.t === 'match' || s.t === 'order';
  $('#next').disabled = need && !S.ans[k];
  $('#next').title = need && !S.ans[k] ? 'Answer to continue' : '';
}
function unlock(k, v) { if (!S.ans[k]) S.ans[k] = v; save(); $('#next').disabled = false; $('#next').title = ''; }
function src(s) {
  if (!s.src) return '';
  return `<details class="src"><summary>What the paper says · ${esc(s.src.where)}</summary><blockquote>${esc(s.src.quote)}</blockquote></details>`;
}

/* ---------- step bodies ---------- */
function body(s, k, c) {
  const h = s.h ? `<h2>${esc(s.h)}</h2>` : '';
  const intro = s.intro ? `<div class="body">${gloss(s.intro)}</div>` : '';
  switch (s.t) {
    case 'video': return `<div id="vid"></div><div class="vidnote"><span>Narrated explainer · ${fmt(AUD[c.id].dur)} · captions on, press <kbd>Space</kbd> to play</span><span>Then read on for the details.</span></div>`;
    case 'text': return `${h}<div class="body">${gloss(s.body)}</div>`;
    case 'quiz': case 'predict': return `<h2>${s.q}</h2><div class="opts">${s.options.map((o, j) => `<button class="opt" data-j="${j}" data-l="${'ABCD'[j]}">${esc(o)}</button>`).join('')}</div><div id="fb"></div>`;
    case 'trace': return `${h}${intro}<div class="tabs" role="tablist">${s.methods.map((m, j) => `<button class="tab" role="tab" data-j="${j}" aria-selected="${j === s.methods.length - 1}">${esc(m.name)}</button>`).join('')}</div>
      <div class="tq"><b>Task:</b> ${esc(s.question)}</div>
      <div class="term"><div class="bar"><i></i><i></i><i></i><span id="tname"></span></div><div class="trace" id="trace"></div></div>
      <div class="tctl"><button class="btn glow" id="autoBtn">${ICO.play}<span>Play</span></button><button class="btn ghost" id="stepBtn">Next step</button><button class="btn ghost" id="allBtn">Show all</button><button class="btn ghost" id="rstBtn">Restart</button></div><div id="verdict"></div>`;
    case 'bars': return `${h}${intro}${s.groups.map(g => `<div class="bgroup"><h3>${esc(g.label)}</h3>${g.rows.map(r => `<div class="brow ${r[2] === 1 ? 'hl' : r[2] === 2 ? 'ref' : ''}"><span class="lab">${esc(r[0])}</span><span class="trk"><i data-w="${r[1] / g.max * 100}"></i></span><span class="v" data-v="${r[1]}">0</span></div>`).join('')}</div>`).join('')}
      <div class="legend"><span class="l1">ReAct and its variants</span><span>Baselines</span><span class="l2">Trained systems or humans, for scale</span></div>${s.note ? `<p class="cap">${gloss(s.note)}</p>` : ''}`;
    case 'match': return `${h}${intro}<div class="mgrid"><div class="mcol" id="ml"></div><div class="mcol" id="mr"></div></div><div id="fb"></div>`;
    case 'order': return `${h}${intro}<div class="built" id="built" aria-label="Your order"></div><div class="mcol" id="pool"></div><div class="tctl"><button class="btn ghost" id="undo">Undo</button><button class="btn ghost" id="reveal">Show answer</button></div><div id="fb"></div>`;
  }
  return '';
}

const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

function wire(s, k, c) {
  if (s.t === 'video' && window.Explainer) {
    const auto = sessionStorage.getItem('autoplay'); sessionStorage.removeItem('autoplay');
    Explainer.mount($('#vid'), c.video, AUD[c.id], {
      onEnd: () => { if (!S.ans[k]) { S.ans[k] = { ok: true }; save(); addPts(10, 'video watched'); } },
      onDone: () => $('#next').click()
    }).then(p => { player = p; if (auto && p) p.play(); });
  }
  if (isCheck(s)) {
    const btns = $$('.opt');
    const show = (pick, first) => {
      btns.forEach((b, j) => { b.disabled = true; if (j === s.answer) b.classList.add('right'); else if (j === pick) b.classList.add('wrong'); });
      const ok = pick === s.answer;
      $('#fb').innerHTML = `<div class="fb">${s.t === 'predict' ? `<b class="${ok ? 'ok' : 'no'}">${ok ? 'Good instinct.' : 'Not quite, and that is the interesting part.'}</b> ` : `<b class="${ok ? 'ok' : 'no'}">${ok ? 'Correct.' : 'Not this time.'}</b> `}${gloss(s.why)}</div>`;
      if (G && first && !reduce) { G.from('#fb .fb', { y: 10, opacity: 0, duration: .4 }); if (!ok) G.fromTo(btns[pick], { x: -6 }, { x: 0, duration: .4, ease: 'elastic.out(1,.3)' }); }
      if (first) { addPts(ok ? 15 : 5, ok ? 'right first time' : 'for trying'); unlock(k, { pick, ok }); if (ok) confetti(btns[pick]); }
    };
    if (S.ans[k]) show(S.ans[k].pick, false);
    btns.forEach((b, j) => b.onclick = () => show(j, true));
  }
  if (s.t === 'trace') {
    let m = s.methods.length - 1, n = 0, timer = 0, typing = 0;
    const tabs = $$('.tab'), tagName = { thought: 'THOUGHT', act: 'ACTION', obs: 'OBS', answer: 'ANSWER', note: '' };
    const lineHTML = ([t, x]) => `<div class="ln ${t}"><span class="tag">${tagName[t]}</span><span class="tx">${esc(x)}</span></div>`;
    const stopAuto = () => { clearInterval(timer); timer = 0; $('#autoBtn span').textContent = 'Play'; };
    const draw = (animateLast) => {
      const M = s.methods[m]; $('#tname').textContent = M.name.toLowerCase() + '.log';
      $('#trace').innerHTML = M.steps.slice(0, n).map(lineHTML).join('') || '<div class="ln note"><span></span><span>Press Play, or step through it yourself.</span></div>';
      const done = n >= M.steps.length;
      $('#stepBtn').disabled = done; $('#allBtn').disabled = done; if (done) stopAuto();
      $('#verdict').innerHTML = done ? `<div class="verdict ${M.ok ? 'ok' : 'no'}"><b>${M.ok ? '✓' : '✗'}</b><span>${esc(M.verdict)}</span></div>` : '';
      tabs.forEach((t, j) => t.setAttribute('aria-selected', j === m));
      if (animateLast && n && !reduce) {
        const row = $('#trace').lastElementChild, tx = row.querySelector('.tx'), full = tx.textContent; let j = 0; clearTimeout(typing);
        if (G) G.from(row, { opacity: 0, x: -10, duration: .25 });
        (function type() { tx.textContent = full.slice(0, j += 3); if (j < full.length) typing = setTimeout(type, 12); })();
      }
    };
    tabs.forEach((t, j) => t.onclick = () => { stopAuto(); m = j; n = 0; draw(); });
    $('#stepBtn').onclick = () => { n++; draw(true); };
    $('#allBtn').onclick = () => { stopAuto(); n = s.methods[m].steps.length; draw(); };
    $('#rstBtn').onclick = () => { stopAuto(); n = 0; draw(); };
    $('#autoBtn').onclick = () => {
      if (timer) return stopAuto();
      if (n >= s.methods[m].steps.length) n = 0;
      $('#autoBtn span').textContent = 'Pause'; n++; draw(true);
      timer = setInterval(() => { n++; draw(true); }, 1300);
    };
    draw();
  }
  if (s.t === 'bars') {
    const bars = $$('.trk i'), vals = $$('.brow .v');
    if (G && !reduce) {
      bars.forEach((b, i) => G.to(b, { width: b.dataset.w + '%', duration: 1.1, delay: .15 + i * .06, ease: 'power3.out' }));
      vals.forEach((v, i) => { const t = +v.dataset.v, o = { x: 0 }; G.to(o, { x: t, duration: 1.1, delay: .15 + i * .06, ease: 'power3.out', onUpdate: () => v.textContent = t % 1 ? o.x.toFixed(1) : Math.round(o.x) }); });
    } else { bars.forEach(b => b.style.width = b.dataset.w + '%'); vals.forEach(v => v.textContent = v.dataset.v); }
  }
  if (s.t === 'match') {
    const L = shuffle(s.pairs.map((p, j) => [p[0], j])), R = shuffle(s.pairs.map((p, j) => [p[1], j]));
    let sel = null, miss = 0; const done = new Set();
    if (S.ans[k]) s.pairs.forEach((_, j) => done.add(j));
    const draw = () => {
      $('#ml').innerHTML = L.map(([t, j]) => `<button class="mi ${done.has(j) ? 'done' : ''} ${sel === j ? 'sel' : ''}" data-j="${j}" ${done.has(j) ? 'disabled' : ''}>${done.has(j) ? `<span class="n">${j + 1}</span>` : ''}${esc(t)}</button>`).join('');
      $('#mr').innerHTML = R.map(([t, j]) => `<button class="mi ${done.has(j) ? 'done' : ''}" data-j="${j}" ${done.has(j) ? 'disabled' : ''}>${done.has(j) ? `<span class="n">${j + 1}</span>` : ''}${esc(t)}</button>`).join('');
      $$('#ml .mi').forEach(b => b.onclick = () => { sel = +b.dataset.j; draw(); });
      $$('#mr .mi').forEach(b => b.onclick = () => {
        if (sel === null) return;
        if (+b.dataset.j === sel) { done.add(sel); sel = null; draw(); if (done.size === s.pairs.length) finish(true); }
        else { miss++; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
      });
    };
    const finish = (live) => {
      if (!S.ans[k]) { addPts(miss === 0 ? 15 : 5, miss === 0 ? 'perfect match' : 'all matched'); unlock(k, { ok: miss === 0 }); if (live && miss === 0) confetti($('#ml')); }
      $('#fb').innerHTML = `<div class="fb"><b class="ok">All matched${live ? (miss ? ` with ${miss} slip${miss > 1 ? 's' : ''}` : ', first try') : ''}.</b> One mechanism, many jobs: the same free-form “thought” slot does all of these.</div>`;
    };
    draw(); if (S.ans[k]) finish(false);
  }
  if (s.t === 'order') {
    const pool = shuffle(s.items.map((t, j) => [t, j])); let built = [], miss = 0;
    const draw = () => {
      $('#built').innerHTML = built.map((j, x) => `<div class="mi done"><span class="n">${x + 1}</span>${esc(s.items[j])}</div>`).join('') || '<span class="hint" style="color:var(--muted);font-size:14px;padding:6px">Tap the first piece below.</span>';
      $('#pool').innerHTML = pool.filter(([, j]) => !built.includes(j)).map(([t, j]) => `<button class="mi" data-j="${j}">${esc(t)}</button>`).join('');
      $$('#pool .mi').forEach(b => b.onclick = () => {
        const j = +b.dataset.j;
        if (j === built.length) { built.push(j); draw(); if (G && !reduce) G.from($('#built').lastElementChild, { y: 20, opacity: 0, duration: .3 }); if (built.length === s.items.length) end(miss === 0, true); }
        else { miss++; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
      });
    };
    const end = (ok, live) => {
      if (!S.ans[k]) { addPts(ok ? 15 : 5, ok ? 'perfect order' : 'done'); unlock(k, { ok }); if (live && ok) confetti($('#built')); }
      $('#fb').innerHTML = `<div class="fb"><b class="ok">That's the loop.</b> Thoughts sit between observations and actions: they read what came back and decide what to do next. Repeat until Finish.</div>`;
    };
    $('#undo').onclick = () => { built.pop(); draw(); };
    $('#reveal').onclick = () => { built = s.items.map((_, j) => j); miss++; draw(); end(false); };
    if (S.ans[k]) { built = s.items.map((_, j) => j); draw(); end(S.ans[k].ok); } else draw();
  }
}

function recap() {
  ++view;
  document.title = 'Recap · ' + P.short;
  const checks = []; P.chapters.forEach(c => steps(c).forEach((s, i) => { if (s.t === 'quiz') checks.push([c, i, s]); }));
  const right = checks.filter(([c, i]) => S.ans[c.id + ':' + i]?.ok);
  const pct = Math.round(Object.keys(S.seen).length / total() * 100);
  app.innerHTML = `<div class="wrap recap" style="max-width:1000px">
    <span class="pill"><b></b>Recap</span>
    <h1>${pct >= 100 ? 'You read the whole paper.' : 'Your cheat sheet so far'}</h1>
    <p class="lede">${P.oneLiner}</p>
    <div class="score">
      <div class="stat"><b>${pct}%</b><span>of the paper covered</span></div>
      <div class="stat"><b>${right.length}/${checks.length}</b><span>checks right first time</span></div>
      <div class="stat"><b style="color:var(--obs)">${S.pts}</b><span>points</span></div>
    </div>
    <h2 class="sh">Key points, stop by stop</h2><p class="sp">Copy it into your notes, or revisit anything you missed.</p>
    <div class="sheet">${P.chapters.map(c => {
      const miss = checks.filter(([cc, i]) => cc === c && S.ans[c.id + ':' + i] && !S.ans[c.id + ':' + i].ok);
      return `<section><h3>${esc(c.title)}</h3><ul>${c.keys.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${miss.length ? `<div class="missed">Worth another look: ${miss.map(([, i, s]) => `<a href="#ch-${c.id}" data-go="${c.id}:${i}">${esc(strip(s.q))}</a>`).join(' · ')}</div>` : ''}</section>`;
    }).join('')}</div>
    <div class="cta" style="margin-top:28px"><button class="btn glow" id="copy">Copy cheat sheet</button><a class="btn ghost" href="#start">Back to the route</a><span id="copied" style="color:var(--muted);font-size:14px"></span></div></div>`;
  $$('[data-go]').forEach(a => a.onclick = () => { const [id, i] = a.dataset.go.split(':'); S.pos[id] = +i; save(); });
  if (G && !reduce) G.from('.recap > *, .sheet section', { y: 20, opacity: 0, stagger: .05, duration: .5, ease: 'power3.out' });
  if (pct >= 100) setTimeout(() => confetti($('h1')), 300);
  $('#copy').onclick = async () => {
    const txt = P.title + '\n\n' + P.chapters.map(c => c.title + '\n' + c.keys.map(x => '- ' + x).join('\n')).join('\n\n');
    try { await navigator.clipboard.writeText(txt); $('#copied').textContent = 'Copied.'; } catch { $('#copied').textContent = 'Copy is blocked here. Select the text instead.'; }
  };
}

/* ---------- glossary popover ---------- */
const pop = $('#pop');
function showPop(key, anchor) {
  const [term, def] = P.glossary[key];
  pop.innerHTML = `<b>${esc(term)}</b>${esc(def)}`; pop.hidden = false;
  const r = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2 - 160, bottom: 120, top: 120 }, w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = Math.max(12, Math.min(r.left, innerWidth - w - 12)) + 'px';
  pop.style.top = (r.bottom + h + 12 > innerHeight ? r.top - h - 8 : r.bottom + 8) + 'px';
  if (G && !reduce) G.from(pop, { y: 6, opacity: 0, duration: .2 });
}
document.addEventListener('click', e => {
  const g = e.target.closest('.gl[data-k]');
  if (g) return showPop(g.dataset.k, g);
  if (!e.target.closest('#pop')) pop.hidden = true;
});
addEventListener('scroll', () => pop.hidden = true, { passive: true });

/* ---------- command palette ---------- */
const cmd = $('#cmd'), cin = $('#cmdInput'), clist = $('#cmdList');
let items = [], sel = 0;
function cmdItems() {
  const out = [];
  P.chapters.forEach((c, ci) => {
    out.push({ ic: String(ci + 1), t: c.title, d: c.sub + ' · ' + c.pages, ty: 'Stop', go: () => { location.hash = 'ch-' + c.id; } });
    steps(c).forEach((s, i) => out.push({ ic: '·', t: stepTitle(c, s), d: c.title, ty: LABEL[s.t], go: () => { S.pos[c.id] = i; save(); if (location.hash === '#ch-' + c.id) { cur.i = i; renderStep(); } else location.hash = 'ch-' + c.id; } }));
  });
  out.push({ ic: '★', t: 'Recap and cheat sheet', d: 'Everything on one page', ty: 'Page', go: () => { location.hash = 'recap'; } });
  Object.entries(P.glossary).forEach(([k, [t, d]]) => out.push({ ic: 'Aa', g: 1, t, d, ty: 'Term', go: () => setTimeout(() => showPop(k), 30) }));
  return out;
}
function drawCmd() {
  const q = cin.value.toLowerCase().trim();
  items = cmdItems().filter(x => !q || (x.t + ' ' + x.d).toLowerCase().includes(q)).slice(0, 40);
  sel = Math.min(sel, Math.max(0, items.length - 1));
  clist.innerHTML = items.map((x, i) => `<li role="option" data-i="${i}" aria-selected="${i === sel}"><span class="ic ${x.g ? 'g' : ''}">${esc(x.ic)}</span><span><span class="t">${esc(x.t)}</span><span class="d">${esc(x.d)}</span></span><span class="ty">${esc(x.ty)}</span></li>`).join('') || '<li><span></span><span class="d">Nothing matches.</span></li>';
  $$('li[data-i]', clist).forEach(li => li.onclick = () => { sel = +li.dataset.i; pick(); });
  clist.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' });
}
function openCmd() { cmd.hidden = false; cin.value = ''; sel = 0; drawCmd(); cin.focus(); if (G && !reduce) G.from('.cmd-in', { y: -12, scale: .98, opacity: 0, duration: .25, ease: 'power3.out' }); }
function closeCmd() { cmd.hidden = true; }
function pick() { const x = items[sel]; closeCmd(); x && x.go(); }
$('#cmdBtn').onclick = openCmd;
cmd.onclick = e => { if (e.target === cmd) closeCmd(); };
cin.oninput = () => { sel = 0; drawCmd(); };
cin.onkeydown = e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); drawCmd(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); drawCmd(); }
  if (e.key === 'Enter') { e.preventDefault(); pick(); }
};

/* ---------- theme switch ---------- */
const SUN = 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z';
const MOON = 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z';
function applyTheme(t, persist) {
  document.documentElement.dataset.theme = t;
  $('#themeIc').setAttribute('d', t === 'dark' ? SUN : MOON);
  const lbl = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  $('#themeBtn').setAttribute('aria-label', lbl); $('#themeBtn').title = lbl;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#07090d' : '#f5f7fa');
  if (persist) try { localStorage.setItem('paperwalk-theme', t); } catch {}
}
applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
$('#themeBtn').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', e => { let saved = null; try { saved = localStorage.getItem('paperwalk-theme'); } catch {} if (!saved) applyTheme(e.matches ? 'light' : 'dark'); });

/* ---------- reset progress ---------- */
const dlg = $('#resetDlg');
const closeDlg = () => { dlg.hidden = true; $('#resetBtn').focus(); };
$('#resetBtn').onclick = () => { dlg.hidden = false; $('#rCancel').focus(); if (G && !reduce) G.from('.dlg', { y: -10, scale: .98, opacity: 0, duration: .25, ease: 'power3.out' }); };
$('#rCancel').onclick = closeDlg;
dlg.onclick = e => { if (e.target === dlg) closeDlg(); };
$('#rOk').onclick = () => {
  if (!P) return closeDlg();
  S = blank(); save(); dlg.hidden = true; updateMeter();
  location.hash === '#start' || location.hash === '' ? route() : (location.hash = 'start');
  toast('<b>Reset.</b> Starting fresh');
};

/* ---------- keys and routing ---------- */
document.addEventListener('keydown', e => {
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !/input|textarea/i.test(e.target.tagName))) { e.preventDefault(); return cmd.hidden ? openCmd() : closeCmd(); }
  if (e.key === 'Escape') { closeCmd(); pop.hidden = true; if (!dlg.hidden) closeDlg(); return; }
  if (!dlg.hidden) return;
  if (!cur || !location.hash.startsWith('#ch-') || /input|textarea/i.test(e.target.tagName) || !cmd.hidden) return;
  if (e.key === ' ' && player && !e.target.closest('button,a,.vp')) { e.preventDefault(); return player.toggle(); }
  if (e.key === 'ArrowRight') $('#next')?.click();
  if (e.key === 'ArrowLeft') $('#prev')?.click();
});
function route() {
  pop.hidden = true; closeCmd();
  if (player) { player.destroy(); player = null; }
  if (window.ScrollTrigger) ScrollTrigger.getAll().forEach(t => t.kill());
  const h = location.hash.slice(1);
  if (h.startsWith('ch-')) return chapter(h.slice(3));
  cur = null; window.scrollTo(0, 0);
  if (h === 'recap') return recap();
  home();
}
addEventListener('hashchange', route);

/* ---------- boot: papers/index.json lists papers; ?paper=id picks one ---------- */
(async () => {
  try {
    const list = await (await fetch('papers/index.json')).json();
    const want = new URLSearchParams(location.search).get('paper');
    const entry = list.find(p => p.id === want) || list[0];
    P = await (await fetch('papers/' + entry.file)).json();
    try { AUD = await (await fetch(`assets/audio/${P.id}/manifest.json`)).json(); } catch { AUD = {}; }
    KEY = 'paperwalk2:' + P.id; S = load();
    updateMeter(); route();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<p class="loading">Could not load the paper. If you opened this file directly, serve the folder instead (for example <code>npx serve .</code>).</p>`;
  }
})();
}
