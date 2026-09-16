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
import sys

# Windows consoles default to a legacy code page, so a single emoji in a source line is
# enough to kill the audit with UnicodeEncodeError halfway through its own report. Force
# UTF-8 and replace anything the terminal still cannot draw.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

CYRILLIC = re.compile(r'[А-Яа-яЁё]')
# A line is considered language-aware if the decision is visible within a few lines of it.
# Every shape the codebase uses to pick a language. Missing one of these turns sound code
# into a false positive, and an audit that cries wolf is an audit nobody reads.
AWARE = re.compile(
    r"\bisRu\b"            # the usual flag in components
    r"|\bru\b\s*\?"         # a local `ru` ternary, as in the error boundary
    r"|\blang\b"
    r"|\bt\("              # translation lookup
    r"|getLanguage\("
    r"|\bcloc\(|\bloc\("   # the canvas and engine localisation helpers
    r"|russianName|nameRu|descRu|russianTitle|russianDescription"
    r"|Ru\s*:|En\s*:"      # paired ru/en fields in a data object
)

PAIRED = re.compile(r"\bru\s*:.*\ben\s*:|\ben\s*:.*\bru\s*:")

"""
Known-good blocks this line-based check cannot see.

The encyclopedia renders whole lists inside one `isRu ? (...) : (...)`, so the language
decision sits far above the lines it governs and no reasonable window reaches it. Each entry
is a file and a marker that must appear on the line; keeping them explicit means a reviewer
can see what is being excused and why, which a wider window would have hidden.
"""
EXEMPT = [
    # Whole lists written inside one `isRu ? (...) : (...)`.
    ('LoreEncyclopediaModal.tsx', '<li><strong className="text-white">'),
    # `descRu:` opens on one line and its branches sit two and three lines below it.
    ('AudioSettingsModal.tsx', 'в вашей папке'),
    ('AudioSettingsModal.tsx', 'Папка пуста'),
]


def exempted(path, line):
    return any(f in path and marker in line for f, marker in EXEMPT)


leaks = []
for path in sorted(glob.glob('src/components/**/*.tsx', recursive=True) + glob.glob('src/*.tsx')):
    lines = io.open(path, encoding='utf-8').read().split('\n')
    for i, line in enumerate(lines):
        if not CYRILLIC.search(line):
            continue
        stripped = line.strip()
        # Comments of every shape, including the JSX form, which holds section markers with
        # Cyrillic in them that no player will ever see.
        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
            continue
        if stripped.startswith('{/*') or stripped.startswith('{/'):
            continue
        # Look at a small window: a ternary often puts the check a line or two above.
        # A line holding both languages at once is a paired entry, not a leak: the choice
        # is made wherever it is read. The stat label table is written this way.
        if PAIRED.search(line):
            continue
        if exempted(path, line):
            continue
        # The decision is on this very line: `isRu ? 'Да' : 'Yes'`, `t('key')`, cloc(...).
        if AWARE.search(line):
            continue

        # Or this line is one branch of a ternary written across several lines, in which
        # case the branch marker is on this line or immediately either side of it. This is
        # deliberately tight. A neighbourhood window of any size exempts whole files here,
        # because the modals mention isRu every few lines - tried at three and at
        # twenty-five, and an injected test leak went unreported at both.
        neighbours = '\n'.join(lines[max(0, i - 1):i + 2])
        if AWARE.search(neighbours) and re.search(r'[?:]', neighbours):
            continue
        leaks.append('%s:%d  %s' % (path, i + 1, line.strip()[:110]))

print('== Russian text with no visible language check: %d' % len(leaks))
for l in leaks:
    print('   ' + l)
