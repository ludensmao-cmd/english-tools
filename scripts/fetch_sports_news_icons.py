#!/usr/bin/env python3
"""Save the existing/public publisher icons for the dated sports addition."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote, urlsplit
import hashlib, json, struct
from fetch_russian_resource_icons import fetch

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'research/sports-news-source-2026-10-07.json'

def download(row):
    path = ROOT / 'dist' / row['icon'].lstrip('/')
    source = 'existing local publisher icon'
    if not path.exists():
        source = 'https://www.google.com/s2/favicons?domain=' + quote(urlsplit(row['url']).hostname) + '&sz=128'
        data, final = fetch(source)
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('Publisher icon is not PNG: ' + row['name'])
        if min(struct.unpack('>II', data[16:24])) < 16:
            raise ValueError('Publisher icon is too small: ' + row['name'])
        path.write_bytes(data)
    data = path.read_bytes()
    return {'name': row['name'], 'icon': row['icon'], 'source': source,
            'width': struct.unpack('>II', data[16:24])[0],
            'height': struct.unpack('>II', data[16:24])[1],
            'sha256': hashlib.sha256(data).hexdigest()}

def main():
    rows = json.loads(SOURCE.read_text())['resources']
    with ThreadPoolExecutor(max_workers=4) as pool:
        report = list(pool.map(download, rows))
    (ROOT / 'research/sports-news-icons-2026-10-07.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
