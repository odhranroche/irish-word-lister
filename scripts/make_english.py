"""Make data/english_top.txt: the 10,000 most frequent English words, one per line.

Source: wordfreq's small English list (https://github.com/rspeer/wordfreq, data under CC BY-SA 4.0):
    curl -LO https://raw.githubusercontent.com/rspeer/wordfreq/master/wordfreq/data/small_en.msgpack.gz
    python3 scripts/make_english.py small_en.msgpack.gz data/english_top.txt

The file is a "cBpack": a header, then lists of words in descending frequency.
Only plain lower-case a-z words are kept.
Needs: pip install msgpack
"""
import gzip
import re
import sys

import msgpack

N = 10000


def main(src, out):
    with gzip.open(src, 'rb') as f:
        pack = msgpack.load(f, raw=False)
    words = []
    for bucket in pack[1:]:
        for w in bucket:
            if re.fullmatch(r'[a-z]+', w):
                words.append(w)
                if len(words) == N:
                    break
        if len(words) == N:
            break
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(words) + '\n')
    print(len(words), 'words')


if __name__ == '__main__':
    main(*sys.argv[1:3])
