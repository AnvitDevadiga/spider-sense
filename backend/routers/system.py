import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db, Product, PriceHistory, Alert, PriceWatch

router = APIRouter(tags=["system"])

@router.get("/")
def root():
    return {
        "project": "Spider-Sense",
        "tagline": "With great data comes great savings. 🕷️",
        "version": "1.0.0",
        "powered_by": "Bright Data Scraper Studio & scikit-learn",
        "status": "online",
        "endpoints": {
            "dashboard_products": "GET /products",
            "product_detail": "GET /products/{product_id}",
            "spider_alerts": "GET /alerts",
            "multi_store_compare": "GET /compare",
            "scrapers_status": "GET /scrapers/status",
            "trigger_scraper": "POST /scrapers/trigger/{source}",
            "track_product": "POST /products/track",
            "webhook_ingest": "POST /webhook/{source}",
        },
    }

@router.get("/health")
def health(db: Session = Depends(get_db)):
    return {
        "status": "ok",
        "database": "connected",
        "products_count": db.query(Product).count(),
        "alerts_count": db.query(Alert).count(),
    }

@router.get("/brightdata/status")
def brightdata_status():
    api_key = os.getenv("BRIGHT_DATA_API_KEY", "").strip()
    is_valid = bool(
        api_key
        and api_key != "your-key-from-brightdata"
        and api_key != "your_bright_data_api_token_here"
        and len(api_key) > 5
    )
    masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else ("Configured" if is_valid else "Not Configured")
    return {
        "configured": is_valid,
        "api_key_preview": masked_key if is_valid else None,
        "engine": "Bright Data Scraper Studio",
        "scrapers_count": 5,
        "supported_retailers": ["amazon", "walmart", "bestbuy"],
        "message": (
            "✅ Bright Data API integration active! Custom Scraper Studio webhooks & triggers ready."
            if is_valid
            else "ℹ️ Running in local simulation mode. Add BRIGHT_DATA_API_KEY to backend/.env for live cloud scraping."
        ),
    }

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    products_count = db.query(Product).count()
    price_points_count = db.query(PriceHistory).count()
    alerts_count = db.query(Alert).count()

    sources = [s[0] for s in db.query(Product.source).distinct().all() if s[0]]

    max_drop = db.query(Alert.drop_percent).order_by(Alert.drop_percent.desc()).first()
    max_drop_pct = round(max_drop[0], 1) if max_drop else 0.0

    return {
        "products_tracked": products_count,
        "price_points": price_points_count,
        "alerts_triggered": alerts_count,
        "sources": len(sources) if sources else 5,
        "retailer_list": sources or ["amazon", "walmart", "bestbuy"],
        "max_savings_percent": max_drop_pct,
    }


@router.post("/clear-history")
def clear_history(db: Session = Depends(get_db)):
    """Wipes stored items from the local database to reset the UI state."""
    db.query(Product).delete()
    db.query(PriceHistory).delete()
    db.query(Alert).delete()
    db.query(PriceWatch).delete()
    db.commit()
    return {"status": "success", "message": "History cleared successfully"}
