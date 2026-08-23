from __future__ import annotations
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class ScrapePayload(BaseModel):
    """Incoming payload from Bright Data Scraper Studio webhook."""
    results: list[dict[str, object]] | None = None
    data: list[dict[str, object]] | None = None
    metadata: dict[str, object] | None = None
    source: str | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    source_id: str | None = None
    title: str
    brand: str | None = None
    category: str | None = None
    image_url: str | None = None
    product_url: str | None = None
    current_price: float | None = None
    old_price: float | None = None
    lowest_price: float | None = None
    highest_price: float | None = None
    average_price: float | None = None
    price_change_24h: float | None = None
    price_change_percent: float | None = None
    trend: str | None = "stable"
    verdict: str | None = "STABLE"
    availability: str | None = "In Stock"
    rating: float | None = None
    review_count: int | None = None
    last_scraped_at: datetime | None = None


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: str
    product_title: str | None = None
    product_image: str | None = None
    product_source: str | None = None
    alert_type: str
    old_price: float
    new_price: float
    drop_percent: float
    message: str
    created_at: datetime


class PredictionOut(BaseModel):
    status: str
    current_price: float
    average_price: float
    lowest_price: float
    highest_price: float
    trend: str
    slope_per_day: float
    forecast_next_7d: list[float]
    verdict: str
    action: str
    message: str
    confidence: int
    days_to_drop: int | None = None
    predicted_lowest: float | None = None
    savings_potential_usd: float | None = None
    savings_potential_pct: float | None = None
    volatility_pct: float | None = None
    data_points: int | None = None
    model: str | None = None


class ProductDetailOut(BaseModel):
    product: ProductOut
    price_history: list[dict[str, object]]
    prediction: PredictionOut
    alerts: list[AlertOut] = []


class ComparisonItem(BaseModel):
    item_name: str
    category: str
    stores: list[dict[str, object]]
    cheapest_store: str
    cheapest_price: float
    highest_price: float
    max_savings_usd: float
    max_savings_pct: float


class ScraperStatus(BaseModel):
    name: str
    retailer: str
    status: str
    frequency: str
    last_run: str | None = None
    products_tracked: int = 0
    sample_url: str = ""
    webhook_endpoint: str = ""
