// pxl로 art/mine.px.js 를 빌드하고, 게임이 쓰는 PNG/JSON만 public/art 로 복사한다.  실행: npm run art
// pxl: crsolver/claude-pxl (MIT) — ~/.claude/skills/pxl-pixel-art 에 클론 (PXL 환경변수로 경로 바꿀 수 있음)
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const pxl = process.env.PXL || join(homedir(), '.claude/skills/pxl-pixel-art/bin/pxl.js');
execFileSync(process.execPath, [pxl, 'build', 'art/mine.px.js'], { stdio: 'inherit' });
rmSync('public/art', { recursive: true, force: true });
for (const dir of ['sprites', 'anims', 'scenes']) {
  mkdirSync(`public/art/${dir}`, { recursive: true });
  cpSync(`art/out/${dir}`, `public/art/${dir}`, { recursive: true, filter: (f) => !f.endsWith('.gif') || f.includes('mine_night') });
}
console.log('→ public/art');
