// 「용사님, 채굴하실게요~」 밸런스 — 게임의 숫자는 전부 여기. (명세2 MINING_SPEC_2_LOOP_1024.md)
// 형철이 직접 바꾸는 파일. 단위: 시간 = 초, 돈 = 금화, 거리 = 칸.
export const B = {
  // ---------------------------------------------------------------- 공통
  startGold: 400,
  dayRealSeconds: 24 * 60,          // 현실 24분 = 게임 하루 (체크인 clock)
  dayStartHour: 6,                  // 새 게임은 1일차 06:00
  autosaveSeconds: 5,

  // ---------------------------------------------------------------- 경매 (§3)
  plotSizes: {                      // 격자 12 × rows
    S: { rows: 10, price: 120 },
    M: { rows: 14, price: 220 },
    L: { rows: 16, price: 360 },
  },
  cardsPerDay: 3,
  hintsPerCard: 2,
  hintValue: 0.15,                  // 평가액 = 시작가 × (1 + 힌트 수 × 0.15) × 길드별 ±10%
  guildSpread: 0.10,
  raises: [0.10, 0.25, 0.50],       // 플레이어 호가 버튼
  guilds: [
    { name: '심연낚시 동호회', style: 'aggressive', cap: 1.3, bigRaiseChance: 0.6 },   // 평가액 ×1.3까지, 60%로 +25% (아니면 +10%)
    { name: '탑오르는중', style: 'careful', cap: 1.0 },                               // 평가액 ×1.0까지, 항상 +10%
    { name: '방패장인 조합', style: 'random', capMin: 0.8, capMax: 1.4 },               // 평가액 ×(0.8~1.4), 호가 무작위
  ],
  aiBidDelay: 0.7,                  // 길드 호가가 하나씩 뜨는 간격(연출)
  freePlot: { size: 'S', veinScale: 0.5 },   // 낙찰 못 하면 공짜 구획: 힌트 없음, 광맥 적음

  // ---------------------------------------------------------------- 격자 생성 (§5-1)
  oreMix: { C: 50, s: 30, g: 15, j: 4, c: 1 },   // 구리·은·금·보석·발광 비율 (뒷산)
  depthWeight: 1.5,                 // 깊을수록 귀한 광종 가중 (맨 아래 줄에서 ×1.5)
  veinsPerRow: 0.4,                 // 줄당 광맥 덩어리 수 (L 16줄 ≈ 6개)
  veinSize: [3, 20],
  bigVeinChance: 0.55,              // 구획마다 큰 광맥(≥ bigVein칸) 하나가 있을 확률
  rockShare: 0.28,                  // 바탕 바위 비율 (힌트 🪨면 rockHint)
  rockHint: 0.45,
  hardShare: 0.10,                  // 단단한 바위
  ancientDepth: 0.75,               // 이 깊이 아래에 고대석 띠가 섞임
  ancientShare: 0.12,
  caves: [3, 5],                    // 빈 공간(동굴) 덩어리
  caveSize: [2, 5],
  relics: [0, 1],                   // 힌트 🏺면 1 확정
  waterHint: [1, 2],                // 힌트 💧 지하수 칸 수
  waterNoHint: [0, 1],
  gas: [0, 1],                      // 가스 주머니
  glowHintMul: 3,                   // 힌트 ✨ 발광 확률 ×3

  // ---------------------------------------------------------------- 탐사 (§4)
  surveySeconds: 15,
  xrayPerDay: 2,                    // 투시 랜턴 하루 횟수 (이번 단계 고정)
  xraySeconds: 2,
  moleSniffDepth: 3,                // 두더지가 아래 몇 칸까지 맡나
  moleSpeed: 14,                    // px/초 (지상)

  // ---------------------------------------------------------------- 시추 (§5)
  pickTier: 1,                      // 곡괭이 등급: 1 = 바위까지
  hardness: { d: 1, r: 1, C: 1, s: 1, g: 1, j: 1, c: 1, w: 1, x: 1, R: 1, o: 1, h: 2, a: 3 },
  digTime: { d: 0.6, r: 1.5, ore: 1.0, w: 0.6, x: 0.6, R: 1.0, o: 0 },
  walkSpeed: 2.2,                   // 칸/초
  climbSpeed: 1.6,
  carrySpeed: 1.8,
  waterSlow: 0.5,                   // 물 칸 이동 속도 배율
  carryPerTrip: 2,                  // 운반 광부가 한 번에 드는 광석
  pickupSeconds: 0.5,               // 흩어진 광석 조각 하나 줍는 시간
  bigVein: 12,                      // 이 칸 이상이면 큰 광맥 연출
  badCellFlash: 0.6,                // 못 뚫는 칸 빨간 X

  // ---------------------------------------------------------------- 광차 · 창고 (§5-3)
  cartCapacity: 8,
  cartSpeed: 2,                     // 칸/초
  cartUnloadSeconds: 1.0,
  warehouseCapacity: 60,

  // ---------------------------------------------------------------- 중력 (§1)
  fallPause: 0.15,
  fallAccel: 12.5,                  // 칸/초²
  fallMax: 6,                       // 칸/초
  landSeconds: 0.5,                 // 엉덩방아
  stunAt: 2, stunSeconds: 1.5,      // 2칸 이상 → 기절
  hurtAt: 4, hurtStunSeconds: 3,    // 4칸 이상 → 기절 3초 + 체력 −1
  cartSpill: 0.5,                   // 광차가 떨어지면 적재 절반이 흩어짐

  // ---------------------------------------------------------------- 광부 (§6)
  minerHp: 3,
  restSeconds: 10,                  // 체력 0 → 지상에서 쉼

  // ---------------------------------------------------------------- 사건 (§7)
  eventGap: [20, 60],
  eventsPerRound: [0, 2],
  collapseMinDug: 15,
  collapseLen: [2, 3],
  pumpCost: 30,
  pumpSeconds: 5,
  gasSeconds: 30,
  gasLanternCells: 2,               // 랜턴을 가스 칸 이 거리 안으로 끌면 폭발
  explosionRadius: 1,               // 3×3
  monsterChance: 0.10,
  monsterSeconds: 10,

  // ---------------------------------------------------------------- 시세 · 판매 (§8)
  basePrice: { C: 8, s: 18, g: 40, j: 90, c: 55 },
  priceTick: 10,
  priceStep: [0.03, 0.12],
  coefRange: [0.5, 2.0],
  meanRevert: 0.02,
  buyers: {
    brok: { name: '브로크 대장간', like: ['C', 's'], bonus: 0.15, penalty: 0.10 },
    merchant: { name: '떠돌이 상인', like: ['g', 'j', 'c'], bonus: 0.15, penalty: 0.10 },
  },
  surgesPerDay: [1, 2],
  surgeWarn: 30,                    // 모모 편지가 이만큼 먼저 온다
  surgeMul: 1.8,
  surgeSeconds: 40,

  // ---------------------------------------------------------------- 유물 · 결과 (§9)
  relicGold: [50, 200],
  stars: [0.5, 1.5, 3.0],           // 순이익 / 낙찰가

  // ---------------------------------------------------------------- 튜토리얼 (§11)
  tutorialSteps: 6,
};
