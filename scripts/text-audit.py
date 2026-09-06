# -*- coding: utf-8 -*-
"""Text audit: what the game says about itself against what it does.

Checks that an item card's printed numbers match its own stat block, that every
translation key a component asks for exists in both language tables, that Russian
strings have not picked up stray Latin, and that nothing still names a unit or mechanic
that has been renamed.

    python scripts/text-audit.py

Every section printing 0 is the pass condition. Two conventions are encoded rather than
flagged: cooldown stats are stored as a reduction magnitude, so "+18" in the data and
"-18%" on the card agree; and a few proper nouns (Lilium, Barrett) are Latin on purpose.
"""
import io
import os
import re
import glob

# Run from anywhere in the repo.
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
GD = io.open('src/data/gameData.ts', encoding='utf-8').read()
I18 = io.open('src/utils/i18n.ts', encoding='utf-8').read()
out = []


def rep(title, items):
    out.append('== %s: %d' % (title, len(items)))
    for i in items:
        out.append('   ' + i)
    out.append('')


# ---------------------------------------------------------------------------------------
# 1. Item descriptions that print a number the stat block does not contain.
# ---------------------------------------------------------------------------------------
STAT_WORDS = {
    'psiPower': ['Силы ПСИ', 'Сила ПСИ', 'пси-урона', 'Урона'],
    'critChance': ['Шанса крита', 'Шанс крита', 'шанса крита'],
    'critDamage': ['Множитель крита', 'Множ. крита'],
    'armor': ['Брони', 'Броня'],
    'maxHp': ['Макс. ОЗ', 'Макс ОЗ', 'к ОЗ', 'ОЗ'],
    'moveSpeed': ['Скорости'],
    'attackSpeed': ['Скорости атаки', 'Скор. атаки'],
    'dodge': ['Уклонения'],
    'vectorReach': ['Радиуса векторов', 'Радиуса'],
    'dnaHarvest': ['сбора ДНК', 'Сбор ДНК'],
    'pickupRange': ['радиуса притяжения', 'Радиус сбора'],
    'bloodLifesteal': ['вампиризма', 'Вампиризм'],
    'luck': ['Удачи'],
    'vibrationBase': ['Гц'],
    'hpRegen': ['Регенерации', 'Реген'],
    'vectorCount': ['вектор'],
    'ultimateCooldown': ['Перезарядки ультимейта', 'его перезарядки'],
    'ultimatePower': ['Силы ультимейта'],
    'dashCooldown': ['Перезарядки рывка'],
    'dashCharges': ['заряд рывка'],
}

# These stats are stored as a reduction magnitude: the item holds +18 and the card reads
# "-18% cooldown". A sign disagreement on them is the convention, not a defect.
REDUCTION_STATS = {'ultimateCooldown', 'dashCooldown'}

mismatches = []
for m in re.finditer(
    r"    id: '([a-z0-9_]+)',\n    name: '[^']*',\n    russianName: '[^']*',\n    rarity: '[^']*',\n    description: '([^']*)',[\s\S]{0,400}?stats: \{([^}]*)\}",
    GD,
):
    iid, desc, statblock = m.group(1), m.group(2), m.group(3)
    stats = dict(re.findall(r"([a-zA-Z]+): (-?[\d.]+)", statblock))
    ordered = sorted(
        ((k, w) for k, ws in STAT_WORDS.items() for w in ws),
        key=lambda kw: -len(kw[1]),
    )
    claimed = []
    for key, w in ordered:
            # A signed number immediately before the stat's Russian name.
            for num in re.findall(r"([+-]?\d+(?:\.\d+)?)\s*%?\s*" + re.escape(w), desc):
                span = desc.find(w)
                if any(span >= a and span < b for a, b in claimed):
                    continue
                claimed.append((span, span + len(w)))
                if key not in stats:
                    mismatches.append('%s: text says "%s %s" but the item has no %s' % (iid, num, w, key))
                else:
                    want = float(stats[key])
                    got = float(num)
                    if abs(abs(want) - abs(got)) > 0.001:
                        mismatches.append('%s: text says "%s %s", stat block has %s' % (iid, num, w, stats[key]))
                    elif key in REDUCTION_STATS:
                        pass
                    elif (want < 0) != (got < 0) and got != 0:
                        mismatches.append('%s: sign disagrees - text "%s %s", stat %s' % (iid, num, w, stats[key]))
                break
rep('item text vs its own stat block', sorted(set(mismatches)))

# ---------------------------------------------------------------------------------------
# 2. Translation keys used in components but absent from the table.
# ---------------------------------------------------------------------------------------
defined = set(re.findall(r"^\s{4}([a-zA-Z][a-zA-Z0-9_]*):\s*['\"`]", I18, re.M))
used = set()
for path in glob.glob('src/**/*.tsx', recursive=True) + glob.glob('src/**/*.ts', recursive=True):
    if path.endswith('i18n.ts'):
        continue
    body = io.open(path, encoding='utf-8').read()
    used |= set(re.findall(r"\bt\('([a-zA-Z][a-zA-Z0-9_]*)'", body))
rep('translation keys used but never defined', sorted(used - defined))

# Keys defined in one language block but not the other.
blocks = re.findall(r"(?:ru|en):\s*\{([\s\S]*?)\n  \}", I18)
if len(blocks) >= 2:
    ks = [set(re.findall(r"^\s{4}([a-zA-Z][a-zA-Z0-9_]*):", b, re.M)) for b in blocks[:2]]
    rep('keys present in one language block only', sorted(ks[0] ^ ks[1]))
else:
    rep('language blocks found', ['%d - could not compare' % len(blocks)])

# ---------------------------------------------------------------------------------------
# 3. Latin text leaking into Russian-only user strings, and the reverse.
# ---------------------------------------------------------------------------------------
leaks = []
for m in re.finditer(r"russianName: '([^']*)'", GD):
    v = m.group(1)
    # Allow known proper nouns and unit designations.
    stripped = re.sub(r"(SAT|НИИ|APC|EMP|M60|SPAS|AE|AP|T\d|No\.\d+|Lebensborn|Type|\d+)", '', v)
    if re.search(r"[A-Za-z]{3,}", stripped):
        leaks.append('%s' % v)
rep('Latin words inside russianName', sorted(set(leaks)))

# ---------------------------------------------------------------------------------------
# 4. Text still naming mechanics that were removed or renamed this week.
# ---------------------------------------------------------------------------------------
stale_terms = ['Голиаф', 'Левиафан', 'плазмо', 'Плазм', 'рельсотрон', 'Рельсотрон',
               'орбитальн', 'Орбитальн', 'спутник', 'термобарич', 'Аракаки', 'Арахаки',
               'Архонт', 'ошейник', 'Ошейник', 'Аджина', 'мех ', 'Мех ']
# 'Стазисное касание' is a live mutation, not a leftover of the removed stasis collar, so
# the bare word is not searched for.
stale = []
for path in ['src/data/gameData.ts', 'src/utils/engine.ts', 'src/data/psychicMutationsData.ts',
             'src/components/LoreEncyclopediaModal.tsx']:
    body = io.open(path, encoding='utf-8').read()
    for term in stale_terms:
        for m in re.finditer(re.escape(term), body):
            line = body[:m.start()].count('\n') + 1
            ctx = body[max(0, m.start() - 60):m.start() + 60].replace('\n', ' ')
            stale.append('%s:%d  ...%s...' % (path.split('/')[-1], line, ctx.strip()))
rep('references to removed or renamed things', sorted(set(stale))[:40])

print('\n'.join(out))
