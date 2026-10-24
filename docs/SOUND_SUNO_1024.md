# 사운드 명세 — Suno 제작 가이드 (v1 · 2026-10-24)

> 형철이 Suno로 직접 만든다. 이 문서는 **곡 목록 · 프롬프트 · 길이 · 루프 규칙 · 파일명**. Code는 §5 통합 규칙만 보면 됨.
> 톤 한 줄: **따뜻한 드워프 광산 — 아코디언·민속 현악·나무 타악·멀리서 곡괭이 소리.** 밝지만 한 꺼풀 어둡고, 방치 게임답게 **질리지 않는 게 1순위**(멜로디 적고 질감 위주).

## 1. BGM — 곡별 카드 (위에서부터 하나씩. 각 카드가 Suno 입력 전부)

방향(11:52 확정): **밝고 신나는데 카페에서 24시간 틀어놔도 안 질리는** 곡. 체크인(오르골·아코디언)과 겹치지 않게 채굴은 **만돌린·덜시머·우쿨렐레·나무 타악·휘파람** 쪽. 느리게 뽑히면 BPM 숫자를 +5 올려 다시.

---
### 1. bgm_title — 타이틀 · 인수인계 장면 · 설명서
- Style: `bright cozy folk, mandolin and ukulele strumming, light wooden percussion, whistling melody, 100 bpm, sunny morning at a small mining company, cheerful and relaxed, cafe background music, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, accordion, music box, epic orchestral, edm drop, synth`
- Vocal Gender: 선택 안 함 · Duration: **2:00** · Max Mode: On · Weirdness: **30%** · Style Influence: **75%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 첫 10초 안에 멜로디가 "꽂히면" 탈락. 흥얼거리고 싶은데 기억은 안 나는 쪽.
- 파일명 `bgm_title`

---
### 2. bgm_yard_day — 회사 화면(낮)
- Style: `upbeat dwarven village workday, mandolin, hammered dulcimer, hand claps and wooden percussion, light bass, 108 bpm, busy but happy, loopable cafe folk, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, accordion, music box, epic orchestral, edm drop, synth, slow`
- Vocal Gender: 선택 안 함 · Duration: **2:30** · Max Mode: On · Weirdness: **35%** · Style Influence: **70%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 2분 30초 동안 분위기가 안 바뀌는 것(중간에 조용해지거나 빌드업 생기면 탈락 — 루프 끊김).
- 파일명 `bgm_yard_day`

---
### 3. bgm_yard_night — 회사 화면(밤) · 돌아오셨군요 카드
- Style: `night shift work song, bright but relaxed, steady stomping rhythm, hammered dulcimer and plucked bass, hummed melody no words, anvil hit on the beat, campfire crackle, 96 bpm, tired but cheerful miners heading home, instrumental folk`
- Exclude styles: `lyrics, singing words, choir, accordion, music box, lullaby, sad, epic orchestral, edm`
- Vocal Gender: **Male**(허밍용) · Duration: **2:30** · Max Mode: On · Weirdness: **40%** · Style Influence: **70%** · Variety: Normal · Personalize: Off · Instrumental: **On**(켠 채로 — 허밍만 나옴. 가사 붙으면 그 트랙 버림)
- 고르는 기준: 낮 곡보다 한 톤 낮되 **느리지 않을 것**. 발 맞춰 걷는 느낌.
- 파일명 `bgm_yard_night`

---
### 4. bgm_mine_1 — 갱도 · 뒷산
- Style: `cheerful underground work rhythm, pickaxe hits on the beat, mandolin riff, hammered dulcimer, wooden percussion, light cave echo, 100 bpm, playful digging, loopable, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, accordion, dark, horror, drone, epic orchestral, edm, synth`
- Vocal Gender: 선택 안 함 · Duration: **3:00** · Max Mode: On · Weirdness: **35%** · Style Influence: **70%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 가장 오래 듣는 곡. 3분 내내 같은 밀도. 곡괭이 소리가 리듬에 들어가면 좋지만 너무 튀면 효과음과 겹침 → 은은한 것.
- 파일명 `bgm_mine_1`

---
### 5. bgm_mine_2 — 갱도 · 폐광(2층)
- Style: `mysterious but upbeat underground folk, hammered dulcimer and pizzicato strings, soft wooden percussion, teal cave shimmer, occasional distant bat flutter, 96 bpm, curious adventure, loopable, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, accordion, horror, scary, drone, epic orchestral, edm, synth`
- Vocal Gender: 선택 안 함 · Duration: **3:00** · Max Mode: On · Weirdness: **45%** · Style Influence: **65%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 뒷산보다 "낯선" 느낌이되 무섭지 않게. 단조여도 템포는 유지.
- 파일명 `bgm_mine_2`

---
### 6. bgm_auction — 경매
- Style: `lively market auction tune, fast mandolin and fiddle, stomping and clapping rhythm, playful competition, tavern energy, 118 bpm, bright and fun, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, accordion, slow, epic orchestral, edm, synth`
- Vocal Gender: 선택 안 함 · Duration: **2:00** · Max Mode: On · Weirdness: **35%** · Style Influence: **75%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 경매는 1~2분이라 조금 꽂혀도 됨. 긴장감보다 **장난스러움**.
- 파일명 `bgm_auction`

---
### 7. bgm_result — 결과 카드
- Style: `short cheerful folk ending, mandolin flourish then relaxed strumming, hand claps, whistling, 104 bpm, satisfied end of a good workday, 60 seconds, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, accordion, sad, epic orchestral, edm, synth`
- Vocal Gender: 선택 안 함 · Duration: **1:00** · Max Mode: On · Weirdness: **30%** · Style Influence: **75%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 앞 5초가 "짠!" 하고, 나머지는 편안히. 끝이 자연스럽게 멈추는 것.
- 파일명 `bgm_result`

---
### 8. bgm_jackpot — 대박 연출 (스팅)
- Style: `gold rush celebration sting, bells and mandolin burst, fast clapping, joyful, 130 bpm, 20 seconds, instrumental, no vocals`
- Exclude styles: `vocals, singing, choir, accordion, epic orchestral, edm, synth, slow`
- Vocal Gender: 선택 안 함 · Duration: **0:30** · Max Mode: On · Weirdness: **30%** · Style Influence: **80%** · Variety: Normal · Personalize: Off · Instrumental: On
- 고르는 기준: 종소리로 시작해서 20초 안에 끝나는 것. 길면 Code가 앞 20초만 씀.
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
