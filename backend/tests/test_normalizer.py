from normalizer import normalize_payload

def test_amazon_normalization():
    raw_amazon: dict[str, object] = {
        "asin": "B0BSHFQXR9",
        "title": "Marvel's Spider-Man 2",
        "price": "$39.99",
        "availability": "In Stock",
        "rating": "4.8 out of 5",
        "review_count": "15,200",
        "url": "https://amazon.com/dp/B0BSHFQXR9"
    }
    
    result = normalize_payload(raw_amazon, "amazon")
    assert result is not None
    assert result["source_id"] == "B0BSHFQXR9"
    assert result["price"] == 39.99
    assert result["availability"] == "In Stock"
    assert result["rating"] == 4.8
    assert result["review_count"] == 15200
    assert result["brand"] == "Amazon"

def test_walmart_normalization():
    raw_walmart: dict[str, object] = {
        "product_id": "910317881",
        "title": "LEGO Spider-Man",
        "price": 279.99,
        "availability": "Out of Stock",
        "rating": 4.5,
        "brand": "LEGO"
    }
    
    result = normalize_payload(raw_walmart, "walmart")
    assert result is not None
    assert result["source_id"] == "910317881"
    assert result["price"] == 279.99
    assert result["availability"] == "Out of Stock"
    assert result["brand"] == "LEGO"

def test_invalid_payload():
    result = normalize_payload(None, "amazon")  # type: ignore
    assert result is None
    
    result = normalize_payload({}, "target")
    # Empty dict without ID key returns None due to no source_id found?
    # Wait, normalizer returns a dict with source_id=None if not found? 
    # Let's check normalizer: it handles it and returns dictionary.
    assert result is not None
    assert result["source_id"] is None
    assert result["price"] == 0.0
