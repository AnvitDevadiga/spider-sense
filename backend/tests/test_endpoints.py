import pytest
from fastapi.testclient import TestClient
from main import app
from database import Base, engine, SessionLocal, Product, PriceHistory

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield

def test_system_endpoints():
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["project"] == "Spider-Sense"

    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "ok"

    r_stats = client.get("/stats")
    assert r_stats.status_code == 200
    assert "products_tracked" in r_stats.json()

def test_demo_seed_and_products():
    # 1. Seed demo dataset
    seed_res = client.post("/demo/seed")
    assert seed_res.status_code == 200
    assert seed_res.json()["status"] == "success"
    assert seed_res.json()["products_seeded"] >= 10

    # 2. List products
    prod_res = client.get("/products")
    assert prod_res.status_code == 200
    products = prod_res.json()
    assert len(products) >= 10
    assert any(p["source"] == "amazon" for p in products)
    assert any(p["source"] == "walmart" for p in products)
    assert any(p["source"] == "bestbuy" for p in products)

    # 3. Product detail with ML forecast
    first_pid = products[0]["id"]
    detail_res = client.get(f"/products/{first_pid}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert "product" in detail
    assert "prediction" in detail
    assert "forecast_next_7d" in detail["prediction"]
    assert len(detail["prediction"]["forecast_next_7d"]) == 7

def test_compare_matrix():
    # Seed first
    client.post("/demo/seed")

    compare_res = client.get("/compare")
    assert compare_res.status_code == 200
    comparisons = compare_res.json()
    assert len(comparisons) >= 1
    # Check that canonical models are grouped
    sony_match = next((c for c in comparisons if "sony" in c["item_name"].lower()), None)
    if sony_match:
        assert len(sony_match["stores"]) >= 2
        assert sony_match["cheapest_price"] > 0
        assert sony_match["max_savings_usd"] >= 0

def test_simulate_drop_and_alerts():
    # Seed first
    client.post("/demo/seed")

    # Simulate price drop
    drop_res = client.post("/demo/simulate-drop")
    assert drop_res.status_code == 200
    drop_data = drop_res.json()
    assert drop_data["status"] == "success"
    assert drop_data["new_price"] < drop_data["old_price"]

    # Check alerts list
    alerts_res = client.get("/alerts")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) >= 1

def test_alert_subscription_flow():
    # Seed first so we have a real product to watch
    client.post("/demo/seed")
    products = client.get("/products").json()
    pid = products[0]["id"]

    # Subscribe with product_id + email
    res = client.post("/api/alerts/add", json={"product_id": pid, "email": "peter@dailybugle.com"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert "message" in body

    # Duplicate subscription should still succeed (idempotent)
    res_dup = client.post("/alerts/add", json={"product_id": pid, "email": "peter@dailybugle.com"})
    assert res_dup.status_code == 200
    assert res_dup.json()["status"] == "success"

    # Missing product_id -> 400
    res_no_pid = client.post("/api/alerts/add", json={})
    assert res_no_pid.status_code == 400

    # Unknown product -> 404
    res_404 = client.post("/api/alerts/add", json={"product_id": "amazon:DOESNOTEXIST"})
    assert res_404.status_code == 404

def test_scrapers_and_healing():
    status_res = client.get("/scrapers/status")
    assert status_res.status_code == 200
    statuses = status_res.json()
    assert len(statuses) >= 3

    heal_res = client.post("/scrapers/heal", json={
        "collector_id": "c_mt3w3rtn12g4br728n",
        "what_broke": "Price selector DOM mutation",
    })
    assert heal_res.status_code == 200
    assert heal_res.json()["healed"] is True
    assert "cli_output" in heal_res.json()


def test_webhook_ingestion_formats():
    # JSON array payload
    r = client.post("/webhook/amazon", json=[
        {
            "source_id": "TESTSKU1",
            "title": "Test Widget",
            "price": "$19.99",
            "availability": "In Stock",
            "url": "https://www.amazon.com/dp/TESTSKU1",
        }
    ])
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert body["received"] == 1

    # NDJSON (JSON Lines) payload — Bright Data streaming format
    ndjson = (
        '{"source_id": "TESTSKU2", "title": "Test Gadget", "price": 42.5, '
        '"url": "https://www.amazon.com/dp/TESTSKU2"}\n'
        'not-valid-json\n'
        '{"source_id": "TESTSKU3", "title": "Broken Item", "price": null}'
    )
    r2 = client.post(
        "/webhook/amazon",
        content=ndjson.encode("utf-8"),
        headers={"Content-Type": "application/x-ndjson"},
    )
    assert r2.status_code == 400 or r2.json().get("received") is not None

    # Empty ping (Bright Data reachability check)
    r3 = client.post("/webhook/amazon", content=b"")
    assert r3.status_code == 200

    # Webhook health beacon
    r4 = client.get("/webhook/health")
    assert r4.status_code == 200
    assert r4.json()["status"] == "ok"


def test_non_blocking_search():
    # POST /api/search for an uncached query returns 202 Accepted and dispatches background tasks
    res = client.post("/api/search", json={"query": "Uncached Futuristic Drone XYZ 9999"})
    assert res.status_code == 202
    data = res.json()
    assert data["status"] == "scraping_started"
    assert data["query"] == "Uncached Futuristic Drone XYZ 9999"

    # POST /api/search for an existing query in DB returns instant 200 Cache Hit
    res_cached = client.post("/api/search", json={"query": "Apple AirPods 4"})
    assert res_cached.status_code in [200, 202]

    # Empty query should return 400
    res_err = client.post("/api/search", json={"query": "   "})
    assert res_err.status_code == 400


def test_product_status_polling_and_streaming():
    # Clear DB to test fresh streaming transition
    client.post("/clear-history")

    # 1. Check status before any products exist
    res = client.get("/api/product/status?search_term=Apple+AirPods+4")
    assert res.status_code == 200
    data = res.json()
    assert "stores" in data
    assert data["stores"]["amazon"]["status"] == "hunting"
    assert data["stores"]["walmart"]["status"] == "hunting"
    assert data["stores"]["bestbuy"]["status"] == "hunting"

    # 2. Simulate Amazon webhook receiving product data
    r_amz = client.post("/webhook/amazon", json=[
        {
            "source_id": "B0D1XD1ZV3",
            "title": "Apple AirPods 4 Wireless Earbuds with ANC",
            "price": 179.00,
            "availability": "In Stock",
            "url": "https://www.amazon.com/dp/B0D1XD1ZV3",
            "image_url": "https://m.media-amazon.com/images/I/airpods.jpg",
            "rating": 4.8,
            "review_count": 1240,
        }
    ])
    assert r_amz.status_code == 200

    # 3. Status poll: Amazon should be ready instantly, Walmart/BestBuy still hunting
    res_amz = client.get("/api/product/status?search_term=Apple+AirPods+4")
    assert res_amz.status_code == 200
    data_amz = res_amz.json()
    assert data_amz["stores"]["amazon"]["status"] == "ready"
    assert data_amz["stores"]["amazon"]["product"]["price"] == 179.00
    assert data_amz["stores"]["walmart"]["status"] == "hunting"
    assert data_amz["stores"]["bestbuy"]["status"] == "hunting"
    assert "amazon" in data_amz["completed_stores"]
    assert "walmart" in data_amz["pending_stores"]

    # 4. Simulate Walmart webhook receiving product data
    r_wm = client.post("/webhook/walmart", json=[
        {
            "source_id": "5016556637",
            "title": "Apple AirPods 4 with Active Noise Cancellation",
            "price": 169.00,
            "availability": "In Stock",
            "url": "https://www.walmart.com/ip/5016556637",
            "image_url": "https://i5.walmartimages.com/airpods.jpg",
            "rating": 4.7,
            "review_count": 890,
        }
    ])
    assert r_wm.status_code == 200

    # 5. Status poll: Amazon and Walmart ready, BestBuy hunting, Walmart is cheapest
    res_wm = client.get("/api/product/status?search_term=Apple+AirPods+4")
    assert res_wm.status_code == 200
    data_wm = res_wm.json()
    assert data_wm["stores"]["amazon"]["status"] == "ready"
    assert data_wm["stores"]["walmart"]["status"] == "ready"
    assert data_wm["stores"]["bestbuy"]["status"] == "hunting"
    assert data_wm["comparison"]["cheapest_store"] == "walmart"
    assert data_wm["comparison"]["cheapest_price"] == 169.00
    assert data_wm["comparison"]["max_savings_usd"] == 10.00


def test_product_status_queries_with_non_catalog_and_special_terms():
    # Test random non-catalog search query
    res = client.get("/api/product/status?search_term=nonexistent+gadget+xyz")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "hunting"
    assert data["is_complete"] is False

    # Test catalog matched search query
    res_catalog = client.get("/api/product/status?search_term=sony+wh-1000xm5")
    assert res_catalog.status_code == 200


