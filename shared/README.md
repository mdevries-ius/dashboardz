# Shared utilities

Collection-level utilities belong here. Project-specific fonts, data, SQL, and
hosting assets stay inside their owning projects so each hosted application can
still be built independently.

Run `scripts/sync_dashboard_outputs.py` from the dashboard collection root
after rebuilding any project. It refreshes the four files in `outputs/` and
keeps that folder free of supporting artifacts.
