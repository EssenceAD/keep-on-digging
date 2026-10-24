// PATCH_V15 §9: 빈 저장 새 브라우저에서 "손가락만 따라" 처음 10분을 끝까지 (node scripts/playtest_v15.cjs [url] [폭x높이])
// 인트로 건너뛰기 → 안내 5단계 → 판매 → 첫 원정(지도 → 싼 땅 → 시추 → 갱도로 삼기). 단계가 바뀔 때마다 docs/screens/v15/ 에 스샷.
// 손가락이 없으면 기다림 = 시간 빨리감기(엔진 lastTick 당기기 · 시추는 프레임 진행). 눌러도 화면이 안 바뀌는 곳이 이어지면 "막힘"으로 기록.
// Playwright: 전역 설치(npm i -g playwright) · 브라우저는 시스템 Chrome(channel: 'chrome')
const path = require('path'), fs = require('fs');
const PW = process.env.PW || path.join(process.env.APPDATA || '', 'npm/node_modules/playwright');
const { chromium } = require(fs.existsSync(PW) ? PW : 'playwright');

(async () => {
  const url = process.argv[2] || 'http://localhost:5181/';
  const [vw, vh] = (process.argv[3] || '1280x800').split('x').map(Number);
  const out = path.join(__dirname, '../docs/screens/v15' + (process.argv[4] ? '_' + process.argv[4] : '')); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });   // 새 프로필 = 빈 저장
  const page = await ctx.newPage();
  const errors = [], log = [], stuck = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on('crash', () => console.log('💥 crash', log.slice(-3)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  let shotN = 0;
  const shot = async (name) => { const f = path.join(out, `${String(++shotN).padStart(2, '0')}_${name}.png`); await page.screenshot({ path: f }); log.push(`📸 ${path.basename(f)}`); };
  await page.goto(url);
  await page.waitForFunction(() => window.__kod && window.__kod.introView, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await shot('intro');
  // 인트로 [건너뛰기] (오른쪽 위 버튼 자리)
  const sk = await page.evaluate(() => { const L = __kod.L; return { x: L.W - 31 * L.uiS, y: 13 * L.uiS }; });
  await page.mouse.click(sk.x, sk.y); await page.waitForTimeout(800);

  const state = () => page.evaluate(() => { const k = __kod, S = k.S; return {
    g: k.guide, h: k.hand, round: S.round?.state ?? null, mines: S.engine.mines.length, done: S.tutorial.done,
    fp: JSON.stringify([S.tutorial.mode, S.tutorial.step, k.upCard, !!document.getElementById('kpanel'), S.gold, S.round?.state, S.round?.shafts?.length, S.round?.shafts?.map((q) => q.dir), k.AU?.card?.name, S.round?.mineMade, S.engine.lv, Object.values(S.warehouse).reduce((a, b) => a + b, 0)]),
    text: [S.tutorial.mode, S.tutorial.step, S.round?.state ?? 'yard'].join('/'), gold: S.gold, lv: S.engine.lv }; });
  const wait = (sec) => page.evaluate((s) => { const k = __kod; if (k.S.round && ['SURVEY', 'DIG'].includes(k.S.round.state)) k.step(Math.round(s * 60)); else k.S.engine.lastTick -= s * 1000; }, sec);
  let lastKey = '', same = 0, lastAt = '';
  const t0 = Date.now();
  for (let i = 0; i < 900; i++) {
    const st = await state();
    const key = `${st.g.mode ?? 'free'}-${st.g.step}-${st.round ?? 'yard'}`;
    if (key !== lastKey) { await page.waitForTimeout(400); await shot(key.replace(/[^a-z0-9-]/gi, '_')); lastKey = key; log.push(`→ ${st.text} · 💰${st.gold} · Lv ${JSON.stringify(st.lv)}`); }
    if (st.done && st.mines >= 2 && !st.round) { await page.waitForTimeout(600); await shot('done'); log.push(`✅ 끝: 안내 완료 · 갱도 ${st.mines}개 · ${Math.round((Date.now() - t0) / 1000)}초`); break; }
    if (!st.h) { await wait(10); await page.waitForTimeout(150); continue; }   // 손가락 없음 → 기다림
    if (process.env.TRACE) console.log(i, st.text, JSON.stringify(st.h), st.gold);
    const at = st.h.dom ? `dom:${st.h.dom}` : `${Math.round(st.h.x)},${Math.round(st.h.y)}`;
    if (st.h.dom) await page.click(st.h.dom, { timeout: 1500, force: true }).catch(() => {}); else await page.mouse.click(st.h.x, st.h.y);
    await page.waitForTimeout(450);
    const after = await state();
    if (after.fp === st.fp) {                                           // 눌렀는데 아무것도 안 바뀜 → 시간이 필요한지 보려고 빨리감기
      same = at === lastAt ? same + 1 : 1; lastAt = at;
      await wait(15);
      if (same === 25) { stuck.push(`${st.text} @ ${at}`); await shot(`stuck_${st.text.replace(/\W/g, '_')}`); }
    } else { same = 0; lastAt = ''; }
  }
  const res = { errors: [...new Set(errors)].slice(0, 10), stuck, log };
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(res, null, 2));
  console.log(log.join('\n')); console.log('막힘:', stuck.length ? stuck : '0개'); console.log('오류:', res.errors.length ? res.errors : '0개');
  await browser.close();
  process.exit(stuck.length || res.errors.length ? 1 : 0);
})();
