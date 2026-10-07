#!/usr/bin/env python3
"""Start the local preview independently of the temporary command session."""
from pathlib import Path
import json
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen

DIST = Path(__file__).resolve().parents[1] / "dist"
URL = "http://127.0.0.1:4173/"
LOG = Path("/private/tmp/english-tools-preview-4173.log")
STATE = Path("/private/tmp/english-tools-preview-4173.json")
expected = (DIST / "index.html").read_bytes()


def ready():
    try:
        with urlopen(URL, timeout=1) as response:
            return response.status == 200 and response.read() == expected
    except (URLError, OSError):
        return False


if ready():
    print(json.dumps({"status": "already_running", "url": URL}))
    raise SystemExit(0)

with LOG.open("ab") as output:
    process = subprocess.Popen(
        [sys.executable, "-m", "http.server", "4173", "--bind", "127.0.0.1",
         "--directory", str(DIST)],
        stdin=subprocess.DEVNULL,
        stdout=output,
        stderr=output,
        start_new_session=True,
        close_fds=True,
    )

for _ in range(20):
    if process.poll() is not None:
        raise SystemExit(f"Preview could not start. Details: {LOG}")
    if ready():
        state = {"status": "running", "pid": process.pid, "url": URL,
                 "directory": str(DIST), "log": str(LOG)}
        STATE.write_text(json.dumps(state, indent=2) + "\n")
        print(json.dumps(state))
        break
    time.sleep(0.15)
else:
    process.terminate()
    raise SystemExit(f"Preview did not become ready. Details: {LOG}")
