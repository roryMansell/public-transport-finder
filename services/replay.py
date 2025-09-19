"""Replay a recorded list of vehicle positions back to the local backend.

This helper avoids hitting external APIs while iterating on the frontend.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import requests


def push_snapshot(endpoint: str, payload: dict) -> None:
    response = requests.post(endpoint, json=payload, timeout=5)
    response.raise_for_status()


def main() -> None:
    parser = argparse.ArgumentParser(description="Replay a vehicle snapshot JSON file to the backend simulator")
    parser.add_argument("snapshot", type=Path, help="Path to the JSON file exported from /api/snapshot")
    parser.add_argument("--endpoint", default="http://localhost:4000/admin/load", help="Backend admin endpoint")
    parser.add_argument("--interval", type=float, default=5.0, help="Delay in seconds between snapshots")
    args = parser.parse_args()

    data = json.loads(args.snapshot.read_text())
    if isinstance(data, dict):
        data = [data]

    print(f"Replaying {len(data)} snapshots to {args.endpoint}…")
    for snapshot in data:
        push_snapshot(args.endpoint, snapshot)
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
