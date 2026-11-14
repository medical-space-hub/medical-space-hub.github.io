import json,re,subprocess,sys,ast
from pathlib import Path
from html.parser import HTMLParser
root=Path(__file__).resolve().parents[1]
class Scan(HTMLParser):
    def __init__(self):super().__init__();self.ids=set();self.scripts=[];self.inscript=False;self.code=[];self.script_type=''
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if a.get('id'):
            if a['id'] in self.ids:raise AssertionError('Duplicate HTML ID '+a['id'])
            self.ids.add(a['id'])
        if tag=='script':self.inscript=True;self.script_type=a.get('type','');self.code=[]
    def handle_data(self,data):
        if self.inscript:self.code.append(data)
    def handle_endtag(self,tag):
        if tag=='script' and self.inscript:
            if self.script_type not in ('application/json','importmap'):
                self.scripts.append((''.join(self.code),self.script_type))
            self.inscript=False

for html in [root/'index.html',root/'anatomy/index.html']:
    sc=Scan();sc.feed(html.read_text());print('HTML',html.name,'ids',len(sc.ids),'script blocks',len(sc.scripts))
    for idx,(code,kind) in enumerate(sc.scripts):
        if not code.strip() or len(code)<40:continue
        temp=Path('/tmp/msh-static-script-'+str(idx)+('.mjs' if kind=='module' else '.js'))
        temp.write_text(code)
        result=subprocess.run(['node','--check',str(temp)],capture_output=True,text=True)
        if result.returncode:raise AssertionError(f'{html}: script {idx} invalid: {result.stderr[:600]}')
for js in [root/'anatomy/js/app.js',root/'anatomy/js/viewer.js']:
    run=subprocess.run(['node','--check',str(js)],capture_output=True,text=True)
    assert run.returncode==0,run.stderr
print('JS syntax: PASS')
config=json.loads((root/'anatomy/data/sources.json').read_text());cards=json.loads((root/'anatomy/data/editorial_cards.json').read_text())
assert len(config['systems'])==14
assert len([s for s in config['systems'] if s.get('male')])==13
assert len([s for s in config['systems'] if s.get('female')])==7
assert len(cards)>=100
assert len({r['id'] for r in cards})==len(cards)
assert all(r.get('overview') for r in cards)
assert all(s.get('male_bytes') or s.get('female_bytes') for s in config['systems'])
assert 'frame.src=\'./anatomy/index.html?embed=1\'' in (root/'index.html').read_text()
print('Package topology: PASS; male systems 13; female 7; detailed card templates',len(cards))
try:
 import tinycss2
 sheet=tinycss2.parse_stylesheet((root/'anatomy/styles.css').read_text())
 errors=[x for x in sheet if x.type=='error']
 assert not errors,errors[:3]
 print('CSS parser: PASS')
except ImportError: print('CSS parser: SKIP')
try:
 import yaml
 wf=yaml.safe_load((root/'.github/workflows/deploy.yml').read_text())
 assert 'jobs' in wf and 'build' in wf['jobs'] and 'deploy' in wf['jobs']
 print('Workflow YAML parser: PASS')
except ImportError: print('Workflow YAML parser: SKIP')
print('LIMIT: In this restricted container, public GLB files could not be downloaded; real 3D rendering, CDN CORS, physical-device gestures and production Supabase are unverified.')
