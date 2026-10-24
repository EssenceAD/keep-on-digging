// 명세6-3 §5 템포 시뮬: 새 계정이 "보이는 대로" 60분 플레이했을 때 해금 시각 (node scripts/tempo_sim.mjs [시드])
// 엔진·해금은 게임과 같은 코드(src/engine.js · src/unlocks.js · balance.js). 원정(시추 손플레이)만 평균값으로 대신함:
//   사람처럼: 업글은 8초에 하나 · 판매는 30초마다 · 원정 5분 · 그동안 원정대가 엔진에서 빠짐 · 라운드 판매 = 예상 가치 × 0.55 · 갱도 = 캔 광맥 칸(예상 가치 ÷ 15) × 30
import { B } from '../src/balance.js';
import * as E from '../src/engine.js';
import { checkUnlocks, isOpen } from '../src/unlocks.js';

let seed = +(process.argv[2] ?? 1);
if (process.argv[3]) { const o = JSON.parse(process.argv[3]); const deep = (a, b) => { for (const k in b) (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? deep(a[k], b[k]) : (a[k] = b[k])); }; const up = o.unlocksPatch; delete o.unlocksPatch; deep(B, o); if (up) { const [r5, e8, s10, r13] = up; const U = (id) => B.unlocks.find((q) => q.id === id); U(5).cond = ['rate', r5]; U(8).cond = ['expeditions', e8]; U(10).cond = ['sold', s10]; U(13).cond = ['rate', r13]; } }   // 숫자 시험: '{"engine":{"up":{"pick":{"mul":1.2}}}}'
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const S = { upgrades: {}, day: 0, gold: B.engine.startGold, unl: { got: {} }, round: null, stats: { relics: [] } };
E.ensureEngine(S);
const wh = { C: 0, s: 0, g: 0, j: 0, c: 0 }, price = B.basePrice;
const cap = () => E.whCapOf(S.engine.lv.warehouse), tot = () => Object.values(wh).reduce((a, b) => a + b, 0);
let sold = 0, whFull = 0, exps = 0, relics = 0, t = 0, expEnd = -1, expGain = 0, tickets = B.expedition.tickets, day = 0;
const log = [];
const sellAll = () => { let g = 0; for (const k in wh) { g += wh[k] * price[k]; wh[k] = 0; } S.gold += g; sold += g; };
const DAY = B.dayRealSeconds;
for (t = 0; t <= 3600; t += 0.5) {
  if (Math.floor(t / DAY) !== day) { day = Math.floor(t / DAY); tickets = B.expedition.tickets; }
  S.round = expEnd > t ? { state: 'DIG' } : null;
  if (expEnd > 0 && t >= expEnd) {                                     // 원정 끝 → 갱도로 삼기
    expEnd = -1; S.gold += expGain.rev; sold += expGain.rev; exps++;
    if (rnd() < 0.35) relics++;
    const cells = Math.round(expGain.mid / 15), mine = E.newMine(S.engine.nextId++, { name: '원정', rows: 10, reserve: cells * B.engine.reservePerCell, depth: 1 + (0.5 + rnd() * 0.4) * B.engine.depthMul, oreMix: B.engine.firstMine.oreMix });
    if (S.engine.mines.length >= E.mineSlots(S)) S.engine.mines.sort((a, b) => a.reserve - b.reserve).shift();
    E.addMine(S, mine);
  }
  E.engineStep(S, 0.5, wh, cap());
  if (t > 0 && t % 300 === 0) log.push(`   [${t / 60}분] 생산 ${Math.min(E.digRate(S), E.cartOf(S.engine.lv.cart).rate).toFixed(1)}/초 · 누적 판매 ${sold} · 원정 ${exps} · 갱도 ${S.engine.mines.filter((m) => m.reserve > 0).length} · Lv ${JSON.stringify(S.engine.lv)} · 광부 ${E.minersTotal(S)} · 깊이 ${S.engine.mines.map((m) => m.depth.toFixed(1)).join(',')} · 💰${Math.round(S.gold)}`);
  if (tot() >= cap()) whFull = 1;
  const ctx = { pickLv: S.engine.lv.pick, cartLv: S.engine.lv.cart, smeltLv: S.engine.lv.smelter, whFull, sold, rate: Math.min(E.digRate(S), E.cartOf(S.engine.lv.cart).rate), mines: S.engine.mines.length, expeditions: exps, relics };
  for (const u of checkUnlocks(S, ctx, t)) log.push(`#${u.id} ${String(Math.floor(t / 60)).padStart(2)}:${String(Math.round(t % 60)).padStart(2, '0')}  ${u.opens.join('·')}`);
  if (whFull && tot() >= cap() * 0.7 && t % 30 === 0) sellAll();                     // 처음 가득 차기 전엔 안 팖 (모르니까) · 그 뒤 70%면 팖
  // 업글: 병목 → 그에 맞는 것, 열린 것만
  const bn = E.bottleneck(S, tot(), cap()), open = (k) => isOpen(S, { pick: 'pick', cart: 'cart', warehouse: 'warehouse', lodge: 'lodge', smelter: 'smelter' }[k]);
  const want = bn === 'carry' && open('cart') ? 'cart' : bn === 'wh' && open('warehouse') ? 'warehouse' : open('lodge') && E.engineCost(S, 'lodge') < E.engineCost(S, 'pick') ? 'lodge' : 'pick';
  if (S.gold >= E.engineCost(S, want) && expEnd < 0 && t % 8 === 0) { S.gold -= E.engineCost(S, want); S.engine.lv[want]++; E.balanceMiners(S); }
  // 원정: 열렸고, 표 있고, 살 돈 있으면
  if (isOpen(S, 'expedition') && expEnd < 0 && tickets > 0) {
    const auction = isOpen(S, 'auction'), mid = auction ? 900 + rnd() * 700 : 400 + rnd() * 300, pay = mid * (auction ? 0.55 : B.expedition.cheap.priceMul);
    if (S.gold >= pay) { S.gold -= pay; tickets--; expEnd = t + 300; expGain = { mid, rev: Math.round(mid * 0.55) }; }
  }
}
console.log(log.join('\n'));
console.log(`60분: Lv ${JSON.stringify(S.engine.lv)} · 갱도 ${S.engine.mines.length} · 생산 ${Math.min(E.digRate(S), E.cartOf(S.engine.lv.cart).rate).toFixed(1)}/초 · 누적 판매 ${sold} · 원정 ${exps}`);
