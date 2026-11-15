#!/usr/bin/env python3
"""Sync licensed public Taiwanese card data with strict validation and safe fallback.

Never converts unknown reward terms into numeric cashbacks. Preserve the last
successful snapshot if an endpoint fails or its schema changes.
"""
from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import re
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "external"
BASE = "https://pay.elggum.com/api/v1"
ENDPOINTS = ("meta", "cards", "today", "wallets", "issuers", "promos", "fee_rules", "sources", "coverage")
MAX_BYTES = 16_000_000
MAX_TEXT = 350
UA = "Credit-Card-Advisor/1.0 (+https://github.com/smartleo123/Credit-Card-Advisor)"
LICENSE = "CC BY 4.0"
ATTRIBUTION = "台灣支付優惠站 https://pay.elggum.com"

def fetch(name):
    url = f"{BASE}/{name}.json"
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=35) as response:
        if response.status != 200:
            raise ValueError(f"{name}: HTTP {response.status}")
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError(f"{name}: response larger than {MAX_BYTES} bytes")
    parsed = json.loads(data.decode("utf-8"))
    if not isinstance(parsed, (list, dict)) or not parsed:
        raise ValueError(f"{name}: missing JSON collection")
    return parsed

def first_collection(obj, keys):
    if isinstance(obj, list):
        return obj
    for key in keys:
        val = obj.get(key)
        if isinstance(val, list):
            return val
        if isinstance(val, dict):
            for subkey in ("items", "data", "results", "records"):
                if isinstance(val.get(subkey), list):
                    return val[subkey]
    for key in ("data", "results", "items", "records"):
        val = obj.get(key)
        if isinstance(val, list):
            return val
        if isinstance(val, dict):
            match = first_collection(val, keys)
            if match:
                return match
    return []

def value(record, keys):
    for key in keys:
        item = record.get(key)
        if isinstance(item, str) and item.strip():
            return item.strip()
        if isinstance(item, (float, int)) and not isinstance(item, bool):
            return str(item)
    return ""

def excerpt(record):
    parts = []
    # Show only fields grounded directly in the source; avoid asserting eligibility.
    for key in ("description_zh", "description", "summary_zh", "summary", "title", "name_zh", "name", "conditions_zh", "conditions", "reward_summary", "reward_text", "benefit"):
        v = record.get(key)
        if isinstance(v, str) and v.strip():
            parts.append(v.strip())
    return " | ".join(parts)[:MAX_TEXT]

def search_text(record):
    # Search within source records, not around mixed/adjacent cards.
    chunks = []
    def walk(x, depth=0):
        if depth > 3 or len(chunks) > 80:
            return
        if isinstance(x, dict):
            for k, v in x.items():
                if k in ("html", "raw_html", "body_html", "image", "images"):
                    continue
                walk(v, depth + 1)
        elif isinstance(x, list):
            for i in x[:15]:
                walk(i, depth + 1)
        elif isinstance(x, (str, int, float)):
            chunks.append(str(x)[:180])
    walk(record)
    return " ".join(chunks)[:2200]

def compact_rows(obj, kind):
    options = {
        "cards": ("cards", "card_list", "versions"),
        "wallets": ("wallets", "payment_methods"),
        "issuers": ("issuers", "banks"),
        "promos": ("promos", "promotions", "offers"),
        "fee_rules": ("fee_rules", "rules"),
        "today": ("recommendations", "deals", "offers", "cards", "promos"),
    }
    data = first_collection(obj, options.get(kind, (kind,)))
    rows = []
    for i, rec in enumerate(data):
        if not isinstance(rec, dict):
            continue
        ident = value(rec, ("id", "card_id", "slug", "code", "key", "uid")) or str(i)
        name = value(rec, ("name_zh", "name", "card_name", "title_zh", "title", "label", "merchant_name"))
        issuer = value(rec, ("issuer_name", "issuer", "bank", "bank_name", "issuer_id"))
        url = value(rec, ("url", "official_url", "source_url", "link"))
        if not url.startswith("https://"):
            url = ""
        rows.append({"id": ident[:150], "name": name[:180], "issuer": issuer[:100], "summary": excerpt(rec), "search": search_text(rec), "url": url})
    return rows

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    existing_manifest = OUT / "manifest.json"
    now = datetime.now(timezone.utc).isoformat()
    payloads = {}
    errors = []
    for name in ENDPOINTS:
        try:
            payloads[name] = fetch(name)
        except Exception as exc:
            errors.append(f"{name}: {str(exc)[:180]}")
    meta = payloads.get("meta")
    if not isinstance(meta, dict) or meta.get("api_version") != 1:
        errors.append("meta: unexpected api_version (expected 1)")
    elif "CC BY" not in str(meta.get("license", "")):
        errors.append("meta: unexpected or absent reuse license")
    if "cards" in payloads and not compact_rows(payloads["cards"], "cards"):
        errors.append("cards: unable to recognize any card records")
    if "wallets" in payloads and not compact_rows(payloads["wallets"], "wallets"):
        errors.append("wallets: unable to recognize payment tools")
    # Atomic publication: all contract checks must pass before replacing any files.
    if errors:
        msg = "\n".join(errors)
        print("Sync rejected, existing successful snapshot preserved:\n" + msg, file=sys.stderr)
        (OUT / "sync-error.txt").write_text(f"{now}\n{msg}\n", encoding="utf-8")
        return 1
    snapshot = {
        "provider": ATTRIBUTION,
        "license": LICENSE,
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "providerSite": "https://pay.elggum.com/",
        "sourceApi": BASE + "/meta.json",
        "dataDate": meta.get("data_date"),
        "generatedAt": meta.get("generated_at"),
        "syncedAt": now,
        "counts": meta.get("counts", {}),
        "recordCounts": {},
        "notes": "Third-party data, not proof of actual reward eligibility. Check the issuing bank's terms."
    }
    index = {}
    for name in ENDPOINTS:
        data = payloads[name]
        write_json(OUT / f"{name}.json", data)
        digest = hashlib.sha256(json.dumps(data, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        snapshot.setdefault("sha256", {})[name] = digest
        if name in ("cards", "wallets", "issuers", "promos", "fee_rules", "today"):
            index[name] = compact_rows(data, name)
            snapshot["recordCounts"][name] = len(index[name])
    write_json(OUT / "index.json", {"metadata": snapshot, "datasets": index})
    write_json(existing_manifest, snapshot)
    (OUT / "sync-error.txt").unlink(missing_ok=True)
    print(f"Published {snapshot['recordCounts']} from provider data date {snapshot['dataDate']}.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
