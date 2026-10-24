#!/bin/sh
# WAV(art/raw/audio/sfx) → public/audio/sfx/*.mp3 + .ogg
set -e
mkdir -p public/audio/sfx
for f in art/raw/audio/sfx/*.wav; do n=$(basename "$f" .wav)
  ffmpeg -y -loglevel error -i "$f" -b:a 96k "public/audio/sfx/$n.mp3"
  ffmpeg -y -loglevel error -i "$f" -c:a libvorbis -q:a 3 "public/audio/sfx/$n.ogg"
done
echo "sfx -> public/audio/sfx"
