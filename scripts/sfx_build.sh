#!/bin/sh
# 효과음·앰비언스 WAV(art/raw/audio/sfx) → public/audio/sfx/*.mp3 + .ogg
# ffmpeg 가 PATH 에 없으면 devDependency ffmpeg-static 을 쓴다 (npm i)
set -e
FF=${FFMPEG:-$(command -v ffmpeg || node -e "process.stdout.write(require('ffmpeg-static'))")}
mkdir -p public/audio/sfx
for f in art/raw/audio/sfx/*.wav; do n=$(basename "$f" .wav)
  "$FF" -y -loglevel error -i "$f" -b:a 96k "public/audio/sfx/$n.mp3"
  "$FF" -y -loglevel error -i "$f" -c:a libvorbis -q:a 3 "public/audio/sfx/$n.ogg"
done
echo "sfx -> public/audio/sfx"
