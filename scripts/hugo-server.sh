#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-1313}"
HUGO_BIN="${HUGO_BIN:-/tmp/hugo-0.97.3/hugo}"
WOWCHEMY_MODULES_DIR="${WOWCHEMY_MODULES_DIR:-/tmp/wowchemy-local-v570/modules}"
HUGO_CACHE_DIR="${HUGO_CACHE_DIR:-/tmp/yulabgenomics-hugo-cache}"

if [[ ! -x "$HUGO_BIN" ]]; then
  if command -v hugo >/dev/null 2>&1; then
    HUGO_BIN="$(command -v hugo)"
  else
    echo "Hugo binary not found. Expected $HUGO_BIN or hugo on PATH." >&2
    exit 1
  fi
fi

if [[ ! -d "$WOWCHEMY_MODULES_DIR/wowchemy" ]]; then
  echo "Wowchemy modules not found in $WOWCHEMY_MODULES_DIR." >&2
  exit 1
fi

REPLACEMENTS="github.com/wowchemy/wowchemy-hugo-themes/modules/wowchemy/v5 -> $WOWCHEMY_MODULES_DIR/wowchemy,github.com/wowchemy/wowchemy-hugo-themes/modules/wowchemy-plugin-netlify -> $WOWCHEMY_MODULES_DIR/wowchemy-plugin-netlify,github.com/wowchemy/wowchemy-hugo-themes/modules/wowchemy-plugin-netlify-cms -> $WOWCHEMY_MODULES_DIR/wowchemy-plugin-netlify-cms,github.com/wowchemy/wowchemy-hugo-themes/modules/wowchemy-core -> $WOWCHEMY_MODULES_DIR/wowchemy-core,github.com/wowchemy/wowchemy-hugo-themes/modules/wowchemy-seo -> $WOWCHEMY_MODULES_DIR/wowchemy-seo"

cd "$ROOT_DIR"

HUGO_MODULE_REPLACEMENTS="$REPLACEMENTS" \
HUGO_CACHEDIR="$HUGO_CACHE_DIR" \
exec "$HUGO_BIN" server --bind 127.0.0.1 --port "$PORT" --disableFastRender
