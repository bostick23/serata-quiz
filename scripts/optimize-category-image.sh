#!/usr/bin/env bash
# Converts animated category artwork (APNG/GIF/MP4...) into a small animated WebP
# for public/categories. The category screen lasts 5 seconds and players load it
# on their phones over the venue Wi-Fi/4G: keep each file in the 150-500 KB range.
#
# Usage: scripts/optimize-category-image.sh <input> [<input>...]
# Requires: ffmpeg built with libwebp (libwebp_anim encoder).
set -euo pipefail

OUT_DIR="$(dirname "$0")/../public/categories"
SIZE="${SIZE:-224}"     # displayed at 96-128 CSS px; 224 covers 2x screens
FPS="${FPS:-20}"
QUALITY="${QUALITY:-55}"

for input in "$@"; do
  name="$(basename "${input%.*}")"
  name="${name// /-}"
  output="$OUT_DIR/$name.webp"
  ffmpeg -v error -y -i "$input" \
    -vf "fps=$FPS,scale=$SIZE:$SIZE:flags=lanczos" \
    -c:v libwebp_anim -lossless 0 -quality "$QUALITY" -compression_level 6 -loop 0 -an \
    "$output"
  printf '%-40s %9d bytes -> %s (%d bytes)\n' "$input" "$(stat -c %s "$input")" "$output" "$(stat -c %s "$output")"
done
