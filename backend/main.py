import os
import json
import re
import threading
import urllib.parse
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base, SessionLocal, Product, PriceHistory, Alert, get_db
from alerts import evaluate_alerts
import brightdata_client
from routers.scrapers import router as scrapers_router
from routers.products import router as products_router
from routers.alerts import router as alerts_router
from routers.system import router as system_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("spider-sense")

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="🕷️ Spider-Sense API",
    description="High-Speed Predictive Price Intelligence & 4-Scraper Orchestrator",
    version="2.0.0",
)

app.include_router(scrapers_router)
app.include_router(products_router)
app.include_router(alerts_router)
app.include_router(system_router)

_allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=(
        r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
        r"|https://[a-z0-9-]+\.ngrok-(free\.)?(app|io|dev)"
        r"|https://.*\.vercel\.app"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class SearchRequest(BaseModel):
    query: str


def _extract_url_str(val: Any) -> str:
    if not val:
        return ""
    if isinstance(val, str):
        return val.strip()
    if isinstance(val, dict):
        return str(val.get("href") or val.get("src") or val.get("url") or "").strip()
    return str(val).strip()


def _extract_number(val: Any) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        s = str(val).strip()
        if not s or s.lower() in ("null", "none", "nan", "undefined", "n/a"):
            return None
        s = s.replace(",", "")
        match = re.search(r"(\d+(?:\.\d+)?)", s)
        if match:
            return float(match.group(1))
        return None
    except Exception:
        return None


async def _parse_request_body(request: Request) -> list[dict]:
    try:
        data = await request.json()
        if isinstance(data, list):
            return [d for d in data if isinstance(d, dict)]
        if isinstance(data, dict):
            for k in ("results", "data", "response", "items"):
                if k in data and isinstance(data[k], list):
                    return [d for d in data[k] if isinstance(d, dict)]
            return [data]
    except Exception:
        return []


def _extract_urls_from_google_items(items: list[dict]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    amazon_url: Optional[str] = None
    bestbuy_url: Optional[str] = None
    walmart_url: Optional[str] = None

    for item in items:
        if not isinstance(item, dict):
            continue

        if not amazon_url:
            amazon_url = item.get("amazon_url") or item.get("amazon")
        if not bestbuy_url:
            bestbuy_url = item.get("bestbuy_url") or item.get("bestbuy") or item.get("best_buy")
        if not walmart_url:
            walmart_url = item.get("walmart_url") or item.get("walmart")

        if "urls" in item and isinstance(item["urls"], dict):
            u = item["urls"]
            if not amazon_url:
                amazon_url = u.get("amazon") or u.get("amazon_url")
            if not bestbuy_url:
                bestbuy_url = u.get("bestbuy") or u.get("bestbuy_url")
            if not walmart_url:
                walmart_url = u.get("walmart") or u.get("walmart_url")

        search_results = item.get("search_results") or item.get("results")
        if isinstance(search_results, list):
            for res in search_results:
                if not isinstance(res, dict):
                    continue
                ret = str(res.get("retailer", "")).lower()
                purl = _extract_url_str(res.get("product_url") or res.get("url") or res.get("link"))
                if not purl:
                    continue
                if ("amazon" in ret or "amazon.com" in purl) and not amazon_url:
                    amazon_url = purl
                elif ("bestbuy" in ret or "best buy" in ret or "bestbuy.com" in purl) and not bestbuy_url:
                    bestbuy_url = purl
                elif ("walmart" in ret or "walmart.com" in purl) and not walmart_url:
                    walmart_url = purl

        item_url = _extract_url_str(item.get("url") or item.get("product_url") or item.get("link"))
        if item_url:
            if "amazon.com" in item_url and not amazon_url:
                amazon_url = item_url
            elif "bestbuy.com" in item_url and not bestbuy_url:
                bestbuy_url = item_url
            elif "walmart.com" in item_url and not walmart_url:
                walmart_url = item_url

    return amazon_url, bestbuy_url, walmart_url


def _poll_and_ingest_retailer(retailer: str, snapshot_id: str):
    logger.info(f"[Poller] Starting background poll for {retailer} snapshot {snapshot_id}")
    rows = brightdata_client.poll_results(snapshot_id, max_wait=60.0, poll_interval=2.0)
    if not rows:
        logger.warning(f"[Poller] No data returned from Bright Data for {retailer} snapshot {snapshot_id}")
        return
    db = SessionLocal()
    try:
        saved_ids = []
        for r in rows:
            if not isinstance(r, dict):
                continue
            try:
                p = _ingest_retailer_item(r, retailer, db)
                db.commit()
                saved_ids.append(p.id)
            except Exception as row_err:
                db.rollback()
                logger.warning(f"[Poller] Skipping malformed {retailer} row: {row_err}")
        if not saved_ids:
            logger.warning(f"[Poller] No usable rows ingested from {retailer} snapshot {snapshot_id}")
        logger.info(f"[Poller] Ingested {len(saved_ids)} products from {retailer} snapshot: {saved_ids}")
    except Exception as e:
        db.rollback()
        logger.error(f"[Poller] Error ingesting {retailer} snapshot results: {e}")
    finally:
        db.close()


def dispatch_retailer_scrapers(amazon_url: Optional[str], walmart_url: Optional[str], bestbuy_url: Optional[str]) -> list[dict]:
    dispatched = []

    if amazon_url:
        logger.info(f"[Dispatcher] Triggering Amazon Scraper for {amazon_url}")
        snap = brightdata_client.trigger_collector("amazon", [amazon_url])
        dispatched.append({"retailer": "amazon", "url": amazon_url, "snapshot_id": snap})
        if snap:
            threading.Thread(target=_poll_and_ingest_retailer, args=("amazon", snap), daemon=True).start()

    if walmart_url:
        logger.info(f"[Dispatcher] Triggering Walmart Scraper for {walmart_url}")
        snap = brightdata_client.trigger_collector("walmart", [walmart_url])
        dispatched.append({"retailer": "walmart", "url": walmart_url, "snapshot_id": snap})
        if snap:
            threading.Thread(target=_poll_and_ingest_retailer, args=("walmart", snap), daemon=True).start()

    if bestbuy_url:
        logger.info(f"[Dispatcher] Triggering Best Buy Scraper for {bestbuy_url}")
        snap = brightdata_client.trigger_collector("bestbuy", [bestbuy_url])
        dispatched.append({"retailer": "bestbuy", "url": bestbuy_url, "snapshot_id": snap})
        if snap:
            threading.Thread(target=_poll_and_ingest_retailer, args=("bestbuy", snap), daemon=True).start()

    return dispatched


def _ingest_retailer_item(item: dict, source: str, db: Session) -> Product:
    source_clean = (source or "brightdata").lower().strip()
    url = _extract_url_str(item.get("url") or item.get("product_url") or item.get("link"))

    if source_clean in ["brightdata", "webhook", "default", ""] or source_clean not in ["amazon", "walmart", "bestbuy"]:
        if "amazon." in url:
            source_clean = "amazon"
        elif "walmart." in url:
            source_clean = "walmart"
        elif "bestbuy." in url:
            source_clean = "bestbuy"
        else:
            source_clean = "amazon"

    source_id = str(item.get("source_id") or item.get("asin") or item.get("id") or "").strip()
    if source_id.lower() in ("none", "null", "undefined"):
        source_id = ""

    if not source_id and url:
        if "amazon.com" in url:
            m = re.search(r"/(?:dp|gp/product)/([A-Z0-9]{10})", url)
            if m:
                source_id = m.group(1)
        elif "walmart.com" in url:
            m = re.search(r"/ip/(?:[^/]+/)?(\d+)", url) or re.search(r"/(\d+)$", url)
            if m:
                source_id = m.group(1)
        elif "bestbuy.com" in url:
            m = re.search(r"/site/(?:[^/]+/)?(\d+)\.p", url) or re.search(r"skuId=(\d+)", url) or re.search(r"/(\d+)\.p", url)
            if m:
                source_id = m.group(1)

    if not source_id and url:
        source_id = url.split("?")[0].rstrip("/").split("/")[-1]
    if not source_id:
        source_id = str(abs(hash(url or str(item.get("title", "")))))[:12]

    product_id = f"{source_clean}:{source_id}"
    raw_title = str(item.get("title") or "Unknown Product").strip()
    title = raw_title if raw_title and raw_title.lower() not in ("none", "null", "undefined") else "Unknown Product"
    price = _extract_number(item.get("price")) or 0.0
    raw_img = (
        item.get("image_url")
        or item.get("imageUrl")
        or item.get("image")
        or item.get("primaryImage")
        or item.get("thumbnail")
        or item.get("img")
        or item.get("photo")
    )
    if isinstance(raw_img, list) and len(raw_img) > 0:
        raw_img = raw_img[0]
    if isinstance(raw_img, dict):
        raw_img = raw_img.get("src") or raw_img.get("url") or raw_img.get("href") or raw_img.get("image") or raw_img.get("thumbnail")
    image_url = _extract_url_str(raw_img)
    if image_url.lower() in ("none", "null", "undefined", "[object object]"):
        image_url = ""
    product_url = url
    availability = str(item.get("availability") or "In Stock")
    rating = _extract_number(item.get("rating"))
    review_count = int(_extract_number(item.get("review_count")) or 0)
    brand = str(item.get("brand") or (source_clean.title() if source_clean else ""))
    category = str(item.get("category") or "Electronics")

    product = db.query(Product).filter(Product.id == product_id).first()
    now = _utcnow()

    if not product:
        product = Product(
            id=product_id,
            source=source_clean,
            source_id=source_id,
            title=title,
            price=price,
            brand=brand,
            category=category,
            image_url=image_url,
            product_url=product_url,
            availability=availability,
            rating=rating,
            review_count=review_count,
            created_at=now,
            scraped_at=now,
        )
        db.add(product)
    else:
        if title and title != "Unknown Product":
            product.title = title
        if price > 0:
            product.price = price
        if image_url:
            product.image_url = image_url
        if product_url:
            product.product_url = product_url
        if availability:
            product.availability = availability
        if rating is not None:
            product.rating = rating
        if review_count:
            product.review_count = review_count
        product.scraped_at = now

    db.flush()

    if price > 0:
        history_entry = PriceHistory(
            product_id=product_id,
            price=price,
            currency=str(item.get("currency") or "USD"),
            availability=availability,
            rating=rating,
            review_count=review_count,
            raw_data=item if isinstance(item, dict) else {},
            scraped_at=now,
        )
        db.add(history_entry)
        db.flush()
        try:
            evaluate_alerts(db, product, history_entry)
        except Exception as alert_err:
            logger.warning(f"[Ingest] Alert evaluation failed for {product_id}: {alert_err}")

    return product


@app.post("/api/search")
def search_product(req: SearchRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    raw_query = req.query.strip()
    if not raw_query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    stores_result, comparison = _match_products_for_query(raw_query, db)
    ready_count = sum(1 for data in stores_result.values() if data.get("status") == "ready")

    if ready_count > 0:
        logger.info(
            f"[Search] Cache hit for '{raw_query}' ({ready_count} store(s) ready) — skipping Bright Data"
        )
        return JSONResponse(
            status_code=200,
            content={
                "status": "cache_hit",
                "query": raw_query,
                "cached": True,
                "message": (
                    f"Instant cache hit — {ready_count} store(s) already tracked for '{raw_query}'."
                ),
                "stores": stores_result,
                "comparison": comparison,
            },
        )

    background_tasks.add_task(_async_dispatch_search, raw_query)
    return JSONResponse(
        status_code=202,
        content={
            "status": "scraping_started",
            "query": raw_query,
            "cached": False,
            "message": (
                f"Spider-bots dispatched! Hunting for '{raw_query}' across Amazon, Walmart, and Best Buy."
            ),
        },
    )


def _extract_price_from_text(text: str) -> Optional[float]:
    if not text:
        return None
    m = re.search(r"\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)", text)
    if m:
        try:
            return float(m.group(1).replace(",", ""))
        except Exception:
            pass
    m2 = re.search(r"(?:USD|US\$)\s*(\d+(?:\.\d{2})?)", text, re.IGNORECASE)
    if m2:
        try:
            return float(m2.group(1).replace(",", ""))
        except Exception:
            pass
    m3 = re.search(r"(?:price|now|only|sale|buy)\s*:?\s*\$?\s*(\d+\.\d{2})", text, re.IGNORECASE)
    if m3:
        try:
            return float(m3.group(1))
        except Exception:
            pass
    return None


def _resolve_retailer_urls_via_search(raw_query: str) -> tuple[Optional[str], Optional[str], Optional[str], list[dict]]:
    """Resolves direct Amazon, Walmart, and Best Buy product URLs and real images via fast meta-search."""
    amazon_url: Optional[str] = None
    bestbuy_url: Optional[str] = None
    walmart_url: Optional[str] = None
    extracted_items: list[dict] = []
    best_image: Optional[str] = None

    try:
        from ddgs import DDGS
        ddgs = DDGS()

        # 1. Discover high-res product image
        try:
            img_results = list(ddgs.images(f"{raw_query} product", max_results=3))
            for img in img_results:
                cand = _extract_url_str(img.get("image") or img.get("thumbnail") or img.get("url"))
                if cand and cand.startswith("http") and not any(x in cand for x in ["favicon", "logo", "icon", "blank"]):
                    best_image = cand
                    break
        except Exception as img_err:
            logger.debug(f"[Meta-Search] Image discovery notice: {img_err}")

        # 2. Discover retailer direct URLs
        search_query = f"{raw_query} site:amazon.com OR site:walmart.com OR site:bestbuy.com"
        results = list(ddgs.text(search_query, max_results=10))
        for r in results:
            href = _extract_url_str(r.get("href") or r.get("link") or r.get("url"))
            title = str(r.get("title") or "").strip()
            body = str(r.get("body") or "").strip()
            if not href:
                continue

            full_text = f"{title} {body}"
            price_val = _extract_price_from_text(full_text)

            if ("amazon.com" in href) and not amazon_url:
                if "/dp/" in href or "/gp/product/" in href or "/gp/" in href or not any(x in href for x in ["/s?", "/b?", "/gp/browse"]):
                    amazon_url = href
                    extracted_items.append({
                        "source": "amazon",
                        "url": href,
                        "title": title or f"{raw_query} on Amazon",
                        "price": price_val,
                        "image_url": best_image,
                        "availability": "In Stock",
                    })

            if ("bestbuy.com" in href) and not bestbuy_url:
                if "/site/" in href or "/product/" in href or ".p" in href or "skuId=" in href:
                    bestbuy_url = href
                    extracted_items.append({
                        "source": "bestbuy",
                        "url": href,
                        "title": title or f"{raw_query} on Best Buy",
                        "price": price_val,
                        "image_url": best_image,
                        "availability": "In Stock",
                    })

            if ("walmart.com" in href) and not walmart_url:
                if "/ip/" in href or "/browse/" not in href:
                    walmart_url = href
                    extracted_items.append({
                        "source": "walmart",
                        "url": href,
                        "title": title or f"{raw_query} on Walmart",
                        "price": price_val,
                        "image_url": best_image,
                        "availability": "In Stock",
                    })
    except Exception as e:
        logger.warning(f"[Meta-Search] Fast URL resolution exception: {e}")

    return amazon_url, bestbuy_url, walmart_url, extracted_items


def _async_dispatch_search(raw_query: str):
    try:
        if raw_query.startswith("http://") or raw_query.startswith("https://"):
            if "amazon.com" in raw_query:
                dispatch_retailer_scrapers(amazon_url=raw_query, walmart_url=None, bestbuy_url=None)
            elif "walmart.com" in raw_query:
                dispatch_retailer_scrapers(amazon_url=None, walmart_url=raw_query, bestbuy_url=None)
            elif "bestbuy.com" in raw_query:
                dispatch_retailer_scrapers(amazon_url=None, walmart_url=None, bestbuy_url=raw_query)
            return

        # 1. Fast Meta-Search resolution to find retailer direct product URLs
        amz_url, bb_url, wm_url, preview_items = _resolve_retailer_urls_via_search(raw_query)
        logger.info(f"[Search Async] Fast URL resolution for '{raw_query}': amz={amz_url}, bb={bb_url}, wm={wm_url}")

        # 2. Ingest preview baseline items if any were extracted so UI gets fast telemetry
        if preview_items:
            db = SessionLocal()
            try:
                for item in preview_items:
                    try:
                        _ingest_retailer_item(item, item.get("source", "amazon"), db)
                        db.commit()
                    except Exception as ing_err:
                        db.rollback()
                        logger.warning(f"[Search Async] Ingest preview item failed: {ing_err}")
            finally:
                db.close()

        # 3. Dispatch Scraper Studio collectors with exact URLs
        if amz_url or wm_url or bb_url:
            dispatch_retailer_scrapers(amazon_url=amz_url, walmart_url=wm_url, bestbuy_url=bb_url)

        # 4. Also trigger Google Meta-Search collector on Bright Data
        query_param = f"{raw_query} site:amazon.com OR site:walmart.com OR site:bestbuy.com"
        google_url = f"https://www.google.com/search?q={urllib.parse.quote_plus(query_param)}"
        logger.info(f"[Search Async] Triggering Google Scraper for query='{raw_query}'")
        snapshot_id = brightdata_client.trigger_collector("google", [google_url])
        if snapshot_id:
            threading.Thread(target=_poll_and_dispatch_google, args=(snapshot_id,), daemon=True).start()
    except Exception as e:
        logger.error(f"[Search Async] Error in background search dispatch: {e}")


def _poll_and_dispatch_google(snapshot_id: str):
    logger.info(f"[Poller] Starting background poll for Google snapshot {snapshot_id}")
    results = brightdata_client.poll_results(snapshot_id, max_wait=45.0, poll_interval=2.0)
    if not results:
        logger.warning(f"[Poller] No results returned from Bright Data for Google snapshot {snapshot_id}")
        return
    amazon_url, bestbuy_url, walmart_url = _extract_urls_from_google_items(results)
    logger.info(f"[Poller] Google extracted URLs: amazon={amazon_url}, walmart={walmart_url}, bestbuy={bestbuy_url}")
    dispatch_retailer_scrapers(amazon_url, walmart_url, bestbuy_url)


@app.post("/webhook/google")
async def webhook_google(request: Request):
    try:
        items = await _parse_request_body(request)
    except Exception as e:
        logger.warning(f"[Webhook Google] Unparseable payload: {e}")
        return {"status": "success", "message": "Payload ignored", "dispatched": []}

    logger.info(f"[Webhook Google] Received payload with {len(items)} item(s)")
    if not items:
        return {"status": "success", "message": "Empty payload accepted", "dispatched": []}

    try:
        amazon_url, bestbuy_url, walmart_url = _extract_urls_from_google_items(items)
        dispatched = dispatch_retailer_scrapers(amazon_url, walmart_url, bestbuy_url)
    except Exception as e:
        logger.exception(f"[Webhook Google] Dispatch failed: {e}")
        return {"status": "success", "message": "Dispatch skipped due to empty or invalid data", "dispatched": []}

    return {
        "status": "success",
        "message": f"Successfully dispatched {len(dispatched)} retailer scrapers",
        "dispatched": dispatched,
    }


@app.post("/webhook/amazon")
@app.post("/webhook/walmart")
@app.post("/webhook/bestbuy")
@app.post("/webhook/{source}")
async def webhook_retailer(request: Request, source: str = "brightdata", db: Session = Depends(get_db)):
    if source in ["brightdata", "webhook", "default", ""]:
        path_end = request.url.path.rstrip("/").split("/")[-1].lower()
        if path_end in ["amazon", "walmart", "bestbuy", "google"]:
            source = path_end

    try:
        items = await _parse_request_body(request)
    except Exception as e:
        logger.warning(f"[Webhook {source}] Unparseable payload: {e}")
        return {
            "status": "success",
            "source": source,
            "saved_count": 0,
            "received": 0,
            "skipped": 0,
            "product_ids": [],
            "message": "Payload ignored",
        }

    if not items:
        return {
            "status": "success",
            "source": source,
            "saved_count": 0,
            "received": 0,
            "skipped": 0,
            "product_ids": [],
            "message": "Empty payload accepted",
        }

    saved_products = []
    skipped = 0
    for item in items:
        if not isinstance(item, dict):
            skipped += 1
            continue
        try:
            p = _ingest_retailer_item(item, source, db)
            db.commit()
            saved_products.append(p.id)
        except Exception as e:
            skipped += 1
            logger.warning(f"[Webhook {source}] Skipping malformed item: {e}")
            db.rollback()

    logger.info(
        f"[Webhook {source}] Ingested {len(saved_products)} product(s), skipped {skipped}: {saved_products}"
    )

    return {
        "status": "success",
        "source": source,
        "saved_count": len(saved_products),
        "received": len(saved_products),
        "skipped": skipped,
        "product_ids": saved_products,
    }


@app.get("/webhook/health")
def webhook_health():
    return {
        "status": "ok",
        "service": "spider-sense-brightdata-webhook-gateway",
        "supported_retailers": ["amazon", "walmart", "bestbuy", "google"],
    }


@app.get("/")
def root():
    return {
        "project": "Spider-Sense",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    return {
        "products_tracked": db.query(Product).count(),
        "price_points": db.query(PriceHistory).count(),
        "alerts_active": db.query(Alert).count(),
    }


@app.get("/health")
def health(db: Session = Depends(get_db)):
    return {
        "status": "ok",
        "database": "connected",
        "products_count": db.query(Product).count(),
        "alerts_count": db.query(Alert).count(),
    }





def _match_products_for_query(query: str, db: Session) -> tuple[dict[str, dict], dict]:
    q = query.lower().strip()
    q_clean = re.sub(r"[^\w\s]", " ", q)
    stop_words = {"the", "and", "for", "with", "site", "com", "http", "https", "pro", "a", "an", "or", "in", "on", "of", "to", "at", "by"}
    tokens = [t for t in q_clean.split() if t not in stop_words and (len(t) > 1 or t.isdigit())]
    if not tokens:
        tokens = [q]

    q_compact = re.sub(r"[\s\-_]", "", q)

    retailers = ["amazon", "bestbuy", "walmart"]
    stores_result: dict[str, dict] = {}
    found_products: list[dict] = []

    for store in retailers:
        candidates = db.query(Product).filter(Product.source == store).all()
        best_prod = None
        best_score = 0

        for p in candidates:
            score = 0
            p_title = (p.title or "").lower()
            p_brand = (p.brand or "").lower()
            p_url = (p.product_url or "").lower()
            p_compact = re.sub(r"[\s\-_]", "", p_title)

            # Direct full phrase match
            if q in p_title or (len(p_title) > 5 and p_title in q):
                score += 100

            # Compact model code match (e.g. wh1000xm5 in wh1000xm5)
            if len(q_compact) >= 4 and q_compact in p_compact:
                score += 90

            matched_tokens = 0
            for token in tokens:
                if re.search(rf"\b{re.escape(token)}\b", p_title):
                    score += 30
                    matched_tokens += 1
                elif re.search(rf"\b{re.escape(token)}\b", p_brand):
                    score += 20
                    matched_tokens += 1
                elif token in p_url:
                    score += 15
                    matched_tokens += 1

            if tokens and matched_tokens >= len(tokens):
                score += 50

            min_required_tokens = max(1, (len(tokens) + 1) // 2)
            has_valid_match = (
                (matched_tokens >= min_required_tokens)
                or (q in p_title)
                or (len(q_compact) >= 4 and q_compact in p_compact)
            )

            if has_valid_match:
                if p.price and p.price > 0:
                    score += 10
                if p.scraped_at:
                    age_hours = (_utcnow() - p.scraped_at).total_seconds() / 3600.0
                    if age_hours < 2:
                        score += 15
            else:
                score = 0

            if score > best_score:
                best_score = score
                best_prod = p

        if best_prod and best_score >= 50:
            prod_data = {
                "id": best_prod.id,
                "product_id": best_prod.id,
                "store": best_prod.source,
                "title": best_prod.title,
                "price": best_prod.price or 0.0,
                "brand": best_prod.brand,
                "category": best_prod.category or "Electronics",
                "image_url": best_prod.image_url,
                "product_url": best_prod.product_url,
                "availability": best_prod.availability or "In Stock",
                "rating": best_prod.rating,
                "review_count": best_prod.review_count,
                "scraped_at": best_prod.scraped_at.isoformat() if best_prod.scraped_at else None,
            }
            stores_result[store] = {
                "status": "ready",
                "product": prod_data,
            }
            found_products.append(prod_data)
        else:
            stores_result[store] = {
                "status": "hunting",
                "product": None,
            }

    valid_prices = [p["price"] for p in found_products if p.get("price") and p["price"] > 0]
    cheapest_price = min(valid_prices) if valid_prices else 0.0
    highest_price = max(valid_prices) if valid_prices else 0.0
    cheapest_store = next((p["store"] for p in found_products if p["price"] == cheapest_price), "amazon")
    max_savings_usd = round(highest_price - cheapest_price, 2)
    max_savings_pct = round((max_savings_usd / highest_price) * 100, 1) if highest_price > 0 else 0.0

    primary_name = query.title()
    primary_category = "Electronics"
    if found_products:
        primary_name = found_products[0]["title"]
        primary_category = found_products[0].get("category") or "Electronics"

    comparison = {
        "item_name": primary_name,
        "category": primary_category,
        "stores": found_products,
        "cheapest_store": cheapest_store,
        "cheapest_price": cheapest_price,
        "highest_price": highest_price,
        "max_savings_usd": max_savings_usd,
        "max_savings_pct": max_savings_pct,
    }

    return stores_result, comparison


@app.get("/api/product/status")
@app.get("/product/status")
@app.get("/api/products/status")
@app.get("/products/status")
def get_product_status(
    search_term: Optional[str] = None,
    query: Optional[str] = None,
    db: Session = Depends(get_db),
):
    target = (search_term or query or "").strip()
    if not target:
        raise HTTPException(status_code=400, detail="search_term or query parameter required")

    stores_result, comparison = _match_products_for_query(target, db)

    completed = [s for s, data in stores_result.items() if data["status"] == "ready"]
    pending = [s for s, data in stores_result.items() if data["status"] == "hunting"]
    is_complete = len(pending) == 0

    return {
        "search_term": target,
        "status": "complete" if is_complete else "hunting",
        "is_complete": is_complete,
        "completed_stores": completed,
        "pending_stores": pending,
        "stores": stores_result,
        "comparison": comparison,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)