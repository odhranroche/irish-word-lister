"""Build the compact BuNaMo word-form index embedded in Glantóir Focal.

Usage: python3 scripts/build_index.py <BuNaMo checkout> data/bunamo_index.txt
Output: one line per dictionary entry:  lemma \t pos \t gender \t type:form,form;type:form ...
  pos     n noun · a adjective · v verb · p preposition · N proper noun
  types   n: gen pl plgen voc · a: gen pl cmp abs · v: fin vn va · p: pron
Forms equal to the lemma are left out. Proper nouns get pos N and are used only to recognise names.
BuNaMo © Foras na Gaeilge, Open Database Licence (ODbL).
"""
import glob, os, sys
import xml.etree.ElementTree as ET
from collections import OrderedDict
src, out = sys.argv[1:3]
NOUN = {'sgGen': 'gen', 'sgGenNoArt': 'gen', 'plNom': 'pl', 'plGen': 'plgen', 'sgVoc': 'voc', 'plVoc': 'voc', 'sgDat': 'gen'}
ADJ = {'sgGenMasc': 'gen', 'sgGenFem': 'gen', 'sgVocMasc': 'gen', 'sgVocFem': 'gen', 'plNom': 'pl', 'graded': 'cmp', 'abstractNoun': 'abs'}
lines = []
def add(lemma, pos, gender, forms):
    forms = OrderedDict((t, sorted(set(f for f in fs if f and f.lower() != lemma.lower()))) for t, fs in forms.items())
    body = ';'.join(f"{t}:{','.join(fs)}" for t, fs in forms.items() if fs)
    lines.append(f"{lemma}\t{pos}\t{gender}\t{body}")
for kind, pos in (('noun', 'n'), ('adjective', 'a'), ('verb', 'v'), ('preposition', 'p')):
    for f in sorted(glob.glob(os.path.join(src, kind, '*.xml'))):
        try:
            r = ET.parse(f).getroot()
        except ET.ParseError:
            continue
        proper = r.get('isProper') == '1'
        lemma = r.get('default')
        if not lemma:
            continue
        forms, gender = {}, ''
        for e in r:
            d = e.get('default')
            if kind == 'noun':
                if e.tag == 'sgNom' and not gender:
                    gender = {'masc': 'm', 'fem': 'f'}.get(e.get('gender'), '')
                t = NOUN.get(e.tag)
            elif kind == 'adjective':
                t = ADJ.get(e.tag)
            elif kind == 'verb':
                t = {'verbalNoun': 'vn', 'verbalAdjective': 'va'}.get(e.tag, 'fin' if e.tag in ('tenseForm', 'moodForm') else None)
            else:
                t = 'pron'
            if t and d:
                forms.setdefault(t, []).append(d)
        add(lemma, 'N' if proper else pos, gender, forms)
open(out, 'w', encoding='utf-8').write('\n'.join(lines))
print(len(lines), 'entries')
