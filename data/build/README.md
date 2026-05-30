# Data provenance (build)

How `data/atlas.json` was assembled, kept here for transparency since this is sacred text.

- **Names and meanings** - the project's own dataset of 1000 entries (English translation).
- **Devanāgarī (all 1000)** - `dev_all.tsv`, sourced from the Vishnu Sahasranamavali at
  drikpanchang.com (order-matched to our names). 108 names retained from prior curation;
  the final 50 reconciled against the vedicprayers namavali and canonical readings.
- **IAST** - generated deterministically from the Devanāgarī by `translit.py`.
- **Verification** - `translit.py` transliterates each Devanāgarī back to IAST and compares it
  to the romanized name (avg match ~0.95). Run: `python3 data/build/translit.py data/build/dev_all.tsv`
- **Śloka grouping (107 ślokas)** - name-to-śloka ranges from swami-krishnananda.org.
- **Themes, roots, avatars, recurrences** - computed from the meaning text.

Sacred text, machine-assembled. Verify against a trusted edition before liturgical use.
