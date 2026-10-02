#!/bin/zsh

ROOT_DIR=${0:A:h}
PYTHON_BIN="/Users/maximodevries/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"

if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN=${commands[python3]}
fi

cd "$ROOT_DIR" || exit 1

if [[ -z "$PYTHON_BIN" ]]; then
  print "UPDATE FAILED: Python 3 was not found."
  STATUS=1
else
  "$PYTHON_BIN" scripts/refresh_dashboard.py --full
  STATUS=$?
fi

if [[ $STATUS -eq 0 ]]; then
  print "\nOpening the refreshed dashboard..."
  /bin/zsh "$ROOT_DIR/Open Dashboard.command"
else
  print "\nDashboard refresh did not complete. Review the message above."
fi

print ""
read -r "?Press Return to close this window."
exit $STATUS
