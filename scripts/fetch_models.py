#!/usr/bin/env python3
"""Download the *original*, named anatomical GLB meshes for publication.

This program does NOT generate geometry or use approximate replacement models.
It is run in GitHub Actions, where network downloads are available. For manual
use: python3 scripts/fetch_models.py --all

The model assets are separate licensed works under CC BY-SA 4.0 (male) and
CC BY 4.0 (female). Do not merge them into one GLB.
"""
import argparse
import json
import os
import shutil
import struct
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'anatomy/data/sources.json'
DEST=ROOT/'anatomy/models'


def download(url, dest, minimum=20, binary=False, retries=2):
    last=None
    for attempt in range(retries+1):
        tmp=dest.with_name(dest.name+'.part')
        try:
            print('GET',url,'->',dest,flush=True)
            req=urllib.request.Request(url,headers={'User-Agent':'MedStudy-Atlas-Assets/22.0 (+education; CC attribution)','Accept':'*/*'})
            with urllib.request.urlopen(req,timeout=130) as reader,open(tmp,'wb') as f:
                shutil.copyfileobj(reader,f,1024*1024)
            n=tmp.stat().st_size
            if n<minimum:raise RuntimeError(f'File too small: {n} bytes')
            if binary:
                with open(tmp,'rb') as f:head=f.read(12)
                if head[:4]!=b'glTF' or struct.unpack_from('<I',head,4)[0]!=2:
                    raise RuntimeError('Not a valid binary glTF v2 header')
                if struct.unpack_from('<I',head,8)[0]!=n:
                    raise RuntimeError('GLB declared length does not match downloaded size')
            else:
                if dest.suffix=='.json':
                    payload=json.loads(tmp.read_text(encoding='utf8'))
                    if 'organs' in payload and len(payload['organs'])<20:raise RuntimeError('Anatomy manifest contains too few named structures')
            os.replace(tmp,dest)
            print('OK',n,'bytes',flush=True)
            return n
        except Exception as e:
            last=e
            print('FAILED',attempt+1,'/',retries+1,str(e),file=sys.stderr)
            tmp.unlink(missing_ok=True)
            if attempt<retries:time.sleep(1.5*(attempt+1))
    raise RuntimeError(f'All attempts failed for {dest.name}: {last}')


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--all',action='store_true',help='Download both sexes and all available systems')
    ap.add_argument('--sex',choices=['male','female'],default=None)
    ap.add_argument('--overwrite',action='store_true')
    ap.add_argument('--no-strict',action='store_true',help='Continue on failed assets and print failures')
    args=ap.parse_args()
    data=json.loads(DATA.read_text())
    DEST.mkdir(parents=True,exist_ok=True)
    sexes=[args.sex] if args.sex else ['male','female']
    jobs={}
    for sex in sexes:
        jobs[data['sexes'][sex]['manifest']] = None
        for s in data['systems']:
            if s.get(sex):jobs[s[sex]]=int(s.get(sex+'_bytes',0))
    for license_name in ('LICENSE','NOTICE'):
        jobs[license_name]=None
    total=0;fail=[]
    for filename,expected in jobs.items():
        target=DEST/filename
        if target.exists() and not args.overwrite:
            print('SKIP',target.name,target.stat().st_size)
            continue
        candidates=[data['raw_url']+filename,data['base_url']+filename]
        success=False
        for url in candidates:
            try:
                n=download(url,target,minimum=max(20,int(expected or 20)*.65),binary=filename.endswith('.glb'),retries=1)
                if expected and n!=expected:
                    raise RuntimeError(f'Unexpected file size {n} versus pinned source size {expected}; aborting')
                total+=n;success=True;break
            except Exception as e:
                target.unlink(missing_ok=True)
                print('Source error:',e,file=sys.stderr)
        if not success:fail.append(filename)
    print('Downloaded',total,'bytes; failures:',fail)
    if fail and not args.no_strict:raise SystemExit('Missing original licensed anatomy sources: '+', '.join(fail))

if __name__=='__main__':main()
