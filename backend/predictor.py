"""Predictive E-Commerce Intelligence Engine.

Robust price-trajectory forecasting for scraped retail time-series:

1. Timestamp-aware feature extraction — regress against *real* elapsed days
   (handles irregular scrape intervals) instead of naive point indices.
2. Outlier winsorization — MAD-based robust z-scores clip flash-sale spikes /
   scraper glitches so a single bad point cannot hijack the fit.
3. Ensemble slope estimation — recency-weighted least squares (captures the
   latest momentum) blended with Theil-Sen median regression (immune to
   residual outliers), weighted by fit quality.
4. Damped multi-step forecast — Holt-style geometric trend damping produces
   realistic short-horizon projections instead of runaway straight lines.
5. Volatility- and coverage-aware confidence scoring.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime
from typing import Any

import numpy as np
from sklearn.linear_model import LinearRegression, TheilSenRegressor

logger = logging.getLogger("spider-sense.predictor")

# ---------------------------------------------------------------------------
# Tunable model hyperparameters
# ---------------------------------------------------------------------------
HALF_LIFE_DAYS = 14.0        # recency weight half-life for WLS
DAMPING_FACTOR = 0.85        # Holt-style per-step trend damping
MAX_SLOPE_PCT_OF_MEAN = 2.5  # clamp |daily slope| to % of mean price
FORECAST_FLOOR_FRACTION = 0.70  # forecast floor vs observed minimum
ROBUST_Z_THRESHOLD = 3.5     # MAD-based modified z-score cutoff
THEIL_SEN_MIN_POINTS = 6     # minimum samples before enabling Theil-Sen

_NO_DATA = {
    "status": "no_data",
    "current_price": 0.0,
    "average_price": 0.0,
    "lowest_price": 0.0,
    "highest_price": 0.0,
    "trend": "stable",
    "slope_per_day": 0.0,
    "forecast_next_7d": [0.0] * 7,
    "verdict": "STABLE",
    "action": "WATCH",
    "message": "🕸️ Collecting initial price points for analysis.",
    "confidence": 50,
    "days_to_drop": None,
    "predicted_lowest": None,
    "savings_potential_usd": 0.0,
    "savings_potential_pct": 0.0,
    "volatility_pct": None,
    "data_points": 0,
    "model": None,
}


def _parse_timestamp(value: Any) -> datetime | None:
    """Parses ISO-8601 strings / datetime objects into naive datetimes."""
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, str) and value.strip():
        try:
            dt = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
            return dt.replace(tzinfo=None)
        except ValueError:
            return None
    return None


class PricePredictor:
    """
    Analyzes historical price trajectories, calculates price momentum,
    forecasts the next 7 days with a robust ensemble (recency-weighted
    linear regression + Theil-Sen), and produces actionable Spider-Verse
    buy/wait recommendations.
    """

    # ------------------------------------------------------------------
    # Feature extraction & cleaning
    # ------------------------------------------------------------------
    def _extract_series(
        self, history: list[dict[str, object]] | None
    ) -> tuple[np.ndarray, np.ndarray, bool]:
        """Returns (t_days, prices, timed). Falls back to index-based time
        axis when any timestamp is missing or unparseable."""
        points: list[tuple[datetime | None, float]] = []
        for entry in history or []:
            if not isinstance(entry, dict):
                continue
            raw = entry.get("price")
            if raw is None:
                continue
            try:
                price = float(raw)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                continue
            if not math.isfinite(price) or price <= 0:
                continue
            points.append((_parse_timestamp(entry.get("scraped_at")), price))

        if not points:
            return np.array([]), np.array([]), False

        timed = all(ts is not None for ts, _ in points)
        if timed:
            points.sort(key=lambda p: p[0])  # type: ignore[arg-type,return-value]
            t0 = points[0][0]
            assert t0 is not None
            t = np.array(
                [((ts - t0).total_seconds() / 86400.0) for ts, _ in points if ts is not None], dtype=float
            )
        else:
            t = np.arange(len(points), dtype=float)

        prices = np.array([p for _, p in points], dtype=float)

        # Collapse exact-duplicate timestamps by averaging their prices.
        if timed and len(np.unique(t)) < len(t):
            unique_t, collapsed = [], []
            for tv in np.unique(t):
                mask = t == tv
                unique_t.append(tv)
                collapsed.append(prices[mask].mean())
            t = np.array(unique_t, dtype=float)
            prices = np.array(collapsed, dtype=float)

        return t, prices, timed

    @staticmethod
    def _winsorize(prices: np.ndarray) -> tuple[np.ndarray, int]:
        """Clips extreme outliers using MAD-based modified z-scores so that
        scraper glitches don't distort regression or statistics."""
        median = float(np.median(prices))
        mad = float(np.median(np.abs(prices - median)))
        if mad < 1e-9:
            return prices, 0

        modified_z = 0.6745 * (prices - median) / mad
        lower = median - ROBUST_Z_THRESHOLD * mad / 0.6745
        upper = median + ROBUST_Z_THRESHOLD * mad / 0.6745
        clipped = np.clip(prices, lower, upper)
        n_outliers = int(np.sum(np.abs(modified_z) > ROBUST_Z_THRESHOLD))
        return clipped, n_outliers

    # ------------------------------------------------------------------
    # Main entrypoint
    # ------------------------------------------------------------------
    def predict(self, price_history: list[dict[str, object]]) -> dict[str, object]:
        t, raw_prices, timed = self._extract_series(price_history)
        if len(raw_prices) == 0:
            return dict(_NO_DATA)

        current = float(raw_prices[-1])
        mean = float(raw_prices.mean())
        min_seen = float(raw_prices.min())
        max_seen = float(raw_prices.max())

        if len(raw_prices) < 3:
            at_low = current <= min_seen
            return {
                "status": "limited_data",
                "current_price": round(current, 2),
                "average_price": round(mean, 2),
                "lowest_price": round(min_seen, 2),
                "highest_price": round(max_seen, 2),
                "trend": "stable",
                "slope_per_day": 0.0,
                "forecast_next_7d": [round(current, 2)] * 7,
                "verdict": "LOWEST_EVER" if at_low else "STABLE",
                "action": "BUY_NOW" if at_low else "WATCH",
                "message": (
                    f"🕷️ Spider-Sense detects historic low! Great time to buy."
                    if at_low
                    else "🌐 Tracking prices across retailers. Check back soon."
                ),
                "confidence": 65,
                "days_to_drop": None,
                "predicted_lowest": round(current, 2),
                "savings_potential_usd": round(max(0.0, max_seen - current), 2),
                "savings_potential_pct": round(
                    ((max_seen - current) / max_seen * 100) if max_seen > 0 else 0, 1
                ),
                "volatility_pct": None,
                "data_points": int(len(raw_prices)),
                "model": None,
            }

        prices_fit, n_outliers = self._winsorize(raw_prices)
        slope, r2, model_name = self._fit_slope(t, prices_fit)

        # ---- Volatility (relative residual spread, in % of mean) -------
        fitted = slope * t + float(np.average(prices_fit, weights=self._recency_weights(t)))
        residuals = prices_fit - fitted
        residual_std = float(np.sqrt(np.mean(residuals**2)))
        volatility_pct = round(residual_std / mean * 100, 2) if mean > 0 else 0.0

        # ---- Confidence: fit quality + coverage − volatility -----------
        coverage = min(1.0, len(raw_prices) / 21.0)
        confidence = int(
            round(
                58
                + 26 * max(0.0, min(1.0, r2))
                + 8 * coverage
                - min(10.0, volatility_pct)
            )
        )
        confidence = max(55, min(97, confidence))

        # ---- Damped 7-day forecast -------------------------------------
        forecast_floor = max(0.50, min_seen * FORECAST_FLOOR_FRACTION)
        max_daily_move = mean * MAX_SLOPE_PCT_OF_MEAN / 100.0
        projected_slope = float(np.clip(slope, -max_daily_move, max_daily_move))

        forecast: list[float] = []
        running = current
        for step_h in range(1, 8):
            running = max(
                forecast_floor, running + projected_slope * (DAMPING_FACTOR**step_h)
            )
            forecast.append(round(running, 2))

        projected_lowest = min(forecast)
        projected_lowest_day = forecast.index(projected_lowest) + 1

        potential_drop_usd = round(max(0.0, current - projected_lowest), 2)
        potential_drop_pct = round(
            (potential_drop_usd / current * 100) if current > 0 else 0, 1
        )

        # ---- Verdict decision tree -------------------------------------
        # A price only counts as a genuine "all-time low" moment when it is
        # BOTH at the historical floor AND momentum has actually flattened.
        # On any declining series the newest point is trivially the new low,
        # so without the momentum gate every drop would read BUY NOW.
        fast_fall_threshold = max(0.30, mean * 0.002)  # $/day, scales with price level
        still_falling_fast = slope < -fast_fall_threshold
        at_record_low = current <= (min_seen * 1.01) and max_seen > min_seen
        is_all_time_low = at_record_low and not still_falling_fast

        if is_all_time_low:
            verdict = "LOWEST_EVER"
            action = "BUY_NOW"
            message = (
                f"🕷️ ALL-TIME LOW! At ${current:.2f}, this is the best price ever "
                f"recorded. Buy now!"
            )
        elif still_falling_fast and potential_drop_pct >= 4.0:
            verdict = "WAIT"
            action = "WAIT"
            message = (
                f"⏳ WAIT {projected_lowest_day} MORE DAYS! Prices are falling fast "
                f"(proj. ${projected_lowest:.2f}, save ~${potential_drop_usd:.2f} / "
                f"{potential_drop_pct:.0f}%)."
            )
        elif slope < -0.05 or current < (mean * 0.96):
            verdict = "PRICE_DROPPING"
            action = "BUY_NOW"
            message = (
                f"📉 Price is trending down below average (${mean:.2f}). Good time to buy!"
            )
        elif current >= (max_seen * 0.98):
            verdict = "WAIT"
            action = "WAIT"
            message = (
                f"🛑 PEAK PRICE ALERT: Currently at ${current:.2f} near historic high "
                f"(${max_seen:.2f}). Wait for a drop."
            )
        else:
            verdict = "STABLE"
            action = "WATCH"
            message = f"🌐 Price is steady around ${current:.2f}. Buy whenever convenient."

        trend = "down" if slope < -0.01 else ("up" if slope > 0.01 else "stable")

        return {
            "status": "ok",
            "current_price": round(current, 2),
            "average_price": round(mean, 2),
            "lowest_price": round(min_seen, 2),
            "highest_price": round(max_seen, 2),
            "trend": trend,
            "slope_per_day": round(slope, 4),
            "forecast_next_7d": forecast,
            "verdict": verdict,
            "action": action,
            "message": message,
            "confidence": confidence,
            "days_to_drop": (
                projected_lowest_day
                if (verdict == "WAIT" and potential_drop_usd > 0)
                else None
            ),
            "predicted_lowest": round(projected_lowest, 2),
            "savings_potential_usd": (
                potential_drop_usd
                if verdict == "WAIT"
                else round(max(0.0, max_seen - current), 2)
            ),
            "savings_potential_pct": (
                potential_drop_pct
                if verdict == "WAIT"
                else round(((max_seen - current) / max_seen * 100) if max_seen > 0 else 0, 1)
            ),
            "volatility_pct": volatility_pct,
            "data_points": int(len(raw_prices)),
            "model": model_name + ("+timed" if timed else "+index"),
        }

    # ------------------------------------------------------------------
    # Model internals
    # ------------------------------------------------------------------
    @staticmethod
    def _recency_weights(t: np.ndarray) -> np.ndarray:
        """Exponential recency weights: newest observation gets weight 1,
        older observations decay with a configurable half-life."""
        age = t.max() - t
        return np.power(0.5, age / HALF_LIFE_DAYS)

    def _fit_slope(
        self, t: np.ndarray, prices: np.ndarray
    ) -> tuple[float, float, str]:
        """Ensemble slope: recency-weighted LS blended with Theil-Sen,
        weighted by the WLS fit quality (R²). Returns (slope_per_day, r2, name)."""
        x = t.reshape(-1, 1)
        w = self._recency_weights(t)

        wls = LinearRegression()
        wls.fit(x, prices, sample_weight=w)
        slope_wls = float(wls.coef_[0])

        # Weighted R² of the WLS fit (guard degenerate constant series).
        pred = wls.predict(x)
        w_mean = float(np.average(prices, weights=w))
        ss_res = float(np.sum(w * (prices - pred) ** 2))
        ss_tot = float(np.sum(w * (prices - w_mean) ** 2))
        r2 = 1.0 - ss_res / ss_tot if ss_tot > 1e-9 else 0.0
        r2 = max(0.0, min(1.0, r2))

        if len(prices) >= THEIL_SEN_MIN_POINTS:
            try:
                ts_model = TheilSenRegressor(random_state=42, max_subpopulation=500)
                ts_model.fit(x, prices)
                slope_ts = float(ts_model.coef_[0])
                # High R² → trust WLS momentum; low R² → lean on the robust median.
                slope = r2 * slope_wls + (1.0 - r2) * slope_ts
                return slope, r2, "ensemble-wls+theilsen"
            except Exception as e:  # pragma: no cover - defensive
                logger.warning("Theil-Sen fit failed, falling back to WLS: %s", e)

        return slope_wls, r2, "wls-recency"
