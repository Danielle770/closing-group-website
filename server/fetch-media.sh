#!/usr/bin/env bash
# Downloads the free Pexels background clips and compresses them for the web.
# Run from the website folder:  sudo bash server/fetch-media.sh
# Needs: curl, ffmpeg  (sudo apt install -y ffmpeg)
# Pexels licence: free for commercial use, no attribution required (https://www.pexels.com/license/).
set -euo pipefail
SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$SITE_DIR/media"; mkdir -p "$OUT"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
command -v ffmpeg >/dev/null || { echo "!! ffmpeg missing: sudo apt install -y ffmpeg"; exit 1; }

# name  pexels-video-id   start-second  (clip of 14 s)
CLIPS="telaviv 18809689 0
jerusalem 30355711 0"

while read -r name id start; do
  [ -z "$name" ] && continue
  if [ -s "$OUT/$name.mp4" ]; then echo "== $name already there"; continue; fi
  echo "== downloading $name (Pexels $id)"
  curl -fL --retry 3 -A "Mozilla/5.0" -o "$TMP/$name.src" "https://www.pexels.com/download/video/$id/"
  # 1280px wide, 14 s, no sound, small file; plus a poster image
  ffmpeg -loglevel error -y -ss "$start" -t 14 -i "$TMP/$name.src" -an -vf "scale=1280:-2,fps=25" \
    -c:v libx264 -preset veryfast -crf 28 -pix_fmt yuv420p -movflags +faststart "$OUT/$name.mp4"
  ffmpeg -loglevel error -y -ss 1 -i "$OUT/$name.mp4" -frames:v 1 -q:v 4 "$OUT/$name.jpg"
  echo "   $(du -h "$OUT/$name.mp4" | cut -f1) video, poster ready"
done <<< "$CLIPS"
echo "== Done. Files in $OUT"
