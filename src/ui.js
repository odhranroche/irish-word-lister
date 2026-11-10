// =====================================================================  input: words from any text
const KEEP_SINGLE = new Set(['a', 'á', 'é', 'i', 'í', 'ó']);
// Months, days and seasons are written with a capital but are ordinary vocabulary, never names
const CALENDAR = new Set(['eanáir', 'feabhra', 'márta', 'aibreán', 'aibreáin', 'bealtaine', 'meitheamh', 'meithimh', 'iúil', 'lúnasa', 'fómhar',
  'fómhair', 'samhain', 'samhna', 'nollaig', 'nollag', 'luan', 'luain', 'máirt', 'céadaoin', 'déardaoin', 'aoine', 'satharn', 'sathairn',
  'domhnach', 'domhnaigh', 'meán', 'cáisc', 'cásca', 'gaeilge', 'béarla', 'gaeltacht', 'gaeltachta']);
let ALL = [], NAMES = [], SHORT = [];   // NAMES: words left out as names, English words or acronyms (r.kind)
let namesKept = new Set();             // left-out words the user put back
// The first letter after a lower-case mutation is the real initial: nGaillimh, hÉireann, tSionainn, d'Éirinn
const capital = (t) => /^(?:t-?|n-?|h-?|mb|gc|nd|ng|bp|dt|bhf|[dbm]['’])?\p{Lu}/u.test(t);
const _ib = new Map();
function irishBase(w) {
  if (!DICT.ready) return false;
  if (!_ib.has(w)) _ib.set(w, bases(w).some(([b]) => DICT.forms.has(b)));
  return _ib.get(w);
}
function extract(text) {
  text = text.replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/gi, ' ')
    // optional letters in brackets: c(h)uid → cuid, Ceist(eanna) → Ceist
    .replace(/(\p{L}+)\(\p{L}+\)(\p{L}*)/gu, (m, a, c) => a + c);
  const rows = new Map();
  for (const sent of text.split(/(?<=[.!?:;])\s+|\n+|\s[\/|]\s|\)\s/)) {   // sentences, lines, table cells, list markers
    const ctx = sent.trim().replace(/\s+/g, ' ').slice(0, 220);
    const toks = [];
    for (const m of sent.matchAll(/\p{L}+(?:['’-]\p{L}+)*/gu)) {
      // an ending written as an example ('-áil', -áin) is not a word
      if (m.index > 0 && sent[m.index - 1] === '-' && !/\p{L}/u.test(sent[m.index - 2] || '')) continue;
      toks.push(m[0]);
    }
    const norms = toks.map(norm);
    // Is this sentence English? Count words that are only English against words the dictionary knows as Irish
    // (words that are both, like is, an, go, count for neither). Decides homographs like 'the' (te lenited).
    let en = 0, ga = 0;
    for (const w of norms) {
      const self = DICT.forms.has(w) || FUNC.has(w);
      if (ENGLISH.has(w)) { if (!self) en++; continue; }
      if (self || irishBase(w)) ga++;              // mutated Irish (bhí, mhaith) counts as Irish too
    }
    const english = en > 0 && en >= 2 * ga;
    // places of more than one word: Baile Átha Cliath, Béal Feirste, Co. an Chláir
    const place = new Set();
    for (let k = 0; k < toks.length; k++) {
      if (!capital(toks[k])) continue;
      for (const p of PLACE_PHRASES) {
        if (k + p.length > toks.length) continue;
        const hit = p.every((pw, j) => norms[k + j] === pw || bases(norms[k + j]).some(([b]) => b === pw));
        if (hit) for (let j = 0; j < p.length; j++) if (capital(toks[k + j])) place.add(k + j);
      }
    }
    toks.forEach((t, k) => {
      const w = norms[k];
      if (!w || (w.length === 1 && !KEEP_SINGLE.has(w))) return;
      let r = rows.get(w);
      if (!r) rows.set(w, r = { w, disp: t, ctx, count: 0, enCount: 0, lower: false, mid: false, place: false, caps: true });
      r.count++;
      if (english) r.enCount++;
      const cap = capital(t);
      if (!cap) r.lower = true;
      else if (k > 0 && t !== t.toUpperCase()) r.mid = true;      // capitalised in mid-sentence
      if (t !== t.toUpperCase() || letters(t) < 2) r.caps = false;  // every occurrence in capitals: a heading or acronym
      if (place.has(k)) r.place = true;
    });
  }
  return [...rows.values()];
}
// The dictionary knows this spelling as a word: a headword, or a verb or adjective form (Mholfainn → molfainn).
// Noun case forms alone don't count, so names like Ciara (also a plural of "ciar") stay names.
function knownAsWord(w) {
  return (DICT.forms.get(w) || []).some(([i, t]) => t === 'lemma' || DICT.lemmas[i].pos !== 'n');
}
const forms = (w) => [w, ...bases(w).map(([b]) => b)];
// Why a word is left out of the list, or '' to keep it
function leftOut(r) {
  const fs = forms(r.w);
  const known = fs.some((f) => DICT.forms.has(f) || FUNC.has(f));
  if (r.caps && !known && letters(r.w) <= 5) return 'acronym';               // TEG, TD
  // Irish uses an apostrophe only after a first d, b, m or s (d'ól, m'athair, s'againne); anything else is English (it's, he's, Tom's)
  if (OPT.eng && r.w.includes("'") && !/^[dbms]'\p{L}{2,}$/u.test(r.w)) return 'english';
  // An English word is left out when no reading of it is Irish, or when it only ever appears in English sentences.
  // So 'the' in an English sentence is English, but 'oíche the' keeps the Irish word te.
  if (OPT.eng && /^[a-z]+$/.test(r.w) && ENGLISH.has(r.w) && !fs.some((f) => PROPER.has(f) || PLACES.has(f))
    && (!known || r.enCount === r.count)) return 'english';
  if (fs.some((f) => CALENDAR.has(f) || FUNC.has(f))) return '';
  // A known name or place written in lower case (transcripts, subtitles) is still a name, unless some reading
  // of it is an ordinary Irish word (colm 'scar', ciara, máire are left alone in lower case only if the dictionary knows them)
  if (r.lower) {
    // BuNaMo files some names as nouns with a capital (Seán, Gaillimh): those don't count as ordinary words
    const common = fs.some((f) => FUNC.has(f) || (DICT.forms.get(f) || []).some(([i]) => !/^\p{Lu}/u.test(DICT.lemmas[i].lemma)));
    const named = fs.some((f) => PROPER.has(f) || PLACES.has(f) || FIRST_NAMES.has(f));
    return named && !common ? 'name' : '';
  }
  if (r.place || fs.some((f) => PROPER.has(f) || PLACES.has(f) || FIRST_NAMES.has(f))) return 'name';
  if (!r.mid || fs.some(knownAsWord)) return '';
  return 'name';
}
function readOpts() {
  OPT = {
    noun: $('opt-noun').checked, adj: $('opt-adj').checked, abs: $('opt-abs').checked, verb: $('opt-verb').checked,
    irr: $('opt-irr').checked, vn: $('opt-vn').checked, vnall: $('opt-vnall').checked, prep: $('opt-prep').checked,
    dictonly: $('opt-dictonly').checked, short: $('opt-short').checked, shorthead: $('opt-shorthead').checked,
    eng: $('opt-eng').checked, th: Number($('opt-th').value),
  };
}
// Choices belong to one document. If the words now loaded are mostly different from the last document's
// (under 80% overlap), pair decisions, removals and kept names start clean, so nothing carries over.
// Small edits to the same text keep them.
function checkDocument(words) {
  if (!words.length) return;
  const prev = store.get('docWords', null);
  if (prev) {
    const a = new Set(prev), b = new Set(words);
    let both = 0; for (const w of b) if (a.has(w)) both++;
    const overlap = both / (a.size + b.size - both);
    if (overlap < 0.8) {
      DEC = {}; removed = new Set(); DROPPED = new Set(); namesKept = new Set();
      store.set('decisions', DEC); store.set('removed', []); store.set('dropped', []); store.set('namesKept', []);
    }
  }
  store.set('docWords', words);
}
function prepare() {
  readOpts();
  ALL = extract($('input').value);
  checkDocument(ALL.map((r) => r.w));
  NAMES = [];
  if (DICT.ready) for (const r of ALL) { r.kind = leftOut(r); r.name = r.kind === 'name'; if (r.kind) NAMES.push(r); }
  SHORT = OPT.short ? ALL.filter((r) => !r.kind && letters(r.w) <= 2) : [];
  const out = new Set([...NAMES.filter((r) => !namesKept.has(r.w)), ...SHORT]);
  W = ALL.filter((r) => !out.has(r));
  idx = new Map(W.map((x, i) => [x.w, i]));
}
const KINDS = [['name', 'Names'], ['english', 'English'], ['acronym', 'Acronyms']];
function showFound() {
  const f = $('found');
  if (!$('input').value.trim()) { f.hidden = true; $('run').disabled = true; $('s1-sub').textContent = ''; return; }
  prepare();
  f.hidden = false; f.textContent = '';
  f.append(el('p', null, el('b', null, W.length.toLocaleString()), ' words', SHORT.length ? el('span', { class: 'lbl' }, ` · ${SHORT.length} short words left out`) : null));
  if (NAMES.length) {
    f.append(el('p', { class: 'lbl' }, 'Left out. Click any to keep:'));
    const chips = el('div', { class: 'chips', lang: 'ga' });
    for (const [kind, title] of KINDS) {
      const rs = NAMES.filter((r) => r.kind === kind).sort((a, b) => a.w.localeCompare(b.w, 'ga'));
      if (!rs.length) continue;
      chips.append(el('span', { class: 'chipgroup' }, title));
      for (const r of rs) {
        chips.append(el('button', { class: 'chip', 'aria-pressed': String(namesKept.has(r.w)),
          onclick: () => { if (namesKept.has(r.w)) namesKept.delete(r.w); else namesKept.add(r.w); saveNames(); } }, kind === 'name' ? r.disp : r.w));
      }
    }
    f.append(chips);
  }
  $('run').disabled = !DICT.ready || !W.length;
  $('s1-sub').textContent = `${W.length.toLocaleString()} words`;
}
function saveNames() { store.set('namesKept', [...namesKept]); showFound(); }
let saveT = null;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { readOpts(); store.set('input', $('input').value); store.set('opts', OPT); }, 300);
}
const OPT_KEYS = ['noun', 'adj', 'abs', 'verb', 'irr', 'vn', 'vnall', 'prep', 'dictonly', 'short', 'shorthead', 'eng'];
function restore() {
  $('input').value = store.get('input', '');
  const o = store.get('opts', null);
  if (o) {
    for (const k of OPT_KEYS) if (k in o) $('opt-' + k).checked = !!o[k];
    if (o.th) { $('opt-th').value = o.th; $('th-out').value = Number(o.th).toFixed(2); }
  }
  DEC = store.get('decisions', {});
  removed = new Set(store.get('removed', []));
  DROPPED = new Set(store.get('dropped', []));
  namesKept = new Set(store.get('namesKept', []));
}

// =====================================================================  steps
let ran = false;
function go(n) {
  for (const k of [1, 2, 3]) {
    $('p' + k).hidden = k !== n;
    const b = $('s' + k);
    if (k === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.classList.toggle('done', ran && k < n);
  }
  if (n === 2) renderCard();
  if (n === 3) renderResult();
  window.scrollTo({ top: 0 });
}
// The work is synchronous, so the spinner is shown and painted first, then the work runs
let busy = false;
async function run() {
  if (busy) return;
  busy = true;
  const b = $('run'), spin = b.querySelector('.spin');
  b.disabled = true; b.setAttribute('aria-busy', 'true'); spin.hidden = false; $('run-t').textContent = 'Removing duplicates…';
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));
  try { work(); } finally {
    busy = false; b.removeAttribute('aria-busy'); spin.hidden = true; $('run-t').textContent = 'Remove duplicates';
    b.disabled = !DICT.ready || !W.length;
  }
}
function work() {
  prepare(); save();
  if (!W.length) return;
  analyse(); applyDecisions();
  pos = SUGG.findIndex((s) => !DEC[s.id]); if (pos < 0) pos = SUGG.length;
  ran = true;
  $('s2').disabled = false; $('s3').disabled = false;
  updateSubs();
  go(SUGG.length && pos < SUGG.length ? 2 : 3);
}
function refresh() { analyse(); applyDecisions(); updateSubs(); }
function updateSubs() {
  const done = SUGG.filter((s) => DEC[s.id]).length;
  $('s2-sub').textContent = SUGG.length ? `${done} of ${SUGG.length} done` : 'None';
  $('s3-sub').textContent = `${groupsNow().length.toLocaleString()} words`;
}

// =====================================================================  step 2: suggestions
function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
function defaultHead(s) {
  const la = lemmaOnly(s.a), lb = lemmaOnly(s.b);
  if (la !== lb) return la ? s.a : s.b;
  const ca = idx.has(s.a) ? W[idx.get(s.a)].count : 0, cb = idx.has(s.b) ? W[idx.get(s.b)].count : 0;
  if (ca !== cb) return ca > cb ? s.a : s.b;
  return s.a.length <= s.b.length ? s.a : s.b;
}
function renderCard() {
  const total = SUGG.length;
  $('p2-count').textContent = total ? `${Math.min(pos + 1, total)} of ${total}` : '';
  $('p2-fill').style.width = total ? (100 * SUGG.filter((s) => DEC[s.id]).length / total) + '%' : '0';
  $('k-prev').disabled = pos === 0;
  $('k-next').hidden = pos >= total;
  const stage = $('stage'); stage.textContent = '';
  if (pos >= total) {
    stage.append(el('div', { class: 'finish' }, el('h3', null, total ? 'All pairs checked' : 'No pairs to check'),
      el('button', { class: 'btn primary big', onclick: () => go(3) }, 'See results')));
    return;
  }
  const s = SUGG[pos], d = DEC[s.id];
  const best = defaultHead(s);
  const word = (w, key) => {
    const n = idx.has(w) ? W[idx.get(w)] : null;
    const sel = d && d.d === 'merge' && d.head === w;
    return el('button', { class: 'choice' + (sel ? ' sel' : ''), title: `Keep ${disp(w)} (${key})`, onclick: () => choose('merge', w) },
      el('span', { class: 'top' }, el('span', null, `Keep this · ${key}`), (!d && w === best) || sel ? el('span', { class: 'tag' }, sel ? 'Kept' : 'Suggested') : null),
      el('span', { class: 'w', lang: 'ga' }, disp(w)),
      el('span', { class: 'info' }, [describe(w) || (n ? 'not in the dictionary' : 'dictionary form'), n ? `${n.count}× in text` : 'not in your text'].join(' · ')),
      n && n.ctx ? el('span', { class: 'ctx', lang: 'ga' }, n.ctx) : null);
  };
  const opt = (dd, label, key, extra) => el('button', { class: 'choice small' + (d && d.d === dd ? ' sel' : ''), title: `${label} (${key})`, onclick: () => choose(dd) }, label, extra || null);
  // Keep neither removes both words and every form merged into them: say how many, and which
  const gone = neitherWords(s);
  const note = gone.length > 2 ? el('span', { class: 'note', title: gone.map(disp).join(', ') }, `· removes ${gone.length} words`) : null;
  stage.append(el('div', { class: 'choices', id: 'card' },
    word(s.a, '1'), word(s.b, '2'), opt('keep', 'Keep both', 'B'), opt('none', 'Keep neither', 'N', note),
    el('p', { class: 'why' }, s.reasons.join('; '))));
}
// Input words that Keep neither removes for pair s: the two words and the forms merged into either of them
function neitherWords(s) {
  const roots = new Set([s.a, s.b].map(nodeOfWord).filter((n) => n != null).map(find));
  const out = [];
  for (let i = 0; i < W.length; i++) if (roots.has(find(i))) out.push(W[i].w);
  for (const w of [s.a, s.b]) if (!out.includes(w) && idx.has(w)) out.push(w);
  return out.sort((a, b) => a.localeCompare(b, 'ga'));
}
function choose(d, headWord) {
  if (pos >= SUGG.length) return;
  const s = SUGG[pos];
  DEC[s.id] = d === 'merge' ? { d, head: headWord } : { d };
  store.set('decisions', DEC);
  refresh();
  pos++; renderCard();
}
function step(n) { pos = Math.max(0, Math.min(SUGG.length, pos + n)); renderCard(); }

// =====================================================================  step 3: results
function results() {
  const gs = groupsNow();
  const keptAs = new Map();             // merged input word -> {h, why}
  for (const g of gs) for (const i of g.members) keptAs.set(W[i].w, { h: g.h, why: why[i] || '' });
  const gone = groupsNow(true).filter((g) => g.gone);
  return { gs, keptAs, gone };
}
const plainWhy = (r) => (r === 'your choice' ? 'you chose this' : r || '');
function renderResult() {
  const { gs, keptAs, gone } = results();
  const goneWords = new Set(gone.flatMap((g) => [g.h, ...g.members.map((i) => W[i].w)]));
  setCounts(gs.length);
  const sorted = (a) => a.sort((x, y) => x.localeCompare(y, 'ga'));
  const outL = $('out-list'), top = outL.scrollTop; outL.textContent = '';
  for (const h of sorted(gs.map((g) => g.h))) {
    outL.append(el('div', { class: 'm' }, el('span', idx.has(h) ? null : { class: 'dict' }, disp(h)),
      el('button', { onclick: (ev) => dropWord(h, true, ev.currentTarget.parentElement), title: `Remove ${disp(h)}`, 'aria-label': `Remove ${disp(h)}` }, '✕')));
  }
  outL.scrollTop = top;
  const inL = $('in-list'); inL.textContent = '';
  for (const r of [...W].sort((a, b) => a.w.localeCompare(b.w, 'ga'))) {
    const k = keptAs.get(r.w), g = goneWords.has(r.w);
    inL.append(el('div', k || g ? { class: 'gone', title: g ? 'removed' : `→ ${disp(k.h)}` } : null, disp(r.w)));
  }
  $('in-h').textContent = `Your words (${W.length.toLocaleString()})`;
  const q = fold(norm($('q').value || ''));
  const hit = (w) => !q || fold(w).includes(q);
  const rm = $('rm-list'); rm.textContent = '';
  const rows = [...keptAs.entries()].filter(([w, k]) => hit(w) || hit(k.h))
    .sort((a, b) => a[1].h.localeCompare(b[1].h, 'ga') || a[0].localeCompare(b[0], 'ga'));
  for (const [w, k] of rows) {
    rm.append(el('div', { class: 'm', title: plainWhy(k.why) }, el('span', null, disp(w)), el('span', { class: 'muted' }, '→'), el('b', null, disp(k.h)),
      el('button', { onclick: () => keepSeparate(w), title: `Keep ${disp(w)} separate`, 'aria-label': `Keep ${disp(w)} separate` }, '✕')));
  }
  if (!rows.length) rm.append(el('div', { class: 'muted' }, q ? 'No match' : 'Nothing merged'));
  $('rm-h').textContent = `Merged (${keptAs.size.toLocaleString()})`;
  $('ex-box').hidden = !gone.length;
  const ex = $('ex-list'); ex.textContent = '';
  for (const s of SUGG.filter((s) => DEC[s.id] && DEC[s.id].d === 'none')) {
    const n = neitherWords(s).length - 2;
    ex.append(el('div', { class: 'm', title: neitherWords(s).map(disp).join(', ') }, el('span', null, `${disp(s.a)}, ${disp(s.b)}`),
      n > 0 ? el('span', { class: 'muted' }, `+${n} form${n > 1 ? 's' : ''}`) : null,
      el('button', { onclick: () => { delete DEC[s.id]; store.set('decisions', DEC); refresh(); renderResult(); }, title: 'Restore' }, '↺')));
  }
  for (const g of gone.filter((g) => DROPPED.has(g.h)).sort((a, b) => a.h.localeCompare(b.h, 'ga'))) {
    ex.append(el('div', { class: 'm' }, el('span', null, disp(g.h)),
      el('button', { onclick: () => dropWord(g.h, false), title: 'Restore', 'aria-label': `Restore ${disp(g.h)}` }, '↺')));
  }
  $('ex-h').textContent = `Removed (${goneWords.size})`;
}
function setCounts(n) {
  const pct = W.length ? Math.round(100 * (1 - n / W.length)) : 0;
  $('r-out').textContent = `${n.toLocaleString()} words`;
  $('r-from').textContent = `from ${W.length.toLocaleString()} · ${pct}% smaller`;
  $('out-h').textContent = `Cleaned list (${n.toLocaleString()})`;
  $('s3-sub').textContent = `${n.toLocaleString()} words`;
}
// The final manual step: take a headword (and its forms) out of the cleaned list.
// Removing a word changes no merges, so there is nothing to re-analyse: the row goes at once and the counts update;
// the other lists are redrawn once the clicking pauses.
let lazyT = null;
function dropWord(h, drop, row) {
  if (drop) DROPPED.add(h); else DROPPED.delete(h);
  try { store.set('dropped', [...DROPPED]); } catch (e) {}
  clearTimeout(lazyT);
  if (drop && row) {
    row.remove();
    setCounts($('out-list').childElementCount);
    lazyT = setTimeout(renderResult, 800);
  } else renderResult();
}
function keepSeparate(w) {
  removed.add(w); store.set('removed', [...removed]);
  refresh(); renderResult();
}
// A cell starting with = + - @ or a tab could run as a formula in a spreadsheet: a leading ' makes it plain text
function csvCell(v) {
  v = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function reportCSV() {
  const { keptAs, gone } = results();
  const goneWords = new Set(gone.flatMap((g) => [g.h, ...g.members.map((i) => W[i].w)]));
  const rows = [['word', 'count', 'kept_as', 'reason', 'example']];
  for (const r of [...W].sort((a, b) => a.w.localeCompare(b.w, 'ga'))) {
    const k = keptAs.get(r.w);
    rows.push([r.disp, r.count, goneWords.has(r.w) ? '' : (k ? disp(k.h) : r.disp), goneWords.has(r.w) ? 'removed by you' : (k ? plainWhy(k.why) : ''), r.ctx]);
  }
  const why2 = { name: 'left out: name', english: 'left out: English', acronym: 'left out: acronym' };
  for (const r of ALL) if (!idx.has(r.w)) rows.push([r.disp, r.count, '', why2[r.kind] || 'left out: 1–2 letters', r.ctx]);
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}
function cleanedTXT() { return groupsNow().map((g) => disp(g.h)).sort((a, b) => a.localeCompare(b, 'ga')).join('\n'); }
async function saveFile(name, text, type) {
  const msg = $('dl-msg');
  try {
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (dl) { await dl.save({ filename: name, data: text }); msg.textContent = 'Saved ' + name; return; }
  } catch (e) { msg.textContent = 'Not saved.'; return; }
  const a = el('a', { href: URL.createObjectURL(new Blob(['﻿' + text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
  msg.textContent = 'Downloaded ' + name;
}

// =====================================================================  wiring
for (const k of [1, 2, 3]) $('s' + k).onclick = () => go(k);
$('input').addEventListener('input', () => { save(); clearTimeout(window._ft); window._ft = setTimeout(showFound, 250); });
// Read a text file safely: size limit, binary check, UTF-8 (or UTF-16 with a BOM), else Windows-1252 with a note
const MAX_FILE = 20 * 1024 * 1024;
async function loadFile(f) {
  if (!f) return;
  const st = $('status');
  if (f.size > MAX_FILE) { st.textContent = `${f.name} is too large (${(f.size / 1048576).toFixed(1)} MB). The limit is 20 MB.`; return; }
  try {
    const buf = new Uint8Array(await f.arrayBuffer());
    let text, note = '';
    if (buf[0] === 0xff && buf[1] === 0xfe) text = new TextDecoder('utf-16le').decode(buf);
    else if (buf[0] === 0xfe && buf[1] === 0xff) text = new TextDecoder('utf-16be').decode(buf);
    else {
      const nul = buf.subarray(0, 4096).filter((b) => b === 0).length;
      if (nul > 8) { st.textContent = `${f.name} is not a plain text file. For Word or PDF files, copy the text and paste it here.`; return; }
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
      catch (e) { text = new TextDecoder('windows-1252').decode(buf); note = ' is not UTF-8: read as Windows-1252, so check the fadas'; }
    }
    $('input').value = text.replace(/^\uFEFF/, '');
    st.textContent = note ? f.name + note : (DICT.ready ? '' : st.textContent);
    save(); showFound();
  } catch (e) {
    st.textContent = `Could not read ${f.name}: ${e.message || e}`;
  }
}
$('file').onchange = (e) => loadFile(e.target.files[0]);
const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); loadFile(e.dataTransfer.files[0]); });
for (const k of OPT_KEYS) $('opt-' + k).onchange = () => { save(); showFound(); };
$('opt-th').oninput = () => { $('th-out').value = Number($('opt-th').value).toFixed(2); save(); };
$('run').onclick = run;
$('k-prev').onclick = () => step(-1);
$('k-next').onclick = () => step(1);
$('q').oninput = renderResult;
$('dl-txt').onclick = () => saveFile('cleaned-list.txt', cleanedTXT(), 'text/plain');
$('dl-csv').onclick = () => saveFile('word-report.csv', reportCSV(), 'text/csv');
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(cleanedTXT()); $('dl-msg').textContent = 'Copied'; }
  catch (e) { $('dl-msg').textContent = 'Copy isn’t available here; use Download.'; }
};
window.addEventListener('keydown', (e) => {
  if ($('p2').hidden || e.metaKey || e.ctrlKey || e.altKey) return;
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement && document.activeElement.tagName)) return;
  const k = e.key;
  if (k === 'ArrowRight') step(1);
  else if (k === 'ArrowLeft') step(-1);
  else if (k === '1' && pos < SUGG.length) choose('merge', SUGG[pos].a);
  else if (k === '2' && pos < SUGG.length) choose('merge', SUGG[pos].b);
  else if (k === 'b' || k === 'B') choose('keep');
  else if (k === 'n' || k === 'N') choose('none');
  else return;
  e.preventDefault();
});
restore();
loadDict().then(() => {
  $('status').textContent = '';
  showFound();
}).catch((e) => { $('status').textContent = `The dictionary could not load: ${e.message}. Try a current version of Chrome, Edge, Firefox or Safari.`; });
