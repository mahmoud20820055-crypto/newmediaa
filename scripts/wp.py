#!/usr/bin/env python3
"""Small helper for editing newmediaa.com through the WordPress REST API.

Credentials are read from environment variables only (never commit them):
    WP_URL           e.g. https://newmediaa.com   (default)
    WP_USER          WordPress username
    WP_APP_PASSWORD  Application Password created in: Users -> Profile -> Application Passwords

Every write first saves the current version to backups/ so it can be restored.

Usage:
    python3 scripts/wp.py whoami
    python3 scripts/wp.py get pages 92                # print title + elementor texts
    python3 scripts/wp.py replace pages 92 "OLD" "NEW" [--apply]
    python3 scripts/wp.py restore backups/pages-92-<timestamp>.json
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("WP_URL", "https://newmediaa.com").rstrip("/") + "/wp-json/wp/v2/"
HERE = os.path.dirname(os.path.abspath(__file__))
BACKUPS = os.path.join(os.path.dirname(HERE), "backups")


def _auth():
    user, pw = os.environ.get("WP_USER"), os.environ.get("WP_APP_PASSWORD")
    if not user or not pw:
        sys.exit("Set WP_USER and WP_APP_PASSWORD environment variables first.")
    return "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode()


def call(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Authorization", _auth())
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:400]}")


def esc(s):
    """The same text as Elementor stores it inside its JSON (\\uXXXX escapes)."""
    return json.dumps(s)[1:-1]


def backup(kind, item):
    os.makedirs(BACKUPS, exist_ok=True)
    path = os.path.join(BACKUPS, f"{kind}-{item['id']}-{int(time.time())}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"kind": kind, "item": item}, f, ensure_ascii=False)
    return path


def cmd_whoami():
    me = call("users/me?context=edit")
    print(me["username"], me["roles"])


def cmd_get(kind, id_):
    it = call(f"{kind}/{id_}?context=edit")
    print("title:", it["title"]["raw"])
    data = (it.get("meta") or {}).get("_elementor_data")
    if data:
        def walk(x):
            if isinstance(x, dict):
                for k, v in x.items():
                    if isinstance(v, str) and k in ("title", "editor", "text", "list_content", "tab_title", "description_text", "placeholder"):
                        print(f"  {k}: {v[:120]}")
                    else:
                        walk(v)
            elif isinstance(x, list):
                for v in x:
                    walk(v)
        walk(json.loads(data))


def cmd_replace(kind, id_, old, new, apply=False):
    it = call(f"{kind}/{id_}?context=edit")
    body, n = {}, 0
    title = it["title"]["raw"]
    if old in title:
        n += title.count(old)
        body["title"] = title.replace(old, new)
    data = (it.get("meta") or {}).get("_elementor_data") or ""
    new_data = data
    for a, b in ((old, new), (esc(old), esc(new))):
        n += new_data.count(a)
        new_data = new_data.replace(a, b)
    if new_data != data:
        json.loads(new_data)  # must stay valid JSON
        body["meta"] = {"_elementor_data": new_data}
    print(f"{n} occurrence(s) found in {kind}/{id_}")
    if not body or not apply:
        print("dry run - add --apply to save" if body else "nothing to change")
        return
    print("backup:", backup(kind, it))
    call(f"{kind}/{id_}", "POST", body)
    print("saved")


def cmd_restore(path):
    with open(path, encoding="utf-8") as f:
        b = json.load(f)
    it, kind = b["item"], b["kind"]
    body = {"title": it["title"]["raw"]}
    data = (it.get("meta") or {}).get("_elementor_data")
    if data:
        body["meta"] = {"_elementor_data": data}
    call(f"{kind}/{it['id']}", "POST", body)
    print("restored", kind, it["id"])


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == "whoami":
        cmd_whoami()
    elif a[0] == "get":
        cmd_get(a[1], a[2])
    elif a[0] == "replace":
        cmd_replace(a[1], a[2], a[3], a[4], "--apply" in a)
    elif a[0] == "restore":
        cmd_restore(a[1])
    else:
        sys.exit(__doc__)
