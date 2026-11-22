#!/usr/bin/env bash
# Builds artifacts/source.zip for a ProductEcho deploy.
# Directory modes are normalised to 755 because the build worker reads the
# unpacked source as a different user.
set -euo pipefail
cd "$(dirname "$0")/.."

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

rsync -a \
  --exclude 'node_modules' --exclude 'dist' --exclude '.git' --exclude 'data' \
  --exclude 'artifacts' --exclude 'logs' --exclude '.productecho' \
  --exclude '.env*' --exclude '*.log' \
  ./ "$STAGE/"

find "$STAGE" -type d -exec chmod 755 {} +
find "$STAGE" -type f -exec chmod 644 {} +

mkdir -p artifacts
rm -f artifacts/source.zip
(cd "$STAGE" && zip -qr "$OLDPWD/artifacts/source.zip" .)
ls -lh artifacts/source.zip
