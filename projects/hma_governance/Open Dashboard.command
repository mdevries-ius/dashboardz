#!/bin/zsh

ROOT_DIR=${0:A:h}
PYTHON_BIN="/Users/maximodevries/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
PORT=8765
SLUG=HMA26A7
URL="http://localhost:${PORT}/${SLUG}/"
LOG_FILE="/tmp/hma_dashboard_${PORT}.log"

if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN=${commands[python3]}
fi

if [[ -z "$PYTHON_BIN" ]]; then
  print "Dashboard could not open because Python 3 was not found."
  exit 1
fi

if ! curl --silent --fail --max-time 1 "$URL" >/dev/null 2>&1; then
  nohup "$PYTHON_BIN" "$ROOT_DIR/scripts/serve_dashboard.py" \
    --port "$PORT" --slug "$SLUG" >"$LOG_FILE" 2>&1 &
  for _attempt in {1..30}; do
    curl --silent --fail --max-time 1 "$URL" >/dev/null 2>&1 && break
    sleep 0.1
  done
fi

if ! curl --silent --fail --max-time 2 "$URL" >/dev/null 2>&1; then
  print "Dashboard server did not start. Review $LOG_FILE"
  exit 1
fi

if [[ -d "/Applications/Google Chrome.app" ]]; then
  open -a "Google Chrome" "$URL"
else
  open "$URL"
fi
