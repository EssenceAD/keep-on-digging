#!/bin/sh
# BGM(art/raw/audio/bgm/*.mp3, 형철 Suno) → public/audio/bgm/*.mp3 (128k) + .ogg  — SOUND_SUNO_1024 §5 · PATCH_V09 §3
# 루프 처리(끝 3초 잘라내기 · 1.5초 크로스페이드)는 게임(src/sound.js)이 한다
set -e
FF=${FFMPEG:-$(command -v ffmpeg || node -e "process.stdout.write(require('ffmpeg-static'))")}
mkdir -p public/audio/bgm
for f in art/raw/audio/bgm/*.mp3; do n=$(basename "$f" .mp3)
  "$FF" -y -loglevel error -i "$f" -b:a 128k "public/audio/bgm/$n.mp3"
  "$FF" -y -loglevel error -i "$f" -c:a libvorbis -q:a 3 "public/audio/bgm/$n.ogg"
done
echo "bgm -> public/audio/bgm"
