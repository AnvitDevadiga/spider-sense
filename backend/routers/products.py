"""
Spider-Sense Products & Intelligence Router
===========================================
Handles product listings, detail views, multi-store price comparisons,
dynamic URL tracking, demo dataset seeding, and flash drop simulation.
"""
from __future__ import annotations

import urllib.parse
from datetime import datetime, timezone, timedelta
import random
import re
import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db, Product, PriceHistory, Alert
from models import ProductOut, ProductDetailOut, AlertOut, ComparisonItem, PredictionOut
from predictor import PricePredictor
from alerts import evaluate_alerts
import brightdata_client

logger = logging.getLogger("spider-sense.products")
router = APIRouter(tags=["products"])
predictor = PricePredictor()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _enrich_product_dto(p: Product, history: list[PriceHistory]) -> ProductOut:
    """Enriches a product model into a comprehensive ProductOut DTO.

    Expects history to be sorted by scraped_at DESC (newest first).
    """
    if not history:
        return ProductOut(
            id=p.id,
            source=p.source,
            source_id=p.source_id,
            title=p.title or "Product",
            brand=p.brand,
            category=p.category,
            image_url=p.image_url,
            product_url=p.product_url,
            current_price=0.0,
            availability="Unknown",
            last_scraped_at=_utcnow(),
        )

    valid = [h for h in history if h.price is not None and h.price > 0]
    latest = valid[0] if valid else history[0]
    current = latest.price if latest.price is not None else 0.0

    prices = [h.price for h in valid if h.price is not None]
    lowest = round(min(prices), 2) if prices else current
    highest = round(max(prices), 2) if prices else current
    avg = round(sum(prices) / len(prices), 2) if prices else current

    old = valid[1].price if len(valid) >= 2 and valid[1].price is not None else current
    chg = round(current - old, 2)
    chg_pct = round((chg / old * 100), 1) if old > 0 else 0.0
    trend = "down" if chg < 0 else ("up" if chg > 0 else "stable")
    is_falling = chg_pct < -0.5
    verdict = (
        "LOWEST_EVER"
        if (current <= lowest and len(prices) > 1 and not is_falling)
        else ("PRICE_DROPPING" if trend == "down" else "STABLE")
    )

    return ProductOut(
        id=p.id,
        source=p.source,
        source_id=p.source_id,
        title=p.title or "Product",
        brand=p.brand,
        category=p.category,
        image_url=p.image_url,
        product_url=p.product_url,
        current_price=current,
        old_price=old if old != current else None,
        lowest_price=lowest,
        highest_price=highest,
        average_price=avg,
        price_change_24h=chg,
        price_change_percent=chg_pct,
        trend=trend,
        verdict=verdict,
        availability=latest.availability or "In Stock",
        rating=latest.rating,
        review_count=latest.review_count,
        last_scraped_at=latest.scraped_at,
    )


@router.get("/api/products", response_model=list[ProductOut])
@router.get("/products", response_model=list[ProductOut])
def list_products(
    q: str | None = None,
    source: str | None = None,
    category: str | None = None,
    verdict: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Lists tracked products with optional filtering by query, retailer source, category, and verdict."""
    query = db.query(Product)
    if q and q.strip():
        tokens = [t.strip() for t in q.strip().split() if t.strip()]
        for token in tokens:
            pattern = f"%{token}%"
            query = query.filter(
                (Product.title.ilike(pattern))
                | (Product.brand.ilike(pattern))
                | (Product.category.ilike(pattern))
                | (Product.source.ilike(pattern))
                | (Product.source_id.ilike(pattern))
            )
    if source:
        query = query.filter(Product.source == source.lower())
    if category:
        query = query.filter(Product.category.ilike(f"%{category}%"))

    fetch_limit = limit * 5 if verdict else limit
    products = query.order_by(Product.created_at.desc()).limit(fetch_limit).all()
    enriched: list[ProductOut] = []

    for p in products:
        history = (
            db.query(PriceHistory)
            .filter(PriceHistory.product_id == p.id)
            .order_by(PriceHistory.scraped_at.desc())
            .all()
        )
        dto = _enrich_product_dto(p, history)
        if verdict and dto.verdict and dto.verdict.lower() != verdict.lower():
            continue
        enriched.append(dto)
        if len(enriched) >= limit:
            break

    return enriched


@router.get("/api/products/{product_id:path}", response_model=ProductDetailOut)
@router.get("/products/{product_id:path}", response_model=ProductDetailOut)
def product_detail(product_id: str, db: Session = Depends(get_db)):
    """Fetches deep-dive intelligence, full price history, 7-day ML forecast, and alert log for a single product."""
    clean_id = urllib.parse.unquote(product_id)
    product = db.query(Product).filter((Product.id == product_id) | (Product.id == clean_id)).first()
    if not product:
        raise HTTPException(404, f"Product '{product_id}' not found")

    target_id = product.id

    history_records_asc = (
        db.query(PriceHistory)
        .filter(PriceHistory.product_id == target_id)
        .order_by(PriceHistory.scraped_at.asc())
        .all()
    )

    history_records_desc = list(reversed(history_records_asc))

    prices = [
        {
            "price": round(float(p.price), 2) if p.price is not None else 0.0,
            "scraped_at": p.scraped_at.isoformat() if p.scraped_at else _utcnow().isoformat(),
            "availability": str(p.availability or "In Stock"),
            "rating": p.rating if p.rating is not None else None,
            "review_count": p.review_count if p.review_count is not None else None,
        }
        for p in history_records_asc
    ]

    prediction = predictor.predict(prices)
    enriched_product = _enrich_product_dto(product, history_records_desc)

    alerts_records = (
        db.query(Alert)
        .filter(Alert.product_id == target_id)
        .order_by(Alert.created_at.desc())
        .limit(10)
        .all()
    )

    alerts_out = [
        AlertOut(
            id=a.id,
            product_id=a.product_id,
            product_title=product.title if product else None,
            product_image=product.image_url if product else None,
            product_source=product.source if product else None,
            alert_type=a.alert_type,
            old_price=round(float(a.old_price), 2) if a.old_price is not None else 0.0,
            new_price=round(float(a.new_price), 2) if a.new_price is not None else 0.0,
            drop_percent=round(float(a.drop_percent), 1) if a.drop_percent is not None else 0.0,
            message=a.message or "Price drop alert detected",
            created_at=a.created_at,
        )
        for a in alerts_records
    ]

    return ProductDetailOut(
        product=enriched_product,
        price_history=prices,
        prediction=PredictionOut.model_validate(prediction),
        alerts=alerts_out,
    )


@router.get("/api/compare", response_model=list[ComparisonItem])
@router.get("/compare", response_model=list[ComparisonItem])
def compare_across_retailers(db: Session = Depends(get_db)):
    """
    Compares identical products across retailers side-by-side.
    Groups products by normalized title to compute cheapest store and price spread.
    """
    all_products = db.query(Product).all()
    if not all_products:
        return []

    product_price_map = {}
    for p in all_products:
        history = (
            db.query(PriceHistory)
            .filter(PriceHistory.product_id == p.id)
            .order_by(PriceHistory.scraped_at.desc())
            .first()
        )
        current_price = float(history.price) if (history and history.price is not None) else 0.0
        if current_price > 0:
            product_price_map[p.id] = {
                "product": p,
                "price": round(current_price, 2),
                "availability": str(history.availability) if (history and history.availability) else "In Stock",
            }

    if not product_price_map:
        return []

    # Group by a normalized version of the title
    groups = {}
    for pid, data in product_price_map.items():
        p = data["product"]
        # Basic normalization for grouping
        title_slug = re.sub(r'[^a-z0-9]', '', (p.title or "").lower()[:30])
        if title_slug not in groups:
            groups[title_slug] = []
        groups[title_slug].append({
            "store": p.source,
            "product_id": p.id,
            "title": p.title,
            "price": data["price"],
            "image_url": p.image_url,
            "product_url": p.product_url,
            "availability": data["availability"],
        })

    comparisons = []
    for slug, stores in groups.items():
        if not stores:
            continue
        stores.sort(key=lambda s: float(s["price"]))
        cheapest = stores[0]
        highest = stores[-1]
        cheapest_price = float(cheapest["price"])
        highest_price = float(highest["price"])
        diff_usd = round(highest_price - cheapest_price, 2)
        diff_pct = round((diff_usd / highest_price * 100) if highest_price > 0 else 0.0, 1)
        
        comparisons.append(
            ComparisonItem(
                item_name=stores[0]["title"][:50],
                category=stores[0].get("category") or "General",
                stores=stores,
                cheapest_store=str(cheapest["store"]),
                cheapest_price=cheapest_price,
                highest_price=highest_price,
                max_savings_usd=diff_usd,
                max_savings_pct=diff_pct,
            )
        )
    return comparisons


DEMO_PRODUCTS = [
    ("airpods4", "Apple AirPods 4 with Active Noise Cancellation", "Apple", "Headphones", 179.00),
    ("sonywh1000xm5", "Sony WH-1000XM5 Wireless Noise Canceling Headphones", "Sony", "Headphones", 349.99),
    ("switcholed", "Nintendo Switch OLED Console", "Nintendo", "Gaming", 349.00),
    ("sandiskextreme", "SanDisk Extreme Portable SSD 1TB", "SanDisk", "Storage", 94.99),
]

DEMO_STORES = {
    "amazon": (0.00, "https://www.amazon.com/dp/"),
    "walmart": (-7.50, "https://www.walmart.com/ip/"),
    "bestbuy": (5.00, "https://www.bestbuy.com/site/"),
}


@router.post("/demo/seed")
def seed_demo_data(db: Session = Depends(get_db)):
    """Creates a repeatable comparison dataset for local demos and empty states."""
    created = 0
    now = _utcnow()

    for model, title, brand, category, base_price in DEMO_PRODUCTS:
        for source, (offset, url_prefix) in DEMO_STORES.items():
            product_id = f"{source}:demo-{model}"
            product = db.query(Product).filter(Product.id == product_id).first()
            current_price = round(base_price + offset, 2)
            if not product:
                product = Product(
                    id=product_id,
                    source=source,
                    source_id=f"demo-{model}",
                    title=title,
                    price=current_price,
                    brand=brand,
                    category=category,
                    image_url=None,
                    product_url=f"{url_prefix}demo-{model}",
                    availability="In Stock",
                    rating=4.7,
                    review_count=1842,
                    scraped_at=now,
                )
                db.add(product)
                created += 1

            has_history = db.query(PriceHistory).filter(PriceHistory.product_id == product_id).first()
            if not has_history:
                for days_ago in range(29, -1, -1):
                    drift = ((days_ago % 7) - 3) * 0.55 + days_ago * 0.12
                    db.add(PriceHistory(
                        product_id=product_id,
                        price=round(current_price + drift, 2),
                        currency="USD",
                        availability="In Stock",
                        rating=4.7,
                        review_count=1842,
                        raw_data={"demo": True},
                        scraped_at=now - timedelta(days=days_ago),
                    ))

    db.commit()
    return {"status": "success", "products_seeded": created or len(DEMO_PRODUCTS) * len(DEMO_STORES)}


@router.post("/demo/simulate-drop")
def simulate_demo_drop(db: Session = Depends(get_db)):
    """Records a real history point and runs the same alert engine as a webhook."""
    product = db.query(Product).order_by(Product.created_at.asc()).first()
    if not product:
        seed_demo_data(db)
        product = db.query(Product).order_by(Product.created_at.asc()).first()
    if not product:
        raise HTTPException(500, "Could not prepare a product for the demo")

    latest = (
        db.query(PriceHistory)
        .filter(PriceHistory.product_id == product.id)
        .order_by(PriceHistory.scraped_at.desc())
        .first()
    )
    old_price = float(latest.price if latest and latest.price else product.price or 100.0)
    new_price = round(old_price * 0.75, 2)
    point = PriceHistory(
        product_id=product.id,
        price=new_price,
        currency="USD",
        availability="In Stock",
        rating=product.rating,
        review_count=product.review_count,
        raw_data={"demo": True, "simulated_drop": True},
        scraped_at=_utcnow(),
    )
    product.price = new_price
    product.scraped_at = point.scraped_at
    db.add(point)
    db.flush()
    alert = evaluate_alerts(db, product, point)
    db.commit()
    return {
        "status": "success",
        "product_id": product.id,
        "old_price": round(old_price, 2),
        "new_price": new_price,
        "alert_triggered": alert.message if alert else "Price drop recorded",
    }

class TrackRequest(BaseModel):
    url: str

@router.post("/products/track")
def track_product(req: TrackRequest, db: Session = Depends(get_db)):
    """Dynamically tracks a new product by retailer URL (Amazon, Walmart, Best Buy)."""
    url = req.url.strip()
    source = "unknown"
    if "amazon.com" in url:
        source = "amazon"
    elif "walmart.com" in url:
        source = "walmart"
    elif "bestbuy.com" in url:
        source = "bestbuy"
    else:
        raise HTTPException(400, "Unsupported retailer URL. Please use Amazon, Walmart, or Best Buy product URLs.")
        
    try:
        brightdata_client.trigger_collector(source, [url])
        logger.info(f"Triggered collector for tracking product: {url}")
    except Exception as e:
        logger.error(f"Failed to trigger scraper for {url}: {e}")
        raise HTTPException(500, "Failed to start tracking.")
        
    return {"status": "success", "message": "Successfully dispatched tracking job to Spider-Sense!"}
