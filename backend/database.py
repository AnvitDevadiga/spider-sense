from __future__ import annotations
from sqlalchemy import create_engine, String, Float, Integer, DateTime, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from datetime import datetime, timezone
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./spider_sense.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _utcnow() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # e.g., amazon:B0CCZ1L489 or source_id
    source: Mapped[str] = mapped_column(String, index=True)   # amazon, walmart, bestbuy
    source_id: Mapped[str | None] = mapped_column(String, nullable=True)
    title: Mapped[str] = mapped_column(String)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    brand: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    product_url: Mapped[str | None] = mapped_column(String, nullable=True)
    availability: Mapped[str | None] = mapped_column(String, nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[str] = mapped_column(String, index=True)
    price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String, default="USD")
    availability: Mapped[str | None] = mapped_column(String, nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    raw_data: Mapped[object] = mapped_column(JSON, nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[str] = mapped_column(String, index=True)
    alert_type: Mapped[str] = mapped_column(String)
    old_price: Mapped[float] = mapped_column(Float)
    new_price: Mapped[float] = mapped_column(Float)
    drop_percent: Mapped[float] = mapped_column(Float)
    message: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
