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
//   art/yard.px.js         회사 부지 배경 (잔디·흙길·울타리·하늘)
// pxl: crsolver/claude-pxl (MIT) — ~/.claude/skills/pxl-pixel-art 에 클론 (PXL 환경변수로 경로 바꿀 수 있음)
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const pxl = process.env.PXL || join(homedir(), '.claude/skills/pxl-pixel-art/bin/pxl.js');
rmSync('art/out', { recursive: true, force: true });
rmSync('art/office/out', { recursive: true, force: true });
rmSync('art/ui/out', { recursive: true, force: true });
for (const f of ['art/shaft.px.js', 'art/mine.px.js', 'art/chibi.px.js', 'art/chars.px.js', 'art/fx.px.js', 'art/buildings.px.js', 'art/buildings_gpt.px.js', 'art/yard.px.js', 'art/office/office_gpt.px.js', 'art/ui/ui.px.js'])
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
console.log('→ public/art');
