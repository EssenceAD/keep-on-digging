#!/usr/bin/env python3
"""GPT가 그린 확대 픽셀아트(마젠타 배경) → pxl 그리드 문자열.

사용: python3 scripts/png2pxl.py art/raw/miner_red_chibi.png --cols 32 --rows 40 --pal art/chars.px.js --name _miner_base
 - 셀 중심 샘플링으로 원본 격자를 복원(최근접 축소)
 - 마젠타(#FF00FF 근처) → 투명 '.'
 - 나머지 색은 pal() 목록에서 가장 가까운 키로 양자화 (Lab 거리)
 - 결과: sprite("<name>", `...`) 블록을 stdout에 출력 → .px.js에 붙여 넣고 프레임은 grid() 패치로 애니메이션
"""
import argparse, re, sys
from PIL import Image

def parse_pal(path):
    src = open(path, encoding="utf-8").read()
    m = re.search(r"pal\(\{(.*?)\}\)", src, re.S)
    pal = {}
    for k, v in re.findall(r"([A-Za-z]):\s*\"#([0-9a-fA-F]{6})\"", m.group(1)):
        pal[k] = tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))
    return pal

def to_lab(rgb):
    r, g, b = [x / 255 for x in rgb]
    def lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = lin(r), lin(g), lin(b)
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722)
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
    def f(t): return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("png"); ap.add_argument("--cols", type=int, required=True); ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--pal", required=True); ap.add_argument("--name", default="_sprite")
    ap.add_argument("--crop", help="x,y,w,h 원본에서 잘라낼 영역(픽셀)")
    a = ap.parse_args()
    im = Image.open(a.png).convert("RGB")
    if a.crop:
        x, y, w, h = map(int, a.crop.split(",")); im = im.crop((x, y, x + w, y + h))
    pal = parse_pal(a.pal); lab = {k: to_lab(v) for k, v in pal.items()}
    cw, ch = im.width / a.cols, im.height / a.rows
    cache = {}
    def key(rgb):
        r, g, b = rgb
        if r > 200 and b > 200 and g < 90: return "."          # 마젠타
        if rgb in cache: return cache[rgb]
        L = to_lab(rgb)
        best = min(lab, key=lambda k: sum((p - q) ** 2 for p, q in zip(L, lab[k])))
        cache[rgb] = best; return best
    rows = []
    for j in range(a.rows):
        row = ""
        for i in range(a.cols):
            # 셀 중심 + 주변 4점 다수결(확대 그림의 경계 흔들림 방지)
            cx, cy = int((i + 0.5) * cw), int((j + 0.5) * ch)
            votes = {}
            for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
                k = key(im.getpixel((min(max(cx + dx, 0), im.width - 1), min(max(cy + dy, 0), im.height - 1))))
                votes[k] = votes.get(k, 0) + 1
            row += max(votes, key=votes.get)
        rows.append(row)
    print(f'sprite("{a.name}", `')
    for r in rows: print("  " + r)
    print("`)")
    used = sorted({c for r in rows for c in r if c != "."})
    print(f"// 사용 색 {len(used)}: {''.join(used)}", file=sys.stderr)

if __name__ == "__main__":
    main()
