#!/usr/bin/env python3
"""Offline checks for static site paths, anchors, structured data and JS syntax."""
import hashlib
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
import struct
import subprocess
from urllib.parse import unquote, urlsplit


DIST = Path(__file__).resolve().parents[1] / "dist"


class Document(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.ids = []
        self.references = []
        self.labels = []
        self.controls = []
        self.scripts = []
        self.script_type = None
        self.script_body = []

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        for attr in ("href", "src", "poster", "action"):
            if attrs.get(attr):
                self.references.append((tag, attr, attrs[attr], self.getpos()[0]))
        if tag == "label" and attrs.get("for"):
            self.labels.append(attrs["for"])
        for attribute in ("aria-controls", "aria-labelledby", "aria-describedby"):
            if attrs.get(attribute):
                self.controls.extend(attrs[attribute].split())
        if tag == "meta" and attrs.get("http-equiv", "").lower() == "refresh":
            redirect = re.search(r"url\s*=\s*(.+)$", attrs.get("content", ""), flags=re.IGNORECASE)
            if redirect:
                self.references.append((tag, "refresh", redirect.group(1).strip(" '\""), self.getpos()[0]))
        if tag == "script":
            self.script_type = attrs.get("type", "javascript")
            self.script_body = []

    def handle_data(self, data):
        if self.script_type is not None:
            self.script_body.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.script_type is not None:
            self.scripts.append((self.script_type, "".join(self.script_body)))
            self.script_type = None


def local_target(source, reference):
    parsed = urlsplit(reference)
    if parsed.scheme or parsed.netloc:
        return None, ""
    target = DIST / unquote(parsed.path).lstrip("/") if parsed.path.startswith("/") else source.parent / unquote(parsed.path)
    if not parsed.path:
        target = source
    target = target.resolve()
    if target.is_dir():
        target = target / "index.html"
    return target, unquote(parsed.fragment)


def main():
    errors = []
    warnings = []
    documents = {}
    stylesheets = set()
    structured_data = 0
    scripts_checked = 0
    references_checked = 0
    node = shutil.which("node")
    for path in sorted(DIST.rglob("*.html")):
        document = Document(path)
        document.feed(path.read_text(encoding="utf-8"))
        documents[path.resolve()] = document
        for identity, count in Counter(document.ids).items():
            if count > 1:
                errors.append(f"{path.relative_to(DIST)}: duplicate id {identity}")
        for identity in document.labels + document.controls:
            if identity not in document.ids:
                errors.append(f"{path.relative_to(DIST)}: control reference has no target: {identity}")
        for kind, body in document.scripts:
            if not body.strip():
                continue
            if kind == "application/ld+json":
                try:
                    json.loads(body)
                    structured_data += 1
                except json.JSONDecodeError as error:
                    errors.append(f"{path.relative_to(DIST)}: JSON-LD {error}")
            elif kind in ("javascript", "module", "text/javascript", "application/javascript") and node:
                checked = subprocess.run([node, "--check"], input=body, text=True, capture_output=True)
                scripts_checked += 1
                if checked.returncode:
                    errors.append(f"{path.relative_to(DIST)}: inline JS syntax: {checked.stderr.strip()}")

    for path, document in documents.items():
        for tag, attr, reference, line in document.references:
            target, anchor = local_target(path, reference)
            if target is None:
                continue
            references_checked += 1
            if not target.is_file():
                errors.append(f"{path.relative_to(DIST)}:{line}: missing {attr} target {reference}")
                continue
            if attr == "href" and tag == "link" and target.suffix == ".css":
                stylesheets.add(str(target.relative_to(DIST)))
            if anchor and target.suffix == ".html" and target in documents and anchor not in documents[target].ids:
                errors.append(f"{path.relative_to(DIST)}:{line}: missing anchor {reference}")

    for path in sorted(DIST.rglob("*.css")):
        for reference in re.findall(r"url\(\s*['\"]?([^)'\"\s]+)", path.read_text(encoding="utf-8")):
            target, _ = local_target(path, reference)
            if target is not None:
                references_checked += 1
                if not target.is_file():
                    errors.append(f"{path.relative_to(DIST)}: missing CSS resource {reference}")

    if node:
        for path in sorted(DIST.rglob("*.js")):
            checked = subprocess.run([node, "--check", str(path)], text=True, capture_output=True)
            scripts_checked += 1
            if checked.returncode:
                errors.append(f"{path.relative_to(DIST)}: JS syntax: {checked.stderr.strip()}")
    else:
        warnings.append("Node unavailable; JavaScript syntax check skipped")

    logo = DIST / "brand/english-tools-transparent.png"
    logo_info = None
    if logo.is_file():
        data = logo.read_bytes()
        if data[:8] != b"\x89PNG\r\n\x1a\n":
            errors.append("Approved logo file is not a PNG")
        else:
            width, height = struct.unpack(">II", data[16:24])
            logo_info = {"path": str(logo.relative_to(DIST)), "width": width, "height": height, "sha256": hashlib.sha256(data).hexdigest()}
    else:
        errors.append("Approved PNG logo missing")

    result = {"html_pages": len(documents), "local_references_checked": references_checked, "javascript_files_and_blocks_checked": scripts_checked, "json_ld_blocks": structured_data, "linked_local_stylesheets": sorted(stylesheets), "approved_logo": logo_info, "errors": errors, "warnings": warnings, "scope": "Offline source checks; no browser render, external URL reachability or publication verification"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(bool(errors))


if __name__ == "__main__":
    main()
