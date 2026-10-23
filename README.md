# 용사님, 채굴하실게요~ (Keep On Digging)

모험의 유산(체크인) 세계관 스핀오프 아이들러. 기획: [`docs/MINING_SPEC_1_1024.md`](docs/MINING_SPEC_1_1024.md) · [`docs/MINING_VISUAL_1024.md`](docs/MINING_VISUAL_1024.md).

**지금 단계: HD-2D 비주얼 프로토타입 v0.4 (명세 §10-2 · 비주얼 가이드 §10·§10-1).** 형철 폰에서 "이 느낌 맞다" 확인 후 본 개발.

- 웹: https://essencead.github.io/keep-on-digging/  (`?low=1` 저사양 · `?ambient=0.4` 앰비언트 조절)
- 기준 그림: pxl 공식 예제 `no_magic_night` · 초안 구운 장면(shaft_night · office_night)은 [설정] → [pxl 기준컷]

## 화면 (v0.4 · 세로 기본 반응형 §6-1 · 칸 36px 이상 §10)
| 세로 폰 390×844 | 패드 820×1180 | PC 1440×900 |
|---|---|---|
| [![세로 폰](docs/screens/phone.png)](docs/screens/phone.png) | [![패드](docs/screens/pad.png)](docs/screens/pad.png) | [![PC](docs/screens/pc.png)](docs/screens/pc.png) |
| 칸 36px(12칸 = 432px라 양옆 21px씩 잘림 · 끌어서 봄) · 위 HUD · 아래 시트(판매·광부·설정 탭) | 칸 = (높이 − HUD − 시트)/17 · 남는 양옆에 패럴랙스 바위 | 칸 = min(너비/12, 높이/18) · 왼쪽 HUD·광부·설정 / 오른쪽 판매 창 |

## 들어 있는 것 (비주얼 가이드 §4)
| 항목 | 구현 |
|---|---|
| 갱도 격자 12×16 | 타일·소품은 형철 초안 `art/shaft.px.js` (흙 3 · 바위 · 단단한 바위 · 구리 · 은 · 금 · 발광 · 보석 · 갱도 · 갱목, 노멀맵) |
| 랜턴 1개 (런타임) | 끌어서 옮기는 랜턴 (power 0.8 · 반경 130). 노멀맵 결을 따라 빛이 훑고, 바위 속으로는 몇 px만 스민다 (`src/gl.js`) |
| 광원 | 벽 랜턴 2 · 광부 헤드램프 · 발광 광석(청록 맥동) — pxl처럼 채널별 max 합성, 앰비언트 0.4 회보라 |
| 캐릭터 (v0.4) | §10 품질 2등신 치비 32×40 — GPT 그림 4장(`art/raw/mine_*chibi*.png`)을 `scripts/png2pxl.py`로 변환(`sh scripts/chibi.sh`) → `art/chibi.px.js`. 타일의 2배 밀도로 그려 1칸 폭·1.25칸 높이 |
| 인게임 | 붉은 수염(금맥 곡괭이질 6f: 예비 2·타격 1·반동 3, 머리 위 말풍선) · 뚱보 갈색 수염(샌드위치)·금발(손 랜턴이 실제로 빛남)은 위 갱도를 쉬고 걷기(걷기 6f · 숨쉬기 2f) · 꼬마 두더지(지상 킁킁 2f) · 광차(GPT 광차 기준, 바퀴살 4f + 덜컹 1px) |
| 긴 그림자 | 캐릭터·광차마다 스프라이트 복제 + skew + alpha 0.35, 끌고 다니는 랜턴 반대쪽으로 기울고 가까울수록 길어짐 |
| UI 틀 안 인물 | 판매 창 매입자(브로크·떠돌이 상인), 광부 탭(붉은 수염), 알림(모모·할아범) — 갱도 안에는 인물 그림 없음 |
| 이펙트 시트 | `art/fx.px.js` 10종 48×48 × 6~8f: 타격 스파크 · 흙 파편 · 바위 파편 · 광맥 터짐(금/발광) · 대박 · 가스 · 지하수 · 붕괴 먼지 · 광차 불꽃 · 시세 급등 펄스. 갱도 사건(붕괴·가스·지하수)이 20~35초마다, [설정] → [이펙트 10종]·[사건 보기] |
| 광차 1대 | 금맥 앞 → 수직갱 리프트 → 지상 창고 왕복, 바퀴 불꽃·먼지 |
| 곡괭이 주스 | 흔들림 2px · 히트 스톱 50ms · 파편 6개 · 금 쉬머 · 광석 숫자 → HUD/판매 창으로 빨려 감 |
| 큰 광맥 | 금을 처음 깨면 슬로모 0.4초 + 플래시 + 종 + "대박!" ([설정] → [대박 연출]로 다시 보기) |
| 판매 창 | 광종별 수량 · 시세(10초마다 ±3~12% 랜덤 워크) · ↑↓ · 최근 막대 8개 · [팔기] [절반] [전부 팔기]. 줄을 누르면 매입자 초상(브로크 / 떠돌이 상인) |
| 패럴랙스 3겹 | 세로: 위(밤하늘 0.2) · 아래(깊은 어둠 0.2 · 석순 0.5 · 앞 바위 1.3) / 가로: 격자 양옆 2칸(0.2 · 0.5 · 1.3). 랜턴 쪽으로 카메라가 살짝 기울어 겹이 움직인다 |
| 틸트 시프트 · 색온도 · 비네팅 | 세로 위아래 8% · 가로 10% 블러, 격자 영역은 마스크로 제외. 저사양에서 꺼짐 |
| 저사양 토글 | 후처리·헤일로·앞 겹 끔, 입자 상한 300→80, 그림자 샘플 12→6 |
| UI | `art/ui/ui.px.js` (나무·돌·양피지) 조각을 PixiJS `NineSliceSprite`로 — HUD(나무) · 하단 시트(돌) · 판매 창(양피지) · 버튼 4상태 · 탭 · 바 · 슬롯 |

## 구조
- `art/shaft.px.js` — 갱도 타일·소품 (형철 초안 그대로 + 끝에 Code 추가분: 금 쉬머 · 말풍선 3. 예전 임시 광부·광차는 더 안 씀)
- `art/chibi.px.js` — §10 캐릭터: 팔레트(갱도 팔레트 + 두더지 털·분홍·망토 초록·모모 보라) + png2pxl 결과 + 손으로 만든 프레임(잘라 옮겨 찍기·grid 패치)
  - `scripts/png2pxl.py`에 정리 옵션 `--samples 3`(칸 다수결) · `--clean`(마젠타 번짐 제거 + 외곽선 잉크 재추적) 추가 — 기본 꺼짐
- `art/fx.px.js` — 이펙트 시트 10종
- `art/chars.px.js` — §9 광부·광차 v2 (형철) — §10에서 치비로 교체돼 지금은 게임에서 안 씀
- `art/office/office.px.js` — 사무소 내부 초안 (이름이 겹쳐서 폴더 분리)
- `art/ui/ui.px.js` — UI 킷 (형철) → `public/art/ui/`
- `art/mine.px.js` — 지상 띠(조명 구움) · 위아래·양옆 패럴랙스 겹 · 광석 아이콘
- `art/raw/mine_*.png` — GPT 캐릭터 원본. 흉상 4장 → `npm run portraits` → `public/assets/portraits/*.png`(48×48, v0.4부터 화면엔 치비를 씀)
  - 48×48 최근접 축소 → shaft·office 팔레트(60색) 양자화 → 외곽선 `#1a1220` 1px 재추적 → 마젠타 제거 (디더링 없음, §5-1-2)
- `npm run art` — pxl 빌드 → `public/art/` (pxl: `crsolver/claude-pxl`, `~/.claude/skills/pxl-pixel-art` 또는 `PXL=…/bin/pxl.js`)
- `src/main.js` 장면·레이아웃·입력·주스·UI / `src/ui.js` UI 킷 런타임 / `src/market.js` 시세 / `src/gl.js` 조명 합성·후처리 / `src/sound.js` 합성 효과음
- 렌더: 알베도 RT + 노멀 RT → 조명 셰이더 → 발광·헤일로 → 후처리 → 확대 (화면 1px = 칸/32: 타일 1px은 2×2, 캐릭터·이펙트는 1:1), 그 위에 UI(정수 배율)

## 명령
```bash
npm install
npm run dev        # 로컬
npm run art        # 아트 다시 굽기
npm run portraits  # 흉상 초상 다시 뽑기
sh scripts/chibi.sh  # 치비 4장 → art/conv/*.txt (art/chibi.px.js에 붙임)
npm run deploy     # gh-pages 배포
```
스크린샷 다시 찍기: `npm run dev` 상태에서 브라우저 콘솔에 `await __kod.shot('phone')` → `docs/screens/phone.png` (dev 서버에서만 저장).
