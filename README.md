# 용사님, 채굴하실게요~ (Keep On Digging)

모험의 유산(체크인) 세계관 스핀오프 아이들러. 기획: `EssenceAD/legacy-of-adventure` → `docs/mining/MINING_SPEC_1_1024.md` · `MINING_VISUAL_1024.md`.

**지금 단계: HD-2D 비주얼 프로토타입 (명세 §10-2).** 형철 폰에서 "이 느낌 맞다" 확인 후 본 개발.

- 웹: https://essencead.github.io/keep-on-digging/  (`?low=1` 저사양 · `?ambient=0.4` 앰비언트 조절)
- 기준 그림: pxl 공식 예제 `no_magic_night` · 초안 구운 장면(shaft_night · office_night)은 화면 오른쪽 아래 [pxl 기준컷]

## 들어 있는 것 (비주얼 가이드 §4 · v0.2)
| 항목 | 구현 |
|---|---|
| 갱도 격자 12×16 | 화면 높이 = 9칸. 타일·소품은 형철 초안 `art/shaft.px.js` (흙 3 · 바위 · 단단한 바위 · 구리 · 은 · 금 · 발광 · 보석 · 갱도 · 갱목, 노멀맵) |
| 랜턴 1개 (런타임) | 끌어서 옮기는 랜턴 (power 0.8 · 반경 130). 노멀맵 결을 따라 빛이 훑고, 바위 속으로는 몇 px만 스민다 (`src/gl.js`) |
| 광원 | 벽 랜턴 2 · 광부 헤드램프 · 발광 광석(청록 맥동) — pxl처럼 채널별 max 합성, 앰비언트 0.4 회보라 |
| 광부 | 붉은 수염 광부: 초안 `miner`에 붉은 수염 + 곡괭이 4프레임 (`miner_red`), HUD에 64×64 초상 |
| 광차 1대 | 금맥 앞 → 수직갱 리프트 → 지상 창고 왕복, 바퀴 불꽃·먼지 |
| 곡괭이 주스 | 흔들림 2px · 히트 스톱 50ms · 파편 6개 · 금 쉬머 · 광석 숫자 → 창고로 빨려 감 |
| 큰 광맥 | 금을 처음 깨면 슬로모 0.4초 + 플래시 + 종 + "대박!" ([대박 연출] 버튼으로 다시 보기) |
| 패럴랙스 3겹 | 격자 양옆 2칸만: 먼 바위 0.2 · 기둥 0.5 · 앞 종유석 1.3 |
| 틸트 시프트 · 색온도 · 비네팅 | 위아래 10% 블러, 격자 영역은 마스크로 제외. 저사양에서 꺼짐 |
| 저사양 토글 | 후처리·헤일로·앞 겹 끔, 입자 상한 300→80, 그림자 샘플 12→6 |

## 구조
- `art/shaft.px.js` — 갱도 타일·소품 (형철 초안 그대로 + 끝에 Code 추가분: 빈 광차 · 붉은 수염 광부 · 금 쉬머)
- `art/office/office.px.js` — 사무소 내부 초안 (이름이 겹쳐서 폴더 분리)
- `art/mine.px.js` — 지상 띠(조명 구움) · 양옆 패럴랙스 바위 · HUD 아이콘
- `art/raw/mine_*.png` — GPT 캐릭터 원본 → `npm run portraits` → `public/assets/portraits/*.png` (64×64 최근접 · 마젠타 제거)
- `npm run art` — pxl 빌드 → `public/art/` (pxl: `crsolver/claude-pxl`, `~/.claude/skills/pxl-pixel-art` 또는 `PXL=…/bin/pxl.js`)
- `src/main.js` 장면·입력·주스·HUD / `src/gl.js` 조명 합성·후처리 / `src/sound.js` 합성 효과음
- 렌더: 알베도 RT + 노멀 RT → 조명 셰이더 → 발광·헤일로 → 후처리 → 확대 (장면 높이 144px = 9칸)

## 명령
```bash
npm install
npm run dev      # 로컬
npm run art        # 아트 다시 굽기
npm run portraits  # 캐릭터 초상 다시 뽑기
npm run deploy   # gh-pages 배포
```
