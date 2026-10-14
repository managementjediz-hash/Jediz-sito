#!/bin/sh
# Crea le versioni leggere delle immagini usate dal sito (assets/_r/…-480/960/1600.webp).
# Uso: node build.mjs && sh tools/resize.sh && node build.mjs   (serve ImageMagick)
cd "$(dirname "$0")/.." || exit 1
while IFS= read -r p; do
  [ -f "$p" ] || continue
  base="${p%.*}"
  for w in 480 960 1600; do
    out="assets/_r/${base}-${w}.webp"
    [ -f "$out" ] && [ "$out" -nt "$p" ] && continue
    mkdir -p "$(dirname "$out")"
    convert "$p" -auto-orient -resize "${w}x>" -strip -quality 78 "$out" && echo "$out"
  done
done < .used-images.txt
