#!/usr/bin/env python3
import json,sys,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1]
config=json.loads((root/'anatomy/data/sources.json').read_text())
assert len(config['systems'])==14
assert (root/'index.html').exists()
assert (root/'anatomy/index.html').exists()
assert (root/'anatomy/js/app.js').exists()
assert (root/'anatomy/js/viewer.js').exists()
assert (root/'anatomy/data/editorial_cards.json').exists()
filenames={s[sex] for s in config['systems'] for sex in ('male','female') if s.get(sex)}
assert len(filenames)==20,len(filenames)
if '--require-models' in sys.argv:
    for file in filenames:
        path=root/'anatomy/models'/file
        assert path.is_file(),f'Missing {file}'
        with path.open('rb') as f:header=f.read(12)
        assert header[:4]==b'glTF',f'Invalid GLB magic {file}'
        assert struct.unpack_from('<I',header,4)[0]==2,f'Invalid glTF version {file}'
        assert struct.unpack_from('<I',header,8)[0]==path.stat().st_size,f'Truncated GLB {file}'
    for sex in ('male','female'):
        data=json.loads((root/'anatomy/models'/config['sexes'][sex]['manifest']).read_text())
        assert len(data.get('organs',[]))>=200,f'Incomplete {sex} manifest'
print('PASS - structure, all 14 systems and 20 source model mappings',len(filenames))
