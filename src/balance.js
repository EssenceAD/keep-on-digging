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
  // v0.8 (PATCH_V08 §3): 텀오일식 — [올리기 +10%] 하나 + [포기]. 길드는 한도까지 즉시 따라옴. 2초 동안 아무도 안 올리면 낙찰
  auction: {
    raiseStep: 0.10,
    guildReact: 0.4,                // 플레이어가 올린 뒤 길드가 따라오기까지 (초)
    hammerSeconds: 2,               // 아무도 안 따라오면 이만큼 뒤 낙찰 (3·2·1)
    valueSpread: 0.25,              // 카드의 예상 가치 범위 ±25% (특성 「탐사 4」면 valueSpreadTalent)
    valueSpreadTalent: 0.10,
    valueNoise: 0.15,               // 예상 가치 중간값이 실제 광맥 가치에서 이만큼까지 어긋남 (그래서 "예상")
    profitOk: 0.3,                  // 이익 막대: (예상 − 현재가)/예상 ≥ 0.3 초록 · ≥ 0 노랑 · 그 밑 빨강
    startShare: 0.35,               // v0.8-b: 시작가 = 예상 가치(중간) × 0.35 (크기별 기본가보다 낮아지진 않음) — 길드 한도(0.45~0.8)까지 몇 번 누르면 닿게
  },
  guilds: [                         // 한도 = 예상 가치(중간) × 길드 눈대중(±guildSpread) × 계수
    { name: '심연낚시 동호회', style: 'aggressive', cap: 0.8 },     // 예상 가치의 0.8배까지 (명세는 1.3 — 그러면 이길 때마다 손해라 낮춤)
    { name: '탑오르는중', style: 'careful', cap: 0.6 },
    { name: '방패장인 조합', style: 'random', capMin: 0.45, capMax: 0.9 },
  ],
  freePlot: { size: 'S', veinScale: 0.5 },   // 낙찰 못 하면 공짜 구획: 힌트 없음, 광맥 적음

  // ---------------------------------------------------------------- 격자 생성 (§5-1)
  oreMix: { C: 50, s: 30, g: 15, j: 4, c: 1 },   // 구리·은·금·보석·발광 비율 (뒷산)
  depthWeight: 1.5,                 // 깊을수록 귀한 광종 가중 (맨 아래 줄에서 ×1.5)
  veinsPerRow: 0.52,                // 줄당 광맥 덩어리 수 (v0.8: +30% — 진행이 빨라진 만큼 라운드 5~8분 유지)
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
  diggers: 2,                       // v0.8: 선두 2명이 동시에 캐고 나머지는 운반
  carrierWalkUp: 2,                 // 운반 광부: 광차가 이만큼(초) 없으면 직접 지상 창고까지
  surveySeconds: 15,
  xrayPerDay: 2,                    // 투시 랜턴 하루 횟수 (이번 단계 고정)
  xraySeconds: 2,
  moleSniffDepth: 3,                // 두더지가 아래 몇 칸까지 맡나
  moleSpeed: 14,                    // px/초 (지상)
  // 명세5 §1 탐사 도구 — Lv1부터 (장비 탭 업글은 3단계에서 upgrades 표로)
  tools: {
    vibro: { seconds: 3 },          // 진동계 결과까지 (횟수·범위·색은 upgrades.vibro)
    sizeWords: [[4, '작은'], [8, '중간'], [99, '큰']],                                         // 진동계 크기 말 (칸 수 이하)
    clue: { perVein: 0.7, truth: 0.5, cave: 0.6, water: 0.6 },                                // 지표 단서: 광맥마다 확률 · 참 비율 · 빈 공간·지하수 단서 확률
  },

  // ---------------------------------------------------------------- 장비 (명세5 §3) — 라운드 중에도 [장비] 탭에서 즉시. 회사 건물(building)과 같은 Lv
  // 값 배열은 Lv 자리 그대로(0부터). min = 처음 Lv. cost[lv] = 지금 Lv → 다음 Lv 값 (라운드 순이익의 0.5~1.5배쯤)
  upgrades: {
    pick: { name: '곡괭이', min: 1, max: 5, cost: [0, 300, 800, 1800, 3500], tier: [0, 1, 2, 3, 3, 3], speed: [1, 1, 1, 1, 1.5, 1.5], double: [0, 0, 0, 0, 0, 1],
      steps: ['', '흙·바위', '단단한 바위', '고대석', '속도 ×1.5', '광맥 2칸 동시'] },
    cart: { name: '광차', building: 'cartShed', min: 1, max: 5, cost: [0, 250, 600, 1300, 2600], load: [0, 10, 12, 15, 18, 20], speed: [0, 3, 3.5, 4, 4.5, 5], carts: [0, 2, 2, 3, 3, 4] },
    lodge: { name: '숙소', building: 'lodge', min: 1, max: 5, cost: [0, 300, 700, 1500, 3000], miners: [0, 3, 4, 5, 6, 7], capHours: [0, 4, 4, 6, 6, 8] },
    warehouse: { name: '창고', building: 'warehouse', min: 1, max: 5, cost: [0, 150, 350, 800, 1600], cap: [0, 60, 120, 200, 320, 500] },
    mole: { name: '꼬물(두더지)', building: 'moleHouse', min: 1, max: 4, cost: [0, 200, 500, 1100], depth: [0, 3, 4, 6, 99], speed: [0, 14, 17, 20, 24], size: [0, 0, 0, 0, 1] },
    vibro: { name: '진동계', min: 1, max: 4, cost: [0, 200, 500, 1100], uses: [0, 2, 3, 4, 5], range: [0, 2, 2, 1, 1], color: [0, 0, 0, 1, 1] },
    lantern: { name: '투시 랜턴', building: 'lanternShop', min: 1, max: 4, cost: [0, 200, 500, 1100], xray: [0, 2, 3, 3, 4], radius: [0, 1, 1, 2, 2] },   // 반경 1 = 3×3 · 2 = 5×5
    smelter: { name: '제련', building: 'smelter', min: 0, max: 3, cost: [400, 900, 2000], sec: [0, 20, 15, 10], slots: [0, 1, 2, 3] },
    pump: { name: '펌프', building: 'pumpRoom', min: 0, max: 3, cost: [200, 500, 1000], price: [30, 20, 10, 0], auto: [0, 0, 0, 1] },
    turret: { name: '포탑', building: 'turretShop', min: 0, max: 3, cost: [350, 800, 1600], grade: [0, 1, 2, 3] },
  },

  // ---------------------------------------------------------------- 시추 (§5)
  pickTier: 1,                      // 곡괭이 등급: 1 = 바위까지
  hardness: { d: 1, r: 1, C: 1, s: 1, g: 1, j: 1, c: 1, w: 1, x: 1, R: 1, o: 1, h: 2, a: 3 },
  digTime: { d: 0.45, r: 1.2, ore: 0.8, w: 0.6, x: 0.6, R: 1.0, o: 0 },   // v0.8: 흙 0.6→0.45 · 바위 1.5→1.2 · 광맥 1.0→0.8
  walkSpeed: 2.2,                   // 칸/초
  climbSpeed: 1.6,
  carrySpeed: 1.8,
  waterSlow: 0.5,                   // 물 칸 이동 속도 배율
  carryPerTrip: 2,                  // 운반 광부가 한 번에 드는 광석
  pickupSeconds: 0.5,               // 흩어진 광석 조각 하나 줍는 시간
  bigVein: 12,                      // 이 칸 이상이면 큰 광맥 연출
  badCellFlash: 0.6,                // 못 뚫는 칸 빨간 X

  // ---------------------------------------------------------------- 광차 · 창고 (§5-3)
  cartCapacity: 10,
  cartSpeed: 3,                     // 칸/초
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
      cartShed: { name: '광차 차고', cost: 250, carts: [2, 2, 2, 3, 3, 4], load: [10, 12, 14, 16, 18, 20], speed: [3, 3.1, 3.2, 3.3, 3.4, 3.5] },   // v0.8: 기본 2대 · Lv3 3대 · Lv5 4대
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

  // ---------------------------------------------------------------- 폐광 2층 (§5) — 사무소 Lv3에서 해금, 경매 카드 셋 중 하나
  abandoned: {
    oreMix: { s: 35, g: 30, C: 15, j: 12, c: 8 },
    hardMul: 2,                     // 단단한 바위 2배
    caveMul: 2,                     // 빈 공간 2배
    relicMul: 2,                    // 유물 2배
    priceMul: 1.6,                  // 시작가 ×1.6
    tint: [0.78, 0.98, 1.16],       // 색온도 청록
    batChance: 0.12,                // 동굴 칸: 박쥐떼 (광부 1.5초 기절 · 등급 2)
    batStun: 1.5,
    batRadius: 2,
    batGrade: 2,
  },

  // ---------------------------------------------------------------- 일일 과제 (§6)
  daybook: { perDay: 3, reward: [50, 150] },

  // ---------------------------------------------------------------- 특성 트리 (§3): 3갈래 × 5단, 위에서부터 1점씩
  // ---------------------------------------------------------------- 광부 성격 (명세4 §5 · 명세5 §5) — 개인 숫자
  traits: {
    hasty: { name: '성급', text: '채굴 +10% · 사고 ×1.5', dig: 1.1, stun: 1.5 },
    calm: { name: '느긋', text: '운반 −10% · 가스 면역', carry: 0.9, gasImmune: true },
    careful: { name: '꼼꼼', text: '유물 +20% · 손 랜턴', relic: 1.2 },
    diligent: { name: '부지런', text: '운반 +10%', carry: 1.1 },
  },
  // 숙소 Lv업마다 다리에서 걸어오는 광부 (명세5 §5) — 이름 · 성격 · 그림(뚱보/금발 몸 + 빛깔)
  recruits: [
    { name: '도르', trait: 'hasty', body: 'brown' },
    { name: '핀', trait: 'diligent', body: 'blonde' },
    { name: '마르타', trait: 'careful', body: 'blonde' },
    { name: '우글', trait: 'calm', body: 'brown' },
  ],

  talents: {                       // 명세5 §4: 3갈래 × 8단, 위에서부터 1점씩. 포인트 = 라운드 별 수(최소 1) + 사무소 Lv
    minPerRound: 1,
    resetCost: 500,                 // 초기화 (처음 한 번은 무료)
    survey: ['힌트 아이콘 3개', '투시 랜턴 +1/일', '진동계 +1/일', '킁킁에 광종 색', '진동계 범위 ±1', '지표 단서 참 70%', '예상 가치 범위 좁게', '광맥 전체 실루엣'],
    dig: ['채굴 +10%', '흙 0.3초로', '광차 +1', '낙하 기절 ½', '채굴 +20%', '광차 적재 +5', '인접 광맥 발견', '광부 조 +1'],
    trade: ['판매가 +5%', '시세 1분 미리보기', '급등 예고 60초 전', '판매가 +10%', '선호 페널티 −5%', '급등 ×2.0', '대박 기준 12→10칸', '시세 고정 2회'],
    // 찍는 순간 화면에 튀는 숫자 (위 표와 같은 자리)
    pop: {
      survey: ['힌트 +1', '투시 +1', '진동계 +1', '광종 색!', '범위 ±1', '단서 70%', '가치 범위 ±', '실루엣!'],
      dig: ['채굴 +10%', '흙 0.3초', '광차 +1', '기절 ½', '채굴 +20%', '적재 +5', '인접 광맥!', '광부 조 +1'],
      trade: ['판매 +5%', '미리보기!', '예고 60초', '판매 +10%', '페널티 −5%', '급등 ×2.0', '대박 10칸', '고정 2회'],
    },
    digMul: [1.1, 1.2],             // 1단 · 5단
    dirtTime: 0.3,
    stunMul: 0.5,
    sellAdd: [0.05, 0.10],          // 1단 · 4단
    surgeWarnLong: 60,
    penaltyLow: 0.05,
    freezeSeconds: 60,
    freezePerDay: 2,
    previewTicks: 6,                // 1분 = 10초 틱 6개
    clueTruth: 0.7,
    surgeMul: 2.0,
    bigVein: 10,
    cartLoadAdd: 5,
    crewAdd: 2,                     // 광부 조 +1 = 광부 2명 + 캐는 사람 1명
    chainRange: 2,                  // 인접 광맥: 이 칸 거리 안
  },

  // ---------------------------------------------------------------- 엔진 (명세6-1): 캐기 → 나르기 → 창고 3단 병목 · 무한 업글 · 방치
  //  비용(Lv) = base × mul^(Lv − start) · 효과는 선형 + milestones Lv에서 ×2 (곡괭이 속도 · 광차 적재)
  engine: {
    startGold: 30,                                   // 새 게임 시작 금화 (엔진은 캐서 번 돈으로 크게)
    firstMine: { name: '뒷산 1호', rows: 10, reserve: 4000, depth: 1.0, oreMix: { C: 0.75, s: 0.17, g: 0.06, j: 0.01, c: 0.01 } },
    oreRank: { C: 0, s: 1, g: 2, j: 3, c: 3 },        // 깊을수록(depth) 귀한 쪽 가중: 비율 × depth^rank
    milestones: [10, 25, 50, 100],
    up: {
      pick: { name: '곡괭이', start: 1, base: 40, mul: 1.4 },        // 6-3 템포 맞춤 (1.15 → 1.4)       // 광부 1명 캐기/초 = pickBase × (1 + pickPerLv(Lv−1)) × 2^마일스톤
      lodge: { name: '숙소', start: 1, base: 150, mul: 1.6 },       // 광부 = 1 + Lv · 갱도 수 = 1 + ⌊Lv/3⌋ (최대 maxMines)
      cart: { name: '광차', start: 1, base: 60, mul: 1.4 },         // 적재 = 4 + 2Lv (×2^마일스톤) · 대수 = 1 + ⌊Lv/8⌋ · 왕복 = max(4, 10 − 0.2Lv)초
      warehouse: { name: '창고', start: 1, base: 50, mul: 1.14 },    // 용량 = ⌊60 × 1.22^(Lv−1)⌋ · 입구 더미 상한 = 용량 ÷ 3
      smelter: { name: '제련', start: 0, base: 400, mul: 1.3 },      // Lv1 해금 · 슬롯 = 1 + ⌊Lv/5⌋ · 시간 = max(3, 12 − 0.3Lv)초
    },
    pickBase: 0.10, pickPerLv: 0.25,
    cartLoad: [4, 2], cartsEvery: 8, trip: [10, 0.2, 4],
    whBase: 60, whMul: 1.22, pileDiv: 3,
    smelt: { slotsEvery: 5, sec: [12, 0.3, 3] },
    maxMines: 6, minesBase: 2, minesEvery: 3,          // 갱도 자리 = minesBase + ⌊(숙소Lv−1)/minesEvery⌋ (6-3 해금 #6: 숙소 전에 갱도 2개)
    reservePerCell: 200, depthMul: 0.8,              // 원정 → 갱도: reserve = 캔 광맥 칸 × 30 · depth = 1 + 최대깊이/줄 × 0.8
    idleCapHours: 2, idleCapPerLodge: 0.25, idleCapMax: 12,
    awayCardSeconds: 60,                            // 이만큼 넘게 떠나 있으면 돌아왔을 때 카드
  },

  // ---------------------------------------------------------------- 원정 (명세6-2): 지도 후보 3 · 이길 수 있는 경매 · 되사기 · 원정 → 갱도
  expedition: {
    tickets: 2, candidates: 3, rebuyChance: 0.25, rebuyMul: [1.3, 1.6], resaleMul: 0.5, resaleVeinMul: 0.3,
    cheap: { size: 'S', hints: 1, priceMul: 0.45 },                 // 고정가 = 예상 가치 중간 × 0.45 (경매 없음)
    normal: { size: 'M', hints: 2, guilds: 1 },
    prime: { size: 'L', hints: 2, glow: true, guilds: [2, 3], abandonedChance: 0.3 },
    auction: { startShare: 0.35, raiseStep: 0.10, hammer: 3, react: [0.8, 1.6], hesitate: 0.7, sweat: 0.9 },
    guildCap: { abyss: [0.55, 0.75], tower: [0.40, 0.55], shield: [0.35, 0.80] }, guildEye: 0.10,
    crew: [3, 3, 4, 4, 5],                                          // 숙소 Lv 1·2·3·4·5+ 원정대 인원 (그만큼 엔진 광부가 빠짐)
    guildStart: { asset: 2000, mines: 1 },                           // 길드 자산·갱도 (땅을 가져갈 때마다 + 예상 가치 · +1)
    guildRatePerMine: 1.2,                                           // 길드 생산/초 = 갱도 수 × 이것 (순위용)
    newsOre: [8, 30],                                                // 길드가 가져간 땅 소식: 광석 n개
  },

  // ---------------------------------------------------------------- 해금 템포 (명세6-3 §1): 조건 충족 순간 모모 한 줄 + 반짝. 목표 #5≈6분 · #8≈20분 · #10≈40분 · #13≈60분
  //  cond: [종류, 값] — pickLv 곡괭이 Lv · cartLv · whFull 창고 첫 가득 · sold 누적 판매 · rate 생산/초 · mines 갱도 수 · expeditions 원정 횟수 · relics 유물 수 · smeltLv
  unlocks: [
    { id: 1, cond: ['start', 0], opens: ['pick'], line: '탭해서 곡괭이부터 갈아요!' },
    { id: 2, cond: ['pickLv', 3], opens: ['cart'], line: '캐는 게 빨라지니 나르는 게 밀리네요' },
    { id: 3, cond: ['whFull', 1], opens: ['warehouse', 'sellAll'], line: '창고가 꽉! 팔거나 넓히거나' },
    { id: 4, cond: ['sold', 500], opens: ['buyers'], line: '브로크 아저씨는 구리를 좋아해요' },
    { id: 5, cond: ['rate', 0.5], opens: ['expedition'], line: '새 땅을 사서 갱도를 늘려봐요' },
    { id: 6, cond: ['mines', 2], opens: ['lodge'], line: '갱도가 둘! 숙소를 넓혀 광부를 늘려요' },
    { id: 7, cond: ['sold', 3000], opens: ['smelter'], line: '괴로 만들면 1.6배!' },
    { id: 8, cond: ['expeditions', 2], opens: ['auction'], who: 'guilds', line: '길드들이 원정 땅에 관심을 보여요' },
    { id: 9, cond: ['pickLv', 10], opens: ['vibro', 'lantern'], line: '곡괭이 ×2! 원정 도구도 올릴 수 있어요' },
    { id: 10, cond: ['sold', 250000], opens: ['foreman1'], line: '이제 판매는 맡겨도 돼요' },
    { id: 11, cond: ['relics', 1], opens: ['showcase'], line: '유물은 진열장에 모아 둬요' },
    { id: 12, cond: ['mines', 3], opens: ['abandoned'], line: '폐광 땅이 지도에 나오기 시작해요' },
    { id: 13, cond: ['rate', 50], opens: ['shares'], who: 'halabeoji', line: '이 마을 조합장 자리가… 곧 지분 경매가 열리네' },
  ],
  // ---------------------------------------------------------------- 십장 (명세6-3 §2): 반복 자동화 · 방치 중에도 일함
  foremen: {
    marta: { name: '판매 십장 마르타', who: 'miner_marta', open: 'foreman1', cost: 2000, fill: 0.7, pct: 1.0 },   // 창고 fill 넘고 시세 ≥ 평균 × pct면 자동 판매
    dor: { name: '제련 십장 도르', who: 'miner_dor', need: ['smelter', 5], cost: 5000 },                              // 제련 칸이 비면 가장 비싼 광석부터
    fin: { name: '운반 십장 핀', who: 'miner_fin', need: ['cart', 15], cost: 8000, tripMul: 0.85, extraCart: 1 },     // 왕복 −15% · 더미 가득이면 광차 +1
  },
  // 특성 (명세6-3 §3): 포인트 = 평판 + 원정 ★3 땅마다 1 · 갈래마다 두 칸은 둘 중 하나만 (칸 번호 0부터)
  talentChoice: { survey: [[2, 3], [5, 6]], dig: [[1, 2], [4, 5]], trade: [[2, 3], [5, 6]] },

  // ---------------------------------------------------------------- 지역 · 조합 지분 · 이사 (명세6-4)
  region: [
    { name: '뒷산', mix: { C: 50, s: 30, g: 15, j: 4, c: 1 } },
    { name: '안개 계곡', mix: { C: 30, s: 35, g: 25, j: 7, c: 3 }, water: 2, line: '물이 많아요. 펌프를 챙겨요' },
    { name: '붉은 협곡', mix: { C: 20, s: 30, g: 30, j: 12, c: 8 }, hard: 2, gasMul: 2, line: '단단한 바위와 가스가 두 배예요' },
    { name: '얼음 동굴', mix: { C: 10, s: 25, g: 35, j: 18, c: 12 }, stunMul: 1.6, line: '떨어지면 오래 기절해요 · 발광석이 많아요' },
  ],
  shares: {
    everyDays: 1,                    // 지분 경매 간격 (게임일 = 현실 24분). 명세는 7일 — 그러면 50%까지 11시간이라 2~3시간 목표에 맞춰 1일
    chunk: 10, win: 50,              // 한 번에 10% · 50% 먼저 = 조합장
    guildCapMul: 0.15,               // 길드 한도 = 자산 × 0.15
    startMul: 0.5,                   // 시작가 = 가장 낮은 길드 한도 × 0.5
    sellPerPct: 0.005,               // 지분 1%마다 판매가 +0.5%
    guildIncome: 13,                 // 길드 자산 증가/초 = 생산/초 × 이 값 (길드도 같이 큼)
    guildMinePerDay: 1,              // 날마다 길드 갱도 +1
  },
  prestige: {
    base: { chief: 2, occupied: 1 }, soldDiv: 50000,   // 평판 = 기본 + ⌊√(지역 누적 판매 ÷ 50,000)⌋ (점령이면 절반)
    prodPerRep: 0.25, goldPerRep: 300,                  // 평판 1마다 생산 +25% · 시작 금화 +300 (특성 +1은 talentPoints)
    loop2: { reserveMul: 1.5, guildCapMul: 1.3 },        // 지역 4 다음 = 2회차
  },
};
