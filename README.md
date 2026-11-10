# Glantóir Focal — Irish word-list deduplicator

A single-page, offline tool that removes duplicate forms from an Irish word list: mutations, plurals, genitives, verb forms and verbal nouns are merged into one headword, using rules from An Caighdeán Oifigiúil (2017) and the BuNaMo dictionary.

## Build and test

```sh
python3 build.py                 # -> dist/glantoir.html (offline app, about 1.05 MB) and dist/artifact.html
python3 tests/test_app.py        # browser tests; needs: pip install playwright && playwright install chromium
```

The build is reproducible: the same sources always give byte-identical files.

- `dist/glantoir.html` is a complete HTML document: open it in any browser, no internet needed, or upload it to a web server as `index.html`. It starts with a UTF-8 byte-order mark so fadas display correctly whatever charset the server sends.
- `src/index.html` is the unbuilt source: it has no dictionary or scripts in it yet, so never upload it to a website.
- `dist/artifact.html` is the same page without the `<html>`/`<head>` wrapper, for publishing as a claude.ai artifact, which adds its own.

## Design

The page follows the Odhrán Roche style guide (odhranroche.com): paper and ink colours, green only for things you can act on, Lexend for headings and controls, Atkinson Hyperlegible for text, hairlines instead of cards, one filled button per screen, sentence case, and a blue focus outline. The two words compared in step 2 are the page's one bold element. Light theme only, written as tokens at the top of `src/index.html`.

## Files

| Path | What it is |
| --- | --- |
| `src/index.html` | Styles and markup, with `/*APP*/` (the scripts) and `/*DICT*/` (the dictionary) placeholders. Fonts are referenced as `../assets/fonts/…` and inlined by the build. |
| `src/engine.js` | Rules engine: dictionary loading (with a gzip fallback), mutations and prefixes, dictionary merges, ending rules, pair suggestions. |
| `src/ui.js` | Interface: reading files and text, names and English, the three steps, saved choices, downloads. |
| `build.py` | Joins the sources and embeds the data and fonts, producing `dist/glantoir.html` and `dist/artifact.html`. |
| `assets/fonts/` | Lexend (400, 500, 600) and Atkinson Hyperlegible (400, 700), Latin subsets, with their licences. |
| `data/bunamo_index.txt` | Compact BuNaMo index: one line per entry, `lemma \t pos \t gender \t type:form,…`. pos is n, a, v, p, or N for a proper noun. |
| `data/english_top.txt` | The 5,000 most frequent English words, one per line. |
| `scripts/build_index.py` | Rebuilds `data/bunamo_index.txt` from a BuNaMo checkout (https://github.com/michmech/BuNaMo). |
| `scripts/make_english.py` | Rebuilds `data/english_top.txt` from wordfreq's `small_en.msgpack.gz`. |
| `tests/test_app.py` | Rule, English, name, saved-choice, CSV, offline and fallback tests, plus snapshot counts for the two fixture texts. |
| `tests/fixtures/` | Sample texts: Cúrsaí Oibre and An Teaghlach. |

## Security

The app is one static page. It has no server code, no accounts, and it never sends or loads anything over the network: text, choices and results stay in the visitor's browser (local storage, keys prefixed `glantoir:`). What a visitor pastes can only affect their own tab.

- **Text is never treated as code.** Every word is added to the page as plain text (no `innerHTML`), so markup or script in a file is just more words.
- **Content Security Policy** in `dist/glantoir.html`: only the page's own script and style block may run, pinned by SHA-256 hash; fonts and icons come from `data:` URIs; no network requests, forms or `<base>`. `build.py` recomputes the hashes on every build.
- **Input limits:** files over 20 MB and binary files are refused; tokens over 40 letters are ignored so a huge "word" can't freeze the page; text is NFC-normalised and invisible format characters are removed.
- **Lookup tables** keyed by words have no prototype, so words like *constructor* are ordinary words.
- **CSV export** prefixes cells starting with = + - @ or a tab with ', so spreadsheets don't run them as formulas.
- **Encoding:** the offline file starts with a UTF-8 byte-order mark, so a wrong server charset can't garble it.

Headers worth adding on the web server (Hostinger `.htaccess` in the app's folder), because a meta tag can't set them:

```apache
<IfModule mod_headers.c>
  Header always set Content-Security-Policy "frame-ancestors 'none'"
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "no-referrer"
</IfModule>
AddDefaultCharset UTF-8
```

`tests/test_app.py` includes checks for markup in the text, prototype keys, combining accents, very long tokens and Content Security Policy violations.

## Data sources

- BuNaMo © Foras na Gaeilge, Open Database Licence (ODbL). `data/bunamo_index.txt` is derived from it and stays under the ODbL.
- wordfreq data by Robyn Speer, CC BY-SA 4.0. `data/english_top.txt` is derived from it.
- Lexend © The Lexend Project Authors and Atkinson Hyperlegible © Braille Institute of America, both under the SIL Open Font License 1.1 (`assets/fonts/OFL-*.txt`).

## Order of the rules

Each word goes through these steps in order, and the first one that applies wins. Headwords the dictionary adds are analysed too, so chains resolve (*chumadh* → *cumadh* → *cum*).

1. **Irregular verbs** (bí, abair, beir, clois, cluin, déan, faigh, feic, ith, tabhair, tar, téigh), before any dictionary lookup.
   - So *rinne* is *déan*, not a genitive of *rinn*.
   - A supplementary map covers forms BuNaMo misfiles or lacks: tá, atá, níl, bhfuil, raibh → bí; deir → abair; chonaic, bhfaca → feic; chuala → clois; fuair → faigh; chuaigh, deachaigh → téigh; tháinig → tar; thug → tabhair; rug → beir.
2. **Emphatic pronouns and suffixes.**
   - Pronouns: mise, tusa, seisean, sise, sinne, sibhse, siadsan, iadsan.
   - Suffixes -sa -se -san -sean -na -ne, only on prepositional-pronoun forms; -ne after -nn drops an n (*againne* → *againn*, *linne* → *linn*).
   - Also after a prefix: *s'againne* → *againn*.
3. **Contractions and calendar genitives.**
   - Contractions, with the prepositional-pronoun option on: den, don, faoin, ón, sa, san, sna, ina, lena… → the preposition.
   - Calendar genitives, with the plurals option on: luain → luan, sathairn → satharn, nollag → nollaig, samhna → samhain…
4. **Protected function words.** These merge only by mutation into another function word in the text (*hé* → *é*).
5. **Mutations and prefixes** (An Caighdeán Oifigiúil 2017, ch. 10 and 2.1.7), checked against the list itself.
   - séimhiú; urú; h-, t- and ts; d', b', m'; s' (*is*: *s'againne*); an-, ró-, fíor-, sár-.
   - A capital vowel marks the prefix (*tAthair*, *nÉireann*).
6. **Dictionary (BuNaMo).**
   - Noun case forms → singular; adjective forms → base; regular verb forms → root; prepositional pronouns → preposition.
   - When a spelling has several readings:
     - A noun reading beats a derived adjective in -ach, -each, -úil, -mhar (*aibhneacha* → *abhainn*), and beats a verbal adjective of a verb not in the list (*tíortha* → *tír*).
     - Of several verbs, second-conjugation endings prefer the -igh verb (*chabhróidh* → *cabhraigh*, *díreofar* → *dírigh*). *chuig* is preferred over *chun*.
     - If exactly one of the readings is in the list, the list decides.
   - A word that is a headword itself merges only:
     - as a noun case form, when its own entry is only an adjective (*leabhair* → *leabhar*);
     - as a prepositional pronoun, with that option on;
     - as a verbal noun or adjective, into a verb that is in the list, or any verb with "Verbal nouns, even without the verb" on.
       - Verbal nouns entered as nouns (*briseadh*, *múineadh*) always qualify.
       - Adjective entries (*cinnte*, *déanta*) qualify only if the verb's spelling is not a form of another noun (*cinn* is a plural of *ceann*).
       - Never for words with a common meaning of their own: roinnt, gairm, cinnte, saoire, éigin, bheith, tuiscint, creideamh…
7. **Ending rules** when the dictionary doesn't know the word. Endings are stripped only if the result is a dictionary headword.
   - Noun plurals: -anna, -acha, -í, -ta.
   - Genitives: -aigh, -igh.
   - Verb forms: -ann, -faidh, -fidh, -aim, -imid, -óidh, -ófar.
   - Verbal nouns: -ú, -adh.
   - For example, *phostanna* → *post*.
8. **Certain mutations and prefixes** even when the base is unknown:
   - bhf, mb, gc, nd, bp, dt, and gh, dh, ph, fh, which never begin an unmutated word (*ghnáthlá* → *gnáthlá*);
   - hyphenated an-, ró-, fíor-, sár-. If adding -a or -e to the base gives a dictionary headword, that standard spelling is used (*an-aiféal* → *aiféala*).

## Reading text

- Files: plain text up to 20 MB. UTF-8 and UTF-16 (with a byte-order mark) are read as they are; other files are read as Windows-1252 with a note to check the fadas. Binary files (Word, PDF) are refused with a note to paste the text instead.
- Web links and e-mail addresses are removed. Words are runs of letters; numbers and punctuation are dropped.
- Bracketed letters are read as the base word: *c(h)uid* → *cuid*, *Ceist(eanna)* → *Ceist*.
- A token after a hyphen with nothing before it (*-áil*, an example ending) is skipped.
- Words are shown in lower case unless they are names.
- **Left out, and listed in step 1 so each can be put back:**
  - **Names**:
    - BuNaMo proper nouns, places and common first names;
    - multi-word places (*Baile Átha Cliath*, *Béal Feirste*, *Dún na Gall*…);
    - unknown words only ever written with a capital that is used mid-sentence. A capital after a mutation prefix counts (*hÉireann*, *tSionainn*, *nGaillimh*).
  - **English** (a setting): words in the top 5,000 English list when no reading of them is Irish, or when they only appear in English sentences. A sentence is English when its English-only words are at least twice its Irish words. So *the* in an English sentence is left out, but *oíche the* keeps *te*. Words with an apostrophe anywhere other than after a first d, b, m or s (*it's*, *Tom's*) are English.
  - Names written in lower case (*seán*, *gaillimh*) are names when the name lists know them and no reading is an ordinary Irish word.
  - **Acronyms**: all capitals, unknown, five letters or fewer (*TEG*, *QR*).
- Settings can also leave out 1–2 letter words, or every word whose headword has 1–2 letters (*bíonn* → *bí*).

## Settings

On by default: plurals and genitives, adjective forms, regular verb forms, verbal nouns (when the verb is in the list), dictionary form as headword, leave out English words.

Off by default: verbal nouns even without the verb, irregular verb forms, prepositional pronouns, abstract nouns, leave out 1–2 letter words, leave out words with a 1–2 letter headword.

## Suggestions

In step 2 you click the word to keep (the other merges into it), or choose keep both or keep neither. Keep neither removes both words, and every form merged into them, from the cleaned list. When that is more than the two words, the button says how many (hover for the list), and the *Removed* list shows the extra forms; ↺ brings them all back.

Pairs are compared on keys with mutations stripped and fadas folded:

- **Same key:** fada-only or mutation-only differences.
- **Irish endings:** plural, genitive, verb, verbal noun and family endings, including slender forms (bád → báid). Scored at least 0.93.
- **Jaro-Winkler similarity** at or above the sensitivity setting (default 0.92), for words of 5 letters or more.
- **Dictionary ambiguity:** a form with several readings where one is in the list (*cinn* / *ceann*, *freagraí*).

## Results

Each word in the cleaned list has a ✕ to remove it (and the forms merged into it) as a final manual step. Removed words are listed under *Removed*, where ↺ restores them.

Decisions, removals and kept names are saved in the browser and belong to one document. When the words loaded overlap less than 80% with the previous document, they start clean; small edits to the same text keep them.

## Robustness

- Pairs are compared only within blocks sharing their first two letters and at most 5 letters apart in length, with a length bound that skips pairs that can't reach the similarity threshold. 10,000 unique words take about 0.5 s and 30,000 about 2 s.
- Browsers without `DecompressionStream` unpack the dictionary with a built-in inflater.
- CSV cells that start with = + - @ or a tab get a leading ' so spreadsheets read them as text.

## Checked against ChatGPT (Cúrsaí Oibre, 907 words)

With irregular verbs, prepositional pronouns, verbal nouns without the verb and short headwords on, the result is 907 → 500 words; ChatGPT's list has 494.

The remaining differences are mostly:

- **Headword choice:** we keep the verb (*ardaigh*) where ChatGPT kept the verbal noun (*ardú*).
- **Readings left to the user:** *cathrach*, *cinn*, *freagraí*, *léim*.
- **ChatGPT errors:** *breise*, *gramadaí*, *sílim*, *róshásta* left unmerged.

BuNaMo © Foras na Gaeilge, Open Database Licence (ODbL).
