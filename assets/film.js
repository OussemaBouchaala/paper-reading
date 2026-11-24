/* Paperwalk films: narrated motion-graphic explainers, rendered live in the browser.
   Each chapter's film is a list of scenes (papers/<id>.films.json). The voice-over uses the
   browser's built-in speech engine; captions always show, so it also works muted. */
window.Film = (() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const synth = 'speechSynthesis' in window ? speechSynthesis : null;
  const pref = (k, d) => { try { const v = localStorage.getItem('pw-film-' + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem('pw-film-' + k, JSON.stringify(v)); } catch {} };

  let el, playlist = [], idx = 0, playing = false, voiceOn = pref('voice', true), ccOn = pref('cc', true), rate = pref('rate', 1);
  let t = 0, est = 1, last = 0, raf = 0, sentences = [], sIdx = 0, speechDone = false, holdTimer = 0, token = 0, voice = null, lastFocus = null;

  /* ---------- voice ---------- */
  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices().filter(v => /^en(-|_|$)/i.test(v.lang));
    const rank = v => (/natural|neural|online/i.test(v.name) ? 0 : /google us english|samantha|aria|jenny|guy|daniel|serena|karen/i.test(v.name) ? 1 : /en-us/i.test(v.lang) ? 2 : 3);
    voice = vs.sort((a, b) => rank(a) - rank(b))[0] || null;
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
  const words = s => s.split(/\s+/).filter(Boolean).length;
  const estimate = s => Math.max(3.2, words(s) / (2.55 * rate) + 0.9);
  const split = s => s.match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g).map(x => x.trim()).filter(Boolean);

  function speakFrom(i, tok) {
    if (tok !== token) return;
    if (i >= sentences.length) { speechDone = true; return; }
    sIdx = i; caption(sentences[i]);
    if (!voiceOn || !synth) {
      // No voice: pace sentences by reading time.
      const ms = words(sentences[i]) / (2.55 * rate) * 1000 + 250;
      holdTimer = setTimeout(() => speakFrom(i + 1, tok), ms);
      return;
    }
    const u = new SpeechSynthesisUtterance(sentences[i]);
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : 'en-US'; u.rate = rate; u.pitch = 1;
    let moved = false;
    const t0 = performance.now(), minMs = words(sentences[i]) / (2.55 * rate) * 1000 * 0.7;
    // If the engine finishes impossibly fast (no real voice installed), still give the sentence its reading time.
    const next = () => { if (moved) return; moved = true; clearTimeout(guard); const left = minMs - (performance.now() - t0); if (left > 0) holdTimer = setTimeout(() => speakFrom(i + 1, tok), left); else speakFrom(i + 1, tok); };
    // Some engines never fire onend; never let a sentence block the film.
    const guard = setTimeout(next, (words(sentences[i]) / (1.6 * rate) + 3) * 1000);
    u.onend = next; u.onerror = next;
    el._u = u; // keep a reference so the utterance isn't garbage-collected mid-speech (Chrome)
    synth.speak(u);
  }
  function stopSpeech() { token++; clearTimeout(holdTimer); if (synth) synth.cancel(); }
  function caption(text) { const c = el.querySelector('.fm-cc'); c.innerHTML = `<span>${esc(text)}</span>`; }

  /* ---------- scenes ---------- */
  const at = f => (est * f).toFixed(2) + 's';
  const spread = (n, a = 0.12, b = 0.7) => j => at(a + (n <= 1 ? 0 : (b - a) * j / (n - 1)));
  const col = c => ({ think: 'var(--think)', act: 'var(--act)', obs: 'var(--obs)' }[c] || 'var(--accent)');

  const R = {
    title: s => `<div class="sc-title">
      <div class="fm-rings" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="kick a-rise" style="--d:.1s">${esc(s.kicker)}</div>
      <h2>${s.title.split(' ').map((w, j) => `<span class="a-word" style="--d:${(0.25 + j * 0.09).toFixed(2)}s">${esc(w)}</span>`).join(' ')}</h2>
      <p class="a-rise" style="--d:${at(0.5)}">${esc(s.sub)}</p></div>`,

    split: s => {
      const side = (x, dir, base) => `<div class="panel a-slide-${dir}" style="--d:${at(base)};--c:${col(x.color)}"><h3>${esc(x.title)}</h3><ul>${x.items.map((it, j) => `<li class="a-rise" style="--d:${at(base + 0.08 + j * 0.07)}">${esc(it)}</li>`).join('')}</ul></div>`;
      return `<div class="sc-split">${side(s.left, 'l', 0.05)}<div class="vs a-pop" style="--d:${at(0.3)}">vs</div>${side(s.right, 'r', 0.38)}</div>`;
    },

    loop: s => {
      const P = [[300, 70], [490, 300], [110, 300]];
      const node = ([x, y], [t, sub, c], j) => `<g class="ln-node" style="--c:${col(c)};--j:${j}"><g class="a-pop" style="--d:${(0.2 + j * 0.25).toFixed(2)}s;transform-origin:${x}px ${y}px">
        <rect x="${x - 90}" y="${y - 34}" width="180" height="68" rx="20"/><text x="${x}" y="${sub ? y - 2 : y + 7}" class="t1">${esc(t)}</text>${sub ? `<text x="${x}" y="${y + 20}" class="t2">${esc(sub)}</text>` : ''}</g></g>`;
      const arc = (a, b, k) => { const [x1, y1] = P[a], [x2, y2] = P[b]; const mx = (x1 + x2) / 2 + (k ? (y2 - y1) * .22 : 0), my = (y1 + y2) / 2 - (x2 - x1) * .22; return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`; };
      const ring = 'M300,70 Q470,90 490,300 Q300,420 110,300 Q130,90 300,70';
      return `<svg class="sc-loop" viewBox="0 0 600 400" aria-hidden="true">
        <defs><linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="var(--think)"/><stop offset=".5" stop-color="var(--act)"/><stop offset="1" stop-color="var(--obs)"/></linearGradient></defs>
        <path d="${ring}" class="track a-draw" style="--d:.4s" pathLength="1"/>
        <path d="${ring}" class="flowp" pathLength="1"/>
        ${reduce ? '' : `<circle r="9" class="spark"><animateMotion dur="4.5s" repeatCount="indefinite" path="${ring}"/></circle>`}
        ${P.map((p, j) => node(p, s.nodes[j], j)).join('')}
        <text x="300" y="230" class="center a-rise" style="--d:${at(0.35)}">${esc(s.center)}</text></svg>`;
    },

    flow: s => `<div class="sc-flow">${s.nodes.map(([t, sub, c], j) => `${j ? `<div class="pipe a-grow" style="--d:${at(0.1 + j * 0.24 - 0.08)};--c:${col(c)}"><i></i></div>` : ''}
      <div class="fnode a-pop" style="--d:${at(0.1 + j * 0.24)};--c:${col(c)}"><b>${esc(t)}</b><small>${esc(sub)}</small></div>`).join('')}</div>`,

    bars: s => {
      const d = spread(s.rows.length, 0.12, 0.6);
      return `<div class="sc-bars"><h3 class="a-rise" style="--d:.05s">${esc(s.title)}</h3>${s.rows.map(([l, v, h], j) => `<div class="fb-row ${h === 1 ? 'hl' : h === 2 ? 'ref' : ''}">
        <span class="lab a-rise" style="--d:${d(j)}">${esc(l)}</span><span class="trk"><i class="a-bar" style="--d:${d(j)};--w:${(v / s.max * 100).toFixed(1)}%"></i></span>
        <span class="v" data-count="${v}" data-at="${parseFloat(d(j))}" data-unit="${s.unit || ''}">0</span></div>`).join('')}</div>`;
    },

    trace: s => {
      const d = spread(s.lines.length, 0.1, 0.82);
      const tag = { thought: 'Thought', act: 'Action', obs: 'Observ.', answer: 'Answer' };
      return `<div class="sc-trace"><div class="term"><div class="bar"><i></i><i></i><i></i><span>${esc(s.title)}</span></div>
        ${s.lines.map(([k, x], j) => `<div class="tl ${k} a-type" style="--d:${d(j)}"><span class="tg">${tag[k]}</span><span>${esc(x)}</span></div>`).join('')}
        <div class="verdict ${s.ok ? 'ok' : 'no'} a-pop" style="--d:${at(0.9)}">${s.ok ? '✓ Correct' : '✗ Wrong'}</div></div></div>`;
    },

    eq: s => `<div class="sc-eq"><div class="big">${[...s.eq].map((ch, j) => `<span class="a-word" style="--d:${(0.15 + j * 0.08).toFixed(2)}s">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')}</div>
      <div class="parts">${s.parts.map(([k, l, c], j) => `<div class="part a-rise" style="--d:${at(0.3 + j * 0.25)};--c:${col(c)}"><b>${esc(k)}</b><span>${esc(l)}</span></div>`).join('')}</div></div>`,

    stat: s => `<div class="sc-stat"><div class="burst a-pop" style="--d:.1s" aria-hidden="true"></div>
      <div class="num"><span>${esc(s.prefix || '')}</span><span data-count="${s.value}" data-at="0.3" data-dur="1.6">0</span><span>${esc(s.suffix || '')}</span></div>
      <p class="a-rise" style="--d:${at(0.35)}">${esc(s.label)}</p></div>`,

    bullets: s => {
      const d = spread(s.items.length, 0.15, 0.72);
      return `<div class="sc-bul"><h3 class="a-rise" style="--d:.05s">${esc(s.title)}</h3><ul>${s.items.map((x, j) => `<li class="a-slide-l" style="--d:${d(j)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>${esc(x)}</li>`).join('')}</ul></div>`;
    },

    cards: s => {
      const d = spread(s.items.length, 0.1, 0.6);
      return `<div class="sc-cards">${s.items.map(([h, p], j) => `<div class="fcard a-rise" style="--d:${d(j)}"><b>${esc(h)}</b><span>${esc(p)}</span></div>`).join('')}</div>`;
    }
  };

  /* ---------- player ---------- */
  function build() {
    el = document.createElement('div');
    el.className = 'film'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Explainer film');
    el.innerHTML = `<div class="fm-box">
      <div class="fm-top"><div class="fm-label"><span class="live"></span><b id="fmCh"></b><span id="fmSc"></span></div>
        <button class="fm-ic" data-a="close" aria-label="Close film (Esc)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="fm-stage"><div class="fm-scene"></div><div class="fm-cc" aria-live="polite"></div>
        <button class="fm-big" data-a="toggle" aria-label="Play"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></button></div>
      <div class="fm-segs" role="group" aria-label="Scenes"></div>
      <div class="fm-ctl">
        <button class="fm-ic" data-a="prev" aria-label="Previous scene"><svg viewBox="0 0 24 24"><path d="M7 6v12M18 6l-8 6 8 6z"/></svg></button>
        <button class="fm-ic main" data-a="toggle" aria-label="Play or pause (Space)"><svg class="i-play" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg><svg class="i-pause" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg></button>
        <button class="fm-ic" data-a="next" aria-label="Next scene"><svg viewBox="0 0 24 24"><path d="M17 6v12M6 6l8 6-8 6z"/></svg></button>
        <span class="fm-sp"></span>
        <button class="fm-pill" data-a="rate" aria-label="Playback speed"></button>
        <button class="fm-pill" data-a="cc" aria-label="Captions (C)">CC</button>
        <button class="fm-pill" data-a="voice" aria-label="Voice-over (M)"></button>
        <button class="fm-ic" data-a="fs" aria-label="Full screen (F)"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      </div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      if (e.target === el) return close();
      const b = e.target.closest('[data-a]'); if (!b) { const sg = e.target.closest('[data-seg]'); if (sg) go(+sg.dataset.seg); return; }
      ({ close, toggle, prev: () => go(idx - 1), next: () => go(idx + 1), rate: cycleRate, cc: toggleCC, voice: toggleVoice, fs: fullscreen })[b.dataset.a]();
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') go(idx + 1);
      else if (e.key === 'ArrowLeft') go(idx - 1);
      else if (e.key === 'c') toggleCC();
      else if (e.key === 'm') toggleVoice();
      else if (e.key === 'f') fullscreen();
      else if (e.key === 'Tab') { // keep focus inside the dialog
        const f = [...el.querySelectorAll('button')].filter(b => b.offsetParent);
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
      }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });
  }

  function syncUI() {
    el.classList.toggle('playing', playing);
    el.classList.toggle('no-cc', !ccOn);
    el.querySelector('[data-a=rate]').textContent = rate + '×';
    el.querySelector('[data-a=cc]').setAttribute('aria-pressed', ccOn);
    const v = el.querySelector('[data-a=voice]');
    v.textContent = synth ? (voiceOn ? 'Voice on' : 'Voice off') : 'No voice here';
    v.disabled = !synth; v.setAttribute('aria-pressed', voiceOn && !!synth);
  }

  function renderScene() {
    const sc = playlist[idx];
    est = estimate(sc.say);
    t = 0;
    const stage = el.querySelector('.fm-scene');
    stage.className = 'fm-scene';
    stage.innerHTML = `<div class="scene t-${sc.type}">${(R[sc.type] || R.bullets)(sc)}</div>`;
    stage.dataset.type = sc.type;
    el.querySelector('#fmCh').textContent = sc._ch;
    el.querySelector('#fmSc').textContent = ` · scene ${sc._n} of ${sc._of}`;
    el.querySelectorAll('.fm-segs button').forEach((b, j) => { b.classList.toggle('done', j < idx); b.classList.toggle('cur', j === idx); b.style.setProperty('--p', j < idx ? 1 : 0); });
    sentences = split(sc.say); sIdx = 0; speechDone = false;
    caption(sentences[0]);
    count();
  }

  function count() {
    el.querySelectorAll('[data-count]').forEach(n => {
      const v = +n.dataset.count, a = +n.dataset.at * (n.dataset.dur ? 1 : est / est), dur = +(n.dataset.dur || 0.9);
      const p = reduce ? 1 : Math.min(1, Math.max(0, (t - a) / dur)), e = 1 - Math.pow(1 - p, 3);
      const dec = String(v).includes('.') ? 1 : 0;
      n.textContent = (v * e).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (n.dataset.unit || '');
    });
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!playing) return;
    t += dt;
    count();
    const seg = el.querySelector('.fm-segs .cur');
    if (seg) seg.style.setProperty('--p', speechDone ? 1 : Math.min(0.97, t / est));
    // Scene ends when narration is done and the animation has had its time.
    if (speechDone && t >= est * 0.8) {
      speechDone = false;
      holdTimer = setTimeout(() => { if (playing) { if (idx < playlist.length - 1) go(idx + 1); else end(); } }, 700);
    }
  }

  function play() {
    if (playing) return;
    playing = true; el.classList.remove('ended');
    el.querySelector('.fm-scene').classList.remove('paused');
    syncUI();
    stopSpeech(); speakFrom(sIdx, token);
  }
  function pause() {
    playing = false; stopSpeech();
    el.querySelector('.fm-scene').classList.add('paused');
    syncUI();
  }
  function toggle() { el.classList.contains('ended') ? (go(0), play()) : playing ? pause() : play(); }
  function go(j) {
    if (j < 0 || j >= playlist.length) return;
    stopSpeech(); idx = j; renderScene();
    if (playing) { playing = false; play(); } else el.querySelector('.fm-scene').classList.add('paused');
  }
  function end() {
    pause(); el.classList.add('ended');
    el.querySelector('.fm-segs .cur')?.style.setProperty('--p', 1);
    caption('The end. Press play to watch again, or close to keep reading.');
  }
  function cycleRate() { const r = [1, 1.25, 1.5, 0.85]; rate = r[(r.indexOf(rate) + 1) % r.length]; setPref('rate', rate); syncUI(); if (playing) { stopSpeech(); speakFrom(sIdx, token); } }
  function toggleCC() { ccOn = !ccOn; setPref('cc', ccOn); syncUI(); }
  function toggleVoice() { if (!synth) return; voiceOn = !voiceOn; setPref('voice', voiceOn); syncUI(); if (playing) { stopSpeech(); speakFrom(sIdx, token); } }
  function fullscreen() { const b = el.querySelector('.fm-box'); document.fullscreenElement ? document.exitFullscreen() : b.requestFullscreen?.().catch(() => {}); }

  function close() {
    pause(); cancelAnimationFrame(raf);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    el.hidden = true; document.documentElement.classList.remove('film-open');
    lastFocus?.focus?.();
  }

  /* open(chapters, films, ids): ids = chapter ids to play in order */
  function open(chapters, films, ids, startPlaying = true) {
    if (!el) build();
    playlist = [];
    ids.forEach(id => {
      const c = chapters.find(x => x.id === id), f = films[id]; if (!c || !f) return;
      f.forEach((s, n) => playlist.push(Object.assign({}, s, { _ch: c.title, _n: n + 1, _of: f.length })));
    });
    if (!playlist.length) return;
    el.querySelector('.fm-segs').innerHTML = playlist.map((s, j) => `<button data-seg="${j}" aria-label="${esc(s._ch)}, scene ${s._n}" ${s._n === 1 && j ? 'class="gap"' : ''}><i></i></button>`).join('');
    lastFocus = document.activeElement;
    el.hidden = false; document.documentElement.classList.add('film-open');
    idx = 0; playing = false; el.classList.remove('ended');
    renderScene(); syncUI();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    el.querySelector('.fm-ctl .main').focus();
    if (startPlaying) play(); else el.querySelector('.fm-scene').classList.add('paused');
  }
  const minutes = list => list.reduce((n, s) => n + estimate(s.say), 0) + list.length * 0.7;
  return { open, minutes, close };
})();
