#!/usr/bin/env python3
"""Download public product marks for the researched Russian-language additions."""
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, quote, urljoin
from urllib.request import Request, urlopen
import hashlib, json, re, struct

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/brand/resource-icons'
SOURCE = ROOT / 'research/russian-tools-source-2026-10-07.json'

class Images(HTMLParser):
    def __init__(self):
        super().__init__(); self.images = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'meta' and a.get('property') == 'og:image':
            self.images.append(a.get('content', ''))
        if tag == 'img' and a.get('itemprop') == 'image':
            self.images.append(a.get('src', ''))

def fetch(url):
    request = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(request, timeout=12) as response:
        data = response.read(8 * 1024 * 1024)
        return data, response.geturl()

def slug(name):
    aliases = {'Полиглот — английский язык': 'polyglot', 'WordBit — английский язык': 'wordbit',
               'Smart Book / Билингва': 'smart-book', 'Мультитран': 'multitran',
               'Яндекс Переводчик': 'yandex-translate', 'Алиса AI': 'alice-ai', 'ГигаЧат': 'gigachat'}
    return aliases.get(name, re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-'))

def download(row):
    name, url = row['name'], row['url']
    filename = 'ru-' + slug(name) + '.png'
    path = OUT / filename
    host = urlsplit(url).hostname
    if path.exists() and host not in {'apps.apple.com', 'play.google.com'}:
        return {'name': name, 'file': filename, 'status': 'retained'}
    try:
        if host == 'apps.apple.com' or name == 'Mondly':
            app_id = re.search(r'/id(\d+)', url).group(1) if host == 'apps.apple.com' else '987873536'
            lookup, _ = fetch('https://itunes.apple.com/lookup?id=' + app_id + '&country=us')
            result = json.loads(lookup)['results'][0]
            asset = result.get('artworkUrl512') or result['artworkUrl100']
        elif host == 'play.google.com':
            html, final = fetch(url)
            parser = Images(); parser.feed(html.decode('utf-8', errors='replace'))
            # Store icons are product-specific; never substitute the store mark.
            candidates = [urljoin(final, image) for image in parser.images if image]
            if not candidates: raise ValueError('Store product image is absent')
            asset = candidates[0]
        else:
            asset = 'https://www.google.com/s2/favicons?domain=' + quote(host) + '&sz=128'
        data, final = fetch(asset)
        if data.startswith(b'\x89PNG\r\n\x1a\n'):
            width, height = struct.unpack('>II', data[16:24])
            if min(width, height) < 16: raise ValueError('Image is too small')
            path.write_bytes(data)
        elif data.startswith(b'\xff\xd8\xff') or data[:4] == b'RIFF':
            # Use the existing system converter; no dependency installation.
            import subprocess, tempfile
            suffix = '.jpg' if data.startswith(b'\xff\xd8\xff') else '.webp'
            with tempfile.NamedTemporaryFile(suffix=suffix) as temp:
                temp.write(data); temp.flush()
                subprocess.run(['sips', '-s', 'format', 'png', temp.name, '--out', str(path)],
                               check=True, capture_output=True)
            width, height = struct.unpack('>II', path.read_bytes()[16:24])
        else:
            raise ValueError('Response is not a supported image')
        return {'name': name, 'file': filename, 'source': final, 'width': width, 'height': height,
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'status': 'downloaded'}
    except Exception as error:
        return {'name': name, 'status': 'unavailable', 'error': str(error)}

def main():
    rows = [row for row in json.loads(SOURCE.read_text())['resources'] if not row.get('catalogId')]
    OUT.mkdir(exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        report = list(pool.map(download, rows))
    report_path = ROOT / 'research/russian-resource-icons-2026-10-07.json'
    previous = {r['name']: r for r in json.loads(report_path.read_text())} if report_path.exists() else {}
    report = [previous.get(r['name'], r) if r['status'] == 'retained' else r for r in report]
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if any(row['status'] == 'unavailable' for row in report):
        raise SystemExit(1)

if __name__ == '__main__': main()
