# 사운드 명세 — Suno 제작 가이드 (v1 · 2026-10-24)

> 형철이 Suno로 직접 만든다. 이 문서는 **곡 목록 · 프롬프트 · 길이 · 루프 규칙 · 파일명**. Code는 §5 통합 규칙만 보면 됨.
> 톤 한 줄: **따뜻한 드워프 광산 — 아코디언·민속 현악·나무 타악·멀리서 곡괭이 소리.** 밝지만 한 꺼풀 어둡고, 방치 게임답게 **질리지 않는 게 1순위**(멜로디 적고 질감 위주).

## 0. 공통 규칙 (Suno)
- 모델: v4.5 이상. **Instrumental** 켜기(가사 없음). 스타일 프롬프트는 영어가 더 정확함.
- 길이: BGM은 **2:00~3:00**로 뽑고 Code가 루프 포인트를 잡음(끝 2초 페이드 금지 — Suno에서 "Extend"로 끝을 자연스럽게 되감기 어렵다면 그냥 2:30짜리를 뽑고 Code가 크로스페이드 루프).
- 한 곡당 **4~6번 생성** 후 가장 "질리지 않는" 걸 고르기. 멜로디가 귀에 꽂히는 건 오히려 탈락 — 30분 들어도 괜찮은 것.
- 템포: 갱도 80~95 BPM, 지상 95~110, 경매 110~120, 결과 자유.
- 금지: 신스 리드 · EDM 드럼 · 오케스트라 브라스 · 보컬 코러스 · 리버브 과다(갱도 곡 제외).
- 내보내기: **MP3 192kbps + WAV**(WAV는 보관용). 파일명 §4.

## 1. BGM (8곡)
| # | 파일 | 쓰임 | Suno 스타일 프롬프트 (그대로 붙여넣기) | 길이 |
|---|---|---|---|---|
| 1 | `bgm_title` | 인수인계 장면 · 설명서 | `warm folk lullaby, solo accordion and nylon guitar, slow 70 bpm, cozy fireplace, dwarven tavern at night, instrumental, gentle, no drums` | 1:30 |
| 2 | `bgm_yard_day` | 회사 화면(낮) | `cheerful dwarven village theme, accordion, mandolin, wooden percussion, hand claps, 100 bpm, folk, sunny workshop, instrumental, loopable, no vocals` | 2:30 |
| 3 | `bgm_yard_night` | 회사 화면(밤) · 돌아오셨군요 카드 | `quiet night village, music box and soft accordion, distant crickets texture, 75 bpm, warm, sleepy, instrumental, ambient folk` | 2:30 |
| 4 | `bgm_mine_1` | 갱도 — 뒷산 | `underground mine ambience with sparse folk instruments, low bowed strings, wooden percussion, dripping water, distant pickaxe rhythm, 85 bpm, mysterious but warm, instrumental, minimal, loopable` | 3:00 |
| 5 | `bgm_mine_2` | 갱도 — 폐광(청록) | `abandoned mine, eerie but gentle, hammered dulcimer, low drone, cave reverb, distant bats, 80 bpm, dark folk, instrumental, minimal melody` | 3:00 |
| 6 | `bgm_auction` | 경매 | `lively market auction, upbeat tavern folk, accordion, fiddle, stomping rhythm, 115 bpm, playful competition, instrumental, dwarven` | 2:00 |
| 7 | `bgm_result` | 결과 카드 | `short triumphant folk jingle that settles into a calm tavern tune, accordion and fiddle, 100 bpm, satisfied end of a workday, instrumental` | 1:00 |
| 8 | `bgm_jackpot` | 대박 연출 (5초 스팅 + 20초 흥겨움) | `gold rush celebration sting, bells, fiddle, fast folk, 130 bpm, 20 seconds, joyful, instrumental` | 0:25 |

2단계용(나중): `bgm_mine_3`(지하 호수 — 물 반사·글라스 하모니카), `bgm_mine_4`(드워프 도시 — 황금·웅장·저음 합창 없이), `bgm_ending`.

## 2. 효과음 (Suno "Sound effect"보다 **freesound.org CC0**가 정확함 — Suno는 BGM만, SFX는 아래 목록을 freesound에서 받거나 Code가 합성)
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
