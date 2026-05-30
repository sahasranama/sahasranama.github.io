#!/usr/bin/env python3
"""Devanagari -> IAST transliteration (deterministic) + fuzzy check against
our romanized names. Used to verify that fetched per-name Devanagari lines up
with our dataset before attaching it."""
import re, unicodedata, difflib

V_IND = {'अ':'a','आ':'ā','इ':'i','ई':'ī','उ':'u','ऊ':'ū','ऋ':'ṛ','ॠ':'ṝ','ऌ':'ḷ',
         'ए':'e','ऐ':'ai','ओ':'o','औ':'au','ऑ':'ŏ','ऎ':'ĕ','ऒ':'ŏ'}
V_DEP = {'ा':'ā','ि':'i','ी':'ī','ु':'u','ू':'ū','ृ':'ṛ','ॄ':'ṝ','ॢ':'ḷ',
         'े':'e','ै':'ai','ो':'o','ौ':'au','ॉ':'ŏ','ॆ':'ĕ','ॊ':'ŏ'}
CONS = {'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ṅ','च':'c','छ':'ch','ज':'j','झ':'jh','ञ':'ñ',
        'ट':'ṭ','ठ':'ṭh','ड':'ḍ','ढ':'ḍh','ण':'ṇ','त':'t','थ':'th','द':'d','ध':'dh','न':'n',
        'प':'p','फ':'ph','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v',
        'श':'ś','ष':'ṣ','स':'s','ह':'h','ळ':'ḷ','क्ष':'kṣ','ज्ञ':'jñ','ऱ':'r'}
SIGNS = {'ं':'ṃ','ः':'ḥ','ँ':'m̐','ऽ':"'"}
VIRAMA='्'

def to_iast(text):
    out=[]; i=0; n=len(text)
    while i<n:
        ch=text[i]
        if ch in CONS:
            out.append(CONS[ch]); i+=1
            # inherent 'a' unless followed by matra or virama
            if i<n and text[i] in V_DEP: out.append(V_DEP[text[i]]); i+=1
            elif i<n and text[i]==VIRAMA: i+=1  # no vowel
            else: out.append('a')
        elif ch in V_IND: out.append(V_IND[ch]); i+=1
        elif ch in SIGNS: out.append(SIGNS[ch]); i+=1
        elif ch==' ': out.append(' '); i+=1
        else: out.append(ch); i+=1
    return ''.join(out)

def norm(s):
    """collapse to a comparison key: strip diacritics, fold common variants."""
    s=unicodedata.normalize('NFD', s)
    s=''.join(c for c in s if unicodedata.category(c)!='Mn')  # drop combining marks
    s=s.lower()
    s=(s.replace('ś','s').replace('ṣ','s').replace('ṛ','ri').replace('ñ','n')
        .replace('ṅ','n').replace('ṇ','n').replace('ṭ','t').replace('ḍ','d')
        .replace('ṃ','m').replace('ḥ','').replace('w','v').replace('z','j')
        .replace('kh','k').replace('gh','g').replace('ch','c').replace('jh','j')
        .replace('th','t').replace('dh','d').replace('ph','p').replace('bh','b')
        .replace('sh','s').replace("'",''))
    return re.sub(r'[^a-z]','',s)

def score(dev, roman):
    a=norm(to_iast(dev)); b=norm(roman)
    return difflib.SequenceMatcher(None,a,b).ratio(), to_iast(dev)

if __name__=='__main__':
    import json,sys
    nodes=json.load(open('data/atlas.json'))['nodes']
    name_by_n={x['n']:x['name'] for x in nodes}
    low=[]; tot=0; ssum=0
    for line in open(sys.argv[1]):
        line=line.rstrip('\n')
        if not line or '\t' not in line: continue
        num,dev=line.split('\t',1); num=int(num)
        r,iast=score(dev, name_by_n[num])
        tot+=1; ssum+=r
        if r<0.6: low.append((num,name_by_n[num],dev,iast,round(r,2)))
    print(f"checked {tot} | avg match {ssum/tot:.3f} | flagged(<0.6): {len(low)}")
    for x in low: print("  FLAG", x)
