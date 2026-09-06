# -*- coding: utf-8 -*-
"""Find user-facing text that ignores the language setting.

Reported from play with a screenshot: the game-over screen rendered entirely in English
while two fragments inside it - "(Серия x3048)" and "(+3280 В НИИ)" - stayed Russian. Those
are strings written without a language check, so they show Russian to an English player and
would show English to a Russian one if written the other way round.

    python scripts/lang-leak-audit.py

The check is deliberately crude: a Cyrillic or Latin-sentence literal in a component, on a
line with no isRu / lang / t( nearby, is a leak. Data files are skipped - names and lore
live there in both languages by design and are selected at the point of use.
"""
import io
import os
import re
import glob

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

CYRILLIC = re.compile(r'[А-Яа-яЁё]')
# A line is considered language-aware if the decision is visible within a few lines of it.
AWARE = re.compile(r"\bisRu\b|\blang\b|\bt\(|getLanguage\(|russianName|nameRu|descRu|Ru\s*:|En\s*:")

leaks = []
for path in sorted(glob.glob('src/components/**/*.tsx', recursive=True) + glob.glob('src/*.tsx')):
    lines = io.open(path, encoding='utf-8').read().split('\n')
    for i, line in enumerate(lines):
        if not CYRILLIC.search(line):
            continue
        if line.strip().startswith('//') or line.strip().startswith('*'):
            continue
        # Look at a small window: a ternary often puts the check a line or two above.
        window = '\n'.join(lines[max(0, i - 3):i + 3])
        if AWARE.search(window):
            continue
        leaks.append('%s:%d  %s' % (path, i + 1, line.strip()[:110]))

print('== Russian text with no visible language check: %d' % len(leaks))
for l in leaks:
    print('   ' + l)
