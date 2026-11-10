'use strict';
// =====================================================================  helpers
const $ = (id) => document.getElementById(id);
const V = 'aeiouáéíóú';
const isV = (c) => !!c && V.includes(c);
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const store = {
  get(k, d) { try { const v = localStorage.getItem('glantoir:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('glantoir:' + k, JSON.stringify(v)); } catch (e) {} },
};
function norm(w) {
  // tAthair, nÉireann: the capital shows where the prefix ends; keep that as t- / n- before lowercasing
  w = w.trim().replace(/^([tn])(?=[AÁEÉIÍOÓUÚ])/, '$1-');
  return w.replace(/[’‘`´]/g, "'").replace(/^[^\p{L}']+|[^\p{L}'-]+$/gu, '').toLowerCase();
}

// =====================================================================  dictionary
const DICT = { lemmas: [], forms: new Map(), ready: false };
// Function words, pronouns, common adverbs and irregular verb forms. BuNaMo has no entries for most of them, so
// their spellings would otherwise match rare forms of unrelated words (féin ≠ genitive of féan, ba ≠ plural of bó).
const FUNC = new Set(["a", "ab", "abhaile", "ach", "aduaidh", "ag", "agus", "amach", "amháin", "amárach", "an", "aneas", "aniar", "ann", "anocht", "anoir", "anois", "anseo", "ansin", "anuas", "anuraidh", "aníos", "aon", "ar", "arb", "aréir", "arís", "as", "atá", "ba", "beagnach", "bhfuair", "bhfuil", "bhuel", "bhur", "cad", "caidé", "cathain", "cheana", "chomh", "choíche", "chuig", "chun", "conas", "cá", "cé", "céard", "cén", "cúpla", "dar", "darb", "de", "den", "deo", "dhá", "do", "don", "dtí", "dá", "dár", "ea", "eile", "eisean", "faoi", "faoin", "faoina", "faoinar", "faraor", "fiú", "freisin", "fuair", "féin", "fós", "gach", "gan", "go", "gur", "gurb", "haigh", "hea", "heileo", "i", "iad", "iadsan", "idir", "in", "ina", "inar", "inniu", "inné", "inár", "is", "ise", "isteach", "istigh", "istoíche", "laistigh", "lasmuigh", "le", "leis", "lena", "lenár", "maidir", "mar", "mise", "mo", "muid", "muise", "mura", "murar", "má", "mé", "n'fheadar", "na", "nach", "nuair", "ná", "nár", "nárbh", "ní", "níl", "nílim", "nílimid", "níor", "níorbh", "nó", "puinn", "raibh", "riamh", "roimh", "sa", "san", "seachas", "seisean", "seo", "siad", "siadsan", "siar", "sibh", "sibhse", "sin", "sinn", "sinne", "sise", "siúd", "sna", "soir", "suas", "sula", "sular", "sé", "sí", "síos", "tada", "thall", "thar", "thart", "theas", "thiar", "thoir", "thuaidh", "thuas", "thusa", "thíos", "thú", "trasna", "trí", "tusa", "tá", "táim", "táimid", "tú", "uile", "uilig", "um", "á", "áfach", "ár", "é", "éigin", "éinne", "í", "ó", "ón", "óna"]);
const IRREG = new Set(['bí', 'abair', 'beir', 'clois', 'cluin', 'déan', 'faigh', 'feic', 'ith', 'tabhair', 'tar', 'téigh']);
// Forms of the irregular verbs that BuNaMo files under other spellings (synthetic, relative, negative and dependent forms)
const IRREG_SUPP = { 'tá': 'bí', 'atá': 'bí', 'táim': 'bí', 'táimid': 'bí', 'níl': 'bí', 'nílim': 'bí', 'nílimid': 'bí', 'bhfuil': 'bí',
  'bhfuilim': 'bí', 'bhfuilimid': 'bí', 'raibh': 'bí', 'rabhamar': 'bí', 'deir': 'abair', 'deirim': 'abair', 'deirimid': 'abair',
  'rinne': 'déan', 'dearna': 'déan', 'chonaic': 'feic', 'bhfaca': 'feic', 'faca': 'feic', 'chuala': 'clois', 'fuair': 'faigh', 'bhfuair': 'faigh',
  'chuaigh': 'téigh', 'deachaigh': 'téigh', 'tháinig': 'tar', 'thug': 'tabhair', 'rug': 'beir', 'thig': 'tar', 'tig': 'tar' };
const PROPER = new Set();   // BuNaMo proper nouns and their forms
// Places and personal names that the dictionary doesn't mark; only used for words that are never written in lower case
const PLACES = new Set(['éire', 'éireann', 'éirinn', 'sasana', 'albain', 'frainc', 'fraince', 'spáinn', 'spáinne', 'iodáil', 'iodáile', 'gearmáin',
  'gearmáine', 'gréig', 'polainn', 'portaingéil', 'sualainn', 'fionlainn', 'danmhairg', 'ísiltír', 'beilg', 'eilvéis', 'ostair', 'rúis', 'úcráin',
  'liotuáin', 'meiriceá', 'ceanada', 'meicsiceo', 'astráil', 'afraic', 'afraice', 'eoraip', 'eorpa', 'india', 'sín', 'seapáin', 'londain', 'páras',
  'róimh', 'gaillimh', 'corcaigh', 'luimneach', 'ciarraí', 'sligeach', 'liatroim', 'muineachán', 'ceatharlach', 'laois', 'longfort', 'sionainn',
  'feirste', 'cliath', 'láirge', 'gall', 'chainnigh', 'mhantáin', 'garman', 'eoghain', 'fhailí', 'árann', 'tuaim', 'doire', 'cabhán']);
const PLACE_PHRASES = [['baile', 'átha', 'cliath'], ['béal', 'feirste'], ['port', 'láirge'], ['dún', 'na', 'gall'], ['cill', 'chainnigh'],
  ['cill', 'dara'], ['cill', 'mhantáin'], ['loch', 'garman'], ['tiobraid', 'árann'], ['maigh', 'eo'], ['tír', 'eoghain'], ['ard', 'mhacha'],
  ['uíbh', 'fhailí'], ['ros', 'comáin'], ['dún', 'dealgan'], ['contae', 'an', 'chláir'], ['co', 'an', 'chláir']];
const FIRST_NAMES = new Set(['seán', 'síle', 'máire', 'pádraig', 'siobhán', 'aoife', 'ciarán', 'sinéad', 'pól', 'peadar', 'seosamh', 'liam',
  'niamh', 'orla', 'úna', 'bríd', 'caitlín', 'nóra', 'éamonn', 'séamus', 'tomás', 'micheál', 'muireann', 'sadhbh', 'caoimhe', 'fionn', 'oisín',
  'colm', 'áine', 'ciara', 'sorcha', 'róisín', 'eoin', 'dónall', 'donncha', 'diarmaid', 'gráinne', 'méabh', 'aisling', 'deirdre', 'eithne',
  'cormac', 'cathal', 'rónán', 'tadhg', 'nuala', 'máirtín', 'mairéad', 'cian', 'conall', 'fiachra', 'tom', 'maria', 'mary', 'john', 'sarah',
  'emma', 'jim', 'larry', 'tony', 'jacob', 'bess', 'tommy', 'joe', 'luke', 'marcus', 'kate', 'jan', 'peter', 'paul', 'anne', 'david', 'michael']);
const ENGLISH = new Set((/*ENGLISH*/'').split(' '));
// =====================================================================  gzip fallback (RFC 1951/1952, after zlib's puff.c)
function gunzip(buf) {
  if (buf[0] !== 0x1f || buf[1] !== 0x8b || buf[2] !== 8) throw new Error('dictionary data is not gzip');
  const flg = buf[3]; let p = 10;
  if (flg & 4) p += 2 + (buf[p] | (buf[p + 1] << 8));
  if (flg & 8) while (buf[p++]);
  if (flg & 16) while (buf[p++]);
  if (flg & 2) p += 2;
  return inflate(buf.subarray(p));
}
function inflate(d) {
  let p = 0, bb = 0, bc = 0, o = 0, out = new Uint8Array(d.length * 4);
  const need = (n) => { if (o + n > out.length) { const t = new Uint8Array(Math.max(out.length * 2, o + n)); t.set(out); out = t; } };
  const bits = (n) => {
    while (bc < n) { if (p >= d.length) throw new Error('dictionary data is cut short'); bb |= d[p++] << bc; bc += 8; }
    const v = bb & ((1 << n) - 1); bb >>>= n; bc -= n; return v;
  };
  const build = (lens) => {
    const count = new Uint16Array(16), sym = new Uint16Array(lens.length), offs = new Uint16Array(16);
    for (const l of lens) count[l]++;
    count[0] = 0;
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
    for (let s = 0; s < lens.length; s++) if (lens[s]) sym[offs[lens[s]]++] = s;
    return { count, sym };
  };
  const decode = (h) => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const c = h.count[len];
      if (code - c < first) return h.sym[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('dictionary data is damaged');
  };
  const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  let last;
  do {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {                       // stored
      bb = 0; bc = 0;
      const len = d[p] | (d[p + 1] << 8); p += 4;
      need(len); out.set(d.subarray(p, p + len), o); o += len; p += len;
      continue;
    }
    let lc, dc;
    if (type === 1) {                       // fixed codes
      const l = new Uint8Array(288);
      l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
      lc = build(l); dc = build(new Uint8Array(30).fill(5));
    } else if (type === 2) {                // dynamic codes
      const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
      const cl = new Uint8Array(19);
      for (let i = 0; i < ncode; i++) cl[ORD[i]] = bits(3);
      const ch = build(cl), lens = new Uint8Array(nlen + ndist);
      for (let i = 0; i < nlen + ndist;) {
        const sym = decode(ch);
        if (sym < 16) { lens[i++] = sym; continue; }
        let v = 0, rep;
        if (sym === 16) { v = lens[i - 1]; rep = 3 + bits(2); } else if (sym === 17) rep = 3 + bits(3); else rep = 11 + bits(7);
        while (rep--) lens[i++] = v;
      }
      lc = build(lens.subarray(0, nlen)); dc = build(lens.subarray(nlen));
    } else throw new Error('dictionary data is damaged');
    for (;;) {
      let sym = decode(lc);
      if (sym < 256) { need(1); out[o++] = sym; continue; }
      if (sym === 256) break;
      sym -= 257;
      const len = LB[sym] + bits(LE[sym]), ds = decode(dc), dist = DB[ds] + bits(DE[ds]);
      need(len);
      for (let k = 0; k < len; k++, o++) out[o] = out[o - dist];
    }
  } while (!last);
  return out.subarray(0, o);
}
async function loadDict() {
  const b64 = $('dict-data').textContent.replace(/\s+/g, '');
  // The template (glantoir.tpl.html) has a placeholder here; build.py fills it in to make glantoir.html
  if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) throw new Error('this copy has no dictionary built in. Open glantoir.html (made by build.py), not glantoir.tpl.html');
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  // Browsers with DecompressionStream unpack natively; others use the small inflater below (slower, same result)
  const text = typeof DecompressionStream === 'function'
    ? await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder('utf-8').decode(gunzip(bin));
  const add = (form, i, type) => {
    let a = DICT.forms.get(form); if (!a) DICT.forms.set(form, a = []);
    a.push([i, type]);
  };
  for (const line of text.split('\n')) {
    const [lemma, pos, gender, body] = line.split('\t');
    if (pos === 'N') {
      PROPER.add(lemma.toLowerCase());
      if (body) for (const part of body.split(';')) for (const f of part.split(':')[1].split(',')) PROPER.add(f.toLowerCase());
      continue;
    }
    const i = DICT.lemmas.push({ lemma, pos, gender }) - 1;
    add(lemma.toLowerCase(), i, 'lemma');
    if (body) for (const part of body.split(';')) {
      const [t, fs] = part.split(':');
      for (const f of fs.split(',')) add(f.toLowerCase(), i, t);
    }
  }
  DICT.ready = true;
}
const POSN = { n: 'noun', a: 'adjective', v: 'verb', p: 'preposition' };
const TYPEN = { lemma: 'dictionary form', gen: 'genitive', pl: 'plural', plgen: 'genitive plural', voc: 'vocative',
  cmp: 'comparative', abs: 'abstract noun', fin: 'verb form', vn: 'verbal noun', va: 'verbal adjective', pron: 'prepositional pronoun' };
function lemmaDesc(w) {           // what w is as a headword of its own: "noun f", "adjective"…
  const a = (DICT.forms.get(w) || []).filter(([, t]) => t === 'lemma');
  return [...new Set(a.map(([i]) => { const L = DICT.lemmas[i]; return POSN[L.pos] + (L.gender ? ' ' + L.gender : ''); }))].join(' / ');
}
function describe(w) {
  const a = DICT.forms.get(w) || [];
  return [...new Set(a.map(([i, t]) => {
    const L = DICT.lemmas[i];
    return t === 'lemma' ? `${POSN[L.pos]}${L.gender ? ' ' + L.gender : ''}` : `${TYPEN[t]} of ${L.lemma}`;
  }))].join(' · ');
}

// =====================================================================  rules (An Caighdeán Oifigiúil ch. 10, 2.1.7)
const EMPH_PRON = { mise: 'mé', tusa: 'tú', thusa: 'tú', seisean: 'sé', eisean: 'é', sise: 'sí', ise: 'í', sinne: 'sinn', muidne: 'muid',
  sibhse: 'sibh', siadsan: 'siad', iadsan: 'iad' };
// Preposition + article or possessive, when prepositional pronouns are merged (sa, san, sna = i + an/na)
const CONTRACTIONS = { den: 'de', don: 'do', dá: 'do', faoin: 'faoi', faoina: 'faoi', faoinar: 'faoi', ón: 'ó', óna: 'ó', ónár: 'ó', sa: 'i',
  san: 'i', sna: 'i', ina: 'i', inar: 'i', inár: 'i', lena: 'le', lenár: 'le', lenar: 'le', trína: 'trí', trínar: 'trí', mar: 'mar' };
// Genitives of months, days and feasts
const CAL_GEN = { luain: 'luan', máirte: 'máirt', sathairn: 'satharn', domhnaigh: 'domhnach', nollag: 'nollaig', samhna: 'samhain',
  fómhair: 'fómhar', cásca: 'cáisc', aibreáin: 'aibreán', meithimh: 'meitheamh', earraigh: 'earrach', geimhridh: 'geimhreadh', samhraidh: 'samhradh' };
// Words from the text are looked up in these tables, so they must not inherit keys like 'constructor'
for (const t of [IRREG_SUPP, EMPH_PRON, CONTRACTIONS, CAL_GEN]) Object.setPrototypeOf(t, null);
const UNLEN = new Set('bcdfgmpt');
// Standard words whose spelling only looks mutated: never strip them (thuaidh is not a lenited *tuaidh*)
const NO_STRIP = new Set(['thuaidh', 'theas', 'thiar', 'thoir', 'thall', 'thuas', 'thíos', 'thart', 'thar', 'thairis', 'cheana', 'chomh',
  'chun', 'chuig', 'choíche', 'dhá', 'dhéag', 'bhur', 'níos', 'nach', 'nár', 'ná', 'nó', 'nuair', 'gach']);
// Each step returns [base, rule] candidates for one stripped prefix.
function stripOnce(w) {
  const out = [];
  let m;
  if ((m = w.match(/^([dbm])'(.+)$/))) {             // d'fhág, d'ól, m'athair, b'fhéidir
    let r = m[2]; if (r.startsWith('fh')) r = 'f' + r.slice(2);
    out.push([r, "d' b' m'"]);
  }
  if ((m = w.match(/^s'(.+)$/))) out.push([m[1], "s' (is)"]);   // an teach s'againne
  if ((m = w.match(/^(an-|ana-)(.+)$/))) out.push([unlen(m[2]), 'an- prefix']);
  if ((m = w.match(/^ró-(.+)$/))) out.push([unlen(m[1]), 'ró- prefix']);
  else if ((m = w.match(/^ró(([bcdfgmpt]h|sh|[lnr]|s[cfmptv]).+)$/))) out.push([unlen(m[1]), 'ró- prefix']);
  if ((m = w.match(/^fíor-?(([bcdfgmpt]h|sh|[lnr]|s[cfmptv]|-).+)$/))) out.push([unlen(m[1].replace(/^-/, '')), 'fíor- prefix']);
  if ((m = w.match(/^sár-?(.{3,})$/))) out.push([unlen(m[1]), 'sár- prefix']);
  if ((m = w.match(/^t-(.+)$/)) && isV(m[1][0])) out.push([m[1], 't- before a vowel']);
  if ((m = w.match(/^ts(.+)$/)) && (isV(m[1][0]) || 'lnr'.includes(m[1][0]))) out.push(['s' + m[1], 't before s']);
  if ((m = w.match(/^n-(.+)$/)) && isV(m[1][0])) out.push([m[1], 'urú (n-)']);
  if ((m = w.match(/^h-?(.+)$/)) && isV(m[1][0])) out.push([m[1], 'h before a vowel']);
  if ((m = w.match(/^bhf(.+)$/))) out.push(['f' + m[1], 'urú']);
  else if ((m = w.match(/^(mb|gc|nd|ng|bp|dt)(.+)$/))) out.push([m[1][1] + m[2], 'urú']);
  if ((m = w.match(/^([bcdfgmpt])h(.+)$/))) out.push([m[1] + m[2], 'séimhiú']);
  if ((m = w.match(/^sh(.+)$/)) && (isV(m[1][0]) || 'lnr'.includes(m[1][0]))) out.push(['s' + m[1], 'séimhiú']);
  return out.filter(([b]) => b.length >= 1);
}
function unlen(r) {
  if (r.length > 2 && r[1] === 'h' && (UNLEN.has(r[0]) || (r[0] === 's' && (isV(r[2]) || 'lnr'.includes(r[2]))))) return r[0] + r.slice(2);
  return r;
}
// All bases reachable by up to three stripping steps, nearest first: [[base, [rules]]]
function bases(w) {
  if (NO_STRIP.has(w)) return [];
  const seen = new Map([[w, []]]);
  let frontier = [w];
  for (let d = 0; d < 3; d++) {
    const next = [];
    for (const f of frontier) for (const [b, r] of stripOnce(f)) {
      if (!seen.has(b)) { seen.set(b, [...seen.get(f), r]); next.push(b); }
    }
    frontier = next;
  }
  seen.delete(w);
  return [...seen.entries()];
}
function emphatic(w) {
  if (EMPH_PRON[w]) return [EMPH_PRON[w], 'emphatic pronoun'];
  const isPron = (f) => (DICT.forms.get(f) || []).some(([, t]) => t === 'pron');
  for (const s of ['sean', 'san', 'sa', 'se', 'na', 'ne']) {
    if (w.length > s.length + 1 && w.endsWith(s) && isPron(w.slice(0, -s.length))) return [w.slice(0, -s.length), 'emphatic suffix'];
  }
  // -ne after -nn drops an n: againn + ne → againne, linn → linne, dúinn → dúinne
  if (w.endsWith('nne') && isPron(w.slice(0, -1))) return [w.slice(0, -1), 'emphatic suffix'];
  return null;
}

// =====================================================================  analysis
let W = [];          // [{w, disp, ctx, count}]
let idx = new Map(); // normalised word -> index in W
let parent = [];     // union-find over W plus extra dictionary headwords
let head = [];       // display headword of each node
let why = [];        // reason a node was merged into its parent
let extra = new Map(); // dictionary headword not in list -> node index
let removed = new Set(); // keys "w" the user split out of rule groups
let OPT = {};

function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
function nodeFor(word) {
  if (idx.has(word)) return idx.get(word);
  if (extra.has(word)) return extra.get(word);
  const i = parent.length; parent.push(i); head.push(word); why.push(null); extra.set(word, i); return i;
}
function attach(i, target, reason) {   // merge node i under target's group
  const a = find(i), b = find(target);
  if (a === b) return false;
  parent[a] = b; why[i] = why[i] || reason; return true;
}
function allowed(t, L) {
  if (t === 'lemma') return true;
  if (L.pos === 'n') return OPT.noun && ['gen', 'pl', 'plgen', 'voc'].includes(t);
  if (L.pos === 'a') return (OPT.adj && ['gen', 'pl', 'cmp'].includes(t)) || (OPT.abs && t === 'abs');
  if (L.pos === 'v') {
    if (t === 'vn' || t === 'va') return OPT.vn && (OPT.vnall || idx.has(L.lemma.toLowerCase())) && (!IRREG.has(L.lemma) || OPT.irr);
    return IRREG.has(L.lemma) ? OPT.irr : OPT.verb;
  }
  if (L.pos === 'p') return OPT.prep;
  return false;
}
// Dictionary headwords this exact spelling can belong to (with allowed form types)
// Dictionary headwords this exact spelling can belong to: lemma -> {types allowed by the options, types switched off}
function lemmasOf(form) {
  const a = DICT.forms.get(form) || [];
  const res = new Map();
  for (const [i, t] of a) {
    const L = DICT.lemmas[i];
    const k = L.lemma.toLowerCase();
    if (!res.has(k)) res.set(k, { on: new Set(), off: new Set(), pos: new Set() });
    res.get(k).pos.add(L.pos);
    res.get(k)[allowed(t, L) ? 'on' : 'off'].add(t);
  }
  return res;
}
// Forms BuNaMo also lists as headwords of their own, but which belong with their source word
const DERIV = new Set(['vn', 'va', 'cmp', 'abs']);
const label = (types) => { const ts = [...types]; const t = ts.find((x) => DERIV.has(x)) || ts.find((x) => x !== 'lemma') || 'lemma'; return t === 'lemma' ? 'dictionary form' : TYPEN[t]; };

const MAX_COMPARISONS = 5e6;
const MAX_PAIRS = 3000;       // more pairs than anyone would check by hand
let SUGG_CUT = false;  // true when the work budget or the pair limit cut the suggestions short
let SUGG = [];       // [{a, b, score, reasons[]}]
// ---- helpers for the analysis
const letters = (w) => [...w.replace(/['’-]/g, '')].length;
// A form of one of the twelve irregular verbs: [verb, form type]
function irregOf(form) {
  for (const [i, t] of DICT.forms.get(form) || []) { const L = DICT.lemmas[i]; if (L.pos === 'v' && IRREG.has(L.lemma)) return [L.lemma, t]; }
  return IRREG_SUPP[form] ? [IRREG_SUPP[form], 'fin'] : null;
}
// The spelling is also a headword that isn't a verb (té = tea, not only a form of téigh)
const nonVerbLemma = (form) => (DICT.forms.get(form) || []).some(([i, t]) => t === 'lemma' && DICT.lemmas[i].pos !== 'v');
// Every dictionary analysis of the spelling belongs to the same headword (mol: yes; cinn: no, it is also a plural of ceann)
// h is only this verb: other readings of its spelling may only be case forms of the verbal noun itself (cuir: gen. of cur)
// or of an adjective (aistrigh: gen. of aistreach), never of another noun (cinn: ceann) or another headword (saor)
const unambiguous = (h, form) => (DICT.forms.get(h) || []).every(([i, t]) => {
  const l = DICT.lemmas[i], lem = l.lemma.toLowerCase();
  return lem === h ? (t !== 'lemma' || l.pos === 'v') : (t !== 'lemma' && (lem === form || l.pos === 'a'));
});
// A noun reading wins over a derived adjective in -ach, -each, -úil, -mhar (aibhneacha: abhainn, not aibhneach)
function preferNoun(targets) {
  const noun = targets.some(([, v]) => v.pos.has('n') && ['gen', 'pl', 'plgen'].some((t) => v.on.has(t)));
  if (!noun) return targets;
  return targets.filter(([h, v]) => !(v.pos.size === 1 && v.pos.has('a') && /(ach|each|úil|iúil|mhar)$/.test(h))
    && !(v.pos.size === 1 && v.pos.has('v') && [...v.on].every((t) => t === 'va') && !idx.has(h)));   // tíortha: tír, not tíor
}
// Several verbs: prefer the standard -igh verb for second-conjugation endings, then the shorter headword
// (chabhróidh: cabhraigh, not cabhair; díreofar: dírigh, not díreoigh); chun's forms are filed under chuig
function preferVerb(form, targets) {
  if (targets.length < 2) return targets;
  if (targets.every(([, v]) => v.pos.has('p'))) { const c = targets.filter(([h]) => h !== 'chun'); return c.length ? c : targets; }
  if (!targets.every(([, v]) => v.pos.size === 1 && v.pos.has('v'))) return targets;
  let ts = targets;
  if (/(óidh|eoidh|ófar|eofar|ódh|eodh|aíonn|íonn|aím|ím|aímid|ímid|óimid|eoimid|aíodh|íodh|aítear|ítear)$/.test(form)) {
    const igh = ts.filter(([h]) => h.endsWith('igh')); if (igh.length) ts = igh;
  }
  const min = Math.min(...ts.map(([h]) => h.length));
  const short = ts.filter(([h]) => h.length === min);
  return short.length === 1 ? short : ts;
}
// A verbal noun entered as a noun (briseadh, múineadh) is the verb's own noun; an adjective entry (cinnte, déanta) may be a word in its own right
// Verbal nouns and adjectives with a common meaning of their own stay separate (roinnt 'some', gairm 'profession')
const LEXICAL = new Set(['roinnt', 'gairm', 'cinnte', 'saoire', 'éigin', 'bheith', 'beith', 'ceannach', 'cáil', 'tuiscint', 'creideamh']);
const selfNounOnly = (form) => (DICT.forms.get(form) || []).filter(([, t]) => t === 'lemma').every(([i]) => DICT.lemmas[i].pos === 'n');
const selfOnlyAdj = (form) => (DICT.forms.get(form) || []).filter(([, t]) => t === 'lemma').every(([i]) => DICT.lemmas[i].pos === 'a');
// Native Irish words never begin with these clusters, so the mutation is certain even if the base word is unknown
function certain(w) {
  if (NO_STRIP.has(w) || FUNC.has(w)) return null;
  let m;
  if ((m = w.match(/^bhf(.{2,})$/))) return ['f' + m[1], 'urú'];
  if ((m = w.match(/^(mb|gc|nd|bp|dt)(.{2,})$/))) return [m[1][1] + m[2], 'urú'];
  if ((m = w.match(/^([gdpf])h(.{2,})$/))) return [m[1] + m[2], 'séimhiú'];
  // A hyphenated intensifier is always a prefix (an-aiféal → aiféal). If the base is unknown but adding -a or -e
  // gives a dictionary headword, that is the standard spelling (aiféal → aiféala)
  if ((m = w.match(/^(an|ana|ró|fíor|sár)-(.{2,})$/))) {
    const b = unlen(m[2]);
    const std = ['a', 'e'].map((x) => b + x).find((x) => (DICT.forms.get(x) || []).some(([, t]) => t === 'lemma'));
    return std ? [std, `${m[1]}- prefix + standard spelling ${std}`] : [b, m[1] + '- prefix'];
  }
  return null;
}
// Endings removed by rule; the result must be a dictionary headword of the right kind: [ending, replacement, label, kind]
const GUESS = [
  ['eanna', '', 'plural -eanna', 'n'], ['anna', '', 'plural -anna', 'n'], ['eacha', '', 'plural -eacha', 'n'], ['acha', '', 'plural -acha', 'n'],
  ['aí', '', 'plural -aí', 'n'], ['í', '', 'plural -í', 'n'], ['í', 'e', 'plural -í', 'n'], ['ta', '', 'plural -ta', 'n'], ['te', '', 'plural -te', 'n'],
  ['tha', '', 'plural -tha', 'n'], ['the', '', 'plural -the', 'n'], ['a', '', 'plural -a', 'n'], ['e', '', 'genitive -e', 'n'],
  ['aigh', 'ach', 'genitive -aigh', 'n'], ['igh', 'each', 'genitive -igh', 'n'],
  ['úla', 'úil', 'adjective plural', 'a'], ['iúla', 'iúil', 'adjective plural', 'a'], ['a', '', 'adjective plural', 'a'], ['e', '', 'adjective genitive', 'a'],
  ['aíonn', 'aigh', 'verb -aíonn', 'v'], ['íonn', 'igh', 'verb -íonn', 'v'], ['aímid', 'aigh', 'verb -aímid', 'v'], ['ímid', 'igh', 'verb -ímid', 'v'],
  ['aím', 'aigh', 'verb -aím', 'v'], ['ím', 'igh', 'verb -ím', 'v'], ['óimid', 'aigh', 'future -óimid', 'v'], ['eoimid', 'igh', 'future -eoimid', 'v'],
  ['óidh', 'aigh', 'future -óidh', 'v'], ['eoidh', 'igh', 'future -eoidh', 'v'], ['ófar', 'aigh', 'future -ófar', 'v'], ['eofar', 'igh', 'future -eofar', 'v'],
  ['ódh', 'aigh', 'conditional -ódh', 'v'], ['eodh', 'igh', 'conditional -eodh', 'v'], ['aíodh', 'aigh', 'past -aíodh', 'v'], ['íodh', 'igh', 'past -íodh', 'v'],
  ['aígí', 'aigh', 'imperative -aígí', 'v'], ['ígí', 'igh', 'imperative -ígí', 'v'], ['aigí', '', 'imperative -aigí', 'v'], ['igí', '', 'imperative -igí', 'v'],
  ['aimid', '', 'verb -aimid', 'v'], ['imid', '', 'verb -imid', 'v'], ['eann', '', 'verb -eann', 'v'], ['ann', '', 'verb -ann', 'v'],
  ['aim', '', 'verb -aim', 'v'], ['im', '', 'verb -im', 'v'], ['faidh', '', 'future -faidh', 'v'], ['fidh', '', 'future -fidh', 'v'],
  ['fadh', '', 'conditional -fadh', 'v'], ['feadh', '', 'conditional -feadh', 'v'], ['far', '', 'future -far', 'v'], ['fear', '', 'future -fear', 'v'],
  ['tar', '', 'autonomous -tar', 'v'], ['tear', '', 'autonomous -tear', 'v'],
  ['ú', 'aigh', 'verbal noun -ú', 'vn'], ['iú', 'igh', 'verbal noun -iú', 'vn'], ['eadh', '', 'verbal noun -eadh', 'vn'], ['adh', '', 'verbal noun -adh', 'vn'],
  ['aithe', 'aigh', 'verbal adjective -aithe', 'vn'], ['ithe', 'igh', 'verbal adjective -ithe', 'vn'], ['ta', '', 'verbal adjective -ta', 'vn'],
  ['te', '', 'verbal adjective -te', 'vn'], ['tha', '', 'verbal adjective -tha', 'vn'], ['the', '', 'verbal adjective -the', 'vn'],
];
function guessFor(f) {               // dictionary headwords reachable from spelling f by one ending rule
  const found = new Map();
  const ok = (cand, kind) => {
    if (letters(cand) < 3 || FUNC.has(cand)) return false;
    return (DICT.forms.get(cand) || []).some(([i, t]) => {
      if (t !== 'lemma') return false;
      const L = DICT.lemmas[i];
      if (kind === 'n') return L.pos === 'n' && OPT.noun;
      if (kind === 'a') return L.pos === 'a' && OPT.adj;
      if (L.pos !== 'v') return false;
      if (IRREG.has(L.lemma) && !OPT.irr) return false;
      return kind === 'v' ? OPT.verb : OPT.vn && (OPT.vnall || idx.has(cand));
    });
  };
  for (const [end, rep, lab, kind] of GUESS) {
    if (!f.endsWith(end)) continue;
    const cand = f.slice(0, f.length - end.length) + rep;
    if (ok(cand, kind) && !found.has(cand)) found.set(cand, lab);
  }
  const m = f.match(/^(.*[aouáóú])i([^aeiouáéíóú]+)$/);   // slender genitive or plural: báid → bád
  if (m && ok(m[1] + m[2], 'n') && !found.has(m[1] + m[2])) found.set(m[1] + m[2], 'slender genitive or plural');
  return found;
}
function guessLemma(w, bs) {         // [headword, reason] when exactly one headword fits
  for (const [f, rules] of [[w, []], ...bs]) {
    if (FUNC.has(f) || DICT.forms.has(f)) continue;
    const found = guessFor(f);
    if (found.size === 1) {
      const [h, lab] = [...found][0];
      return [h, [...rules, lab + ' (ending rule)'].join(' + ')];
    }
    if (found.size > 1) return null;
  }
  return null;
}

function analyse() {
  parent = W.map((_, i) => i); head = W.map((x) => x.w); why = W.map(() => null); extra = new Map();
  const ambiguous = [];
  const canHead = (h) => idx.has(h) || OPT.dictonly;
  // Headwords added from the dictionary are analysed too, so chains resolve: chumadh → cumadh → cum
  for (let i = 0; i < parent.length; i++) {
    const w = head[i];
    if (removed.has(w)) continue;
    const own = DICT.forms.has(w) || FUNC.has(w);
    const bs = bases(w);
    const inList = bs.find(([b]) => idx.has(b) && !removed.has(b));
    // 1. irregular verbs come first, so rinne is déan, not a genitive of rinn
    let irr = null, irrRules = [];
    if (IRREG_SUPP[w]) irr = [IRREG_SUPP[w], 'fin'];
    else if (!nonVerbLemma(w)) {
      irr = irregOf(w);
      if (!irr && !DICT.forms.has(w)) {
        for (const [b, r] of bs) { if (nonVerbLemma(b)) break; const x = irregOf(b); if (x) { irr = x; irrRules = r; break; } }
      }
    }
    if (irr) {
      const [lem, t] = irr;
      const vnOk = (t !== 'vn' && t !== 'va') || (OPT.vn && (OPT.vnall || idx.has(lem)));
      if (OPT.irr && vnOk && lem !== w && canHead(lem)) {
        attach(i, nodeFor(lem), [...irrRules, t === 'lemma' ? 'irregular verb ' + lem : `${TYPEN[t]} of irregular verb ${lem}`].join(' + '));
      } else if (inList) attach(i, idx.get(inList[0]), inList[1].join(' + '));   // still the same word mutated: bhí → bí
      continue;
    }
    // 2. emphatic forms
    let e = emphatic(w);
    if (!e) for (const [b, r] of bs) { const x = emphatic(b); if (x) { e = [x[0], [...r, x[1]].join(' + ')]; break; } }
    if (e && canHead(e[0])) { attach(i, nodeFor(e[0]), e[1]); continue; }
    // 3. contractions of prepositions, and genitives of calendar words
    if (OPT.prep && CONTRACTIONS[w] && CONTRACTIONS[w] !== w && canHead(CONTRACTIONS[w])) { attach(i, nodeFor(CONTRACTIONS[w]), 'preposition + article or possessive'); continue; }
    const cal = CAL_GEN[w] || (bs.find(([b]) => CAL_GEN[b]) || [])[0] && CAL_GEN[bs.find(([b]) => CAL_GEN[b])[0]];
    if (OPT.noun && cal && canHead(cal)) { attach(i, nodeFor(cal), 'genitive of ' + cal); continue; }
    // 4. function words: only plain mutations into another function word in the text (hé → é)
    if (FUNC.has(w)) {
      const fb = bs.find(([x]) => FUNC.has(x) && idx.has(x) && !removed.has(x));
      if (fb) attach(i, idx.get(fb[0]), fb[1].join(' + '));
      continue;
    }
    // 5. mutations and prefixes, checked against the list itself
    if (inList && !own) { attach(i, idx.get(inList[0]), inList[1].join(' + ')); continue; }
    if (inList && own) ambiguous.push([w, inList[0], inList[1].join(' + ') + ` (but ${w} is also a dictionary word)`]);
    // 6. dictionary: the word itself, else its nearest base the dictionary knows
    let form = w, rules = [];
    let L = lemmasOf(w);
    if (!L.size) {
      for (const [b, r] of bs) { const l = lemmasOf(b); if (l.size) { form = b; rules = r; L = l; break; } }
    }
    if (L.size) {
      if (FUNC.has(form)) continue;
      const pre = rules.length ? rules.join(' + ') + ' + ' : '';
      if (form !== w && L.has(form) && L.get(form).on.has('lemma')) {   // mutated or prefixed headword
        if (canHead(form)) attach(i, nodeFor(form), pre + 'dictionary form');
        continue;
      }
      const selfLemma = L.has(form) && L.get(form).on.has('lemma');
      let targets = preferVerb(form, preferNoun([...L.entries()].filter(([h, v]) => h !== form && v.on.size)));
      const listed = targets.filter(([h]) => idx.has(h));
      if (listed.length === 1) targets = listed;          // the list itself settles which word is meant
      if (targets.length === 1) {
        const [h, v] = targets[0];
        // A word that is also a headword of its own only merges as a verbal noun or adjective of an unambiguous verb
        const verbDeriv = v.on.has('vn') || v.on.has('va');
        // …or as a noun case form when its own entry is only a (rare) adjective: leabhair is a plural of leabhar
        const nounForm = v.pos.has('n') && ['gen', 'pl', 'plgen'].some((t) => v.on.has(t)) && selfOnlyAdj(form);
        if (!selfLemma || nounForm || (verbDeriv && !LEXICAL.has(form) && (idx.has(h) || OPT.vnall) && (selfNounOnly(form) || unambiguous(h, form)))
          || (OPT.prep && v.on.has('pron') && v.pos.has('p') && !L.get(form).pos.has('n'))) {
          if (canHead(h)) attach(i, nodeFor(h), pre + label(v.on) + ' of ' + h);
        } else if (idx.has(h)) ambiguous.push([w, h, `${label(v.on)} of ${h}, but ${w} is also a ${lemmaDesc(w)} in the dictionary`]);
      } else {
        for (const [h, v] of targets) if (idx.has(h)) ambiguous.push([w, h, `${label(v.on)} of ${h} (one of ${targets.length} dictionary words)`]);
      }
      continue;
    }
    // 7. endings removed by rule, checked against dictionary headwords (phostanna → post, díreofar → dírigh)
    const g = guessLemma(w, bs);
    if (g) { if (canHead(g[0])) attach(i, nodeFor(g[0]), g[1]); continue; }
    // 8. a mutation that is certain from the spelling alone (ghnáthlá → gnáthlá)
    const c = certain(w);
    if (c && canHead(c[0])) attach(i, nodeFor(c[0]), c[1] + ' (base not in the dictionary)');
  }
  buildSuggestions(ambiguous);
}

// =====================================================================  similarity
function jaroWinkler(s, t) {
  if (s === t) return 1;
  const n = s.length, m = t.length; if (!n || !m) return 0;
  const range = Math.max(0, Math.floor(Math.max(n, m) / 2) - 1);
  const sm = new Array(n).fill(false), tm = new Array(m).fill(false);
  let matches = 0;
  for (let i = 0; i < n; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(m, i + range + 1); j++) {
      if (!tm[j] && s[i] === t[j]) { sm[i] = tm[j] = true; matches++; break; }
    }
  }
  if (!matches) return 0;
  let k = 0, tr = 0;
  for (let i = 0; i < n; i++) if (sm[i]) { while (!tm[k]) k++; if (s[i] !== t[k]) tr++; k++; }
  const jaro = (matches / n + matches / m + (matches - tr / 2) / matches) / 3;
  let p = 0; while (p < Math.min(4, n, m) && s[p] === t[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}
// Irish endings: [ending on the longer word, ending on the shorter, label]
const ENDINGS = [
  ['anna', '', 'plural -anna'], ['eanna', '', 'plural -eanna'], ['acha', 'ach', 'plural -acha'], ['eacha', 'each', 'plural -eacha'],
  ['í', '', 'plural or genitive -í'], ['aí', '', 'plural -aí'], ['aí', 'a', 'plural -aí'], ['ta', '', 'plural -ta'], ['tha', '', 'plural -tha'],
  ['te', '', 'plural -te'], ['the', '', 'plural -the'], ['a', '', 'plural or genitive -a'], ['e', '', 'genitive or comparative -e'],
  ['aigh', 'ach', 'genitive -aigh'], ['igh', 'each', 'genitive -igh'], ['ach', 'aigh', 'verb / adjective -ach'], ['ach', '', 'adjective -ach'], ['each', '', 'adjective -each'],
  ['ann', '', 'ending -ann (verb or genitive)'], ['eann', '', 'ending -eann (verb or genitive)'], ['aim', '', 'verb -aim'], ['im', '', 'verb -im'],
  ['faidh', '', 'future -faidh'], ['fidh', '', 'future -fidh'], ['adh', '', 'verbal noun -adh'], ['eadh', '', 'verbal noun -eadh'],
  ['ú', 'aigh', 'verbal noun -ú'], ['iú', 'igh', 'verbal noun -iú'], ['ta', 'aigh', 'verbal adjective'], ['te', 'igh', 'verbal adjective'],
  ['acht', '', 'abstract noun -acht'], ['eacht', '', 'abstract noun -eacht'], ['úil', '', 'adjective -úil'], ['iúil', '', 'adjective -iúil'],
  ['mhar', '', 'adjective -mhar'], ['óir', '', 'agent -óir'], ['eoir', '', 'agent -eoir'], ['ín', '', 'diminutive -ín'],
];
let ENDINGS_F = null;                 // ENDINGS with fadas folded, made once
function endingLink(a, b) {          // a, b normalised; returns label or null
  const [l, s] = a.length >= b.length ? [a, b] : [b, a];
  if (!ENDINGS_F) ENDINGS_F = ENDINGS.map(([x, y, lab]) => [fold(x), fold(y), lab]);
  for (const [le, se, lab] of ENDINGS_F) {
    if (l.endsWith(le) && s.endsWith(se)) {
      const ls = l.slice(0, l.length - le.length), ss = s.slice(0, s.length - se.length);
      if (ls.length >= 3 && (ls === ss || slender(ss) === ls || slender(ls) === ss)) return lab;
    }
  }
  if (l.length === s.length + 1 && slender(s) === l) return 'slender form (bád → báid)';
  return null;
}
function slender(s) {                 // bád -> báid, fear -> fir is irregular; simple i before final consonants
  const m = s.match(/^(.*[aeiouáéíóú])([^aeiouáéíóú]+)$/);
  return m ? m[1] + 'i' + m[2] : s;
}
function key(w) {                     // mutations stripped, fadas folded
  let k = w;
  const bs = bases(w);
  const best = bs.find(([b]) => idx.has(b)) || bs[bs.length - 1];
  if (best && !DICT.forms.has(w)) k = best[0];
  return fold(k.replace(/-/g, ''));
}
const lemmaOnly = (w) => (DICT.forms.get(w) || []).some(([, t]) => t === 'lemma');
function buildSuggestions(ambiguous) {
  SUGG_CUT = false;
  const groups = new Map();
  W.forEach((_, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, i); });
  const reps = [...groups.keys()].map((r) => ({ r, w: headOf(r), k: key(headOf(r)) }));
  const out = new Map();
  const push = (a, b, score, reason) => {
    if (a === b) return;
    const [x, y] = a < b ? [a, b] : [b, a];
    const id = x + '|' + y;
    const s = out.get(id);
    if (s) { s.score = Math.max(s.score, score); if (!s.reasons.includes(reason)) s.reasons.push(reason); }
    else if (out.size < MAX_PAIRS * 5) out.set(id, { id, a: x, b: y, score, reasons: [reason] });
    else SUGG_CUT = true;
  };
  for (const [w, h, r, sc] of ambiguous) push(w, h, sc || 0.99, r);
  const byStart = new Map();
  for (const x of reps) { const s = x.k.slice(0, 2); if (!byStart.has(s)) byStart.set(s, []); byStart.get(s).push(x); }
  // Within a block, words are sorted by length and only compared with words at most 5 letters longer:
  // no Irish ending link adds more than that, and longer gaps are not spelling variants. This keeps large files fast.
  // A budget caps the work: real texts need far fewer comparisons (30,000 different words take about 1.6 million),
  // but a file built to be pathological (thousands of near-identical long words) would otherwise freeze the page.
  let budget = MAX_COMPARISONS;
  outer: for (const list of byStart.values()) {
    list.sort((x, y) => x.k.length - y.k.length);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length && list[j].k.length - list[i].k.length <= 5; j++) {
      if (SUGG_CUT || --budget < 0) { SUGG_CUT = true; break outer; }
      const A = list[i], B = list[j];
      if (A.r === B.r) continue;
      if (A.k === B.k) {
        if (Math.min(A.k.length, B.k.length) < 3) continue;
        const fadaOnly = fold(A.w) === fold(B.w);
        const two = lemmaOnly(A.w) && lemmaOnly(B.w);
        push(A.w, B.w, two ? 0.85 : 1, fadaOnly ? (two ? 'fada difference, but both are dictionary words' : 'differs only by fadas') : 'same word apart from mutation');
        continue;
      }
      const lab = endingLink(A.k, B.k);
      if (lab) { push(A.w, B.w, Math.max(jaroWinkler(A.k, B.k), 0.93), lab); continue; }
      if (A.k.length < 5) continue;   // the shorter of the two
      // Upper bound of Jaro-Winkler from the lengths alone: skip pairs that cannot reach the threshold
      const jm = (A.k.length / B.k.length + 2) / 3;
      if (jm + 0.4 * (1 - jm) < OPT.th) continue;
      const jw = jaroWinkler(A.k, B.k);
      if (jw >= OPT.th) push(A.w, B.w, jw, 'similar spelling');
    }
  }
  SUGG = [...out.values()].map((s) => {
    const da = DICT.forms.get(s.a), db = DICT.forms.get(s.b);
    const bothLemmas = da && db && da.some(([, t]) => t === 'lemma') && db.some(([, t]) => t === 'lemma');
    s.both = !!bothLemmas;
    s.rank = s.score - (bothLemmas && s.score < 0.99 ? 0.04 : 0);
    return s;
  }).sort((x, y) => y.rank - x.rank || x.a.localeCompare(y.a, 'ga'));
  // keep the strongest pairs when there are more than anyone would check by hand
  if (SUGG.length > MAX_PAIRS) { SUGG.length = MAX_PAIRS; SUGG_CUT = true; }
}

// =====================================================================  state from decisions
let DEC = Object.create(null);     // suggestion id -> {d: 'merge'|'keep', head}
let hist = [];
let pos = 0;
function nodeOfWord(w) { return idx.has(w) ? idx.get(w) : extra.get(w); }
const EXCL = new Set();        // words the user chose to keep neither of
let DROPPED = new Set();       // cleaned-list words the user removed by hand
function applyDecisions() {
  preferred.clear(); EXCL.clear();
  for (const s of SUGG) {
    const d = DEC[s.id];
    if (d && d.d === 'none') { EXCL.add(s.a); EXCL.add(s.b); continue; }
    if (!d || d.d !== 'merge' || removed.has(s.a) || removed.has(s.b)) continue;
    const a = nodeOfWord(s.a) ?? nodeFor(s.a), b = nodeOfWord(s.b) ?? nodeFor(s.b);
    const [from, to] = d.head === s.a ? [b, a] : [a, b];
    const rf = find(from), rt = find(to);
    if (rf !== rt) { parent[rf] = rt; why[from] = why[from] || 'your choice'; }
    preferred.add(d.head);
  }
}
const preferred = new Set();   // spellings the user chose to keep
function headOf(root) { return head[root]; }
const disp = (w) => (idx.has(w) && W[idx.get(w)].name ? W[idx.get(w)].disp : w);   // names keep their capital
function groupsNow(withExcluded) {
  const g = new Map();
  for (let i = 0; i < parent.length; i++) {
    const r = find(i); if (!g.has(r)) g.set(r, []);
    g.get(r).push(i);
  }
  return [...g.entries()].map(([r, ms]) => {
    const pick = ms.find((i) => preferred.has(head[i]));
    const h = pick != null ? head[pick] : head[r];
    const members = ms.filter((i) => head[i] !== h && i < W.length);
    const inList = idx.has(h);
    const ctx = ms.map((i) => W[i] && W[i].ctx).find(Boolean) || '';
    const count = ms.reduce((a, i) => a + (W[i] ? W[i].count : 0), 0);
    const gone = ms.some((i) => EXCL.has(head[i])) || DROPPED.has(h);
    const short = !!OPT.shorthead && letters(h) <= 2;
    return { r, h, members, inList, ctx, count, gone: gone || short, short, size: ms.filter((i) => i < W.length).length };
  }).filter((g) => g.size > 0 && (withExcluded || !g.gone));
}

