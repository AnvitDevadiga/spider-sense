from datetime import datetime, timedelta

from predictor import PricePredictor

def test_predict_empty_or_invalid():
    predictor = PricePredictor()
    
    # Empty history
    res = predictor.predict([])
    assert res["status"] == "no_data"
    
    # Invalid history
    res = predictor.predict([{"price": None}, {"price": "invalid"}])
    assert res["status"] == "no_data"

def test_predict_limited_data():
    predictor = PricePredictor()
    
    # 2 points
    history_lim: list[dict[str, object]] = [{"price": 100}, {"price": 100}]
    res = predictor.predict(history_lim)
    assert res["status"] == "limited_data"
    assert res["current_price"] == 100.0

def test_predict_dropping_price():
    predictor = PricePredictor()
    
    # Falling price history
    history: list[dict[str, object]] = [{"price": p} for p in range(120, 89, -2)]
    res = predictor.predict(history)
    
    assert res["status"] == "ok"
    assert res["trend"] == "down"
    # Slope should be negative
    assert float(str(res["slope_per_day"])) < 0
    # Current is the lowest so far, but since it's falling fast, verdict could be WAIT or PRICE_DROPPING
    assert res["verdict"] in ["WAIT", "PRICE_DROPPING"]

def test_predict_all_time_low():
    predictor = PricePredictor()
    
    # Price dropped and then stabilized to flatten the slope
    history: list[dict[str, object]] = [{"price": 150}] * 10 + [{"price": 99}] * 4  # type: ignore
    res = predictor.predict(history)
    
    assert res["status"] == "ok"
    assert res["verdict"] in ["LOWEST_EVER", "WAIT"]

def test_predict_stable():
    predictor = PricePredictor()
    # In the middle of max and min
    history: list[dict[str, object]] = [{"price": 200}] + [{"price": 100}] + [{"price": 150}] * 20  # type: ignore
    res = predictor.predict(history)
    
    assert res["status"] == "ok"
    assert res["trend"] == "stable"
    assert res["verdict"] == "STABLE"


# ---------------------------------------------------------------------------
# Enhanced engine coverage
# ---------------------------------------------------------------------------

def test_predict_timed_series_irregular_intervals():
    """Real elapsed days drive the regression, not naive point indices."""
    predictor = PricePredictor()
    start = datetime(2026, 8, 1)
    # Steady -$2/day drift sampled at irregular intervals (gaps of 1-3 days).
    offsets_days = [0, 1, 3, 4, 7, 8, 10, 14, 15, 18]
    history: list[dict[str, object]] = [
        {
            "price": 120 - 2 * d,
            "scraped_at": (start + timedelta(days=d)).isoformat(),
        }
        for d in offsets_days
    ]
    res = predictor.predict(history)

    assert res["status"] == "ok"
    assert res["model"].startswith("ensemble")  # type: ignore[union-attr]
    assert "+timed" in str(res["model"])
    # ~$2/day slope recovered despite irregular sampling.
    assert -2.6 < float(str(res["slope_per_day"])) <= -1.4


def test_predict_outlier_resilience():
    """A single scraper glitch must not hijack the slope or verdict."""
    predictor = PricePredictor()
    clean = [float(p) for p in range(120, 89, -2)]
    noisy = clean[:-1] + [9999.0]  # spike on the newest point
    history: list[dict[str, object]] = [{"price": p} for p in noisy]
    res = predictor.predict(history)

    assert res["status"] == "ok"
    # Slope stays negative and bounded — nowhere near the glitch magnitude.
    assert -5.0 < float(str(res["slope_per_day"])) < 0


def test_confidence_bounds_and_new_fields():
    predictor = PricePredictor()
    history: list[dict[str, object]] = [{"price": p} for p in range(120, 89, -2)]
    res = predictor.predict(history)

    assert 55 <= int(str(res["confidence"])) <= 97
    assert res["volatility_pct"] >= 0
    assert res["data_points"] == len(history)
    assert res["model"]
    assert len(res["forecast_next_7d"]) == 7  # type: ignore[index]


def test_predict_unsorted_timestamps_are_ordered():
    """Out-of-order input must be sorted before fitting."""
    predictor = PricePredictor()
    start = datetime(2026, 8, 1)
    rows = [
        {"price": 100.0, "scraped_at": (start + timedelta(days=9)).isoformat()},
        {"price": 118.0, "scraped_at": (start + timedelta(days=0)).isoformat()},
        {"price": 112.0, "scraped_at": (start + timedelta(days=3)).isoformat()},
        {"price": 106.0, "scraped_at": (start + timedelta(days=6)).isoformat()},
        {"price": 103.0, "scraped_at": (start + timedelta(days=8)).isoformat()},
    ]
    res = predictor.predict(rows)
    # After sorting, price declines 118 -> 100 => downward trend.
    assert res["trend"] == "down"
