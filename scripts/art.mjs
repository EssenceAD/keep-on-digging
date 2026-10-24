// pxl로 아트를 빌드하고, 게임이 쓰는 PNG/JSON만 public/art 로 복사한다.  실행: npm run art
//   art/shaft.px.js        갱도 타일·소품 (형철 초안 + Code 추가분)
//   art/mine.px.js         지상 띠 · 격자 양옆 패럴랙스 바위 · HUD 아이콘
//   art/office/office_gpt.px.js 사무소 내부 — v0.9 GPT 원본 → png2pxl (sh scripts/office.sh). 옛 코드 그림 office.px.js 는 팔레트만 빌려 씀 (빌드 안 함)
//   art/ui/ui.px.js        UI 킷 (나무·돌·양피지, 9-slice) → public/art/ui/
//   art/chibi.px.js        §10 캐릭터(광부 3·두더지·NPC 4·광차) — GPT 치비를 png2pxl로 변환(sh scripts/chibi.sh) + 손 프레임
//   art/fx.px.js           이펙트 시트 10종 (48×48 × 6~8f)
//   art/chars.px.js        §9 광차 v2 (형철) — v0.5부터 게임 광차. 광부 v2는 안 씀
//   art/buildings.px.js    명세3 §2-3 지상 부지 건물 9종 × Lv1/3/5 + 장식 6 (형철 초안 · 폴백)
//   art/buildings_gpt.px.js 명세3 §2-3-1 GPT 건물 시트 → png2pxl (sh scripts/buildings.sh) — 게임은 이걸 먼저 씀
//   art/yard/yard.px.js    PATCH_V10 회사 부지 장면 (형철 pxl 조립 · tiles.px.js 포함) → scenes/yard_day·yard_night + 덤불 소품(yd_*)
//   art/yard/yard_anims.px.js  위 장면의 _ripple·_fire 를 yard_ripple·yard_fire 로 내보냄 (yard.px.js 를 include — 장면도 이걸로 빌드)
//   art/yard/buildings64.px.js 부지 장면용 건물 64×64 · 장식 (sh scripts/buildings64.sh — GPT 원본에서 바로 64칸)
// pxl: crsolver/claude-pxl (MIT) — ~/.claude/skills/pxl-pixel-art 에 클론 (PXL 환경변수로 경로 바꿀 수 있음)
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const pxl = process.env.PXL || join(homedir(), '.claude/skills/pxl-pixel-art/bin/pxl.js');
rmSync('art/out', { recursive: true, force: true });
rmSync('art/office/out', { recursive: true, force: true });
rmSync('art/ui/out', { recursive: true, force: true });
rmSync('art/yard/out', { recursive: true, force: true });
for (const f of ['art/shaft.px.js', 'art/mine.px.js', 'art/chibi.px.js', 'art/chars.px.js', 'art/fx.px.js', 'art/buildings.px.js', 'art/buildings_gpt.px.js', 'art/yard/yard_anims.px.js', 'art/yard/buildings64.px.js', 'art/office/office_gpt.px.js', 'art/ui/ui.px.js'])
  execFileSync(process.execPath, [pxl, 'build', f], { stdio: ['ignore', 'ignore', 'inherit'] });

rmSync('public/art', { recursive: true, force: true });
for (const dir of ['sprites', 'anims']) {
  mkdirSync(`public/art/${dir}`, { recursive: true });
  cpSync(`art/out/${dir}`, `public/art/${dir}`, { recursive: true, filter: (f) => !f.endsWith('.gif') });
}
cpSync('art/ui/out/sprites', 'public/art/ui', { recursive: true });
// 사무소 (v0.9): 본체 그림 · 벽난로 불꽃 anim 도 게임이 씀
for (const f of ['sprites/office_base.png', 'anims/office_fire.png', 'anims/office_fire.json']) cpSync(`art/office/out/${f}`, `public/art/${f}`);
// 기준컷(pxl이 구운 장면): 첫 프레임 PNG만
mkdirSync('public/art/scenes', { recursive: true });
for (const [from, name] of [['art/out/scenes', 'surface'], ['art/out/scenes', 'shaft_night'], ['art/office/out/scenes', 'office_night'], ['art/office/out/scenes', 'office_day']])
  if (existsSync(`${from}/${name}.png`)) cpSync(`${from}/${name}.png`, `public/art/scenes/${name}.png`);
// 부지 장면 (PATCH_V10): 낮·밤 첫 프레임 + 잠긴 터를 덮는 덤불
for (const n of ['yard_day', 'yard_dusk', 'yard_night']) cpSync(`art/yard/out/scenes/${n}.png`, `public/art/scenes/${n}.png`);
// PATCH_V13: 공사터 · 간판 판자 · 앞 수풀 · 숲 채우기
for (const n of ['lot_site_a', 'lot_site_b', 'lot_site_locked', 'lot_site_locked_b', 'yard_front', 'forest_fill', ...['pick', 'anvil', 'gear', 'bed', 'crate', 'gem', 'mug', 'cart', 'bag', 'flask'].map((k) => `sign_${k}`)]) cpSync(`art/yard/out/sprites/${n}.png`, `public/art/sprites/${n}.png`);
for (const n of ['bush_white', 'bush_pink', 'bush_orange']) cpSync(`art/yard/out/sprites/${n}.png`, `public/art/sprites/yd_${n}.png`);
for (const f of readdirSync('art/yard/out/sprites')) if (f.startsWith('g64_')) cpSync(`art/yard/out/sprites/${f}`, `public/art/sprites/${f}`);
for (const n of ['yard_ripple', 'yard_fire']) for (const ext of ['png', 'json']) cpSync(`art/yard/out/anims/${n}.${ext}`, `public/art/anims/${n}.${ext}`);
console.log('→ public/art');
