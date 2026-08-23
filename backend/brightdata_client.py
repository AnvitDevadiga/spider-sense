"""
Bright Data Scraper Studio API Client
=====================================
Triggers real Bright Data collectors and handles dispatching.
"""
from __future__ import annotations

import os
import time
import logging
import httpx

logger = logging.getLogger("spider-sense.brightdata")

BASE_URL = "https://api.brightdata.com"

DEFAULT_COLLECTORS = {
    "google": "c_mt4jdk882ftyi0l2tq",
    "amazon": "c_mt3w3rtn12g4br728n",
    "walmart": "c_mt3wf5q4kwqm2mhi",
    "bestbuy": "c_mt3vgsej1ydszi4zhf",
}


def get_collector_id(retailer: str) -> str:
    """Returns the collector ID for a given retailer dynamically."""
    retailer_clean = retailer.lower().strip()
    env_id = os.getenv(f"BRIGHT_DATA_COLLECTOR_{retailer_clean.upper()}", "")
    if env_id:
        return env_id.strip()
    return DEFAULT_COLLECTORS.get(retailer_clean, "")


def get_api_token() -> str:
    """Returns the configured Bright Data API token."""
    return os.getenv("BRIGHT_DATA_API_KEY", "1a84b3b4-3d82-408f-9922-0ae4ecc8f096").strip()


def is_configured() -> bool:
    """Returns True if Bright Data API credentials are configured."""
    return bool(get_api_token())


def _headers() -> dict[str, str]:
    token = get_api_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def trigger_collector(retailer: str, urls: list[str], timeout: float = 30.0) -> str | None:
    """
    Triggers a Bright Data collector for the given retailer with a list of URLs.
    Returns the snapshot_id (collection_id) on success, or None on failure.
    """
    collector_id = get_collector_id(retailer)
    if not collector_id:
        if retailer.startswith("c_"):
            collector_id = retailer
        else:
            logger.warning(f"No collector ID configured for '{retailer}'.")
            return None

    api_token = get_api_token()
    if not api_token:
        logger.warning("BRIGHT_DATA_API_KEY is not set.")
        return None

    payload = [{"url": u} for u in urls]

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(
                f"{BASE_URL}/dca/trigger",
                params={
                    "collector": collector_id,
                    "queue_next": 1,
                    "override_incompatible_schema": 1,
                },
                headers=_headers(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            snapshot_id = data.get("collection_id")
            logger.info(f"Triggered {retailer} collector {collector_id} -> snapshot {snapshot_id}")
            return snapshot_id
    except httpx.HTTPStatusError as e:
        logger.error(f"Bright Data trigger failed ({e.response.status_code}): {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Bright Data trigger error: {e}")
        return None


def poll_results(
    snapshot_id: str,
    max_wait: float = 60.0,
    poll_interval: float = 2.0,
    timeout: float = 15.0,
) -> list[dict] | None:
    """
    Polls Bright Data for results until the snapshot is ready or max_wait is exceeded.
    Optimized for faster response times.
    """
    if not get_api_token():
        return None

    elapsed = 0.0
    try:
        with httpx.Client(timeout=timeout) as client:
            while elapsed < max_wait:
                resp = client.get(
                    f"{BASE_URL}/dca/dataset",
                    params={"id": snapshot_id},
                    headers=_headers(),
                )
                if resp.status_code not in (200, 202):
                    logger.warning(f"Bright Data poll unexpected status {resp.status_code}: {resp.text[:100]}")
                    time.sleep(poll_interval)
                    elapsed += poll_interval
                    continue

                body = None
                try:
                    body = resp.json()
                except Exception:
                    ndjson_rows = []
                    for line in resp.text.splitlines():
                        line = line.strip()
                        if line:
                            try:
                                parsed = json.loads(line)
                                if isinstance(parsed, dict):
                                    ndjson_rows.append(parsed)
                                elif isinstance(parsed, list):
                                    ndjson_rows.extend([x for x in parsed if isinstance(x, dict)])
                            except Exception:
                                pass
                    if ndjson_rows:
                        body = ndjson_rows

                if isinstance(body, list) and len(body) > 0:
                    logger.info(f"Snapshot {snapshot_id} ready: {len(body)} rows")
                    return body

                if isinstance(body, dict):
                    status = body.get("status", "unknown")
                    if status in ("failed", "error", "cancelled"):
                        logger.warning(f"Snapshot {snapshot_id} terminated with status: {status}")
                        return None
                    logger.info(f"Snapshot {snapshot_id} status: {status} (waited {elapsed:.0f}s)")
                else:
                    logger.info(f"Snapshot {snapshot_id} waiting for data (waited {elapsed:.0f}s)")

                time.sleep(poll_interval)
                elapsed += poll_interval

        return None
    except Exception as e:
        logger.error(f"Bright Data poll error: {e}")
        return None