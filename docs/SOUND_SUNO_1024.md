# 사운드 명세 — Suno 제작 가이드 (v1 · 2026-10-24)

> 형철이 Suno로 직접 만든다. 이 문서는 **곡 목록 · 프롬프트 · 길이 · 루프 규칙 · 파일명**. Code는 §5 통합 규칙만 보면 됨.
> 톤 한 줄: **따뜻한 드워프 광산 — 아코디언·민속 현악·나무 타악·멀리서 곡괭이 소리.** 밝지만 한 꺼풀 어둡고, 방치 게임답게 **질리지 않는 게 1순위**(멜로디 적고 질감 위주).

## 1. BGM — 곡별 카드 (위에서부터 하나씩. 각 카드가 Suno 입력 전부)

**기준 = 형철이 고른 타이틀 트랙**(`bgm_title` 확정본: 아코디언 + 나일론 기타, 따뜻하고 부드러움, 체감 약 90 BPM). 2~8번은 전부 **이 곡의 가족** — 같은 악기(아코디언·나일론 기타)를 중심에 두고 장면에 따라 **타악기만 조금 더하거나 빼는** 식. 밝고 신나는 쪽으로 억지로 안 민다.

> 팁: Suno에서 타이틀 트랙으로 **Persona**를 만들어(트랙 ··· → Create Persona) 2~8번에 그 Persona를 걸면 음색이 자동으로 이어진다. 그러면 아래 Style Influence는 60으로 낮춰도 됨.

---
### 1. bgm_title — 타이틀 · 인수인계 장면 · 설명서  ✅ 확정
- Style(확정본): `warm folk lullaby, solo accordion and nylon guitar, slow 70 bpm, cozy fireplace, dwarven tavern at night, instrumental, gentle, no drums`
- 파일명 `bgm_title` — 받은 WAV/MP3 그대로 `art/raw/audio/bgm/`.

---
### 2. bgm_yard_day — 회사 화면(낮)
- Style: `warm folk, accordion and nylon guitar, soft brushed percussion and light hand claps, 92 bpm, sunny morning at a small dwarven mining company, gentle walking pulse, cozy and relaxed, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, music box, epic orchestral, edm drop, synth, fast`
- Vocal Gender: 선택 안 함 · Duration: **2:30** · Max Mode: On · Weirdness: **30%** · Style Influence: **70%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 타이틀에 **브러시 타악만 얹은 느낌**. 2분 30초 동안 밀도가 안 변하는 것.
- 파일명 `bgm_yard_day`

---
### 3. bgm_yard_night — 회사 화면(밤) · 돌아오셨군요 카드
- Style: `warm night folk, accordion and nylon guitar, slow steady foot-tap rhythm on wooden percussion, low plucked bass, soft hummed melody without words, campfire crackle, 86 bpm, miners resting after work, gentle work song, instrumental`
- Exclude styles: `lyrics, singing words, choir, music box, lullaby, sad, epic orchestral, edm, synth`
- Vocal Gender: **Male**(허밍용) · Duration: **2:30** · Max Mode: On · Weirdness: **35%** · Style Influence: **70%** · Variety: Normal · Personalize: Off · Instrumental: **On**(켠 채로 — 허밍만. 가사 붙으면 버림)
- 고르는 기준: 타이틀보다 **살짝 낮고, 발 박자가 들리는 것**. 체크인 밤 곡(오르골)과 다르려면 허밍·발 박자가 핵심.
- 파일명 `bgm_yard_night`

---
### 4. bgm_mine_1 — 갱도 · 뒷산
- Style: `underground folk, accordion and nylon guitar played softly, sparse wooden percussion on the beat like distant pickaxes, light cave echo, 88 bpm, warm and hypnotic, loopable, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, music box, dark, horror, drone, epic orchestral, edm, synth`
- Vocal Gender: 선택 안 함 · Duration: **3:00** · Max Mode: On · Weirdness: **35%** · Style Influence: **70%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 제일 오래 듣는 곡. **타이틀을 동굴에서 치는 느낌**. 3분 내내 같은 밀도, 빌드업 없음.
- 파일명 `bgm_mine_1`

---
### 5. bgm_mine_2 — 갱도 · 폐광(2층)
- Style: `mysterious warm folk, accordion and nylon guitar in a minor key, soft pizzicato, sparse wooden percussion, cave shimmer, 86 bpm, curious but not scary, loopable, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, music box, horror, scary, drone, epic orchestral, edm, synth`
- Vocal Gender: 선택 안 함 · Duration: **3:00** · Max Mode: On · Weirdness: **40%** · Style Influence: **65%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 4번과 같은 악기, **단조로만** 바뀐 것. 무서우면 탈락.
- 파일명 `bgm_mine_2`

---
### 6. bgm_auction — 경매
- Style: `lively tavern folk, accordion lead and nylon guitar strumming, foot stomps and claps, playful bargaining mood, 104 bpm, bright, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, music box, slow, epic orchestral, edm, synth`
- Vocal Gender: 선택 안 함 · Duration: **2:00** · Max Mode: On · Weirdness: **30%** · Style Influence: **70%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 가족 중 제일 빠른 곡이지만 **같은 아코디언 음색**. 1~2분이라 조금 꽂혀도 됨.
- 파일명 `bgm_auction`

---
### 7. bgm_result — 결과 카드
- Style: `short warm folk ending, accordion flourish then relaxed nylon guitar, soft claps, 90 bpm, satisfied end of a good workday, 60 seconds, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, music box, sad, epic orchestral, edm, synth`
- Vocal Gender: 선택 안 함 · Duration: **1:00** · Max Mode: On · Weirdness: **30%** · Style Influence: **70%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 앞 5초 "짠", 나머지는 타이틀로 돌아가는 느낌. 끝이 자연스럽게 멈추는 것.
- 파일명 `bgm_result`

---
### 8. bgm_jackpot — 대박 연출 (스팅)
- Style: `joyful gold rush sting, accordion burst with bells and fast claps, 120 bpm, 20 seconds, celebration, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, music box, epic orchestral, edm, synth, slow`
- Vocal Gender: 선택 안 함 · Duration: **0:30** · Max Mode: On · Weirdness: **30%** · Style Influence: **75%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 종으로 시작해 20초 안에 끝나는 것. 길면 Code가 앞 20초만 씀.
- 파일명 `bgm_jackpot`

---
**내보내기**: 곡마다 MP3 + WAV 둘 다. `art/raw/audio/bgm/` 에 파일명 그대로. 루프 처리는 Code.

## 2. 효과음 — **전부 합성 완료** (`scripts/sfx_synth.py` → `art/raw/audio/sfx/*.wav` 46종, 11:20). freesound 안 씀. 소리가 마음에 안 들면 스크립트 숫자만 바꿔 재생성. Code는 `sh scripts/sfx_build.sh`로 mp3/ogg 변환해 `public/audio/sfx/`에.
| 파일 | 소리 | 비고 |
|---|---|---|
| `sfx_pick_dirt` | 곡괭이 흙 (퍽) ×3 변주 | 타격마다 랜덤 |
| `sfx_pick_rock` | 곡괭이 바위 (깡) ×3 | |
| `sfx_pick_ore` | 곡괭이 광석 (쨍 + 반짝) ×2 | |
| `sfx_vein_found` | 광맥 발견 (짧은 종 + 반짝) | |
| `sfx_jackpot` | 대박 (큰 종 + 환호 없음) | bgm_jackpot과 겹쳐 재생 |
| `sfx_cart_roll` | 광차 바퀴 (루프 2초) | 속도에 따라 피치 |
| `sfx_cart_dump` | 광석 쏟기 (자갈 쏟아짐) | |
| `sfx_coin` | 금화 (짤랑) ×2 | 판매·낙찰 |
| `sfx_coin_big` | 큰 금액 (짤랑짤랑 + 종) | 순이익 공개 |
| `sfx_gavel` | 경매 망치 (쾅) | |
| `sfx_stamp` | 도장 (쿵) | |
| `sfx_bid` | 호가 (나무 블록 똑) | 길드별 피치 3단 |
| `sfx_pass` | 패스 (짧은 한숨/흠) | 사람 소리 X — 나무 삐걱 |
| `sfx_fall` | 낙하 (휙) + `sfx_land`(쿵 먼지) | |
| `sfx_stun` | 기절 (띵~ 뱅글) | |
| `sfx_water` | 지하수 (콸콸 루프) | |
| `sfx_pump` | 펌프 (철컥철컥 3초) | |
| `sfx_gas` | 가스 (쉬익 루프) + `sfx_boom`(폭발) | |
| `sfx_collapse` | 붕괴 (우르르) | |
| `sfx_bat` | 박쥐떼 (푸드덕) | |
| `sfx_slime` | 슬라임 (물컹) | |
| `sfx_mole_sniff` | 두더지 킁킁 ×2 | |
| `sfx_letter` | 모모 편지 (종이 + 작은 종) | |
| `sfx_surge` | 급등 (상승 글리산도 짧게) | |
| `sfx_build` | 건물 짓기 (망치 3번 + 완성 띵) | |
| `sfx_upgrade` | 업그레이드 (띠링 상승) | |
| `sfx_talent` | 특성 찍기 (책 넘김 + 띵) | |
| `sfx_ui_tap` · `sfx_ui_open` · `sfx_ui_close` · `sfx_ui_error` | UI | 나무·종이 질감 |
| `sfx_welcome` | 돌아오셨군요 (문 열림 + 종) | |
| `amb_mine` | 갱도 앰비언스 (물방울·바람 루프 30초) | BGM 밑에 깔림 |
| `amb_yard_day` / `amb_yard_night` | 새·바람 / 귀뚜라미·모닥불 | |

freesound 검색어 예: `pickaxe dirt`, `pickaxe stone hit`, `coins pouch`, `wooden gavel`, `rubber stamp`, `mine cart rolling`, `gravel pour`, `cave drip ambience`, `bat wings flap`. **라이선스 CC0만**(CC-BY는 크레딧 필요 — 설정 화면 크레딧에 적으면 되긴 함).

## 3. 믹스 규칙
- BGM −12 dB 기준, SFX −6, 앰비언스 −18. 대박 순간만 BGM 덕킹(−6 dB 2초).
- 곡괭이 소리는 **1초에 최대 4번**(광부 3명이 동시에 치면 겹치지 않게 큐).
- 폰 기본은 **BGM 켬·SFX 켬**, 설정에 둘 따로 슬라이더. 앱이 백그라운드면 전부 정지.

## 4. 파일 · 폴더
```
public/audio/bgm/bgm_mine_1.mp3   (+ .ogg 변환은 Code)
public/audio/sfx/sfx_pick_dirt_1.mp3 … _3
public/audio/amb/amb_mine.mp3
docs/sound/CREDITS.md             (freesound 출처)
```
형철은 `art/raw/audio/`에 원본(WAV)만 던져 놓으면 Code가 변환·이름 정리.

## 5. Code 통합 규칙
- Howler.js(체크인에서 썼으면 그대로). 스프라이트 시트 1개로 SFX 묶기. 첫 터치 전엔 무음(모바일 정책).
- BGM 전환은 크로스페이드 1.5초. 갱도 층별로 곡 바꿈. 돌아오셨군요 카드는 `bgm_yard_night`.
- 루프 포인트: 곡 끝 1.5초와 시작 1.5초를 크로스페이드(Suno 곡은 끝이 페이드아웃이라 **마지막 3초는 잘라내고** 루프).
- 사운드 없을 때 게임이 멈추면 안 됨(파일 없으면 조용히 무시).
