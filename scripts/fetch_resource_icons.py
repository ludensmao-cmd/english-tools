#!/usr/bin/env python3
"""Save the listed services' public favicons as local PNG assets."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen
import re
import json
import subprocess
import struct
import tempfile
import time


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = DIST / "brand" / "resource-icons"
URL_PATTERN = re.compile(r"[\"']?url[\"']?\s*:\s*['\"]([^'\"]+)['\"]")


def domain_name(url):
    host = urlparse(url).hostname.removeprefix("www.")
    return host, re.sub(r"[^a-z0-9]+", "-", host) + ".png"


def fetch_icon(item):
    host, filename = item
    if any((OUT / filename).with_suffix(ext).exists() for ext in (".png", ".ico", ".jpg", ".jpeg", ".svg")):
        return host, filename, 'existing local asset retained', 0, 0, None
    icon_host = "uiowa.edu" if host == "soundsofspeech.uiowa.edu" else host
    source = f"https://www.google.com/s2/favicons?domain={quote(icon_host)}&sz=128"
    request = Request(source, headers={"User-Agent": "Mozilla/5.0 (compatible; English.tools prototype)"})
    for attempt in range(2):
        try:
            with urlopen(request, timeout=7) as response:
                data = response.read()
            if data.startswith(b"\xff\xd8\xff"):
                with tempfile.NamedTemporaryFile(suffix=".jpg") as image_file:
                    image_file.write(data)
                    image_file.flush()
                    subprocess.run(["sips", "-s", "format", "png", image_file.name, "--out", str(OUT / filename)], check=True, capture_output=True)
                data = (OUT / filename).read_bytes()
            if not data.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("response is neither PNG nor JPEG")
            width, height = struct.unpack(">II", data[16:24])
            if width < 16 or height < 16:
                raise ValueError(f"image is only {width}×{height}")
            (OUT / filename).write_bytes(data)
            return host, filename, source, width, height, None
        except Exception as error:
            if attempt == 1:
                return host, filename, source, 0, 0, str(error)
            time.sleep(attempt + 1)


def main():
    urls = []
    for source_file in (DIST / "data.js", DIST / "library-data.js", DIST / "englinks-data.js"):
        if source_file.exists():
            urls.extend(URL_PATTERN.findall(source_file.read_text(encoding="utf-8")))
    source_data = ROOT / "research" / "englinks" / "resources-source.json"
    if source_data.exists():
        urls.extend(item['url'] for item in json.loads(source_data.read_text())['resources'] if item.get('url'))
    domains = dict(domain_name(url) for url in urls)
    if not urls:
        raise SystemExit('No resource URLs found; existing assets were not changed')
    OUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = [future.result() for future in as_completed(pool.submit(fetch_icon, item) for item in domains.items())]
    errors = [row for row in results if row[-1]]
    downloaded = [row for row in results if not row[-1] and row[3]]
    if downloaded:
        manifest = ["", "## Additional website favicons", "", "Downloaded only for missing assets. Existing service marks were retained.", ""]
        manifest.extend(f"- `{host}` → `{filename}` ({width}×{height}) — {source}" for host, filename, source, width, height, error in sorted(downloaded))
        with (ROOT / "RESOURCE_ICON_SOURCES.md").open('a', encoding='utf-8') as stream:
            stream.write("\n".join(manifest) + "\n")
    print(f"Resources: {len(urls)}; icon domains: {len(domains)}; downloaded: {len(downloaded)}; retained: {len(results) - len(errors) - len(downloaded)}")
    for host, _, _, _, _, error in errors:
        print(f"FAILED {host}: {error}")
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
