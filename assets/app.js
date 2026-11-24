/* Paperwalk: a guided reader that renders any paper file in papers/*.json */
{
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let P = null, S = null, KEY = '';

/* ---------- storage ---------- */
const blank = () => ({ seen: {}, ans: {}, pts: 0, pos: {} });
function load() { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch { return blank(); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }

/* ---------- helpers ---------- */
const total = () => P.chapters.reduce((n, c) => n + c.steps.length, 0);
const chSeen = c => c.steps.filter((_, i) => S.seen[c.id + ':' + i]).length;
const isCheck = s => s.t === 'quiz' || s.t === 'predict';
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
  return `<svg class="ring" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="${r}" fill="none" stroke="var(--line)" stroke-width="5"/>
  <circle cx="26" cy="26" r="${r}" fill="none" stroke="var(--teal)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C * frac} ${C}" transform="rotate(-90 26 26)"/>
  ${done ? '<path d="M17 27l6 6 12-13" fill="none" stroke="var(--teal)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' : `<text x="26" y="31" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)">${Math.round(frac * 100)}%</text>`}</svg>`;
}

/* ---------- cover picture: the paper's core loop ---------- */
function loopSVG() {
  const node = (x, y, fill, stroke, title, sub) => `<g transform="translate(${x - 88} ${y - 34})"><rect width="176" height="68" rx="14" fill="var(--${fill})" stroke="var(--${stroke})" stroke-width="2"/>
    <text x="88" y="29" text-anchor="middle" font-weight="800" font-size="20" fill="var(--ink)">${title}</text>
    <text x="88" y="51" text-anchor="middle" font-size="13" fill="var(--muted)">${sub}</text></g>`;
  const path = 'M250,72 A170,148 0 1,1 249.9,72';
  return `<svg viewBox="0 0 500 440" role="img" aria-label="The ReAct loop: Thought, then Action, then Observation, repeated until Finish">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink)"/></marker></defs>
    <path d="M344,84 A170,148 0 0,1 420,250" fill="none" stroke="var(--ink)" stroke-width="2" marker-end="url(#ah)"/>
    <path d="M330,338 A170,148 0 0,1 172,338" fill="none" stroke="var(--ink)" stroke-width="2" marker-end="url(#ah)"/>
    <path d="M80,252 A170,148 0 0,1 154,86" fill="none" stroke="var(--ink)" stroke-width="2" marker-end="url(#ah)"/>
    ${reduce ? '' : `<circle r="7" fill="var(--claret)"><animateMotion dur="9s" repeatCount="indefinite" path="${path}"/></circle>`}
    ${node(250, 72, 'tealbg', 'teal', 'Thought', 'a note to self')}
    ${node(392, 292, 'clbg', 'claret', 'Action', 'touches the world')}
    ${node(108, 292, 'obs', 'muted', 'Observation', 'the world replies')}
    <text x="250" y="205" text-anchor="middle" font-size="15" fill="var(--muted)">repeat until</text>
    <text x="250" y="232" text-anchor="middle" font-size="19" font-family="JetBrains Mono,monospace" fill="var(--ink)">Finish[answer]</text>
  </svg>`;
}

/* ---------- views ---------- */
function home() {
  document.title = P.short + ' · Paperwalk';
  const started = Object.keys(S.seen).length > 0;
  const next = P.chapters.find(c => chSeen(c) < c.steps.length) || P.chapters[0];
  app.innerHTML = `<div class="wrap">
    <section class="cover">
      <div>
        <div class="venue">${esc(P.venue)} · about ${P.minutes} minutes</div>
        <h1>${esc(P.title)}</h1>
        <p class="authors">${esc(P.authors)} · ${esc(P.affil)}</p>
        <p class="lede">${P.oneLiner}</p>
        <p class="why">${esc(P.why)}</p>
        <div class="cta">
          <a class="btn teal" href="#ch-${next.id}">${started ? 'Continue: ' + esc(next.title) : 'Start reading'}</a>
          ${started ? '<a class="btn ghost" href="#recap">See your cheat sheet</a>' : ''}
          <a class="btn ghost" href="${esc(P.link)}" target="_blank" rel="noopener">Original PDF</a>
        </div>
      </div>
      <div class="loopfig">${loopSVG()}</div>
    </section>
    <section class="road">
      <h2>Your route through the paper</h2>
      <p>${P.chapters.length} short stops. Each one explains a part in plain words, shows the evidence, and ends with a quick check.</p>
      <ol class="chs">${P.chapters.map(c => `<li class="ch"><a href="#ch-${c.id}">${ring(chSeen(c) / c.steps.length)}
        <span><b>${esc(c.title)}</b><small>${esc(c.sub)} · ${esc(c.pages)} · ${c.minutes} min</small></span></a></li>`).join('')}
        <li class="ch"><a href="#recap">${ring(Object.keys(S.seen).length / total())}<span><b>Recap and cheat sheet</b><small>Everything you learned, on one page</small></span></a></li>
      </ol>
      <p class="note">Progress is saved in this browser. <button class="gl" id="reset">Start over</button></p>
    </section></div>`;
  $('#reset').onclick = () => { S = blank(); save(); updateMeter(); home(); };
}

let cur = null; // {c, i}
function chapter(id) {
  const c = P.chapters.find(x => x.id === id);
  if (!c) return home();
  const i = Math.min(S.pos[id] || 0, c.steps.length - 1);
  cur = { c, i };
  document.title = c.title + ' · ' + P.short;
  renderStep();
}

function renderStep() {
  const { c, i } = cur, s = c.steps[i], k = c.id + ':' + i;
  if (!S.seen[k]) { S.seen[k] = 1; addPts(5); }
  S.pos[c.id] = i; save(); updateMeter();
  const ci = P.chapters.indexOf(c), nextCh = P.chapters[ci + 1];
  const last = i === c.steps.length - 1;
  const label = { text: 'Read', predict: 'Guess first', quiz: 'Quick check', trace: 'Replay', bars: 'The evidence', match: 'Match up', order: 'Put in order' }[s.t];
  app.innerHTML = `<div class="reader">
    <div class="rhead"><div><div class="crumb"><a href="#start">${esc(P.short)}</a> · Stop ${ci + 1} of ${P.chapters.length} · ${esc(c.pages)}</div><h1>${esc(c.title)}</h1></div></div>
    <div class="dots" role="tablist" aria-label="Steps">${c.steps.map((st, j) => `<button data-j="${j}" class="${j === i ? 'cur' : S.seen[c.id + ':' + j] ? 'seen' : ''}" aria-label="Step ${j + 1}" ${j === i ? 'aria-current="step"' : ''}>${j + 1}</button>`).join('')}</div>
    <article class="card" id="card"><div class="kind ${isCheck(s) ? 'q' : ''}">${label}</div>${body(s, k)}${src(s)}</article>
    <div class="nav">
      <button class="btn ghost" id="prev" ${i === 0 && ci === 0 ? 'disabled' : ''}>Back</button>
      <button class="btn" id="next">${last ? (nextCh ? 'Next stop: ' + esc(nextCh.title) : 'Finish: see your recap') : 'Next'}</button>
    </div>
    <p class="hint">Tip: use ← and → keys. Tap any dotted word for a definition.</p></div>`;
  wire(s, k);
  gate(s, k);
  app.querySelectorAll('.dots button').forEach(b => b.onclick = () => go(+b.dataset.j));
  $('#prev').onclick = () => i > 0 ? go(i - 1) : (location.hash = 'ch-' + P.chapters[ci - 1].id);
  $('#next').onclick = () => {
    if ($('#next').disabled) return;
    if (!last) return go(i + 1);
    location.hash = nextCh ? 'ch-' + nextCh.id : 'recap';
  };
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
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
  return `<details class="src"><summary>What the paper says (${esc(s.src.where)})</summary><blockquote>${esc(s.src.quote)}</blockquote></details>`;
}

/* ---------- step bodies ---------- */
function body(s, k) {
  const h = s.h ? `<h2>${esc(s.h)}</h2>` : '';
  const intro = s.intro ? `<div class="body">${gloss(s.intro)}</div>` : '';
  switch (s.t) {
    case 'text': return `${h}<div class="body">${gloss(s.body)}</div>`;
    case 'quiz': case 'predict': return `<h2>${s.q}</h2><div class="opts">${s.options.map((o, j) => `<button class="opt" data-j="${j}">${esc(o)}</button>`).join('')}</div><div id="fb"></div>`;
    case 'trace': return `${h}${intro}<div class="tabs" role="tablist">${s.methods.map((m, j) => `<button class="tab" role="tab" data-j="${j}" aria-selected="${j === s.methods.length - 1}">${esc(m.name)}</button>`).join('')}</div>
      <div class="tq"><b>Task:</b> ${esc(s.question)}</div><div class="trace" id="trace"></div>
      <div class="tctl"><button class="btn teal" id="stepBtn">Next step</button><button class="btn ghost" id="allBtn">Show all</button><button class="btn ghost" id="rstBtn">Restart</button></div><div id="verdict"></div>`;
    case 'bars': return `${h}${intro}${s.groups.map(g => `<div class="bgroup"><h3>${esc(g.label)}</h3>${g.rows.map(r => `<div class="brow ${r[2] === 1 ? 'hl' : r[2] === 2 ? 'ref' : ''}"><span class="lab">${esc(r[0])}</span><span class="trk"><i data-w="${r[1] / g.max * 100}"></i></span><span class="v">${r[1]}</span></div>`).join('')}</div>`).join('')}
      <div class="legend"><span class="l1">ReAct and its variants</span><span>Baselines</span><span class="l2">Trained systems or humans, for scale</span></div>${s.note ? `<p class="cap">${gloss(s.note)}</p>` : ''}`;
    case 'match': return `${h}${intro}<div class="mgrid"><div class="mcol" id="ml"></div><div class="mcol" id="mr"></div></div><div id="fb"></div>`;
    case 'order': return `${h}${intro}<div class="built" id="built" aria-label="Your order"></div><div class="mcol" id="pool"></div><div class="tctl"><button class="btn ghost" id="undo">Undo</button><button class="btn ghost" id="reveal">Show answer</button></div><div id="fb"></div>`;
  }
  return '';
}

const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

function wire(s, k) {
  if (isCheck(s)) {
    const btns = [...app.querySelectorAll('.opt')];
    const show = (pick, first) => {
      btns.forEach((b, j) => { b.disabled = true; if (j === s.answer) b.classList.add('right'); else if (j === pick) b.classList.add('wrong'); });
      const ok = pick === s.answer;
      $('#fb').innerHTML = `<div class="fb">${s.t === 'predict' ? `<b class="${ok ? 'ok' : 'no'}">${ok ? 'Good instinct.' : 'Not quite, and that is the interesting part.'}</b> ` : `<b class="${ok ? 'ok' : 'no'}">${ok ? 'Correct.' : 'Not this time.'}</b> `}${gloss(s.why)}</div>`;
      if (first) { addPts(ok ? 15 : 5); unlock(k, { pick, ok }); }
    };
    if (S.ans[k]) show(S.ans[k].pick, false);
    btns.forEach((b, j) => b.onclick = () => show(j, true));
  }
  if (s.t === 'trace') {
    let m = s.methods.length - 1, n = 0;
    const tabs = [...app.querySelectorAll('.tab')];
    const tagName = { thought: 'Thought', act: 'Action', obs: 'Observ.', answer: 'Answer', note: '' };
    const draw = () => {
      const M = s.methods[m];
      $('#trace').innerHTML = M.steps.slice(0, n).map(([t, x]) => `<div class="ln ${t}"><span class="tag">${tagName[t]}</span><span>${esc(x)}</span></div>`).join('') || '<div class="ln note"><span></span><span>Press Next step to start the replay.</span></div>';
      const done = n >= M.steps.length;
      $('#stepBtn').disabled = done; $('#allBtn').disabled = done;
      $('#verdict').innerHTML = done ? `<div class="verdict ${M.ok ? 'ok' : 'no'}"><b>${M.ok ? '✓ ' : '✗ '}</b>${esc(M.verdict)}</div>` : '';
      tabs.forEach((t, j) => t.setAttribute('aria-selected', j === m));
    };
    tabs.forEach((t, j) => t.onclick = () => { m = j; n = 0; draw(); });
    $('#stepBtn').onclick = () => { n++; draw(); };
    $('#allBtn').onclick = () => { n = s.methods[m].steps.length; draw(); };
    $('#rstBtn').onclick = () => { n = 0; draw(); };
    draw();
  }
  if (s.t === 'bars') requestAnimationFrame(() => setTimeout(() => app.querySelectorAll('.trk i').forEach(i => i.style.width = i.dataset.w + '%'), reduce ? 0 : 60));
  if (s.t === 'match') {
    const L = shuffle(s.pairs.map((p, j) => [p[0], j])), R = shuffle(s.pairs.map((p, j) => [p[1], j]));
    let sel = null, done = new Set(), miss = 0;
    const solved = !!S.ans[k];
    if (solved) s.pairs.forEach((_, j) => done.add(j));
    const draw = () => {
      $('#ml').innerHTML = L.map(([t, j]) => `<button class="mi ${done.has(j) ? 'done' : ''} ${sel === j ? 'sel' : ''}" data-j="${j}" ${done.has(j) ? 'disabled' : ''}>${done.has(j) ? `<span class="n">${j + 1}</span>` : ''}${esc(t)}</button>`).join('');
      $('#mr').innerHTML = R.map(([t, j]) => `<button class="mi ${done.has(j) ? 'done' : ''}" data-j="${j}" data-r="1" ${done.has(j) ? 'disabled' : ''}>${done.has(j) ? `<span class="n">${j + 1}</span>` : ''}${esc(t)}</button>`).join('');
      app.querySelectorAll('#ml .mi').forEach(b => b.onclick = () => { sel = +b.dataset.j; draw(); });
      app.querySelectorAll('#mr .mi').forEach(b => b.onclick = () => {
        if (sel === null) return;
        if (+b.dataset.j === sel) { done.add(sel); sel = null; draw(); if (done.size === s.pairs.length) finish(); }
        else { miss++; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
      });
    };
    const finish = () => {
      if (!S.ans[k]) { addPts(miss === 0 ? 15 : 5); unlock(k, { ok: miss === 0 }); }
      $('#fb').innerHTML = `<div class="fb"><b class="ok">All matched${miss ? ` with ${miss} slip${miss > 1 ? 's' : ''}` : ', first try'}.</b> One mechanism, many jobs: the same free-form “thought” slot does all of these.</div>`;
    };
    draw(); if (solved) finish();
  }
  if (s.t === 'order') {
    const pool = shuffle(s.items.map((t, j) => [t, j])); let built = [], miss = 0;
    const draw = (msg) => {
      $('#built').innerHTML = built.map((j, x) => `<div class="mi done"><span class="n">${x + 1}</span>${esc(s.items[j])}</div>`).join('') || '<span class="hint">Tap the first piece below.</span>';
      $('#pool').innerHTML = pool.filter(([, j]) => !built.includes(j)).map(([t, j]) => `<button class="mi" data-j="${j}">${esc(t)}</button>`).join('');
      app.querySelectorAll('#pool .mi').forEach(b => b.onclick = () => {
        const j = +b.dataset.j;
        if (j === built.length) { built.push(j); draw(); if (built.length === s.items.length) end(miss === 0); }
        else { miss++; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
      });
      if (msg) $('#fb').innerHTML = msg;
    };
    const end = ok => {
      if (!S.ans[k]) { addPts(ok ? 15 : 5); unlock(k, { ok }); }
      $('#fb').innerHTML = `<div class="fb"><b class="ok">That's the loop.</b> Thoughts sit between observations and actions: they read what came back and decide what to do next. Repeat until Finish.</div>`;
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
  app.innerHTML = `<div class="wrap recap" style="max-width:900px">
    <div class="crumb"><a href="#start">${esc(P.short)}</a> · Recap</div>
    <h1>${pct >= 100 ? 'You read the whole paper.' : 'Your cheat sheet so far'}</h1>
    <p class="lede">${P.oneLiner}</p>
    <div class="score">
      <div class="stat"><b>${pct}%</b><span>of the paper covered</span></div>
      <div class="stat"><b>${right.length}/${checks.length}</b><span>checks right first time</span></div>
      <div class="stat"><b>${S.pts}</b><span>points</span></div>
    </div>
    <h2>Key points, stop by stop</h2>
    <div class="sheet">${P.chapters.map(c => {
      const miss = checks.filter(([cc, i]) => cc === c && S.ans[c.id + ':' + i] && !S.ans[c.id + ':' + i].ok);
      return `<section><h3>${esc(c.title)} <small class="crumb">· ${esc(c.pages)}</small></h3><ul>${c.keys.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${miss.length ? `<div class="missed">Worth another look: ${miss.map(([, i, s]) => `<a href="#ch-${c.id}" data-go="${c.id}:${i}">${esc(s.q.replace(/<[^>]+>/g, ''))}</a>`).join(' · ')}</div>` : ''}</section>`;
    }).join('')}</div>
    <div class="cta" style="margin-top:24px"><button class="btn" id="copy">Copy cheat sheet</button><a class="btn ghost" href="#start">Back to the route</a><span id="copied" class="hint"></span></div></div>`;
  app.querySelectorAll('[data-go]').forEach(a => a.onclick = () => { const [id, i] = a.dataset.go.split(':'); S.pos[id] = +i; save(); });
  $('#copy').onclick = async () => {
    const txt = P.title + '\n\n' + P.chapters.map(c => c.title + '\n' + c.keys.map(x => '- ' + x).join('\n')).join('\n\n');
    try { await navigator.clipboard.writeText(txt); $('#copied').textContent = 'Copied.'; } catch { $('#copied').textContent = 'Copy is blocked here. Select the text above instead.'; }
  };
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
$('#glossBtn').onclick = () => { drawGloss(); drawer.hidden = false; $('#glossSearch').value = ''; $('#glossSearch').focus(); };
$('#glossClose').onclick = () => { drawer.hidden = true; $('#glossBtn').focus(); };
drawer.onclick = e => { if (e.target === drawer) drawer.hidden = true; };
$('#glossSearch').oninput = e => drawGloss(e.target.value);

/* ---------- keys and routing ---------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { drawer.hidden = true; pop.hidden = true; }
  if (!cur || !location.hash.startsWith('#ch-') || /input|textarea/i.test(e.target.tagName) || !drawer.hidden) return;
  if (e.key === 'ArrowRight') $('#next')?.click();
  if (e.key === 'ArrowLeft') $('#prev')?.click();
});
function route() {
  pop.hidden = true;
  const h = location.hash.slice(1);
  if (h.startsWith('ch-')) return chapter(h.slice(3));
  cur = null;
  if (h === 'recap') return recap();
  home();
}
addEventListener('hashchange', route);

/* ---------- boot: papers/index.json lists available papers; ?paper=id picks one ---------- */
(async () => {
  try {
    const list = await (await fetch('papers/index.json')).json();
    const want = new URLSearchParams(location.search).get('paper');
    const entry = list.find(p => p.id === want) || list[0];
    P = await (await fetch('papers/' + entry.file)).json();
    KEY = 'paperwalk:' + P.id; S = load();
    updateMeter(); route();
  } catch (err) {
    app.innerHTML = `<p class="loading">Could not load the paper. If you opened this file directly, serve the folder instead (for example <code>npx serve .</code>).</p>`;
  }
})();
}
