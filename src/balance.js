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

  // ================================================================ 명세3 (MINING_SPEC_3_IDLE_1024.md)
  // ---------------------------------------------------------------- 방치 (§1)
  idle: {
    cellsPerMinerMinute: 0.5,       // 분당 = 광부 수 × 곡괭이 등급 × 0.5칸 (3명·등급1 = 시간당 90칸)
    capHours: 4,                    // 방치 상한 (숙소 Lv3 6h · Lv5 8h)
    minAwaySeconds: 60,             // 이보다 짧게 떠났으면 카드 안 띄움 (체크인 minSecondsForSummary)
    marketMaxHours: 24,             // 떠나 있던 동안 시세 빨리감기 상한 (24h = 8,640틱)
  },

  // ---------------------------------------------------------------- 회사 (§2) — 값 배열은 Lv0(안 지음)~Lv5. 비용 = Lv1 비용 × costMul[다음 Lv-1]
  company: {
    baseCols: 6, rows: 4,           // 부지 슬롯 6×4, 사무소 Lv마다 +1열 (Lv5 = 10×4)
    officeCost: [800, 2000, 5000, 12000],   // 사무소 Lv1→2 · 2→3 · 3→4 · 4→5
    lPlotLv: 2,                     // 사무소 Lv2부터 L 구획이 경매에
    mineLv: 3,                      // Lv3 폐광 (명세3 §5)
    costMul: [1, 2.2, 4.5, 9, 18],
    harmonyRange: 1,                // 어울림: 슬롯 사이 빈칸 1 이하(대각선 포함) — 체크인 harmony.ts gap()
    buildings: {
      warehouse: { name: '창고', cost: 150, cap: [60, 120, 200, 320, 400, 500] },
      cartShed: { name: '광차 차고', cost: 250, carts: [1, 1, 1, 2, 2, 2], load: [8, 10, 12, 14, 15, 16], speed: [2, 2.1, 2.2, 2.3, 2.4, 2.5] },
      lodge: { name: '광부 숙소', cost: 300, miners: [3, 4, 5, 5, 6, 6], capHours: [4, 4, 4, 6, 6, 8] },
      smelter: { name: '제련소', cost: 400, sec: [0, 20, 17, 15, 12, 10], slots: [0, 1, 1, 2, 2, 3] },
      lanternShop: { name: '랜턴 공방', cost: 200, xray: [2, 3, 4, 4, 5, 6], radius: [1, 1, 1, 2, 2, 2] },   // 반경 1 = 3×3 · 2 = 5×5
      pumpRoom: { name: '펌프실', cost: 200, pump: [30, 20, 10, 0, 0, 0], auto: [0, 0, 0, 0, 1, 1] },
      turretShop: { name: '포탑 공방', cost: 350, grade: [0, 1, 2, 3, 4, 5] },            // 몬스터 등급 ≤ 포탑이면 자동 처치
      moleHouse: { name: '두더지 집', cost: 200, survey: [15, 16, 17, 18, 19, 20], depth: [3, 3, 4, 4, 5, 5], size: [0, 0, 0, 0, 1, 1] },
    },
    decos: {                        // 한 종류에 하나씩
      campfire: { name: '모닥불', cost: 120 },
      flag: { name: '깃발', cost: 100 },
      well: { name: '우물', cost: 150 },
      flowers: { name: '꽃밭', cost: 80 },
      scales: { name: '저울', cost: 200 },
      railDeco: { name: '레일 장식', cost: 120 },
    },
    harmonies: [
      { id: 'rest', a: 'lodge', b: 'campfire', name: '모닥불 곁 숙소', text: '방치 속도 +10%', fx: { idleMul: 0.10 } },
      { id: 'banner', a: 'office', b: 'flag', name: '깃발 단 사무소', text: '경매 평가액 −5%', fx: { guildMul: -0.05 } },
      { id: 'cool', a: 'smelter', b: 'well', name: '우물가 제련소', text: '제련 속도 +15%', fx: { smeltMul: 0.15 } },
      { id: 'garden', a: 'moleHouse', b: 'flowers', name: '꽃밭 두더지 집', text: '탐사 +5초', fx: { surveyAdd: 5 } },
      { id: 'fair', a: 'warehouse', b: 'scales', name: '저울 단 창고', text: '판매가 +3%', fx: { sellMul: 0.03 } },
      { id: 'rails', a: 'cartShed', b: 'railDeco', name: '레일 깔린 차고', text: '광차 속도 +10%', fx: { cartMul: 0.10 } },
      { id: 'watch', a: 'turretShop', b: 'flag', name: '망루 포탑', text: '포탑 등급 +1', fx: { turretAdd: 1 }, hidden: true, hint: '포탑 공방 곁에 휘날리는 것' },
      { id: 'night', a: 'lanternShop', b: 'campfire', name: '불씨 랜턴', text: '투시 랜턴 +1/일', fx: { xrayAdd: 1 }, hidden: true, hint: '랜턴 공방 곁에 꺼지지 않는 불' },
    ],
    smeltMul: 1.6,                  // 괴 = 광석 가격 × 1.6
    ingotVolatility: 0.5,           // 괴는 시세 변동 ½ (안전자산)
  },

  // ---------------------------------------------------------------- 특성 트리 (§3): 3갈래 × 5단, 위에서부터 1점씩
  talents: {
    star3PerPoint: 10,              // 사무소 Lv당 1점 + 라운드 ★3 10회마다 1점
    resetCost: 500,                 // 초기화 (사무소 Lv1일 때 한 번은 무료)
    survey: ['힌트 아이콘 3개', '투시 랜턴 +1/일', '킁킁에 광종 색', '카드에 광맥 총량', '공짜 구획 힌트 1'],
    dig: ['곡괭이 2 · 단단한 바위', '맨땅 0.6 → 0.45초', '낙하 기절 ½', '곡괭이 3 · 고대석', '인접 광맥 발견'],
    trade: ['시세 1분 미리보기', '판매가 +5%', '급등 예고 60초 전', '선호 페널티 −5%', '하루 1회 시세 고정'],
    dirtTime: 0.45,
    stunMul: 0.5,
    sellAdd: 0.05,
    surgeWarnLong: 60,
    penaltyLow: 0.05,
    freezeSeconds: 60,
    previewTicks: 6,                // 1분 = 10초 틱 6개
    veinRange: 0.2,                 // 카드에 광맥 총량 ±20%
    chainRange: 2,                  // 인접 광맥: 이 칸 거리 안
  },
};
