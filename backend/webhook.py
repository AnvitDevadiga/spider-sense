"""
Bright Data webhook receivers — one per retailer.
Each custom scraper in Bright Data Scraper Studio pushes data here.

Production scrapers hit these endpoints:
    POST /webhook/amazon    → Amazon custom scraper
    POST /webhook/walmart   → Walmart custom scraper
    POST /webhook/bestbuy   → Best Buy custom scraper
    POST /webhook/brightdata → Universal Bright Data webhook
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import logging
import urllib.parse

from database import SessionLocal, Product, PriceHistory
from normalizer import normalize_payload
from alerts import evaluate_alerts
from brightdata_client import trigger_collector

logger = logging.getLogger("spider-sense.webhook")
router = APIRouter(prefix="/webhook", tags=["bright-data-webhooks"])

SUPPORTED_SOURCES = {"amazon", "walmart", "bestbuy", "google", "brightdata"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def process_raw_items(
    source: str, items: list[dict[str, object]], db: Session
) -> dict[str, object]:
    """Unified ingestion pipeline used by all retailers."""
    target_source = source.lower().strip()
    received = 0
    skipped = 0
    alerts_triggered = 0
    new_products = 0

    for raw in items:
        if not isinstance(raw, dict):
            skipped += 1
            continue

        try:
            received_count = _ingest_item(raw, target_source, db)
        except Exception:
            logger.exception(
                "[webhook] Failed to ingest item for source=%s — skipping", target_source
            )
            skipped += 1
            continue

        if received_count is None:
            skipped += 1
        else:
            new_products_local, alert_triggered = received_count
            received += 1
            new_products += new_products_local
            alerts_triggered += 1 if alert_triggered else 0

    db.commit()
    return {
        "status": "success",
        "source": target_source,
        "received": received,
        "new_products": new_products,
        "skipped": skipped,
        "alerts_triggered": alerts_triggered,
    }


def _ingest_item(
    raw: dict[str, object], target_source: str, db: Session
) -> tuple[int, bool] | None:
    """Normalizes and persists one scraped item. Returns
    (new_product_created, alert_triggered) or None when the item is unusable."""
    item_source = str(raw.get("source") or target_source).lower()
    if item_source not in SUPPORTED_SOURCES:
        item_source = target_source

    data = normalize_payload(raw, item_source)
    if not data or not data.get("source_id"):
        return None

    universal_id = f"{item_source}:{data['source_id']}"

    product = db.query(Product).filter(Product.id == universal_id).first()
    is_new = product is None
    if is_new:
        product = Product(
            id=universal_id,
            source=item_source,
            source_id=str(data["source_id"]) if data.get("source_id") else None,
            title=str(data.get("title") or "Unknown Product"),
            brand=str(data["brand"]) if data.get("brand") else None,
            category=str(data["category"])
            if data.get("category") else None,
            image_url=str(data["image_url"])
            if data.get("image_url") else None,
            product_url=str(data["product_url"])
            if data.get("product_url") else None,
        )
        db.add(product)
        db.flush()
    else:
        if data.get("title"):
            product.title = str(data["title"])
        if data.get("brand"):
            product.brand = str(data["brand"])
        if data.get("category"):
            product.category = str(data["category"])

        new_image_url = str(data["image_url"]) if data.get("image_url") else None
        if new_image_url and (not product.image_url or _is_better_image_url(new_image_url, product.image_url, item_source)):
            product.image_url = new_image_url

        new_product_url = str(data["product_url"]) if data.get("product_url") else None
        source_id_val = str(data["source_id"]) if data.get("source_id") else None
        if new_product_url and (not product.product_url or _is_canonical_product_url(new_product_url, product.product_url, item_source, source_id_val)):
            product.product_url = new_product_url

    raw_price = data.get("price", 0.0)
    price_val = float(raw_price) if isinstance(
        raw_price, (int, float)
    ) else 0.0
    raw_rating = data.get("rating")
    raw_review = data.get("review_count")
    entry = PriceHistory(
        product_id=universal_id,
        price=price_val,
        availability=str(data.get("availability") or "In Stock"),
        rating=float(raw_rating)
        if isinstance(raw_rating, (int, float)) else None,
        review_count=int(raw_review)
        if isinstance(raw_review, (int, float)) else None,
        raw_data=raw,
        scraped_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(entry)
    db.flush()

    alert = evaluate_alerts(db, product, entry)

    return (1 if is_new else 0), alert is not None


@router.post("/{source}")
async def scrape_webhook(
    source: str, request: Request, db: Session = Depends(get_db)
):
    """Bright Data Scraper Studio calls this with results."""
    try:
        body_bytes = await request.body()
        if not body_bytes:
            return {"status": "success", "message": "Empty payload received (ping ok)"}

        if request.headers.get("content-encoding") == "gzip" or body_bytes.startswith(b'\x1f\x8b'):
            import gzip
            body_bytes = gzip.decompress(body_bytes)

        import json
        try:
            body = json.loads(body_bytes)
        except json.JSONDecodeError:
            lines = body_bytes.decode('utf-8').strip().split('\n')
            body = [json.loads(line) for line in lines if line.strip()]
    except Exception as e:
        logger.error(f"Failed to parse webhook payload: {e}")
        raise HTTPException(400, "Invalid JSON payload")

    items: list[dict[str, object]] = []
    if isinstance(body, list):
        items = body
    elif isinstance(body, dict):
        if "results" in body and isinstance(body["results"], list):
            items = body["results"]
        elif "data" in body and isinstance(body["data"], list):
            items = body["data"]
        else:
            items = [body]

    logger.info(f"[webhook] Incoming {source}: {len(items)} item(s)")

    return process_raw_items(source, items, db)


def _is_better_image_url(new_url: str, current_url: str, source: str) -> bool:
    """Determine if new image URL is better than current."""
    try:
        new_parsed = urllib.parse.urlparse(new_url)
        curr_parsed = urllib.parse.urlparse(current_url)

        retailer_domains = {
            "amazon": ["images-na.ssl-images-amazon.com", "m.media-amazon.com"],
            "walmart": ["walmart.com", "walmartimages.com"],
            "bestbuy": ["bestbuy.com", "bestbuy.ca"],
        }

        preferred = retailer_domains.get(source, [])
        new_is_preferred = any(d in new_parsed.netloc for d in preferred)
        curr_is_preferred = any(d in curr_parsed.netloc for d in preferred)

        if new_is_preferred and not curr_is_preferred:
            return True
        if curr_is_preferred and not new_is_preferred:
            return False

        if new_parsed.scheme == "https" and curr_parsed.scheme == "http":
            return True
        if new_parsed.scheme == "http" and curr_parsed.scheme == "https":
            return False

        return len(new_url) > len(current_url)
    except Exception:
        return False


def _is_canonical_product_url(new_url: str, current_url: str, source: str, source_id: str | None) -> bool:
    """Determine if new product URL is more canonical than current."""
    try:
        new_parsed = urllib.parse.urlparse(new_url)
        curr_parsed = urllib.parse.urlparse(current_url)

        if source == "amazon" and source_id:
            expected = f"/dp/{source_id}"
            if expected in new_url and expected not in current_url:
                return True
        elif source == "walmart" and source_id:
            expected = f"/ip/{source_id}"
            if expected in new_url and expected not in current_url:
                return True
        elif source == "bestbuy" and source_id:
            expected = f"/site/{source_id}.p"
            if expected in new_url and expected not in current_url:
                return True

        retailer_domains = {
            "amazon": "amazon.com",
            "walmart": "walmart.com",
            "bestbuy": "bestbuy.com",
        }
        preferred_domain = retailer_domains.get(source, "")
        new_is_retailer = preferred_domain in new_parsed.netloc
        curr_is_retailer = preferred_domain in curr_parsed.netloc

        if new_is_retailer and not curr_is_retailer:
            return True
        if curr_is_retailer and not new_is_retailer:
            return False

        new_params = len(urllib.parse.parse_qsl(new_parsed.query))
        curr_params = len(urllib.parse.parse_qsl(curr_parsed.query))
        if new_params < curr_params:
            return True

        return False
    except Exception:
        return False


@router.get("/health")
def webhook_health():
    """Bright Data pings this to verify webhook reachability."""
    return {
        "status": "ok",
        "platform": "Spider-Sense Price Intelligence",
        "supported_sources": sorted(list(SUPPORTED_SOURCES)),
        "endpoint_pattern": "POST /webhook/{source}",
    }