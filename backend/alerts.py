"""Alert evaluation engine for Spider-Sense price drops and inventory changes."""
from __future__ import annotations
from sqlalchemy.orm import Session
from database import PriceHistory, Alert, Product


def evaluate_alerts(db: Session, product: Product, latest: PriceHistory) -> Alert | None:
    """
    Evaluates new incoming price points against historical trends to trigger
    instant Spider-Sense alerts (lowest ever, steep drops, back in stock).
    """
    if not latest or latest.price is None or latest.price <= 0:
        return None

    history: list[PriceHistory] = (
        db.query(PriceHistory)
        .filter(PriceHistory.product_id == product.id)
        .order_by(PriceHistory.scraped_at.asc())
        .all()
    )

    if len(history) < 2:
        return None

    previous = history[-2]
    prior_history = history[:-1]

    if not prior_history or previous.price is None or previous.price <= 0:
        return None

    valid_prior_prices = [h.price for h in prior_history if h.price is not None and h.price > 0]
    if not valid_prior_prices:
        return None

    prior_min_price = min(valid_prior_prices)
    drop_pct = ((previous.price - latest.price) / previous.price) * 100
    price_diff = previous.price - latest.price

    alert: Alert | None = None
    # product.title and product.source are already `str` via Mapped[str]
    title_snippet = product.title[:50]
    source_name = product.source.upper()

    # 1. New All-Time Low Alert
    if latest.price < prior_min_price:
        savings = prior_min_price - latest.price
        alert = Alert(
            product_id=product.id,
            alert_type="lowest_ever",
            old_price=round(previous.price, 2),
            new_price=round(latest.price, 2),
            drop_percent=round(max(0.0, drop_pct), 1),
            message=(
                f"🕷️ NEW ALL-TIME LOW! {title_snippet} dropped to ${latest.price:.2f} "
                f"on {source_name} (Beat lowest by ${savings:.2f})!"
            ),
        )
    # 2. Steep Price Drop Alert (>= 8% or >= $15 drop)
    elif drop_pct >= 8.0 or price_diff >= 15.0:
        alert = Alert(
            product_id=product.id,
            alert_type="price_drop",
            old_price=round(previous.price, 2),
            new_price=round(latest.price, 2),
            drop_percent=round(drop_pct, 1),
            message=(
                f"📉 {drop_pct:.0f}% FLASH SALE! {title_snippet} dropped from "
                f"${previous.price:.2f} to ${latest.price:.2f} on {source_name}!"
            ),
        )
    # 3. Back In Stock Alert
    elif (
        previous.availability
        and "out of stock" in previous.availability.lower()
        and latest.availability
        and "in stock" in latest.availability.lower()
    ):
        alert = Alert(
            product_id=product.id,
            alert_type="back_in_stock",
            old_price=round(previous.price, 2),
            new_price=round(latest.price, 2),
            drop_percent=0.0,
            message=f"📦 BACK IN STOCK! {title_snippet} is available again at ${latest.price:.2f} on {source_name}!",
        )

    if alert:
        db.add(alert)
        db.flush()

    return alert
