#!/usr/bin/env python3
"""Bounded public asset snapshot for the user-selected interface reference."""
from pathlib import Path
import re, urllib.request, concurrent.futures
root=Path(__file__).resolve().parents[1]
raw=root/'research/englinks/raw'
texts=[(root/'dist/englinks-source.css').read_text(),*(p.read_text() for p in raw.glob('*.html'))]
paths=sorted(set(re.findall(r'/(?:icons|assets|flags)/[a-zA-Z0-9_.-]+\.(?:svg|woff2)', '\n'.join(texts))))
# source UI assets only, no JS bundles, tracking, authentication or external resource providers.
jobs=[(p,root/'dist'/p.lstrip('/')) for p in paths]
jobs.append(('/blog/',raw/'blog.html'))
def fetch(job):
 path,target=job
 if target.exists():return 'exists '+path
 try:
  request=urllib.request.Request('https://englinks.net'+path,headers={'User-Agent':'English.tools reference snapshot'})
  with urllib.request.urlopen(request,timeout=12) as response:data=response.read(4_000_000)
  target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
  return 'ok '+path
 except Exception as error:return 'ERROR '+path+' '+str(error)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 results=list(pool.map(fetch,jobs))
print('\n'.join(r for r in results if r.startswith('ERROR')))
print('Requested',len(jobs),'saved/existing',sum(not r.startswith('ERROR') for r in results))
