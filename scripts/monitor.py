#!/usr/bin/env python3
"""Check official source changes. Never automatically approve reward terms."""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / "data/cards.json").read_text(encoding="utf-8"))
urls = sorted({card["source"] for card in catalog["cards"] if card.get("source")})
state_path = ROOT / "data/source-status.json"
old = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
previous = {item["url"]: item for item in old.get("sources", [])}
checked_at = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat(timespec="seconds")
results = []
for url in urls:
    entry = {"url": url, "checkedAt": checked_at, "ok": False}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; CardWiseTW/1.0; source-audit)"})
        with urllib.request.urlopen(req, timeout=25) as response:
            body = response.read(2_000_000).decode("utf-8", "replace")
            entry["httpStatus"] = response.status
        normalized = re.sub(r"\s+", " ", re.sub(r"<script\b[^>]*>.*?</script>", "", body, flags=re.I | re.S))
        digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        entry.update(ok=True, sha256=digest, changed=bool(previous.get(url, {}).get("sha256") and previous[url]["sha256"] != digest))
    except Exception as exc:
        entry["error"] = str(exc)[:180]
    results.append(entry)
state_path.write_text(json.dumps({"checkedAt": checked_at, "sources": results, "notice": "Source changes are review signals; not verified new offers."}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
changes = [item for item in results if item.get("changed")]
failed = [item for item in results if not item.get("ok")]
(ROOT / "data/changes.txt").write_text("\n".join("CHANGED " + item["url"] for item in changes) + ("\n" if changes else "") + "\n".join("FAILED " + item["url"] + ": " + item.get("error", "HTTP error") for item in failed) + ("\n" if failed else ""), encoding="utf-8")
print(f"Checked {len(results)} official sources; {len(changes)} changed; {len(failed)} failed")
