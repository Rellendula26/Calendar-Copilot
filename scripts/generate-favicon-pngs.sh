#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FAVICON_SVG="$ROOT_DIR/public/favicon.svg"
FAVICON_32="$ROOT_DIR/public/favicon-32x32.png"
FAVICON_16="$ROOT_DIR/public/favicon-16x16.png"

if [[ ! -f "$FAVICON_SVG" ]]; then
  echo "Missing $FAVICON_SVG"
  exit 1
fi

if command -v sips >/dev/null 2>&1; then
  if sips -s format png "$FAVICON_SVG" --resampleWidth 32 --out "$FAVICON_32" >/dev/null 2>&1 \
    && sips -s format png "$FAVICON_SVG" --resampleWidth 16 --out "$FAVICON_16" >/dev/null 2>&1; then
    echo "Generated with sips:"
    echo "  - $FAVICON_32"
    echo "  - $FAVICON_16"
    exit 0
  fi
  echo "sips is installed but could not convert this SVG; trying other tools..."
fi

if command -v magick >/dev/null 2>&1; then
  magick "$FAVICON_SVG" -resize 32x32 "$FAVICON_32"
  magick "$FAVICON_SVG" -resize 16x16 "$FAVICON_16"
  echo "Generated:"
  echo "  - $FAVICON_32"
  echo "  - $FAVICON_16"
  exit 0
fi

echo "No supported converter found."
echo "Install one of:"
echo "  - macOS sips (built in)"
echo "  - ImageMagick (magick)"
echo "Or use an online/local SVG exporter to produce:"
echo "  - public/favicon-32x32.png"
echo "  - public/favicon-16x16.png"
exit 1
