"""Build Glantóir Focal into one self-contained HTML file.

    python3 build.py              ->  dist/index.html   the app: the only file to publish (upload it as it is)
    python3 build.py --artifact   ->  also artifact/glantoir.html, the same page without the document
                                      wrapper, for publishing as a claude.ai artifact (which adds its own)

src/page.html    the page template: styles and markup, with /*APP*/ and /*DICT*/ placeholders (never publish it)
src/engine.js   rules engine: dictionary loading, mutations, merges, pair suggestions
src/ui.js       interface: text extraction, names and English, steps 1-3, downloads
data/bunamo_index.txt   compact BuNaMo index (made by scripts/build_index.py)
data/english_top.txt    5,000 most frequent English words (made by scripts/make_english.py)
assets/fonts/           Lexend and Atkinson Hyperlegible (SIL Open Font License), inlined as data URIs

The dictionary is gzipped with a fixed timestamp, so the same sources always give the same file.
"""
import base64
import gzip
import hashlib
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


def read(*p):
    with open(os.path.join(ROOT, *p), encoding='utf-8') as f:
        return f.read()


def main():
    page = read('src', 'page.html')
    app = read('src', 'engine.js') + read('src', 'ui.js')
    for ph in ('/*APP*/', '/*DICT*/', "(/*ENGLISH*/'')"):
        target = app if ph.startswith('(') else page
        assert target.count(ph) == 1, f'placeholder {ph} must appear exactly once'
    with open(os.path.join(ROOT, 'data', 'bunamo_index.txt'), 'rb') as f:
        dict_b64 = base64.b64encode(gzip.compress(f.read(), 9, mtime=0)).decode('ascii')
    english = ' '.join(w for w in read('data', 'english_top.txt').split() if len(w) >= 2)
    assert "'" not in english and '\\' not in english, 'English list must not contain quotes or backslashes'
    app = app.replace("(/*ENGLISH*/'')", "('" + english + "')")
    page = re.sub(r'url\("\.\./assets/fonts/([\w.-]+\.woff2)"\)', font_uri, page)
    assert '../assets/' not in page, 'every asset must be inlined'
    body = page.replace('/*APP*/', app).replace('/*DICT*/', dict_b64)
    title = re.search(r'<title>(.*?)</title>', body).group(1)
    doc = ('<!doctype html>\n<html lang="en-IE">\n<head>\n<meta charset="utf-8">\n'
           f'<meta http-equiv="Content-Security-Policy" content="{csp(body)}">\n'
           '<meta name="referrer" content="no-referrer">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
           f'<title>{title}</title>\n'
           f'<meta name="description" content="{title} collects the unique words from an Irish-language document, merging grammatical forms into one dictionary headword. Works offline.">\n'
           '</head>\n<body>\n' + re.sub(r'<title>.*?</title>\n', '', body, count=1) + '</body>\n</html>\n')
    # dist/ holds exactly one file. It starts with a UTF-8 byte-order mark: browsers trust it over everything
    # else, so the fadas display correctly even when a web server sends a wrong charset (á shown as Ã¡).
    outputs = [('dist', 'index.html', doc, 'utf-8-sig')]
    if '--artifact' in sys.argv[1:]:
        outputs.append(('artifact', 'glantoir.html', body, 'utf-8'))
    for folder, name, html, enc in outputs:
        os.makedirs(os.path.join(ROOT, folder), exist_ok=True)
        for old in os.listdir(os.path.join(ROOT, folder)):     # clear out anything an older build left behind
            if old != name and old.endswith('.html'):
                os.remove(os.path.join(ROOT, folder, old))
        out = os.path.join(ROOT, folder, name)
        with open(out, 'w', encoding=enc) as f:
            f.write(html)
        print(f'built {os.path.relpath(out, ROOT)} ({len(html.encode()) / 1024:.0f} KB)')


def csp(body):
    """A strict Content Security Policy for the offline file: only this page's own script and style block
    may run (pinned by hash), fonts and icons come from data: URIs, and nothing can be loaded from or sent
    to the network. Downloads use blob: URLs. A web server can add frame-ancestors as a header."""
    def hashes(tag):
        blocks = re.findall(rf'<{tag}>(.*?)</{tag}>', body, flags=re.S)
        assert blocks, f'no <{tag}> block found'
        return ' '.join("'sha256-" + base64.b64encode(hashlib.sha256(b.encode()).digest()).decode() + "'" for b in blocks)
    return ("default-src 'none'; script-src " + hashes('script') + "; style-src " + hashes('style')
            + "; font-src data:; img-src data: blob:; base-uri 'none'; form-action 'none'")


def font_uri(m):
    with open(os.path.join(ROOT, 'assets', 'fonts', m.group(1)), 'rb') as f:
        return 'url("data:font/woff2;base64,' + base64.b64encode(f.read()).decode('ascii') + '")'


if __name__ == '__main__':
    main()
