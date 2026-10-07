#!/usr/bin/env python3
"""Read public English catalogue and AI pages. No login, paywall or renderer."""
from pathlib import Path
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor,as_completed
import json,time,shutil
root=Path(__file__).resolve().parents[1]/'research'/'englinks'/'raw'
root.mkdir(parents=True,exist_ok=True)
paths=['links/reading','links/listening','links/social-media','links/speaking','links/vocabulary','links/watch/cinema-tv','links/watch/courses','links/watch/youtube','links/writing','ai/prompts','ai/skills','ai/writing']
def fetch(route):
 url='https://englinks.net/'+route
 request=Request(url,headers={'User-Agent':'Mozilla/5.0 (English.tools public catalogue research)'})
 try:
  with urlopen(request,timeout=15) as response:
   data=response.read(5_000_000)
   destination=root/(route.replace('/','_')+'.html')
   destination.write_bytes(data)
  time.sleep(.3)
  return {'route':route,'url':url,'file':str(destination),'bytes':len(data),'ok':True}
 except Exception as e:return {'route':route,'url':url,'error':str(e),'ok':False}
rows=[]
with ThreadPoolExecutor(max_workers=3) as pool:
 for future in as_completed(pool.submit(fetch,route) for route in paths):
  row=future.result();rows.append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
for source,name in [('/private/tmp/englinks-featured.html','links_featured-links.html'),('/private/tmp/englinks-home.html','home.html'),('/private/tmp/englinks-sitemap.xml','sitemap.xml')]:
 if Path(source).exists():shutil.copyfile(source,root/name)
(root.parent/'fetch-report.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
if not all(row['ok'] for row in rows):raise SystemExit(1)
