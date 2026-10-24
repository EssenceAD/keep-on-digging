"""v0.8 §5 변환 손실 점검: GPT 원본(왼쪽) ↔ png2pxl 결과 4배(오른쪽) → docs/preview/convert_check_*.png
사용: py scripts/convert_check.py   (npm run art 뒤에)
"""
import os
from PIL import Image

OUT = "docs/preview"
os.makedirs(OUT, exist_ok=True)
S = 4

def sprite(path):
    return Image.open(path).convert("RGBA")

def pair(raw, crop, spr):
    """raw 원본 crop → 결과 크기×4로 줄인 것 | 결과 ×4 (최근접)"""
    src = Image.open(raw).convert("RGBA").crop(crop)
    w, h = spr.size
    a = src.resize((w * S, h * S), Image.LANCZOS)
    b = spr.resize((w * S, h * S), Image.NEAREST)
    out = Image.new("RGBA", (w * S * 2 + 8, h * S), (26, 18, 32, 255))
    out.paste(a, (0, 0), a); out.paste(b, (w * S + 8, 0), b)
    return out

def sheet(name, pairs):
    imgs = [pair(*p) for p in pairs]
    W = max(i.width for i in imgs); H = sum(i.height + 8 for i in imgs)
    out = Image.new("RGBA", (W, H), (26, 18, 32, 255)); y = 0
    for i in imgs: out.paste(i, (0, y)); y += i.height + 8
    out.save(f"{OUT}/convert_check_{name}.png"); print("→", f"{OUT}/convert_check_{name}.png")

SP = "public/art/sprites"
# 캐릭터 NPC · 길드 (scripts/chibi.sh 와 같은 자르기)
sheet("npc", [
    ("art/raw/mine_chibi_npc3.png", (0, 0, 647, 809), sprite(f"{SP}/npc_halabeoji.png")),
    ("art/raw/mine_chibi_npc3.png", (647, 0, 1294, 809), sprite(f"{SP}/npc_momo.png")),
    ("art/raw/mine_chibi_npc3.png", (1294, 0, 1942, 809), sprite(f"{SP}/npc_brok.png")),
    ("art/raw/mine_chibi_merchant_cart.png", (0, 0, 793, 992), sprite(f"{SP}/npc_merchant.png")),
])
sheet("guilds", [
    ("art/raw/mine_chibi_guilds.png", (0, 0, 647, 809), sprite(f"{SP}/npc_guild_abyss.png")),
    ("art/raw/mine_chibi_guilds.png", (647, 0, 1294, 809), sprite(f"{SP}/npc_guild_tower.png")),
    ("art/raw/mine_chibi_guilds.png", (1294, 0, 1942, 809), sprite(f"{SP}/npc_guild_shield.png")),
])
# 건물 Lv1·3·5 (scripts/buildings.sh 와 같은 칸)
names = ["office", "warehouse", "cartshed", "lodge", "smelter", "lanternshop", "pump", "turretshop", "molehome"]
for lv in (1, 3, 5):
    raw = f"art/raw/mine_buildings_lv{lv}.png"
    if not os.path.exists(raw): continue
    sheet(f"buildings_lv{lv}", [(raw, ((i % 5) * 397, (i // 5) * 396, (i % 5) * 397 + 396, (i // 5) * 396 + 396), sprite(f"{SP}/g_{n}_{lv}.png")) for i, n in enumerate(names)])
# 사무소 내부
sheet("office", [("art/raw/mine_office_interior.png", (0, 0, 1341, 1173), sprite(f"{SP}/office_base.png"))])
