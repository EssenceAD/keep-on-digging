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

## 3. 사람·두더지·광차 (전부 교체 — 옛 GPT 치비·초상 그림은 더 안 씀)
- `chars/<id>_walk.png`·`_idle.png` 15명 (40×48 프레임, 가로 4 × 세로 [오른, 왼, 뒤, 앞], 발 (20, 41)):
  광부 `miner_brick·tumba·elin·grun·dor·fin·marta·ugle` (안전모+헤드랜턴) · `npc_halabeoji`(흰머리·흰수염) · `npc_momo`(보라 마법사 모자) · `npc_brok`(붉은 수염 대장장이) · `npc_merchant`(챙모자) · `npc_guild_abyss`(어부 모자·붉은 수염) · `npc_guild_tower`(고글) · `npc_guild_shield`(회색 두건).
- 옛 이름 → 새 그림: `red_*`→miner_brick · `brown_*`→miner_tumba · `blonde_*`→miner_elin · 숙소 신입(recruits) 도르·핀·마르타·우글 → miner_dor/fin/marta/ugle · `npc_*` 같은 이름.
- **초상(말풍선·경매·설명서)**: 따로 그림 없이 그 인물 `_idle` 앞모습(세로 4번째 줄) 0프레임을 **2배**로, 초상 틀 안에 발 아래 잘라 상반신만(위 32px). 경매 길드 3명도 같음(옛 64×80 그림 삭제).
- 꼬물(두더지): `critters/mole_idle.png`(24×18 ×4, 킁킁 4fps) · `mole_walk.png`(×4, 8fps, 오른쪽 보기 — 왼쪽은 좌우 뒤집기). 옛 `mole_sniff` 대체.
- 광차: `critters/cart_empty/ore/gold/glow.png`(28×22) · 굴러갈 땐 `cart_roll(_ore/_gold/_glow).png` 바퀴 4프레임 10fps. 옛 `cart_*`·`cart_roll*` 대체.
- 걷기: `spine`·`branches` 중심선 따라, 방향 = 이동 방향(가로 우세 → 오른/왼, 세로 → 앞/뒤). 멈추면 idle.
- 라운드 밖: `idleSpots`에 흩어져 서 있다가 20~40초마다 다른 자리로. 라운드 중: 갱도 입구(`entrance`) ↔ 창고 건물 문 앞 왕복.

## 3-1. 갱도 안 타일 (같은 이름 그대로 교체)
- `shaft/` 의 16×16 타일 18종 + 노멀맵 12장: dirt_1~3 · rock · hard_rock · ancient · ore_copper/silver/gold · gem · pocket_water/gas · relic_chest · cave · tunnel · tunnel_beam · ladder · rail(16×4).
- `scripts/art.mjs` 맨 끝에 `public/art/yard5/shaft/*.png` → `public/art/sprites/` 복사 한 줄 (pxl 빌드가 덮어쓰지 않게 마지막에). 시험 그림: `shaft/shaft_sample.png`.
- 아이콘·힌트·별·X 표시(작은 UI 조각)는 그대로.

## 3-2. 회사 사무실 내부 장면 삭제
- `office_day/office_night`(옛 GPT 통그림) 안 씀. 인수인계·튜토리얼 대사는 **부지 화면, 상회(lot 1) 앞**에서: 할아범·모모가 상회 문 앞에 서서 말풍선. 첫 화면도 부지(밤 → 아침).

## 4. 낮·해질녘·밤
- 06–16 낮(색 그대로) · 16–20 해질녘(전부 곱하기 `0xffc8a0`) · 20–06 밤(`0x8890c8`). 바닥·소품·건물·사람 모두 같은 값.
- 밤·해질녘 글로우: `lamps` 6곳(r 18, `0xffd58a`, 0.55), 모닥불(r 30, `0xffb27a`, 0.6), 갱도 입구(r 24). 건물 창문 글로우는 기존 방식 유지.

## 5. 크레딧
설명서 끝(또는 설정 → 정보)에 한 줄: `credit_line` 그대로 — "타일·건물·나무: The Fan-tasy Tileset (Free) — Ventilatore".

## 6. 순서
1 바닥+objects y정렬+배율 → 2 건물·빈 터·연기 → 3 사람 15명·꼬물·광차 교체 + 초상 → 3-1 갱도 타일 → 3-2 사무실 장면 삭제 → 4 시간대 색·글로우 → 5 크레딧. 1~4 끝나면 배포 + PC·폰 세로 스샷.
