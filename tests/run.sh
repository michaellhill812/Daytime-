#!/usr/bin/env bash
# Build the app and the harness, serve both, run the suites, tidy up.
#
#   tests/run.sh              every suite
#   tests/run.sh attach       just that one
#
# Everything here runs against a real production build rather than a dev
# server, because most of what has actually broken in this app was layout,
# paint, or platform behaviour — none of which a dev build reproduces
# faithfully and none of which jsdom sees at all.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

APP_PORT=${APP_PORT:-4321}
HARNESS_PORT=${HARNESS_PORT:-4400}

# VITE_EMBED=1: no cloud code, so the build needs no Supabase credentials and
# the app boots straight into localStorage.
echo "→ building the app"
VITE_EMBED=1 npx vite build --outDir dist-test --emptyOutDir >/dev/null

echo "→ building the harness"
npx vite build --config tests/harness/vite.config.mjs >/dev/null

# A server left running from an earlier run answers on the same port out of a
# directory that no longer exists, and every suite then fails on a 404 that
# looks nothing like a stale process. Refuse rather than guess.
for port in "$APP_PORT" "$HARNESS_PORT"; do
  if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$port/"; then
    echo "port $port is already serving something — stop it first (pkill -f http.server)" >&2
    exit 1
  fi
done

python3 -m http.server "$APP_PORT" --bind 127.0.0.1 --directory dist-test >/dev/null 2>&1 &
app_pid=$!
python3 -m http.server "$HARNESS_PORT" --bind 127.0.0.1 --directory .harness-dist >/dev/null 2>&1 &
harness_pid=$!
trap 'kill $app_pid $harness_pid 2>/dev/null || true' EXIT

# Give both servers a moment to bind before the first navigation.
ready=false
for _ in $(seq 1 40); do
  if curl -sf --max-time 1 "http://127.0.0.1:$APP_PORT/" >/dev/null &&
    curl -sf --max-time 1 "http://127.0.0.1:$HARNESS_PORT/signin.html" >/dev/null; then
    ready=true
    break
  fi
  sleep 0.25
done
$ready || { echo "servers never came up" >&2; exit 1; }

if [ $# -gt 0 ]; then
  suites=("$@")
else
  suites=(batch verify verify2 attrib attach attach2 ring duetime daybadge hub whentest walltest infotest msgtest signin)
fi

failed=()
for name in "${suites[@]}"; do
  echo
  echo "════ $name ════"
  node "tests/${name%.mjs}.mjs" || failed+=("$name")
done

echo
if [ ${#failed[@]} -gt 0 ]; then
  echo "FAILED: ${failed[*]}"
  exit 1
fi
echo "All suites passed."
