#!/usr/bin/env python3
"""Enrich the raw 1000-name dataset into data/names.json + data/meta.json.

Input : data/_raw_1000.json  (list of {n, name, meaning})
Output: data/names.json      (enriched entries)
        data/meta.json        (theme/root/avatar/icon definitions + framing text)

All tags are AUTO-DERIVED (keyword + prefix heuristics). Phase 1 will hand-curate.
"""
import json, re, os
from collections import defaultdict

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
raw = json.load(open(os.path.join(HERE, "data", "_raw_1000.json")))

# ---------------------------------------------------------------- meanings
def split_meanings(m):
    # separate the "; or He who…" / " or He who…" alternates the translation uses
    parts = re.split(r"\s*;\s*|\s+or\s+(?=He\b|She\b|It\b)", m)
    parts = [p.strip().rstrip(".") for p in parts if p.strip()]
    return parts or [m]

# ---------------------------------------------------------------- themes
# keyword -> theme. A name may carry several themes.
THEMES = {
    "protection":   r"protect|saviour|shelter|rescue|removes fear|guards|takes care|saves",
    "fear":         r"\bfear|afraid",
    "anger":        r"anger|krodha|manyu",
    "desire":       r"\bdesire|wish|\bkama\b|kaam|longing|loved by|liked by|dear to",
    "sorrow":       r"\bsad\b|sorrow|misery|miserable|shoka|grief|unhappy",
    "pride-ego":    r"pride|proud|\bego\b|humble|amani|conceit",
    "patience":     r"patien|tolerat|pardon|kshama|forgive|\bbear\b",
    "bliss":        r"happ|bliss|pleasure|ananda|\bnanda|joy|delight|comfort",
    "illusion":     r"illusion|\bmaya|deceive|net of",
    "deathless":    r"death|deathless|immortal|never die|does not die|nectar|amrith|ambrosia",
    "time":         r"\btime\b|\byear|yuga|season|samvatsara|past, present|present and future",
    "deluge":       r"deluge|pralaya|end of every|destroys the world|destruction|\bchurn|at the end",
    "knowledge":    r"knowledge|\bknows\b|\bknow\b|wisdom|intelligen|learned|examines|interpret|\bsees\b|\bmind\b|\bbrain\b|thinks",
    "veda":         r"\bveda|shruti|scripture|sastra|upanishad",
    "truth":        r"\btruth|satya|\btrue\b|real meaning|essence",
    "creation":     r"creat|\bborn\b|source|\bseed\b|origin|first reason|evolved|nurtures|\bmakes\b|\bgiver\b|\bgives the|brought",
    "wealth":       r"wealth|riches|treasure|\bgold|prosper|lakshmi|\bfacilit",
    "lakshmi":      r"lakshmi|shree|\bsri\b|consort|goddess",
    "sacrifice":    r"yagna|yaga|sacrifice|offering|\bsoma\b|homa|oblation",
    "all-pervading":r"universe|everywhere|spread|all[- ]pervad|all the world|all worlds|every being|all beings|every thing|everything|cosmos|three worlds|carries the world|the world|in every",
    "light":        r"\blight|luster|lustre|shine|shines|\bray\b|rays|radian|glitter|bright|\bsun\b|luminous",
    "water-ocean":  r"ocean|\bsea\b|\bwater|milk|\bcloud",
    "dharma":       r"dharma|righteous|justice|\blaw\b|right action|\borders\b|obey",
    "form":         r"\bform\b|\bshape|formless|appearance|many forms|several forms|\bfat\b|stout|\bbig\b|\bthin\b|colour|\bred\b|\bblack\b|\bbody\b|limbs|\bface\b|\beyes\b|\bhead",
    "self-soul":    r"\bsoul\b|\batma|witness|inside every|in every being|the self|himself",
    "sound-om":     r"\b[Oo][Mm]\b|pranava|manthra|mantra|\bword\b|\bsound|sings|orator|voice",
    "yoga-tapas":   r"\byoga|meditat|penance|\btapas|renunciation|silence|self restraint",
    "beauty":       r"beautiful|handsome|attractive|\bbeauty|epitome of beauty|lovely|golden",
    "strength":     r"\bstrong|strength|valor|valour|\bhero|brave|mighty|\bpower|archer|weapon|conquer|\bwins\b|victor|defeat|\bwon\b|\barms\b",
    "stillness":    r"\bstable|permanent|unmovable|stillness|never changes|does not change|always same|ancient",
    "fierce":       r"asura|rakshas|enem|kills|destroys those|troubles|punish|strict|\bwar\b",
    "sovereignty":  r"\blord\b|master of|\bruler|rules|\bchief\b|\bking\b|greatest|greater than|\bbest\b|\belder\b|presides|controls|commands|\bleader|reigns|sovereign|appoints|\bgod of|above all|above him",
    "purity":       r"\bpure\b|purif|blemish|\bclean|\bholy\b|sinless|washes off|removes sin|no sin|not touched by sin",
    "transcendent": r"beyond|cannot be|can not be|not reachable|immeasurable|indefinable|inconceivable|nobody can|never get|infinite|limitless|endless|unborn|birthless|\bno birth|neither birth|not visible|hidden",
    "grace-mercy":  r"mercy|merciful|\bkind\b|good to others|does good|blesses|\bboon|favours|\bfavour|\bgrace|compassion|to his devotee|to devotees|fulfills",
}

# ---------------------------------------------------------------- roots
# canonical root label -> regex on the (lowercased) name
ROOTS = {
    "Maha- (great)":      r"^maha",
    "Sarva- (all)":       r"^s+arva",
    "Shri/Sri- (grace)":  r"^s?shri|^sri|^shree",
    "Vrisha- (dharma)":   r"^vrisha|^vrish|^vrash",
    "Vasu- (dwelling)":   r"^vasu",
    "Chatur- (four)":     r"^chatur|^chathur",
    "Viswa- (cosmos)":    r"^vis?hwa|^viswa",
    "Brahma- (absolute)": r"^brahma",
    "Loka- (world)":      r"^loka",
    "Deva- (divine)":     r"^deva|^deava",
    "Veera- (valor)":     r"^veera|^veer\b|^vira|^veer",
    "Satya/Sath- (truth)":r"^satya|^sath|^sat\b|^satha",
    "Tri- (three)":       r"^tri|^thri",
    "Dur- (hard)":        r"^dur",
    "Padma- (lotus)":     r"^padma|^padhma|^padm",
    "Yagna- (sacrifice)": r"^yagn|^yaj|^ijhya|^krathu|^maha\s?yagna",
    "Kama- (desire)":     r"^kama|^kaam",
    "Dharma- (law)":      r"^dharma",
    "Naika- (many)":      r"^naika|^nyka|^nykha",
    "Prana- (life)":      r"^prana|^pranaa|^pranad|^pranav",
}

# ---------------------------------------------------------------- avatars
AVATARS = {
    "matsya":     (r"\bfish\b|shringa|with horn", "Matsya — the fish"),
    "kurma":      (r"tortoise|churn", "Kurma — the tortoise"),
    "varaha":     (r"varaha|\bboar\b|lifted the earth|vrashakapi|kapindra", "Varaha — the boar"),
    "narasimha":  (r"narasimha|man[- ]?lion|\blion\b|protruding incisor|part human", "Narasimha — man-lion"),
    "vamana":     (r"vamana|three steps|measured the world|trivikrama|grew big", "Vamana / Trivikrama"),
    "parasurama": (r"\baxe\b|parasu|dana to kasyapa|gave earth as", "Parasurama — the axe"),
    "rama":       (r"\brama\b|saranga|\bmonkey|dasarha|rama who is dear|in the form of rama", "Rama — the bow"),
    "krishna":    (r"krishna|devaki|\byadu|son of vasudeva|dwaipayana", "Krishna"),
    "kapila":     (r"kapila", "Kapila — the sage"),
}

# ---------------------------------------------------------------- iconography
ICONS = {
    "conch":   r"conch|pancha janya|panchajanya",
    "discus":  r"\bwheel\b|chakra|sudarshana|sudharsana|radanga",
    "mace":    r"\bmace\b|gadha|gowmodaki|kaumodaki",
    "bow":     r"\bbow\b|saranga|sarnga|dhanwa|archer|dhanur",
    "sword":   r"\bsword\b|nandaka|nandaki",
    "lotus":   r"lotus|padma|pundarik|aravinda|kamala",
    "garland": r"garland|vanamali|wears nature",
}

def norm(s):
    return re.sub(r"[^a-z]", "", s.lower())

def tags_for(text, table):
    out = []
    for label, pat in table.items():
        if re.search(pat, text, re.I):
            out.append(label)
    return out

entries = []
for x in raw:
    name, meaning = x["name"], x["meaning"]
    blob = name + " " + meaning
    meanings = split_meanings(meaning)
    themes = tags_for(blob, THEMES)
    roots  = [lbl for lbl, pat in ROOTS.items() if re.search(pat, name.lower())]
    avs    = [k for k, (pat, _) in AVATARS.items() if re.search(pat, blob, re.I)]
    icons  = [k for k, pat in ICONS.items() if re.search(pat, blob, re.I)]
    entries.append({
        "n": x["n"], "name": name, "key": norm(name),
        "meanings": meanings,
        "themes": themes, "roots": roots,
        "avatars": avs, "icons": icons,
    })

# repeat groups (same key, >1 occurrence)
bykey = defaultdict(list)
for e in entries:
    bykey[e["key"]].append(e["n"])
for e in entries:
    occ = bykey[e["key"]]
    e["repeat"] = occ if len(occ) > 1 else []

# ---- validation
assert len(entries) == 1000, len(entries)
ns = [e["n"] for e in entries]
assert ns == list(range(1, 1001)), "not contiguous 1..1000"
assert all(e["meanings"] for e in entries), "an entry lost its meaning"
groups = sum(1 for k, v in bykey.items() if len(v) > 1)

# ---------------------------------------------------------------- meta
THEME_META = {
    "protection":("Protection","Names that shelter, rescue, and guard."),
    "fear":("Fear & fearlessness","Where the stotra meets dread — and dissolves it."),
    "anger":("Anger","Krodha, and the one who conquered it."),
    "desire":("Desire (kāma)","What is wished for, and the giver of wishes."),
    "sorrow":("Sorrow","Grief, misery, and its undoing."),
    "pride-ego":("Pride & ego","The humbler of pride."),
    "patience":("Patience","Forbearance, pardon, endurance."),
    "bliss":("Bliss","Ānanda — happiness as the ground of being."),
    "illusion":("Illusion (māyā)","The veil, and the one who casts it."),
    "deathless":("Death & deathlessness","Mortality and the nectar beyond it."),
    "time":("Time","The year, the ages, the turning."),
    "deluge":("Dissolution","Pralaya — the end, the churning, the unmaking."),
    "knowledge":("Knowledge","Wisdom, the knower, the witness."),
    "veda":("Veda & scripture","The texts and their interpreter."),
    "truth":("Truth (satya)","That which simply is."),
    "creation":("Creation","Origin, seed, source of beings."),
    "wealth":("Wealth","Riches, gold, treasure, prosperity."),
    "lakshmi":("Śrī / Lakṣmī","The grace and its dwelling place."),
    "sacrifice":("Sacrifice (yajña)","The fire-offering, in every form."),
    "all-pervading":("All-pervading","Spread everywhere, in every being."),
    "light":("Light","Radiance, luster, sun and ray."),
    "water-ocean":("Water & ocean","Sea, milk-ocean, cloud."),
    "dharma":("Dharma","Right action, law, justice."),
    "form":("Form & formlessness","Shape, appearance, the many and the one."),
    "self-soul":("Self & soul","Ātman — the witness within."),
    "sound-om":("Sound & OM","Praṇava, mantra, the word."),
    "yoga-tapas":("Yoga & tapas","Meditation, penance, restraint."),
    "beauty":("Beauty","The attractive, the lovely form."),
    "strength":("Strength & valor","Power, the hero, the weapon."),
    "stillness":("Stillness","The stable, permanent, unchanging."),
    "fierce":("The fierce","Slayer of asuras, punisher, protector by force."),
    "sovereignty":("Sovereignty","Lord, ruler, the greatest, the chief."),
    "purity":("Purity","The pure, the cleanser, the sinless."),
    "transcendent":("Beyond grasp","The immeasurable, the limitless, the unborn."),
    "grace-mercy":("Grace & mercy","Boon-giver, the kind, the fulfiller of wishes."),
}
# only keep themes that actually occur, with counts
theme_counts = defaultdict(int)
for e in entries:
    for t in e["themes"]:
        theme_counts[t] += 1
meta = {
    "title": "Sahasranama Atlas",
    "subtitle": "The thousand names of Vishnu, connected.",
    "source": "English translation (P. R. Ramachander), leaning on the Sri Ramakrishna Mutt (Anna) Tamil rendering. Romanization and meanings follow that source; to be cross-checked in Phase 1.",
    "counts": {"names": 1000, "distinctKeys": len(bykey), "repeatGroups": groups},
    "themes": {k: {"label": THEME_META[k][0], "desc": THEME_META[k][1], "count": theme_counts[k]}
               for k in THEME_META if theme_counts[k]},
    "roots": {lbl: sum(1 for e in entries if lbl in e["roots"]) for lbl in ROOTS},
    "avatars": {k: {"label": AVATARS[k][1], "count": sum(1 for e in entries if k in e["avatars"])}
                for k in AVATARS},
    "icons": {k: sum(1 for e in entries if k in e["icons"]) for k in ICONS},
}
meta["roots"] = {k: v for k, v in meta["roots"].items() if v}

json.dump(entries, open(os.path.join(HERE, "data", "names.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))
json.dump(meta, open(os.path.join(HERE, "data", "meta.json"), "w"),
          ensure_ascii=False, indent=2)

print(f"names.json: {len(entries)} entries | distinct keys {len(bykey)} | repeat groups {groups}")
print(f"themes used: {len(meta['themes'])} | roots: {len(meta['roots'])} | avatars: {sum(1 for a in meta['avatars'].values() if a['count'])}")
print("theme counts:", dict(sorted(theme_counts.items(), key=lambda kv: -kv[1])))
