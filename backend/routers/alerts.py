from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Product, Alert, PriceWatch
from models import AlertOut

router = APIRouter(tags=["alerts"])


class AlertAddRequest(BaseModel):
    product_id: str | None = None
    email: str | None = None


@router.post("/api/alerts/add")
@router.post("/alerts/add")
def add_alert(req: AlertAddRequest, db: Session = Depends(get_db)):
    """Subscribes a user (optionally via email) to price drop alerts for a product."""
    if not req.product_id:
        raise HTTPException(status_code=400, detail="product_id is required")

    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{req.product_id}' not found")

    existing = (
        db.query(PriceWatch)
        .filter(
            PriceWatch.product_id == req.product_id,
            PriceWatch.email == req.email,
            PriceWatch.active == 1,
        )
        .first()
    )
    if existing:
        return {
            "status": "success",
            "message": f"🔔 Already watching {product.title} — Spider-Sense will alert you on the next drop!",
        }

    watch = PriceWatch(product_id=req.product_id, email=req.email, active=1)
    db.add(watch)
    db.commit()

    return {
        "status": "success",
        "product_id": req.product_id,
        "email": req.email,
        "message": f"🔔 Watching {product.title} — we'll ping you when the price drops!",
    }


@router.get("/api/alerts", response_model=list[AlertOut])
@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(
    alert_type: str | None = None,
    limit: int = 40,
    db: Session = Depends(get_db),
):
    query = db.query(Alert)
    if alert_type:
        query = query.filter(Alert.alert_type == alert_type)

    alerts_records = query.order_by(Alert.created_at.desc()).limit(limit).all()

    # Batch-fetch referenced products in one query instead of N+1 lookups.
    product_ids = {a.product_id for a in alerts_records}
    product_map: dict[str, Product] = {}
    if product_ids:
        product_map = {
            p.id: p for p in db.query(Product).filter(Product.id.in_(product_ids)).all()
        }

    results: list[AlertOut] = []
    for a in alerts_records:
        product = product_map.get(a.product_id)
        results.append(
            AlertOut(
                id=a.id,
                product_id=a.product_id,
                product_title=product.title if product else "Spider-Sense Tracked Product",
                product_image=product.image_url if product else None,
                product_source=product.source if product else "retailer",
                alert_type=a.alert_type,
                old_price=round(float(a.old_price), 2) if a.old_price is not None else 0.0,
                new_price=round(float(a.new_price), 2) if a.new_price is not None else 0.0,
                drop_percent=round(float(a.drop_percent), 1) if a.drop_percent is not None else 0.0,
                message=a.message or "Price drop alert detected",
                created_at=a.created_at,
            )
        )

    return results

