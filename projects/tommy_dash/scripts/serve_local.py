#!/usr/bin/env python3
from __future__ import annotations

import argparse
import contextlib
import http.server
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "output" / "local_hosting"
HOST = "127.0.0.1"
START_PORT = 8776
MARKER = b"data-tommy-local-dashboard"


def is_tommy_server(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://{HOST}:{port}/", timeout=0.5) as response:
            return MARKER in response.read(4096)
    except Exception:
        return False


def available_port() -> int:
    for port in range(START_PORT, START_PORT + 20):
        with contextlib.closing(socket.socket()) as probe:
            try:
                probe.bind((HOST, port))
                return port
            except OSError:
                if is_tommy_server(port):
                    return port
    raise RuntimeError("No local dashboard port was available.")


def serve(port: int) -> None:
    handler = lambda *args, **kwargs: http.server.SimpleHTTPRequestHandler(  # noqa: E731
        *args, directory=str(SITE), **kwargs
    )
    http.server.ThreadingHTTPServer((HOST, port), handler).serve_forever()


def launch() -> None:
    if not (SITE / "index.html").exists():
        raise FileNotFoundError("Local dashboard is missing. Run the local HTML build first.")
    port = available_port()
    if not is_tommy_server(port):
        log = (ROOT / "output" / "local_server.log").open("a", encoding="utf-8")
        subprocess.Popen(
            [sys.executable, str(Path(__file__).resolve()), "--serve", "--port", str(port)],
            stdout=log,
            stderr=log,
            start_new_session=True,
        )
        for _ in range(30):
            if is_tommy_server(port):
                break
            time.sleep(0.1)
    webbrowser.open(f"http://{HOST}:{port}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--serve", action="store_true")
    parser.add_argument("--port", type=int, default=START_PORT)
    args = parser.parse_args()
    serve(args.port) if args.serve else launch()
