#!/usr/bin/env python3
"""Compare exact source identities; matching inventory is not a security verdict."""
import argparse
import json
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--update', action='store_true', help='Explicit maintenance only; review changes.')
args = parser.parse_args()
backend = (ROOT / 'manage.py').exists()
paths = [ROOT / 'apps', ROOT / 'rst_admin'] if backend else [ROOT / 'src']
pattern = re.compile(r'router\.register|path\(|^class .*ViewSet|permission_classes|@action\(' if backend else r'<Route\b|dangerouslySetInnerHTML|\.innerHTML\s*=|<iframe|target=["\x27]_blank|window\.open')
identities=[]
for base in paths:
    for file in sorted(base.rglob('*')):
        if file.suffix not in ('.py', '.tsx', '.ts') or any(p in {'tests', 'migrations', '__pycache__'} for p in file.parts): continue
        for line, text in enumerate(file.read_text().splitlines(), 1):
            if pattern.search(text): identities.append(f'{file.relative_to(ROOT)}:{line}:{text.strip()}')
manifest=ROOT/'security/inventory-manifest.json'
if args.update:
    manifest.write_text(json.dumps(identities,ensure_ascii=False,indent=2)+'\n')
    print(f'Updated {len(identities)} identities. Review the diff.')
else:
    expected=json.loads(manifest.read_text())
    if expected != identities:
        for item in sorted(set(expected)-set(identities)):print('- '+item)
        for item in sorted(set(identities)-set(expected)):print('+ '+item)
        raise SystemExit('Source inventory drift; review authorization/sinks and update explicitly.')
    print(f'{len(identities)} source identities match. Behavioral tests remain required.')
