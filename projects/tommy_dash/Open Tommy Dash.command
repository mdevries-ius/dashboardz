#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
/usr/bin/python3 "$SCRIPT_DIR/scripts/serve_local.py"
