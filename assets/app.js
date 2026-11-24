/* Paperwalk: a guided reader that renders any paper file in papers/*.json */
{
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const strip = s => String(s).replace(/<[^>]+>/g, '');
const app = $('#app');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let P = null, S = null, KEY = '', FILMS = {};

/* ---------- storage ---------- */
const blank = () => ({ seen: {}, ans: {}, pts: 0, pos: {} });
function load() { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch { return blank(); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

/* ---------- helpers ---------- */
const total = () => P.chapters.reduce((n, c) => n + c.steps.length, 0);
const chSeen = c => c.steps.filter((_, i) => S.seen[c.id + ':' + i]).length;
const isCheck = s => s.t === 'quiz' || s.t === 'predict';
const KIND = { text: 'Read', predict: 'Guess first', quiz: 'Quick check', trace: 'Replay', bars: 'The evidence', match: 'Match up', order: 'Put in order' };
const stepTitle = s => strip(s.h || s.q || KIND[s.t]);
const fmtMin = sec => { const m = Math.floor(sec / 60), s = Math.round(sec % 60); return m + ':' + String(s).padStart(2, '0'); };
const filmLen = id => FILMS[id] ? Film.minutes(FILMS[id]) : 0;
function gloss(html) {
  return html.replace(/\{\{([^}|]+)(?:\|([^}]+))?\}\}/g, (_, label, key) => {
    const k = (key || label).trim().toLowerCase();
    return P.glossary[k] ? `<button class="gl" data-k="${esc(k)}">${label}</button>` : label;
  });
}
function addPts(n) {
  if (!n) return;
  S.pts += n; save();
  const x = $('#xp'); x.textContent = S.pts + ' pts';
  if (!reduce) { x.classList.remove('bump'); void x.offsetWidth; x.classList.add('bump'); }
}
function updateMeter() {
  const pct = Math.round(Object.keys(S.seen).length / total() * 100);
  $('#pbar').style.width = pct + '%'; $('#ptext').textContent = pct + '%';
  $('#xp').textContent = S.pts + ' pts';
}
function ring(frac) {
  const r = 22, C = 2 * Math.PI * r, done = frac >= 1;
  return `<svg class="ring" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="${r}" fill="none" stroke="var(--line)" stroke-width="4"/>
  <circle cx="26" cy="26" r="${r}" fill="none" stroke="url(#rg)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C * frac} ${C}" transform="rotate(-90 26 26)"/>
  ${done ? '<path d="M17 27l6 6 12-13" fill="none" stroke="var(--think)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' : `<text x="26" y="30.5" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">${Math.round(frac * 100)}%</text>`}</svg>`;
}
const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
function burst(target) {
  if (reduce || !target) return;
  const r = target.getBoundingClientRect(), cols = ['var(--think)', 'var(--act)', 'var(--obs)', 'var(--accent)'];
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('i'); p.className = 'spark-p';
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
    p.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${cols[i % 4]};--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px`;
    document.body.appendChild(p); setTimeout(() => p.remove(), 900);
  }
}
function swap(fn) { // smooth view changes where the browser supports it
  if (!reduce && document.startViewTransition) document.startViewTransition(fn); else fn();
}
function playFilm(ids) { if (Object.keys(FILMS).length) Film.open(P.chapters, FILMS, ids); }

/* ---------- living loop (hero): a spark travels the cycle and the console narrates each stop ---------- */
let heroRAF = 0;
function loopSVG() {
  return `<svg viewBox="-30 0 580 420" role="img" aria-label="The ReAct loop: Thought, then Action, then Observation, repeated until Finish">
    <defs>
      <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--think)"/><stop offset=".55" stop-color="var(--act)"/><stop offset="1" stop-color="var(--obs)"/></linearGradient>
      <radialGradient id="sg"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="var(--spark)"/><stop offset="1" stop-color="var(--spark)" stop-opacity="0"/></radialGradient>
    </defs>
    <path id="loopPath" d="M260,64 C380,64 456,170 444,262 C430,352 340,372 260,356 C180,372 90,352 76,262 C64,170 140,64 260,64Z" fill="none" stroke="var(--line)" stroke-width="2"/>
    <path d="M260,64 C380,64 456,170 444,262 C430,352 340,372 260,356 C180,372 90,352 76,262 C64,170 140,64 260,64Z" fill="none" stroke="url(#hg)" stroke-width="2.5" stroke-dasharray="6 14" class="dash"/>
    <g id="trail"></g>
    <circle id="spark" r="16" fill="url(#sg)" cx="260" cy="64"/>
    ${[['think', 260, 64, 'Thought', 'a note to self'], ['act', 444, 262, 'Action', 'touches the world'], ['obs', 76, 262, 'Observation', 'the world replies']].map(([k, x, y, t, s], j) => `
    <g class="hn" data-n="${j}" style="--c:var(--${k})"><circle class="halo" cx="${x}" cy="${y}" r="46"/><rect x="${x - 82}" y="${y - 30}" width="164" height="60" rx="18"/>
      <text x="${x}" y="${y - 2}" class="t1">${t}</text><text x="${x}" y="${y + 17}" class="t2">${s}</text></g>`).join('')}
    <text x="260" y="198" text-anchor="middle" class="rep">repeat until</text>
    <text x="260" y="228" text-anchor="middle" class="fin">Finish[answer]</text>
  </svg>`;
}
function startHero() {
  cancelAnimationFrame(heroRAF);
  const path = $('#loopPath'); if (!path) return;
  const demo = P.chapters.flatMap(c => c.steps).find(s => s.t === 'trace');
  const lines = demo ? demo.methods.at(-1).steps : [];
  const L = path.getTotalLength();
  const stops = [[260, 64], [444, 262], [76, 262]].map(([x, y]) => { let best = 0, bd = 1e9; for (let d = 0; d < L; d += 2) { const p = path.getPointAtLength(d), dd = (p.x - x) ** 2 + (p.y - y) ** 2; if (dd < bd) { bd = dd; best = d; } } return best; });
  const spark = $('#spark'), nodes = $$('.hn'), con = $('#console'), trail = $('#trail');
  const tag = { thought: 'Thought', act: 'Action', obs: 'Observation', answer: 'Answer' };
  let li = 0, lastStop = -1, start = performance.now(), typing = 0;
  const kindAt = { thought: 0, act: 1, obs: 2 };
  const say = () => {
    if (!lines.length) return;
    const [k, x] = lines[li % lines.length]; li++;
    const row = document.createElement('div'); row.className = 'cl ' + k;
    row.innerHTML = `<span class="tg">${tag[k] || ''}</span><span class="tx"></span>`;
    con.appendChild(row); while (con.children.length > 4) con.firstChild.remove();
    const tx = row.querySelector('.tx'); let n = 0; clearInterval(typing);
    if (reduce) { tx.textContent = x; return; }
    typing = setInterval(() => { n += 2; tx.textContent = x.slice(0, n); if (n >= x.length) clearInterval(typing); }, 16);
  };
  if (reduce) { say(); say(); say(); return; }
  const DUR = 9000;
  const tick = now => {
    heroRAF = requestAnimationFrame(tick);
    if (!document.body.contains(path)) { cancelAnimationFrame(heroRAF); clearInterval(typing); return; }
    const d = ((now - start) % DUR) / DUR * L, p = path.getPointAtLength(d);
    spark.setAttribute('cx', p.x); spark.setAttribute('cy', p.y);
    if (Math.random() < 0.5) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', 3); c.setAttribute('class', 'tr');
      trail.appendChild(c); setTimeout(() => c.remove(), 700);
    }
    const near = stops.findIndex(s => Math.abs(d - s) < L * 0.025);
    if (near > -1 && near !== lastStop) {
      lastStop = near;
      nodes.forEach((n, j) => n.classList.toggle('on', j === near));
      // advance the console until the next line matches this node's kind
      for (let g = 0; g < 4 && lines.length; g++) { const k = lines[li % lines.length][0]; if (kindAt[k] === near || k === 'answer') break; li++; }
      say();
    }
  };
  heroRAF = requestAnimationFrame(tick);
}

/* ---------- reveal on scroll + spotlight cards ---------- */
let io;
function reveal() {
  io?.disconnect();
  if (reduce || !('IntersectionObserver' in window)) { $$('.rv').forEach(e => e.classList.add('in')); return; }
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach(e => io.observe(e));
}
document.addEventListener('pointermove', e => {
  const c = e.target.closest?.('.spot');
  if (c) { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
  if (!reduce) { document.documentElement.style.setProperty('--gx', e.clientX + 'px'); document.documentElement.style.setProperty('--gy', e.clientY + 'px'); }
}, { passive: true });

/* ---------- views ---------- */
function home() {
  document.title = P.short + ' · Paperwalk';
  const started = Object.keys(S.seen).length > 0;
  const next = P.chapters.find(c => chSeen(c) < c.steps.length) || P.chapters[0];
  const [head, ...rest] = P.title.split(':');
  const allFilm = P.chapters.reduce((n, c) => n + filmLen(c.id), 0);
  const prog = Object.keys(S.seen).length / total();
  const terms = Object.values(P.glossary).map(g => g[0]);
  app.innerHTML = `<div class="wrap">
    <section class="hero">
      <div class="hero-copy">
        <div class="pill rv"><span class="live"></span>${esc(P.venue)} · ${P.minutes} min read · ${P.chapters.length} stops</div>
        <h1 class="rv">${esc(head)}${rest.length ? `:<br><em>${esc(rest.join(':').trim())}</em>` : ''}</h1>
        <p class="lede rv">${P.oneLiner}</p>
        <p class="why rv">${esc(P.why)}</p>
        <div class="cta rv">
          <a class="btn primary mag" href="#ch-${next.id}">${started ? 'Continue: ' + esc(next.title) : 'Start reading'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          ${allFilm ? `<button class="btn glass mag" id="watchAll">${playIcon}Watch the film <span class="dim">${fmtMin(allFilm)}</span></button>` : ''}
          <a class="btn ghost" href="${esc(P.link)}" target="_blank" rel="noopener">Original paper ↗</a>
        </div>
        <p class="authors rv">${esc(P.authors)} · ${esc(P.affil)}</p>
      </div>
      <div class="hero-fig rv">
        <div class="loopfig spot">${loopSVG()}</div>
        <div class="console" aria-hidden="true"><div class="con-bar"><i></i><i></i><i></i><span>live trace · Figure 1</span></div><div id="console"></div></div>
      </div>
    </section>

    <div class="marquee" aria-hidden="true"><div class="mq">${[...terms, ...terms].map(t => `<span>${esc(t)}</span>`).join('<b>✦</b>')}</div></div>

    <section class="bento">
      <div class="bt spot rv b-film"><div class="bt-art"><div class="eq-mini">▶</div><div class="wave">${Array.from({ length: 24 }, (_, j) => `<i style="--j:${j}"></i>`).join('')}</div></div><h3>Narrated films</h3><p>Every stop has a short motion-graphic explainer with voice-over and captions.</p></div>
      <div class="bt spot rv b-replay"><div class="bt-art"><div class="mini-trace"><span class="t">Thought</span><span class="a">Search[…]</span><span class="o">Observation</span></div></div><h3>Replay the model</h3><p>Step through what the model actually wrote, line by line.</p></div>
      <div class="bt spot rv b-check"><div class="bt-art"><div class="checks"><i></i><i></i><i></i></div></div><h3>Guess, then check</h3><p>Predict before you read. Points for every right first try.</p></div>
      <div class="bt spot rv b-sheet"><div class="bt-art"><div class="bars-mini"><i style="--h:40%"></i><i style="--h:65%"></i><i style="--h:50%"></i><i style="--h:92%"></i></div></div><h3>Your cheat sheet</h3><p>The key points from each stop, on one page, ready to copy.</p></div>
    </section>

    <section class="road" id="route">
      <div class="road-head rv"><div><div class="eyebrow">The route</div><h2>${P.chapters.length} stops through the paper</h2></div>
        <p>Each stop explains one part in plain words, shows the evidence, and ends with a quick check.</p></div>
      <ol class="flow" style="--prog:${prog}">
        ${P.chapters.map((c, j) => { const f = chSeen(c) / c.steps.length, fl = filmLen(c.id); return `<li class="stop rv ${f >= 1 ? 'done' : f > 0 ? 'part' : ''}" style="--i:${j}">
          <span class="node" aria-hidden="true">${String(j + 1).padStart(2, '0')}</span>
          <div class="sc spot"><a class="sc-main" href="#ch-${c.id}">${ring(f)}<span><small>${esc(c.sub)} · ${esc(c.pages)}</small><b>${esc(c.title)}</b><span class="keys">${esc(c.keys[0])}</span></span></a>
            <div class="sc-meta"><span>${c.steps.length} steps · ${c.minutes} min</span>${fl ? `<button class="filmbtn" data-film="${c.id}">${playIcon}Film ${fmtMin(fl)}</button>` : ''}</div></div></li>`; }).join('')}
        <li class="stop rv end" style="--i:${P.chapters.length}"><span class="node" aria-hidden="true">✦</span>
          <div class="sc spot"><a class="sc-main" href="#recap">${ring(prog)}<span><small>Finish line</small><b>Recap and cheat sheet</b><span class="keys">Everything you learned, on one page.</span></span></a></div></li>
      </ol>
      <p class="note">Progress is saved in this browser. <button class="linkbtn" id="reset">Start over</button></p>
    </section>
    <footer class="foot"><span>Paperwalk · a guided reading of ${esc(P.short)}</span><span>Press <kbd>⌘K</kbd> to jump anywhere</span></footer>
  </div>`;
  $('#reset').onclick = () => { if (!confirm('Clear your progress and points?')) return; S = blank(); save(); updateMeter(); home(); };
  $('#watchAll')?.addEventListener('click', () => playFilm(P.chapters.map(c => c.id)));
  $$('[data-film]').forEach(b => b.onclick = () => playFilm([b.dataset.film]));
  magnet(); reveal(); startHero();
}

function magnet() {
  if (reduce || matchMedia('(pointer: coarse)').matches) return;
  $$('.mag').forEach(b => {
    b.onpointermove = e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.12}px,${(e.clientY - r.top - r.height / 2) * 0.2}px)`; };
    b.onpointerleave = () => b.style.transform = '';
  });
}

let cur = null; // {c, i}
function chapter(id) {
  const c = P.chapters.find(x => x.id === id);
  if (!c) return home();
  const i = Math.min(S.pos[id] || 0, c.steps.length - 1);
  cur = { c, i };
  document.title = c.title + ' · ' + P.short;
  renderStep(true);
}

function renderStep(fresh) {
  const { c, i } = cur, s = c.steps[i], k = c.id + ':' + i;
  if (!S.seen[k]) { S.seen[k] = 1; addPts(5); }
  S.pos[c.id] = i; save(); updateMeter();
  const ci = P.chapters.indexOf(c), nextCh = P.chapters[ci + 1];
  const last = i === c.steps.length - 1, fl = filmLen(c.id);
  const draw = () => {
    app.innerHTML = `<div class="reader">
    <div class="rhead">
      <div><div class="crumb"><a href="#start">${esc(P.short)}</a><span>/</span>Stop ${ci + 1} of ${P.chapters.length}<span>/</span>${esc(c.pages)}</div><h1>${esc(c.title)}</h1></div>
      ${fl ? `<button class="btn glass sm" id="chFilm">${playIcon}Watch this stop <span class="dim">${fmtMin(fl)}</span></button>` : ''}
    </div>
    <div class="rgrid">
      <aside class="rail" aria-label="Steps in this stop"><div class="rail-line"><i style="height:${(i / Math.max(1, c.steps.length - 1)) * 100}%"></i></div>
        ${c.steps.map((st, j) => `<button data-j="${j}" class="${j === i ? 'cur' : S.seen[c.id + ':' + j] ? 'seen' : ''}" ${j === i ? 'aria-current="step"' : ''}><span class="dot"></span><span class="rt"><small>${KIND[st.t]}</small>${esc(stepTitle(st))}</span></button>`).join('')}
      </aside>
      <div class="rmain">
        <div class="segs" aria-hidden="true">${c.steps.map((_, j) => `<i class="${j < i ? 'd' : j === i ? 'c' : ''}"></i>`).join('')}</div>
        <article class="card spot" id="card"><div class="kind ${isCheck(s) ? 'q' : ''}"><span></span>${KIND[s.t]} · ${i + 1}/${c.steps.length}</div>${body(s, k)}${src(s)}</article>
        <div class="nav">
          <button class="btn ghost" id="prev" ${i === 0 && ci === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Back</button>
          <button class="btn primary" id="next">${last ? (nextCh ? 'Next stop: ' + esc(nextCh.title) : 'Finish: see your recap') : 'Next'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        </div>
        <p class="hint">Use ← and → keys. Tap any underlined word for a definition. <kbd>⌘K</kbd> to jump.</p>
      </div>
    </div></div>`;
    wire(s, k);
    gate(s, k);
    $$('.rail button').forEach(b => b.onclick = () => go(+b.dataset.j));
    $('#chFilm')?.addEventListener('click', () => playFilm([c.id]));
    $('#prev').onclick = () => i > 0 ? go(i - 1) : (location.hash = 'ch-' + P.chapters[ci - 1].id);
    $('#next').onclick = () => {
      if ($('#next').disabled) return;
      if (!last) return go(i + 1);
      location.hash = nextCh ? 'ch-' + nextCh.id : 'recap';
    };
  };
  fresh ? draw() : swap(draw);
  window.scrollTo({ top: 0, behavior: reduce || fresh ? 'auto' : 'smooth' });
}
function go(j) { cur.i = j; renderStep(); }

function gate(s, k) {
  const need = isCheck(s) || s.t === 'match' || s.t === 'order';
  $('#next').disabled = need && !S.ans[k];
  if (need && !S.ans[k]) $('#next').title = 'Answer to continue';
}
function unlock(k, v) { if (!S.ans[k]) S.ans[k] = v; save(); $('#next').disabled = false; $('#next').title = ''; }

function src(s) {
  if (!s.src) return '';
  return `<details class="src"><summary>What the paper says <span>${esc(s.src.where)}</span></summary><blockquote>${esc(s.src.quote)}</blockquote></details>`;
}

/* ---------- step bodies ---------- */
function body(s, k) {
  const h = s.h ? `<h2>${esc(s.h)}</h2>` : '';
  const intro = s.intro ? `<div class="body">${gloss(s.intro)}</div>` : '';
  switch (s.t) {
    case 'text': return `${h}<div class="body">${gloss(s.body)}</div>`;
    case 'quiz': case 'predict': return `<h2>${s.q}</h2><div class="opts">${s.options.map((o, j) => `<button class="opt" data-j="${j}"><span class="ok-k">${String.fromCharCode(65 + j)}</span><span>${esc(o)}</span></button>`).join('')}</div><div id="fb"></div>`;
    case 'trace': return `${h}${intro}<div class="tabs" role="tablist">${s.methods.map((m, j) => `<button class="tab" role="tab" data-j="${j}" aria-selected="${j === s.methods.length - 1}">${esc(m.name)}</button>`).join('')}</div>
      <div class="term"><div class="con-bar"><i></i><i></i><i></i><span id="tname"></span></div><div class="tq"><b>Task</b> ${esc(s.question)}</div><div class="trace" id="trace"></div></div>
      <div class="tctl"><button class="btn primary sm" id="stepBtn">Next step</button><button class="btn ghost sm" id="playBtn">${playIcon}Autoplay</button><button class="btn ghost sm" id="allBtn">Show all</button><button class="btn ghost sm" id="rstBtn">Restart</button></div><div id="verdict"></div>`;
    case 'bars': return `${h}${intro}${s.groups.map(g => `<div class="bgroup"><h3>${esc(g.label)}</h3>${g.rows.map((r, j) => `<div class="brow ${r[2] === 1 ? 'hl' : r[2] === 2 ? 'ref' : ''}" style="--j:${j}"><span class="lab">${esc(r[0])}</span><span class="trk"><i data-w="${r[1] / g.max * 100}"></i></span><span class="v" data-v="${r[1]}">0</span></div>`).join('')}</div>`).join('')}
      <div class="legend"><span class="l1">ReAct and its variants</span><span>Baselines</span><span class="l2">Trained systems or humans, for scale</span></div>${s.note ? `<p class="cap">${gloss(s.note)}</p>` : ''}`;
    case 'match': return `${h}${intro}<div class="mgrid"><div class="mcol" id="ml"></div><div class="mcol" id="mr"></div></div><div id="fb"></div>`;
    case 'order': return `${h}${intro}<div class="built" id="built" aria-label="Your order"></div><div class="mcol" id="pool"></div><div class="tctl"><button class="btn ghost sm" id="undo">Undo</button><button class="btn ghost sm" id="reveal">Show answer</button></div><div id="fb"></div>`;
  }
  return '';
}

const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
function countUp(el, v, delay = 0) {
  const dec = String(v).includes('.') ? 1 : 0;
  if (reduce) { el.textContent = v.toFixed(dec); return; }
  const t0 = performance.now() + delay, D = 900;
  const f = now => { const p = Math.min(1, Math.max(0, (now - t0) / D)), e = 1 - Math.pow(1 - p, 3); el.textContent = (v * e).toFixed(dec); if (p < 1 && document.body.contains(el)) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}

let traceTimer = 0;
function wire(s, k) {
  clearInterval(traceTimer);
  if (isCheck(s)) {
    const btns = $$('.opt', app);
    const show = (pick, first) => {
      btns.forEach((b, j) => { b.disabled = true; if (j === s.answer) b.classList.add('right'); else if (j === pick) b.classList.add('wrong'); });
      const ok = pick === s.answer;
      $('#fb').innerHTML = `<div class="fb ${ok ? 'good' : 'bad'}">${s.t === 'predict' ? `<b>${ok ? 'Good instinct.' : 'Not quite, and that is the interesting part.'}</b> ` : `<b>${ok ? 'Correct.' : 'Not this time.'}</b> `}${gloss(s.why)}</div>`;
      if (first) { addPts(ok ? 15 : 5); unlock(k, { pick, ok }); if (ok) burst(btns[pick]); }
    };
    if (S.ans[k]) show(S.ans[k].pick, false);
    btns.forEach((b, j) => b.onclick = () => show(j, true));
  }
  if (s.t === 'trace') {
    let m = s.methods.length - 1, n = 0;
    const tabs = $$('.tab', app);
    const tagName = { thought: 'Thought', act: 'Action', obs: 'Observ.', answer: 'Answer', note: '' };
    const stopAuto = () => { clearInterval(traceTimer); traceTimer = 0; $('#playBtn').innerHTML = playIcon + 'Autoplay'; };
    const draw = (animLast) => {
      const M = s.methods[m];
      $('#tname').textContent = M.name;
      $('#trace').innerHTML = M.steps.slice(0, n).map(([t, x], j) => `<div class="ln ${t} ${animLast && j === n - 1 ? 'new' : ''}"><span class="tag">${tagName[t]}</span><span class="tx">${esc(x)}</span></div>`).join('') || '<div class="ln note"><span></span><span>Press Next step or Autoplay to start the replay.</span></div>';
      const done = n >= M.steps.length;
      $('#stepBtn').disabled = done; $('#allBtn').disabled = done; $('#playBtn').disabled = done;
      if (done) stopAuto();
      $('#verdict').innerHTML = done ? `<div class="verdict ${M.ok ? 'ok' : 'no'}"><b>${M.ok ? '✓ ' : '✗ '}</b>${esc(M.verdict)}</div>` : '';
      tabs.forEach((t, j) => t.setAttribute('aria-selected', j === m));
      const newest = $('#trace .ln.new .tx');
      if (newest && !reduce) { const full = newest.textContent; let c = 0; newest.textContent = ''; const iv = setInterval(() => { c += 3; newest.textContent = full.slice(0, c); if (c >= full.length) clearInterval(iv); }, 12); }
    };
    tabs.forEach((t, j) => t.onclick = () => { stopAuto(); m = j; n = 0; draw(); });
    $('#stepBtn').onclick = () => { n++; draw(true); };
    $('#allBtn').onclick = () => { stopAuto(); n = s.methods[m].steps.length; draw(); };
    $('#rstBtn').onclick = () => { stopAuto(); n = 0; draw(); };
    $('#playBtn').onclick = () => {
      if (traceTimer) return stopAuto();
      $('#playBtn').innerHTML = '❚❚ Pause';
      const adv = () => { if (!document.body.contains($('#trace'))) return stopAuto(); n++; draw(true); };
      adv(); traceTimer = setInterval(adv, 1600);
    };
    draw();
  }
  if (s.t === 'bars') requestAnimationFrame(() => setTimeout(() => $$('.brow', app).forEach((r, j) => {
    const i = r.querySelector('.trk i'), d = reduce ? 0 : j * 70;
    i.style.transitionDelay = d + 'ms'; i.style.width = i.dataset.w + '%';
    countUp(r.querySelector('.v'), +r.querySelector('.v').dataset.v, d);
  }), reduce ? 0 : 80));
  if (s.t === 'match') {
    const L = shuffle(s.pairs.map((p, j) => [p[0], j])), R = shuffle(s.pairs.map((p, j) => [p[1], j]));
    let sel = null, done = new Set(), miss = 0;
    const solved = !!S.ans[k];
    if (solved) s.pairs.forEach((_, j) => done.add(j));
    const draw = () => {
      $('#ml').innerHTML = L.map(([t, j]) => `<button class="mi ${done.has(j) ? 'done' : ''} ${sel === j ? 'sel' : ''}" data-j="${j}" ${done.has(j) ? 'disabled' : ''}>${done.has(j) ? `<span class="n">${j + 1}</span>` : ''}${esc(t)}</button>`).join('');
      $('#mr').innerHTML = R.map(([t, j]) => `<button class="mi ${done.has(j) ? 'done' : ''}" data-j="${j}" data-r="1" ${done.has(j) ? 'disabled' : ''}>${done.has(j) ? `<span class="n">${j + 1}</span>` : ''}${esc(t)}</button>`).join('');
      $$('#ml .mi', app).forEach(b => b.onclick = () => { sel = +b.dataset.j; draw(); });
      $$('#mr .mi', app).forEach(b => b.onclick = () => {
        if (sel === null) return;
        if (+b.dataset.j === sel) { done.add(sel); sel = null; draw(); if (done.size === s.pairs.length) finish(); }
        else { miss++; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
      });
    };
    const finish = () => {
      if (!S.ans[k]) { addPts(miss === 0 ? 15 : 5); unlock(k, { ok: miss === 0 }); burst($('#mr')); }
      $('#fb').innerHTML = `<div class="fb good"><b>All matched${miss ? ` with ${miss} slip${miss > 1 ? 's' : ''}` : ', first try'}.</b> One mechanism, many jobs: the same free-form “thought” slot does all of these.</div>`;
    };
    draw(); if (solved) finish();
  }
  if (s.t === 'order') {
    const pool = shuffle(s.items.map((t, j) => [t, j])); let built = [], miss = 0;
    const draw = (msg) => {
      $('#built').innerHTML = built.map((j, x) => `<div class="mi done"><span class="n">${x + 1}</span>${esc(s.items[j])}</div>`).join('') || '<span class="hint">Tap the first piece below.</span>';
      $('#pool').innerHTML = pool.filter(([, j]) => !built.includes(j)).map(([t, j]) => `<button class="mi" data-j="${j}">${esc(t)}</button>`).join('');
      $$('#pool .mi', app).forEach(b => b.onclick = () => {
        const j = +b.dataset.j;
        if (j === built.length) { built.push(j); draw(); if (built.length === s.items.length) end(miss === 0); }
        else { miss++; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
      });
      if (msg) $('#fb').innerHTML = msg;
    };
    const end = ok => {
      if (!S.ans[k]) { addPts(ok ? 15 : 5); unlock(k, { ok }); if (ok) burst($('#built')); }
      $('#fb').innerHTML = `<div class="fb good"><b>That's the loop.</b> Thoughts sit between observations and actions: they read what came back and decide what to do next. Repeat until Finish.</div>`;
    };
    $('#undo').onclick = () => { built.pop(); draw(); };
    $('#reveal').onclick = () => { built = s.items.map((_, j) => j); miss++; draw(); end(false); };
    if (S.ans[k]) { built = s.items.map((_, j) => j); draw(); end(S.ans[k].ok); } else draw();
  }
}

function recap() {
  document.title = 'Recap · ' + P.short;
  const checks = []; P.chapters.forEach(c => c.steps.forEach((s, i) => { if (s.t === 'quiz') checks.push([c, i, s]); }));
  const answered = checks.filter(([c, i]) => S.ans[c.id + ':' + i]);
  const right = answered.filter(([c, i]) => S.ans[c.id + ':' + i].ok);
  const pct = Math.round(Object.keys(S.seen).length / total() * 100);
  app.innerHTML = `<div class="wrap recap">
    <div class="crumb"><a href="#start">${esc(P.short)}</a><span>/</span>Recap</div>
    <h1 class="rv">${pct >= 100 ? 'You read the <em>whole paper.</em>' : 'Your cheat sheet <em>so far</em>'}</h1>
    <p class="lede rv">${P.oneLiner}</p>
    <div class="score">
      <div class="stat spot rv"><b><span data-c="${pct}">0</span>%</b><span>of the paper covered</span></div>
      <div class="stat spot rv"><b><span data-c="${right.length}">0</span>/${checks.length}</b><span>checks right first time</span></div>
      <div class="stat spot rv"><b><span data-c="${S.pts}">0</span></b><span>points</span></div>
    </div>
    <h2 class="rv">Key points, stop by stop</h2>
    <div class="sheet">${P.chapters.map((c, j) => {
      const miss = checks.filter(([cc, i]) => cc === c && S.ans[c.id + ':' + i] && !S.ans[c.id + ':' + i].ok);
      return `<section class="spot rv" style="--i:${j}"><div class="sh-n">${String(j + 1).padStart(2, '0')}</div><div><h3>${esc(c.title)} <small>${esc(c.pages)}</small></h3><ul>${c.keys.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${miss.length ? `<div class="missed">Worth another look: ${miss.map(([, i, s]) => `<a href="#ch-${c.id}" data-go="${c.id}:${i}">${esc(strip(s.q))}</a>`).join(' · ')}</div>` : ''}</div></section>`;
    }).join('')}</div>
    <div class="cta" style="margin-top:28px"><button class="btn primary" id="copy">Copy cheat sheet</button>${Object.keys(FILMS).length ? `<button class="btn glass" id="watchAll">${playIcon}Rewatch the film</button>` : ''}<a class="btn ghost" href="#start">Back to the route</a><span id="copied" class="hint"></span></div></div>`;
  $$('[data-go]', app).forEach(a => a.onclick = () => { const [id, i] = a.dataset.go.split(':'); S.pos[id] = +i; save(); });
  $$('[data-c]', app).forEach((e, j) => countUp(e, +e.dataset.c, 200 + j * 150));
  $('#watchAll')?.addEventListener('click', () => playFilm(P.chapters.map(c => c.id)));
  $('#copy').onclick = async () => {
    const txt = P.title + '\n\n' + P.chapters.map(c => c.title + '\n' + c.keys.map(x => '- ' + x).join('\n')).join('\n\n');
    try { await navigator.clipboard.writeText(txt); $('#copied').textContent = 'Copied.'; } catch { $('#copied').textContent = 'Copy is blocked here. Select the text above instead.'; }
  };
  if (pct >= 100) setTimeout(() => burst($('.recap h1')), 400);
  reveal();
}

/* ---------- glossary ---------- */
const pop = $('#pop');
document.addEventListener('click', e => {
  const g = e.target.closest('.gl[data-k]');
  if (!g) { pop.hidden = true; return; }
  const [term, def] = P.glossary[g.dataset.k];
  pop.innerHTML = `<b>${esc(term)}</b>${esc(def)}`; pop.hidden = false;
  const r = g.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = Math.max(12, Math.min(r.left, innerWidth - w - 12)) + 'px';
  pop.style.top = (r.bottom + h + 12 > innerHeight ? r.top - h - 8 : r.bottom + 8) + 'px';
});
addEventListener('scroll', () => pop.hidden = true, { passive: true });
function drawGloss(q = '') {
  q = q.toLowerCase();
  $('#glossList').innerHTML = Object.values(P.glossary).sort((a, b) => a[0].localeCompare(b[0]))
    .filter(([t, d]) => !q || (t + d).toLowerCase().includes(q))
    .map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('') || '<dd>No matching term.</dd>';
}
const drawer = $('#drawer');
const openGloss = () => { drawGloss(); drawer.hidden = false; $('#glossSearch').value = ''; $('#glossSearch').focus(); };
$('#glossBtn').onclick = openGloss;
$('#glossClose').onclick = () => { drawer.hidden = true; $('#glossBtn').focus(); };
drawer.onclick = e => { if (e.target === drawer) drawer.hidden = true; };
$('#glossSearch').oninput = e => drawGloss(e.target.value);

/* ---------- theme ---------- */
$('#themeBtn').onclick = () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const t = dark ? 'light' : 'dark';
  const apply = () => { document.documentElement.dataset.theme = t; try { localStorage.setItem('pw-theme', t); } catch {} };
  swap(apply);
};

/* ---------- command palette ---------- */
const cmd = $('#cmd'), cmdIn = $('#cmdInput'), cmdList = $('#cmdList');
let items = [], sel = 0;
function cmdItems() {
  const out = [];
  if (Object.keys(FILMS).length) out.push({ k: 'Film', t: 'Watch the whole film', run: () => playFilm(P.chapters.map(c => c.id)) });
  P.chapters.forEach((c, ci) => {
    out.push({ k: 'Stop ' + (ci + 1), t: c.title, d: c.sub, run: () => location.hash = 'ch-' + c.id });
    if (FILMS[c.id]) out.push({ k: 'Film', t: 'Watch: ' + c.title, run: () => playFilm([c.id]) });
    c.steps.forEach((s, i) => out.push({ k: KIND[s.t], t: stepTitle(s), d: c.title, run: () => { S.pos[c.id] = i; save(); location.hash === '#ch-' + c.id ? chapter(c.id) : location.hash = 'ch-' + c.id; } }));
  });
  Object.values(P.glossary).forEach(([t, d]) => out.push({ k: 'Term', t, d, run: () => { openGloss(); $('#glossSearch').value = t; drawGloss(t); } }));
  out.push({ k: 'Page', t: 'Recap and cheat sheet', run: () => location.hash = 'recap' });
  out.push({ k: 'Theme', t: 'Switch light / dark', run: () => $('#themeBtn').click() });
  return out;
}
function drawCmd() {
  const q = cmdIn.value.trim().toLowerCase();
  const all = cmdItems();
  items = (q ? all.filter(x => (x.t + ' ' + (x.d || '') + ' ' + x.k).toLowerCase().includes(q)) : all.filter(x => /Stop|Film|Page/.test(x.k))).slice(0, 40);
  sel = Math.min(sel, Math.max(0, items.length - 1));
  cmdList.innerHTML = items.map((x, j) => `<li role="option" data-j="${j}" aria-selected="${j === sel}"><span class="ck">${esc(x.k)}</span><span class="ct">${esc(x.t)}${x.d ? `<small>${esc(strip(x.d)).slice(0, 90)}</small>` : ''}</span></li>`).join('') || '<li class="empty">Nothing found.</li>';
  cmdList.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' });
}
function openCmd() { if (!P) return; cmd.hidden = false; cmdIn.value = ''; sel = 0; drawCmd(); cmdIn.focus(); }
function closeCmd() { cmd.hidden = true; }
$('#cmdBtn').onclick = openCmd;
cmdIn.oninput = () => { sel = 0; drawCmd(); };
cmd.onclick = e => { if (e.target === cmd) return closeCmd(); const li = e.target.closest('li[data-j]'); if (li) { closeCmd(); items[+li.dataset.j].run(); } };
cmdIn.onkeydown = e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); drawCmd(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); drawCmd(); }
  else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); closeCmd(); items[sel].run(); }
};

/* ---------- keys and routing ---------- */
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmd.hidden ? openCmd() : closeCmd(); return; }
  if (e.key === 'Escape') { drawer.hidden = true; pop.hidden = true; closeCmd(); }
  if (document.documentElement.classList.contains('film-open')) return;
  if (e.key === '/' && !/input|textarea/i.test(e.target.tagName) && cmd.hidden) { e.preventDefault(); openCmd(); return; }
  if (!cur || !location.hash.startsWith('#ch-') || /input|textarea/i.test(e.target.tagName) || !drawer.hidden || !cmd.hidden) return;
  if (e.key === 'ArrowRight') $('#next')?.click();
  if (e.key === 'ArrowLeft') $('#prev')?.click();
});
function route() {
  pop.hidden = true; clearInterval(traceTimer); cancelAnimationFrame(heroRAF);
  const h = location.hash.slice(1);
  const run = () => {
    if (h.startsWith('ch-')) return chapter(h.slice(3));
    cur = null;
    if (h === 'recap') return recap();
    home();
    if (h === 'route') $('#route')?.scrollIntoView();
  };
  swap(run);
  if (!h.startsWith('ch-') && h !== 'route') window.scrollTo(0, 0);
}
addEventListener('hashchange', route);

/* ---------- boot: papers/index.json lists available papers; ?paper=id picks one ---------- */
(async () => {
  try {
    const list = await (await fetch('papers/index.json')).json();
    const want = new URLSearchParams(location.search).get('paper');
    const entry = list.find(p => p.id === want) || list[0];
    P = await (await fetch('papers/' + entry.file)).json();
    if (P.films && window.Film) { try { FILMS = await (await fetch('papers/' + P.films)).json(); } catch { FILMS = {}; } }
    KEY = 'paperwalk:' + P.id; S = load();
    updateMeter(); route();
  } catch (err) {
    app.innerHTML = `<p class="loading">Could not load the paper. If you opened this file directly, serve the folder instead (for example <code>npx serve .</code>).</p>`;
  }
})();
}
