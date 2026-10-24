#!/usr/bin/env python3
"""Tiled(.tmx/.tsx) 맵을 PNG로 그리는 작은 렌더러 + Wang 오토타일 — The Fan-tasy Tileset(무료판, 비상업) 용.
  python3 scripts/tiled_render.py <map.tmx> <out.png> [--frame N]
라이브러리:  TS = load_tsx(path) · pick(TS, want8) · render(layers, objects, w, h)
wangid 순서(Tiled): 위, 오른위, 오른, 오른아래, 아래, 왼아래, 왼, 왼위
"""
import os, re, sys, xml.etree.ElementTree as ET
from PIL import Image

FLIP = 0xE0000000

class Tileset:
    def __init__(self, path):
        self.path = path; root = ET.parse(path).getroot(); d = os.path.dirname(path)
        self.tw, self.th = int(root.get("tilewidth")), int(root.get("tileheight"))
        self.cols = int(root.get("columns") or 0); self.count = int(root.get("tilecount"))
        img = root.find("image"); self.image = Image.open(os.path.normpath(os.path.join(d, img.get("source")))).convert("RGBA") if img is not None else None
        self.tiles, self.anim, self.wang = {}, {}, {}
        for t in root.findall("tile"):
            tid = int(t.get("id")); im = t.find("image")
            if im is not None: self.tiles[tid] = Image.open(os.path.normpath(os.path.join(d, im.get("source")))).convert("RGBA")
            a = t.find("animation")
            if a is not None: self.anim[tid] = [int(f.get("tileid")) for f in a.findall("frame")]
        for ws in root.iter("wangset"):
            for wt in ws.findall("wangtile"): self.wang[int(wt.get("tileid"))] = tuple(int(v) for v in wt.get("wangid").split(","))
    def tile(self, tid, frame=0):
        if tid in self.anim: tid = self.anim[tid][frame % len(self.anim[tid])]
        if tid in self.tiles: return self.tiles[tid]
        x, y = (tid % self.cols) * self.tw, (tid // self.cols) * self.th
        return self.image.crop((x, y, x + self.tw, y + self.th))

_cache = {}
def load_tsx(p):
    p = os.path.normpath(p)
    if p not in _cache: _cache[p] = Tileset(p)
    return _cache[p]

def pick(ts, want, rng=None):
    """want: 8개 값(None = 상관없음). 가장 많이 맞는 wang 타일 (동점이면 rng로 고름)."""
    best, cands = -1, []
    for tid, w in ts.wang.items():
        s = sum(1 for a, b in zip(w, want) if b is None or a == b)
        if s > best: best, cands = s, [tid]
        elif s == best: cands.append(tid)
    return (rng.choice(cands) if rng else cands[0]), best

def autotile(grid, ts, color=1, rng=None, blob=True):
    """grid[y][x] 가 color 인 칸마다 wang 타일 id (나머지 None). blob: 모서리는 양옆 변이 다 채워졌을 때만 1."""
    H, W = len(grid), len(grid[0]); out = [[None] * W for _ in range(H)]
    at = lambda x, y: grid[min(max(y, 0), H - 1)][min(max(x, 0), W - 1)] == color
    for y in range(H):
        for x in range(W):
            if not at(x, y): continue
            n, e, s, w = at(x, y - 1), at(x + 1, y), at(x, y + 1), at(x - 1, y)
            ne, se, sw, nw = at(x + 1, y - 1), at(x + 1, y + 1), at(x - 1, y + 1), at(x - 1, y - 1)
            if blob: ne, se, sw, nw = ne and n and e, se and s and e, sw and s and w, nw and n and w
            want = tuple(color if v else 0 for v in (n, ne, e, se, s, sw, w, nw))
            out[y][x] = pick(ts, want, rng)[0]
    return out

def render(w, h, tile_layers, objects, frame=0, bg=(0, 0, 0, 0)):
    """tile_layers: [(ts, grid_of_tid_or_None), ...]  objects: [(img, x, y_bottom), ...] (y 순 정렬해서 그림)"""
    out = Image.new("RGBA", (w, h), bg)
    for ts, grid in tile_layers:
        for y, row in enumerate(grid):
            for x, tid in enumerate(row):
                if tid is not None: out.alpha_composite(ts.tile(tid, frame), (x * ts.tw, y * ts.th))
    for img, x, yb in sorted(objects, key=lambda o: o[2]): _paste_clip(out, img, int(round(x)), int(round(yb)) - img.height)
    return out

def _paste_clip(out, img, x, y):
    x0, y0 = max(0, -x), max(0, -y); x1, y1 = min(img.width, out.width - x), min(img.height, out.height - y)
    if x1 > x0 and y1 > y0: out.alpha_composite(img.crop((x0, y0, x1, y1)), (x + x0, y + y0))

def render_tmx(path, frame=0):
    root = ET.parse(path).getroot(); d = os.path.dirname(path)
    W, H, TW, TH = (int(root.get(k)) for k in ("width", "height", "tilewidth", "tileheight"))
    sets = sorted(((int(t.get("firstgid")), load_tsx(os.path.join(d, t.get("source")))) for t in root.findall("tileset")), key=lambda s: s[0])
    def lookup(gid):
        gid &= ~FLIP; ts, first = None, 0
        for f, t in sets:
            if gid >= f: ts, first = t, f
        return ts, gid - first
    out = Image.new("RGBA", (W * TW, H * TH), (0, 0, 0, 0))
    for el in root:
        if el.get("visible") == "0": continue
        if el.tag == "layer":
            data = [int(v) for v in el.find("data").text.replace("\n", "").split(",") if v.strip()]
            for i, gid in enumerate(data):
                if not gid: continue
                ts, tid = lookup(gid); out.alpha_composite(ts.tile(tid, frame), ((i % W) * TW, (i // W) * TH))
        elif el.tag == "objectgroup":
            objs = []
            for o in el.findall("object"):
                if o.get("gid") is None: continue
                ts, tid = lookup(int(o.get("gid"))); img = ts.tile(tid, frame)
                ow, oh = float(o.get("width", img.width)), float(o.get("height", img.height))
                if (round(ow), round(oh)) != img.size: img = img.resize((round(ow), round(oh)), Image.NEAREST)
                objs.append((img, float(o.get("x")), float(o.get("y"))))
            for img, x, yb in sorted(objs, key=lambda o: o[2]): _paste_clip(out, img, int(round(x)), int(round(yb)) - img.height)
    return out

if __name__ == "__main__":
    fr = int(sys.argv[sys.argv.index("--frame") + 1]) if "--frame" in sys.argv else 0
    render_tmx(sys.argv[1], fr).save(sys.argv[2]); print("→", sys.argv[2])
