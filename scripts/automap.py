#!/usr/bin/env python3
"""Tiled 자동 매핑(Automapping) 최소 구현 — Fan-tasy 팩의 RockSlopes_Rules.tmx 용.
입력 레이어(높이 칠하기: 타일 id 0~3) → 출력 레이어(바위 둔덕 타일).  load_rules(path) · apply(rules, grid)
특수 입력(automap-tiles): Empty / Ignore / NonEmpty / Other / Negate
"""
import xml.etree.ElementTree as ET
from collections import deque

def _layer(root, name):
    l = [l for l in root.findall("layer") if l.get("name") == name][0]
    return [int(v) for v in l.find("data").text.replace("\n", "").split(",") if v.strip()]

def load_rules(path):
    root = ET.parse(path).getroot(); W, H = int(root.get("width")), int(root.get("height"))
    sets = sorted((int(t.get("firstgid")), t.get("source")) for t in root.findall("tileset"))
    am = [f for f, s in sets if "automap" in s][0]; rs = [f for f, s in sets if "RockSlope" in s][0]
    reg, inp = _layer(root, "Regions"), _layer(root, "input_RockSlopes")
    outname = [l.get("name") for l in root.findall("layer") if l.get("name").startswith("output")][0]; out = _layer(root, outname)
    seen = [False] * (W * H); rules = []
    for i in range(W * H):
        if not reg[i] or seen[i]: continue
        q = deque([i]); seen[i] = True; cells = []
        while q:
            c = q.popleft(); cells.append(c); x, y = c % W, c // W
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                j = ny * W + nx
                if 0 <= nx < W and 0 <= ny < H and reg[j] and not seen[j]: seen[j] = True; q.append(j)
        x0 = min(c % W for c in cells); y0 = min(c // W for c in cells)
        used = set(inp[c] - rs for c in cells if inp[c] and inp[c] < am)
        ins, outs = [], []
        for c in sorted(cells):
            dx, dy = c % W - x0, c // W - y0; g = inp[c]
            if g >= am: kind = ("empty", "ignore", "nonempty", "other", "negate")[g - am]; ins.append((dx, dy, kind, None))
            elif g: ins.append((dx, dy, "tile", g - rs))
            if out[c]: outs.append((dx, dy, (out[c] & 0x1FFFFFFF) - rs))
        if outs: rules.append({"in": ins, "out": outs, "used": used, "y": y0, "x": x0})
    rules.sort(key=lambda r: (r["y"], r["x"]))                               # 규칙 순서 = 지도 위→아래·왼→오
    return rules

def apply(rules, grid, edge=None, by_location=True):
    """grid[y][x]: 입력 타일 id (None = 빈칸). 반환: 출력 타일 id 격자 (None = 없음). edge: 지도 밖을 이 값으로 봄"""
    H, W = len(grid), len(grid[0]); out = [[None] * W for _ in range(H)]; written = [[False] * W for _ in range(H)]
    at = lambda x, y: grid[y][x] if 0 <= x < W and 0 <= y < H else edge
    M = max(max(d[0] for d in r["in"] + r["out"]) for r in rules) + 1; N = max(max(d[1] for d in r["in"] + r["out"]) for r in rules) + 1
    order = ([(oy, ox, r) for oy in range(-N, H) for ox in range(-M, W) for r in rules] if by_location else
             [(oy, ox, r) for r in rules for oy in range(-N, H) for ox in range(-M, W)])
    for oy, ox, r in order:
                ok = True
                for dx, dy, kind, tid in r["in"]:
                    v = at(ox + dx, oy + dy)
                    if kind == "tile": ok = v == tid
                    elif kind == "empty": ok = v is None
                    elif kind == "nonempty": ok = v is not None
                    elif kind == "other": ok = v is not None and v not in r["used"]
                    elif kind == "negate": ok = True
                    if not ok: break
                if not ok: continue
                # Negate: 같은 칸에 적힌 타일이 아니어야 함 → 같은 칸 tile 조건을 뒤집음
                neg = {(dx, dy) for dx, dy, k, _ in r["in"] if k == "negate"}
                if neg:
                    for dx, dy, kind, tid in r["in"]:
                        if kind == "tile" and (dx, dy) in neg and at(ox + dx, oy + dy) == tid: ok = False
                    if not ok: continue
                cells = [(ox + dx, oy + dy, t) for dx, dy, t in r["out"] if 0 <= ox + dx < W and 0 <= oy + dy < H]
                if any(written[y][x] for x, y, _ in cells): continue
                for x, y, t in cells: out[y][x] = t; written[y][x] = True
    return out
