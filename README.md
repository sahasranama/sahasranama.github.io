# Sahasranama Atlas

**An interactive graph atlas of the 1000 names of Vishnu** — from the Vishnu Sahasranama
(Mahābhārata, Anuśāsana Parva). The litany is not a flat list: names recur with new meanings,
cluster around shared roots, and map the whole inner life. This turns it into something you can
*explore*.

🔗 **Live:** _(GitHub Pages link added on deploy)_

## What it does

- **Graph explorer** — all 1000 names as nodes, clustered around concept **hubs**: ~35 themes of
  life, 20 Sanskrit roots, and the avatars woven through the verses.
- **One reality, many faces** — the **70 recurring names** are linked: e.g. *Vishnu* appears at
  2 / 258 / 657, each time with a different meaning. Click one to see them all.
- **Filter & search** — isolate a theme (*fear, desire, sovereignty, grace…*) or an avatar, or
  search any name or meaning.
- **Toggle connections** — themes, recurring names, shared roots, avatars, or the litany sequence.

## Run locally

It's a zero-build static site. Any static server works:

```bash
python3 -m http.server 8731
# open http://localhost:8731/
```

## Data

`data/names.json` is generated from the raw 1000-name list by `tools/build_data.py`
(auto-derives normalized keys, root/theme/avatar/iconography tags). Rebuild with:

```bash
python3 tools/build_data.py
```

**Tags are auto-derived heuristics in this prototype** and will be hand-curated. Transliteration
(IAST/Devanagari), sloka numbers, and source cross-checking are planned next.

## Source & attribution

The English names and meanings follow an English translation by **P. R. Ramachander**, which
itself leans on the Sri Ramakrishna Mutt (Anna) Tamil rendering. The text is reproduced here for
**educational and devotional** use; meanings will be cross-checked against a reliable edition.
Romanization quirks come from the source. The **code** in this repo is MIT-licensed (see LICENSE);
the **translated text** belongs to its respective authors.

## Roadmap

- **Phase 1** — curate tags; add IAST + Devanagari; sloka numbers; source citations.
- **Phase 2** — interpretive lenses: *recurring-names*, *themes-of-life atlas*, *avatar trail*,
  *litany scroll*, *daily contemplation*.
- **Phase 3** — shareable deep-links, the Bhīṣma/Yudhiṣṭhira framing, meaning search, audio
  chanting with name-sync, offline/PWA, guided tours.

> “It is also very important to meditate on the meaning of each word while it is sung.”
