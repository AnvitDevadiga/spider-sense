# 🕷️ Spider-Sense Demo Video Script (3-Minute Presentation Walkthrough)

> **Demo Theme**: *"With great data comes great savings."* 🕸️  
> **Target Tracks**: Grand Prize ("Web-Slinger"), Best UI ("Suit-Up"), Bright Data Scraper Studio Track

---

## ⚡ Quick Demo Setup & Prerequisites

Before recording, ensure the stack is running:

```bash
# 1. Start the stack (FastAPI Backend + Next.js UI)
docker-compose up --build

# Or locally:
# Terminal 1: cd backend && uvicorn main:app --reload --port 8000
# Terminal 2: cd frontend && npm run dev
```

* **Frontend URL**: `http://localhost:3000`
* **Sentinel Alerts Feed**: `http://localhost:3000/alerts`
* **Backend API Docs**: `http://localhost:8000/docs`

---

## ⏱️ Video Timeline & Spoken Script (3:00 Total)

### 1. The Hook & The Problem (0:00 – 0:40)
* **Screen**: Start on the **Spider-Sense Landing Page** (`http://localhost:3000`). Highlight the cyber aesthetic, telemetry status pill, and search interface.
* **Action**: Hover over the hero search bar and click one of the quick chips (e.g. `Sony WH-1000XM5` or `Apple AirPods 4`).
* **Spoken Script**:
  > *"Imagine you want to buy new Sony noise-canceling headphones or Apple AirPods. You check Amazon ($348), Walmart ($329), and Best Buy ($299). Prices fluctuate unpredictably, flash discounts disappear in minutes, and shoppers are constantly buying right before a price drop.
  >
  > Welcome to **Spider-Sense** — an autonomous predictive price intelligence platform built for the Bright Data Hackathon.
  >
  > Powered by Bright Data Scraper Studio, Spider-Sense orchestrates a 4-scraper pipeline across Google Meta-Search, Amazon, Walmart, and Best Buy. It analyzes real-time price spreads and forecasts upcoming price drops with machine learning — alerting you the exact moment to buy."*

---

### 2. Sub-Second Multi-Store Arbitrage Matrix (0:40 – 1:20)
* **Screen**: The **Live Multi-Store Matrix** renders side-by-side cards for Amazon, Best Buy, and Walmart.
* **Action**: Highlight the **"MAX ARBITRAGE SAVINGS"** badge, the **"BEST PRICE"** emerald pill on the cheapest retailer, and the instant sub-second response.
* **Spoken Script**:
  > *"Notice how the search loaded instantly. Spider-Sense features a sub-second SQLite intelligence cache. When a product is queried, our system checks local historical data first for zero-latency comparisons, and spins up background Bright Data collectors for new products with optimistic cyber-scanner loaders.
  >
  > Here in the Multi-Store Matrix, Spider-Sense aligns identical products across all retailers side-by-side. For the Sony WH-1000XM5, Spider-Sense automatically crowns Best Buy as the cheapest retailer at $299.99 and calculates a **$48.00 (14% OFF)** arbitrage spread — eliminating manual price checking across multiple websites."*

---

### 3. Scikit-Learn ML Price Forecast & Buying Verdict (1:20 – 2:05)
* **Screen**: Click the **"PRICE INTELLIGENCE"** button on any product card to open the Modal.
* **Action**: Point out the **30-Day Historical Price Curve (Solid Red)**, the **7-Day ML Price Forecast Trajectory (Dashed Cyan)**, and the **Spider-Sense Buying Verdict**.
* **Spoken Script**:
  > *"Now let's look at the brain of Spider-Sense: our Machine Learning Price Prediction Engine.
  >
  > In this modal, we visualize 30 days of historical scraped prices in solid red, alongside a 7-day future price trajectory in dashed cyan. Our engine uses scikit-learn Linear Regression with exponential recency weighting to detect price velocity and floor resistance.
  >
  > Based on price momentum and historical bounds, Spider-Sense issues an actionable verdict: **'🕷️ ALL-TIME LOW — Buy now!'** For declining items, Spider-Sense advises: **'⏳ Wait 3 days — price projected to drop to $278.00'**, ensuring shoppers never overpay."*

---

### 4. Real-Time Sentinel Alerts Feed (2:05 – 2:40)
* **Screen**: Click **"Sentinel Feed"** in the top navigation bar (`http://localhost:3000/alerts`).
* **Action**: Scroll through the active alerts and filter by category (All-Time Lows, Flash Sales, Back in Stock).
* **Spoken Script**:
  > *"Our Price Drop Sentinel continuously monitors incoming webhook streams for historical floor breaks, steep price drops (>= 8%), and back-in-stock events.
  >
  > In the Sentinel Feed, users get real-time cards highlighting new all-time low records, flash discount spikes, and retailer badges. Shoppers can subscribe for instant notifications, ensuring they capture flash sales before stock runs out."*

---

### 5. Bright Data Scraper Architecture & Conclusion (2:40 – 3:00)
* **Screen**: Return to the Home Page (`http://localhost:3000`) or show the FastAPI Swagger Docs (`http://localhost:8000/docs`).
* **Spoken Script**:
  > *"Spider-Sense demonstrates the full power of Bright Data Scraper Studio: custom collector definitions, automated webhook delivery, resilient NDJSON/JSON data normalization, and continuous telemetry.
  >
  > Spider-Sense turns messy, fragmented e-commerce data into automated savings. 
  > 
  > Built with Bright Data, FastAPI, Next.js, and scikit-learn. With great data comes great savings. Thank you!"*

---

## 🎯 Speaker Cheat Sheet & Flow Checklist

| Time | Step | Action | Key Takeaway |
| :--- | :--- | :--- | :--- |
| **0:00** | Landing Page | Open `localhost:3000`, show cyber dark UI | Fragmented prices, manual comparison pain point |
| **0:20** | Search Trigger | Click `Sony WH-1000XM5` chip | Sub-second DB cache + Bright Data pipeline |
| **0:45** | Price Matrix | Show Amazon vs Best Buy vs Walmart | Max Arbitrage Savings ($48+ spread) |
| **1:25** | ML Modal | Click "PRICE INTELLIGENCE" | 30-day historical + 7-day ML forecast |
| **2:10** | Sentinel Feed | Navigate to `/alerts` | Automated monitoring of steep drops & stock |
| **2:45** | Wrap-Up | Highlight Bright Data Scraper Studio | Scalable, production-ready e-commerce intelligence |
