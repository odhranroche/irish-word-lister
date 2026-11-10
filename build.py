"""Build Glantóir Focal into one self-contained HTML file.

    python3 build.py            ->  dist/glantoir.html

src/page.html   styles and markup, with /*APP*/ and /*DICT*/ placeholders
src/engine.js   rules engine: dictionary loading, mutations, merges, pair suggestions
src/ui.js       interface: text extraction, names and English, steps 1-3, downloads
data/bunamo_index.txt   compact BuNaMo index (made by scripts/build_index.py)
data/english_top.txt    5,000 most frequent English words (made by scripts/make_english.py)

The dictionary is gzipped with a fixed timestamp, so the same sources always give the same file.
"""
import base64
import gzip
import os

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
    html = page.replace('/*APP*/', app).replace('/*DICT*/', dict_b64)
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    out = os.path.join(ROOT, 'dist', 'glantoir.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'built {os.path.relpath(out, ROOT)} ({len(html.encode()) / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
