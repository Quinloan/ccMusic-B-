# 用法: python scripts/publish_release.py <版本号>
# 例:   python scripts/publish_release.py 1.2.0
# 前提: electron-builder 已打包出 release-v<版本>/ 产物，且同目录有 RELEASE_NOTES_v<版本>.md
# 行为: 创建 GitHub Release(不存在时) → 上传 exe / latest.yml / blockmap；
#       已存在的同名附件会先删除再上传，可安全重复执行。
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

if len(sys.argv) < 2:
    sys.exit("用法: python scripts/publish_release.py <版本号>  例: 1.2.0")
VER = sys.argv[1].lstrip("v")

OWNER, REPO = "Quinloan", "ccMusic-Bilibili-Player"
BASE = "https://api.github.com/repos/%s/%s" % (OWNER, REPO)
TAG = "v" + VER
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "release-v" + VER)
EXE = "ccMusic-Setup-%s.exe" % VER
ASSETS = [EXE, "latest.yml", EXE + ".blockmap"]

with open(os.path.expanduser("~/.workbuddy/.github_token"), encoding="utf-8") as f:
    TOKEN = f.read().strip()


def call(url, method="GET", data=None, headers=None, timeout=120):
    h = {
        "Authorization": "Bearer " + TOKEN,
        "Accept": "application/vnd.github+json",
        "User-Agent": "ccMusic-release",
    }
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


notes_path = os.path.join(DIST, "RELEASE_NOTES_v%s.md" % VER)
with open(notes_path, encoding="utf-8") as f:
    lines = f.read().split("\n")
if lines and lines[0].startswith("# "):
    lines = lines[1:]
BODY = "\n".join(lines).strip()

print("tag =", TAG, "| repo =", OWNER + "/" + REPO)

try:
    rel = call("%s/releases/tags/%s" % (BASE, TAG))
    print("release 已存在，复用:", rel["html_url"])
except urllib.error.HTTPError as e:
    if e.code != 404:
        raise
    rel = call(
        "%s/releases" % BASE,
        "POST",
        json.dumps(
            {
                "tag_name": TAG,
                "target_commitish": "main",
                "name": "ccMusic " + TAG,
                "body": BODY,
                "draft": False,
                "prerelease": False,
            }
        ).encode("utf-8"),
        {"Content-Type": "application/json"},
    )
    print("release 已创建:", rel["html_url"])

existing = {a["name"]: a["id"] for a in rel.get("assets", [])}
upload_base = rel["upload_url"].split("{")[0]

for name in ASSETS:
    full = os.path.join(DIST, name)
    if not os.path.exists(full):
        print("!! 缺少产物，跳过:", name)
        continue
    if name in existing:
        call("%s/assets/%d" % (BASE, existing[name]), "DELETE")
        print("已删除旧附件:", name)
    with open(full, "rb") as f:
        blob = f.read()
    url = upload_base + "?name=" + urllib.parse.quote(name)
    a = call(
        url,
        "POST",
        blob,
        {"Content-Type": "application/octet-stream"},
        timeout=900,
    )
    print("已上传: %s  (%.1f MB, %s)" % (a["name"], a["size"] / 1048576, a["state"]))

print("RELEASE_URL=" + rel["html_url"])
