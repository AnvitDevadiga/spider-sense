# 🕷️ Spider-Sense — Predictive E-Commerce Price Intelligence

> *"With great data comes great savings."* 🕸️  
> **Bright Data 'Into the Scrape-Verse' Hackathon Submission**  
> **Target Tracks**: Grand Prize (**Web-Slinger**), Best UI (**Suit-Up**), and Architecture (**Spider-Sense**)

[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![Bright Data](https://img.shields.io/badge/Bright_Data-Scraper_Studio-blue?style=for-the-badge&logo=databricks&logoColor=white)](https://brightdata.com)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.5%2B-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org)
[![Pytest](https://img.shields.io/badge/Tests-21%20Passed-brightgreen?style=for-the-badge&logo=pytest&logoColor=white)](https://pytest.org)

---

## 🌟 Overview

**Spider-Sense** is an autonomous predictive e-commerce intelligence platform that extracts, normalizes, and analyzes live product data across **Amazon, Walmart, and Best Buy** using a multi-stage crawler pipeline built on **Bright Data Scraper Studio**.

By combining automated web data extraction with **scikit-learn machine learning**, Spider-Sense forecasts price trajectories, detects historical price floors, calculates cross-store arbitrage savings, and alerts shoppers the exact moment to buy at historic lows.

### ⚡ Core Capabilities
- 🕸️ **4-Stage Scraper Studio Pipeline**: Google Scout collector dynamically discovers cross-retailer product URLs and dispatches 3 dedicated retailer collectors in parallel.
- ⏱️ **Real-Time Stream Polling**: Non-blocking asynchronous search (`202 Accepted`) paired with high-frequency status polling (`/api/product/status`) visualizing live scraper hunting states.
- 🤖 **Ensemble ML Forecaster**: Blends exponential recency-weighted linear regression with Theil-Sen robust median estimators to project 7-day price trajectories with Holt damping ($\phi = 0.85$).
- 📊 **Multi-Store Price Matrix**: Cross-store alignment across Amazon, Walmart, and Best Buy highlighting the cheapest retailer, price spreads, and instant dollar/percentage arbitrage savings.
- 🚨 **Price Drop Sentinel**: Autonomous alerting engine that detects flash price drops and all-time low threshold breaches.
- 🩺 **AI Self-Healing Integration**: Seamless trigger with the Bright Data CLI (`bdata scraper heal`) to re-synthesize broken selectors when retailer DOM structures evolve.

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph Client_App["✨ Spider-Sense Frontend (Next.js 14 + TailwindCSS + Lucide Icons)"]
        UI_SEARCH["Instant Search Bar & Real-Time Radar"]
        UI_MATRIX["Multi-Store Price Matrix (/compare)"]
        UI_DETAIL["Price History & 7-Day ML Forecast Modal"]
        UI_ALERTS["Flash Drop Sentinel (/alerts)"]
        UI_HEAL["AI Scraper Self-Healing Modal"]
    end

    subgraph Backend_Engine["⚡ FastAPI Backend Engine (Python 3.12)"]
        API_SEARCH["Search Router (/api/search)"]
        STATUS_POLL["Live Progress Poller (/api/product/status)"]
        DISPATCHER["Multi-Collector Dispatcher (Parallel Threads)"]
        WEBHOOK_GW["Webhook Gateway (/webhook/{source})"]
        POLL_WORKER["Background Polling Fallback Worker"]
        NORMALIZER["Data Normalizer & Sanitizer (normalizer.py)"]
        DB[(SQLite / PostgreSQL Engine)]
        PREDICTOR["scikit-learn Ensemble Forecaster (predictor.py)"]
        SENTINEL["Price Drop Sentinel (alerts.py)"]
    end

    subgraph Bright_Data_Cloud["🌐 Bright Data Scraper Studio & DCA"]
        BD_GOOGLE["#1 Google Scout Collector (c_mt4jdk882ftyi0l2tq)"]
        BD_AMZ["#2 Amazon Collector (c_mt3w3rtn12g4br728n)"]
        BD_WMT["#3 Walmart Collector (c_mt3wf5q4kwqm2mhi)"]
        BD_BBY["#4 Best Buy Collector (c_mt3vgsej1ydszi4zhf)"]
        BD_CLI["AI Self-Healing Engine (bdata scraper heal)"]
    end

    UI_SEARCH -->|POST /api/search (202 Accepted)| API_SEARCH
    UI_SEARCH -.->|GET /api/product/status (Polling)| STATUS_POLL
    STATUS_POLL <--> DB
    API_SEARCH -->|Trigger Search Query| BD_GOOGLE
    API_SEARCH -->|Parallel Dispatch| DISPATCHER

    BD_GOOGLE -->|POST Webhook / Delivery| WEBHOOK_GW
    WEBHOOK_GW --> DISPATCHER

    DISPATCHER -->|POST /dca/trigger| BD_AMZ
    DISPATCHER -->|POST /dca/trigger| BD_WMT
    DISPATCHER -->|POST /dca/trigger| BD_BBY

    BD_AMZ -->|Delivery| WEBHOOK_GW
    BD_WMT -->|Delivery| WEBHOOK_GW
    BD_BBY -->|Delivery| WEBHOOK_GW

    DISPATCHER -.->|Async Fallback Polling| POLL_WORKER
    POLL_WORKER -->|Fetch Dataset| NORMALIZER

    WEBHOOK_GW --> NORMALIZER
    NORMALIZER --> DB
    DB --> PREDICTOR
    PREDICTOR --> SENTINEL
    SENTINEL --> DB

    DB --> UI_MATRIX
    DB --> UI_DETAIL
    DB --> UI_ALERTS
    UI_HEAL -->|bdata scraper heal| BD_CLI
```

---

## 🕸️ Bright Data Scraper Studio Integration

Spider-Sense orchestrates **4 custom collectors** built in **Bright Data Scraper Studio**:

| Role | Scraper Name | Collector ID | Target Selectors | Extracted Fields |
|---|---|---|---|---|
| **#1 Scout / Router** | `google_spidersense` | `c_mt4jdk882ftyi0l2tq` | `.g, #rso, a` | `query`, `amazon_url`, `walmart_url`, `bestbuy_url` |
| **#2 Retailer** | `amazon_spidersense` | `c_mt3w3rtn12g4br728n` | `#productTitle`, `.a-offscreen`, `#acrPopover` | `source_id`, `title`, `price`, `rating`, `review_count`, `availability`, `image_url` |
| **#3 Retailer** | `walmart_spidersense` | `c_mt3wf5q4kwqm2mhi` | `h1#main-title`, `[data-seo-id=hero-price]` | `source_id`, `title`, `price`, `rating`, `review_count`, `availability`, `image_url` |
| **#4 Retailer** | `bestbuy_spidersense` | `c_mt3vgsej1ydszi4zhf` | `h1.text-default`, `[data-testid*="customer-price"]` | `source_id`, `title`, `price`, `rating`, `review_count`, `availability`, `image_url` |

### Pipeline Highlights
1. **Schema Override Compatibility**: Passes `override_incompatible_schema=1` on all trigger requests to ensure seamless data delivery without validation lockouts.
2. **Dual Delivery Architecture**:
   - **Real-Time Webhooks** (`/webhook/{source}`): Instant delivery for production environments via ngrok or public IP.
   - **Asynchronous Polling Fallback** (`brightdata_client.poll_results`): Guarantees zero data loss even during network interruptions.
3. **AI Self-Healing Scrapers**: Supports instant repair via `bdata scraper heal <collector_id> "<error_description>"` to autonomously regenerate resilient CSS selectors when retailers alter page layouts.

---

## 🤖 Predictive Machine Learning Engine

Located in [`backend/predictor.py`](backend/predictor.py), the price forecasting engine uses a multi-model ensemble:

1. **Recency-Weighted Linear Regression**:
   Uses an exponential decay weighting kernel:
   $$w_i = \exp\left(-\frac{\ln(2)}{\tau} \cdot (t_{\text{now}} - t_i)\right) \quad (\tau = 14\text{ days})$$
   Giving significantly higher significance to recent market fluctuations.
2. **Theil-Sen Robust Median Regression**:
   Computes median slopes across all sample pairs, making the forecast resilient against transient outliers and flash discount noise.
3. **Damped 7-Day Trajectory**:
   Applies Holt-style trend damping ($\phi = 0.85$) to prevent unbounded linear divergence:
   $$\hat{y}_{t+k} = y_t + \sum_{j=1}^k \phi^j \cdot \beta$$
4. **Spider-Sense Buying Verdicts**:
   - `🕷️ ALL-TIME LOW — Buy now!`: Current price is within 2% of the historical floor and trend is stabilizing.
   - `⏳ WAIT FOR DROP`: Negative velocity detected; forecast projects lower price within 3–7 days.
   - `📉 PRICE DROPPING`: Active downward momentum below 14-day moving average.
   - `⚖️ FAIR PRICE`: Price is stable within the historical interquartile range.
5. **Confidence Score (50–98%)**:
   Derived from regression goodness-of-fit ($R^2$), historical sample volume, and price variance.

---

## 📦 Canonical Data Contract

All raw scraper payloads are normalized into a unified schema:

```json
{
  "id": "amazon:B0D1XD1ZV3",
  "source": "amazon",
  "source_id": "B0D1XD1ZV3",
  "title": "Apple AirPods Pro (2nd Generation) with MagSafe Case (USB-C)",
  "price": 189.99,
  "currency": "USD",
  "rating": 4.7,
  "review_count": 18450,
  "availability": "In Stock",
  "image_url": "https://m.media-amazon.com/images/I/61SUj2aKoEL._AC_SL1500_.jpg",
  "product_url": "https://www.amazon.com/dp/B0D1XD1ZV3",
  "brand": "Apple",
  "category": "Headphones",
  "scraped_at": "2026-08-23T06:50:00Z"
}
```

---

## 📁 Repository Structure

```text
spider-sense/
├── backend/
│   ├── main.py                  # FastAPI application entrypoint & search orchestrator
│   ├── database.py              # SQLAlchemy ORM models (Product, PriceHistory, Alert)
│   ├── normalizer.py            # Canonical data normalizer & currency/URL sanitizer
│   ├── predictor.py             # Scikit-learn ML price forecasting engine
│   ├── alerts.py                # Flash price drop detection & evaluation sentinel
│   ├── brightdata_client.py     # Bright Data REST API & Scraper Studio trigger client
│   ├── webhook.py               # Ingestion handlers for multi-retailer webhooks
│   ├── routers/
│   │   ├── scrapers.py          # Scraper status & AI self-healing router
│   │   └── products.py          # Product catalog & matrix comparison router
│   ├── tests/
│   │   ├── test_endpoints.py    # API endpoint, polling & search tests
│   │   ├── test_normalizer.py   # Data sanitization & currency parser tests
│   │   └── test_predictor.py    # Regression & ML forecast validation tests
│   └── requirements.txt         # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js 14 App Router pages (Dashboard, Compare, Alerts, Product)
│   │   └── components/          # Glassmorphic UI components & charts
│   ├── package.json
│   └── tailwind.config.ts
│
├── scrapers/brightdata/
│   ├── google_spidersense.js    # Scout collector (Interaction + Parser)
│   ├── amazon_spidersense.js    # Amazon scraper code
│   ├── walmart_spidersense.js   # Walmart scraper code
│   ├── bestbuy_spidersense.js   # Best Buy scraper code
│   └── README.md                # Scraper Studio setup & authoring guide
│
├── docker-compose.yml           # Multi-container orchestration
├── DEMO.md                      # 3-minute hackathon demo video script
└── README.md                    # Project documentation
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Python 3.12+**
- **Node.js 18+** & **npm**
- **ngrok** (optional, for live Scraper Studio webhooks)

---

### Option A: Local Development

#### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start backend server on port 8000
uvicorn main:app --reload --port 8000
```

#### 2. Expose Webhook Gateway (Optional)
```bash
ngrok http 8000
```
Set your Bright Data Scraper Studio webhooks to: `https://<your-subdomain>.ngrok-free.app/webhook/{source}`

#### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

### Option B: Docker Compose

```bash
docker-compose up --build
```
- **Frontend Application**: `http://localhost:3000`
- **Interactive Swagger API Docs**: `http://localhost:8000/docs`

---

## 📡 API Reference Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/search` | Non-blocking search dispatch (`202 Accepted`), triggers Scout + Retailer collectors |
| `GET` | `/api/product/status` | Real-time polling endpoint tracking store progress (`hunting` vs `ready`) |
| `GET` | `/api/compare` | Multi-store comparison matrix with cross-store arbitrage savings |
| `GET` | `/api/products` | Retrieves all tracked products |
| `GET` | `/products/{product_id}` | Product deep-dive with price history & 7-day ML price forecast |
| `GET` | `/api/alerts` | Fetches active price drop alerts |
| `POST` | `/api/alerts/add` | Subscribes an email to price drop alerts for a product |
| `POST` | `/demo/simulate-drop` | Simulates an instant 25% flash price drop for demo presentations |
| `POST` | `/demo/seed` | Seeds database with 15 flagship demo products and 30-day price history |
| `POST` | `/api/clear-history` | Resets product history and clears demo data |
| `POST` | `/webhook/{source}` | Universal webhook ingestor (`google`, `amazon`, `walmart`, `bestbuy`) |
| `GET` | `/scrapers/status` | Operational status of all 4 Bright Data collectors |
| `POST` | `/scrapers/trigger/{source}` | On-demand trigger for Bright Data collectors |
| `POST` | `/scrapers/heal` | Triggers Bright Data CLI AI Self-Healing (`bdata scraper heal`) |
| `GET` | `/stats` | Platform metrics (products tracked, price points, alert counts) |
| `GET` | `/health` | Backend and database connectivity beacon |

---

## 🧪 Automated Testing

Run the full automated test suite covering endpoints, status poller, normalizers, and ML predictor engines:

```bash
cd backend
pytest
```

```text
============================= test session starts ==============================
platform darwin -- Python 3.12+ / 3.14+, pytest-9.1.1
collected 21 items

tests/test_endpoints.py .........                                        [ 42%]
tests/test_normalizer.py ...                                             [ 57%]
tests/test_predictor.py .........                                        [100%]

======================== 21 passed in 4.90s =========================
```

---

## 🤖 AI Coding Assistant Disclosure

In full transparency and alignment with the Bright Data Hackathon guidelines, **AI coding assistants were used as an interactive pair-programming partner** during the development of this project:
- Assisted in designing Next.js glassmorphism components and Tailwind tokens.
- Assisted in implementing the scikit-learn recency-weighted regression algorithms and pytest unit tests.
- All Bright Data Scraper Studio collector scripts, parser selectors, and webhook pipeline architectures were authored, configured, and verified by the team.

---

## 📄 License

MIT License © 2026 Spider-Sense Intelligence Team. Built for the Bright Data Into the Scrape-Verse Hackathon.