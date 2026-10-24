# v1.4 패치 — 부지(마을) 그림 전면 교체: The Fan-tasy Tileset 무료판 (형철 확정 10/24 21:58)

> 형철: "슬롭냄새 나는 GPT 그림 말고 이런 퀄(레퍼런스 3장)으로. 돈은 안 씀. 상업 이용 안 함."
> → **The Fan-tasy Tileset (Free) — Ventilatore** (비상업 무료판, 수정 가능, 재배포 금지). 마을 그림은 전부 이 팩 + 팩 73색 안에서만 손으로 찍은 조각.
> 이 패치가 **PATCH_V10 · V13(yard.px.js v2·v3)을 대체**한다. 옛 `art/yard/yard.px.js`, `yard_lots.json`, `g64_*`, `yd_*` 는 부지에서 더 안 씀.
> 광고·결제·"광고 보고 시간 단축" 같은 건 넣지 않는다(체크인·채굴 둘 다 상업 이용 안 함).

## 0. 파일 (전부 `public/art/yard5/`, 만든 스크립트: `sh scripts/build_yard5.sh "<팩 폴더>"` — 팩 원본은 저장소에 없음)
| 파일 | 내용 |
|---|---|
| `yard_ground_f0~3.png` | 960×540 바닥(풀·흙·길·둔덕·돌계단·개울). 개울 물결 4프레임 → **4fps로 갈아끼움** |
| `props/<n>.png` | 나무·덤불·바위·꽃·가로등·깃발·게시판·상자·갱도 입구 등 (팩 원본 그림) |
| `props/campfire_f0~7.png` | 모닥불 8프레임 (8fps) — `objects` 안의 `animation_campfire_f0` 자리에서 돌림 |
| `yard_v5.json` | `lots`(9) · `objects`(n, x, by) · `spine`/`branches`(길 중심선) · `entrance` · `campfire` · `idleSpots`(8) · `lamps`(6) · `credit_line` |
| `bld/<건물>_<1·3·5>.png` + `bld/anchors.json` | 건물 9종 × Lv1·3·5 (지붕 색·건물 소품 포함). `anchors[이름] = [ax, ay]` = 그림 안의 건물 바닥 가운데 |
| `bld/smoke_f0~5.png` + `anchors["smelter_N_smoke"]` | 대장간 굴뚝 연기 16×28, 6프레임 6fps. 자리 = 건물 그림 왼위 + 이 값 |
| `bld/lot_site_a/b/locked.png` (anchor `lot_site` = [90, 52]) | 빈 터(말뚝·밧줄·자재) a=짝수 id, b=홀수 id / 잠긴 터(덤불 우거짐) |
| `chars/miner_<brick·tumba·elin·grun>_walk.png`, `_idle.png` | 광부 40×48 프레임, 가로 4프레임 × 세로 4방향 **[오른, 왼, 뒤, 앞]**. 발 = (20, 41). walk 8fps · idle 4fps |
| `yard_mock.png` | 목표 화면(건물 몇 채 세운 합성). **이것과 다르면 틀린 것** |

## 1. 그리기 순서 (부지 화면)
1. `yard_ground_f{t}` (배경, 4fps)
2. **y정렬 한 무리**: `objects` 전부 + 건물(또는 빈 터) + 광부·두더지·광차 — 정렬 키 = 바닥 y(`by`). 그림 위치 = (x, by − 그림 높이). 나무 뒤로 광부가 지나가는 게 자연스러워야 함.
3. 밤 글로우(가로등 `lamps`, 모닥불, 창문) → UI.
- 장면 크기 960×540. **PC 2배 = 1920×1080 딱 맞음.** 폰 세로: 높이에 맞는 정수 배(1×)로 그리고 좌우 끌기, 처음엔 상회(lot 1) 가운데. 가로 폰: 1× 또는 2× 큰 쪽.
- 정수 배율·nearest만(흐림 금지).

## 2. 건물
- 터 9곳 `lots[i] = {cx, by}`. Lv → 그림: Lv1~2 → `_1`, Lv3~4 → `_3`, Lv5 → `_5`.
- 게임 건물 id → 그림 이름: office→office · smelter→smelter · warehouse→warehouse · cartShed→cartshed · lodge→lodge · lanternShop→lanternshop · pumpRoom→pump · turretShop→turretshop · moleHouse→molehome.
- 그리는 자리 = (cx − ax, by − ay). 빈 터 = `lot_site_a/b` 를 (cx − 90, by − 52), 잠긴 터 = `lot_site_locked`.
- 대장간(smelter)은 연기 6프레임을 굴뚝 자리에서 계속 돌림.
- 탭 영역: (cx − 90, by − 140, 180, 150). 짓기·옮기기 중 반짝임은 빈 터 그림 위에 기존 방식.
- 장식(모닥불·깃발·우물 등 6종)·어울림은 이 패치에서 **숨김** (명세6 재설계 때 다시 정함). 부지엔 고정 모닥불 광장이 이미 있음.

## 3. 사람
- 광부 4명(브릭·툼바·엘린·그룬)은 `chars/` 그림으로 교체. 나머지 광부·길드·상인·할아범·모모(두더지)는 다음 단계에서 같은 방식으로 다시 그림 — 그때까지는 옛 그림 유지.
- 걷기: `spine`·`branches` 중심선 따라, 방향 = 이동 방향(가로 우세 → 오른/왼, 세로 → 앞/뒤). 멈추면 idle.
- 라운드 밖: `idleSpots`에 흩어져 서 있다가 20~40초마다 다른 자리로. 라운드 중: 갱도 입구(`entrance`) ↔ 창고 건물 문 앞 왕복.

## 4. 낮·해질녘·밤
- 06–16 낮(색 그대로) · 16–20 해질녘(전부 곱하기 `0xffc8a0`) · 20–06 밤(`0x8890c8`). 바닥·소품·건물·사람 모두 같은 값.
- 밤·해질녘 글로우: `lamps` 6곳(r 18, `0xffd58a`, 0.55), 모닥불(r 30, `0xffb27a`, 0.6), 갱도 입구(r 24). 건물 창문 글로우는 기존 방식 유지.

## 5. 크레딧
설명서 끝(또는 설정 → 정보)에 한 줄: `credit_line` 그대로 — "타일·건물·나무: The Fan-tasy Tileset (Free) — Ventilatore".

## 6. 순서
1 바닥+objects y정렬+배율 → 2 건물·빈 터·연기 → 3 광부 4명 걷기/대기 → 4 시간대 색·글로우 → 5 크레딧. 1~4 끝나면 배포 + PC·폰 세로 스샷.
