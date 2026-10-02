#!/usr/bin/env python3
"""Serve the static dashboard locally behind a short, non-filesystem URL."""

from __future__ import annotations

import argparse
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_ROOT = ROOT / "artifacts" / "public_hosting"


def make_handler(slug: str) -> type[BaseHTTPRequestHandler]:
    route = f"/{slug}"

    class DashboardHandler(BaseHTTPRequestHandler):
        server_version = "HMA Dashboard"

        def do_GET(self) -> None:  # noqa: N802
            path = unquote(urlsplit(self.path).path)
            if path == route:
                self.send_response(302)
                self.send_header("Location", f"{route}/")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return
            if path == f"{route}/":
                self._send_file(PUBLIC_ROOT / "index.html")
                return
            font_prefix = f"{route}/fonts/"
            if path.startswith(font_prefix):
                filename = Path(path.removeprefix(font_prefix)).name
                self._send_file(PUBLIC_ROOT / "fonts" / filename)
                return
            self.send_error(404, "Dashboard route not found")

        def _send_file(self, file_path: Path) -> None:
            if not file_path.is_file() or PUBLIC_ROOT not in file_path.resolve().parents:
                self.send_error(404, "Asset not found")
                return
            content = file_path.read_bytes()
            mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, _format: str, *_args: object) -> None:
            return

    return DashboardHandler


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--slug", default="HMA26A7")
    args = parser.parse_args()
    if not args.slug.isalnum():
        raise ValueError("The dashboard slug must be alphanumeric.")
    if not (PUBLIC_ROOT / "index.html").is_file():
        raise FileNotFoundError("The hostable dashboard has not been built yet.")
    server = ThreadingHTTPServer((args.host, args.port), make_handler(args.slug))
    server.serve_forever()


if __name__ == "__main__":
    main()
