# 用法: python scripts/unpublish_release.py <版本号>
# 例:   python scripts/unpublish_release.py 1.2.0
# 行为: 删除 GitHub 上该版本的 Release（连同附件）与同名 tag。
#       本地代码改动不受影响。可安全重复执行（不存在时直接提示）。
import json
import os
import sys
import urllib.error
import urllib.request

if len(sys.argv) < 2:
    sys.exit("用法: python scripts/unpublish_release.py <版本号>  例: 1.2.0")
VER = sys.argv[1].lstrip("v")

OWNER, REPO = "Quinloan", "ccMusic-Bilibili-Player"
BASE = "https://api.github.com/repos/%s/%s" % (OWNER, REPO)
TAG = "v" + VER

with open(os.path.expanduser("~/.workbuddy/.github_token"), encoding="utf-8") as f:
    TOKEN = f.read().strip()


def call(url, method="GET", data=None, headers=None):
    h = {
        "Authorization": "Bearer " + TOKEN,
        "Accept": "application/vnd.github+json",
        "User-Agent": "ccMusic-release",
    }
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


rel = call("%s/releases/tags/%s" % (BASE, TAG))
if rel:
    call("%s/releases/%d" % (BASE, rel["id"]), "DELETE")
    print("已删除 release:", TAG, "（含 %d 个附件）" % len(rel.get("assets", [])))
else:
    print("release 不存在，无需删除:", TAG)

deleted = call("%s/git/refs/tags/%s" % (BASE, TAG), "DELETE")
print("已删除 tag:" if deleted is not None else "tag 不存在，无需删除:", TAG)

left = call("%s/releases/tags/%s" % (BASE, TAG))
print("复查:", TAG, "仍存在" if left else "已彻底移除")
