"""Normalize retailer's scraper data into one canonical form."""
from __future__ import annotations
import re
import urllib.parse


def normalize_payload(
    raw: dict[str, object], source: str
) -> dict[str, object] | None:
    """Map each retailer's data format to a consistent canonical shape.
    Scrapers now output a unified schema, so this validates and cleans fields.
    """
    if not isinstance(raw, dict):
        return None

    try:
        source_id = raw.get("source_id") or raw.get("asin") or raw.get("product_id") or raw.get("id")
        clean_source_id = str(source_id).strip() if source_id is not None else None
        if clean_source_id in ("", "None", "null", "undefined"):
            clean_source_id = None

        title = str(raw.get("title") or "").strip()
        brand = raw.get("brand")
        if not brand and source:
            brand_map = {
                "amazon": "Amazon",
                "walmart": "Walmart",
                "bestbuy": "Best Buy",
                "brightdata": "Bright Data",
            }
            brand = brand_map.get(source.lower(), source.title())

        raw_img = raw.get("image_url") or raw.get("image") or raw.get("img") or raw.get("photo")
        image_url = _clean_image_url(raw_img)

        raw_url = raw.get("url") or raw.get("product_url") or raw.get("link")
        product_url = _clean_product_url(raw_url, source, clean_source_id, title)

        return {
            "source_id": clean_source_id,
            "title": title,
            "price": _price(raw.get("price")),
            "availability": _availability(raw.get("availability")),
            "rating": _safe_float(raw.get("rating")),
            "review_count": _safe_int(raw.get("review_count")),
            "image_url": image_url,
            "product_url": product_url,
            "brand": brand,
            "category": raw.get("category"),
        }
    except Exception as e:
        import logging
        logging.getLogger("spider-sense.normalizer").error(f"Failed to normalize payload for {source}: {e}", exc_info=True)
        return None


def _clean_image_url(v: object) -> str | None:
    if v is None:
        return None
    if isinstance(v, list) and len(v) > 0:
        v = v[0]
    if isinstance(v, dict):
        v = v.get("src") or v.get("url") or v.get("href") or v.get("image") or v.get("thumbnail")
    s = str(v).strip()
    if not s or s.lower() in ("none", "null", "undefined", "[object object]"):
        return None
    # Strip any enclosing quotes or formatting artifacts
    s = s.strip("\"'()[]{}")
    if s.startswith("//"):
        s = "https:" + s
    elif not s.startswith(("http://", "https://", "data:image")):
        if s.startswith("/"):
            return None
        s = "https://" + s
    # Validate it's a proper image URL
    try:
        parsed = urllib.parse.urlparse(s)
        if not parsed.scheme or not parsed.netloc:
            return None
    except Exception:
        return None
    return s


def _clean_product_url(v: object, source: str, source_id: str | None, title: str | None) -> str | None:
    s = str(v).strip() if v else ""
    s = s.strip("\"'()[]{}")
    src = (source or "").lower().strip()

    # If an existing URL is provided, clean and canonicalize it
    if s and s.lower() not in ("none", "null", "undefined", "#"):
        if s.startswith("//"):
            s = "https:" + s
        elif not s.startswith(("http://", "https://")):
            if s.startswith("/"):
                base_domains = {
                    "amazon": "https://www.amazon.com",
                    "walmart": "https://www.walmart.com",
                    "bestbuy": "https://www.bestbuy.com",
                }
                s = base_domains.get(src, "https://www.google.com") + s
            else:
                s = "https://" + s

        # Validate URL structure
        try:
            parsed = urllib.parse.urlparse(s)
            if not parsed.scheme or not parsed.netloc:
                s = ""
            else:
                s = urllib.parse.urlunparse(parsed)
        except Exception:
            s = ""

        # Canonicalize Amazon URLs
        if s and ("amazon.com" in s or src == "amazon"):
            asin_match = re.search(r"/(?:dp|gp/product)/([A-Z0-9]{10})", s)
            if asin_match:
                return f"https://www.amazon.com/dp/{asin_match.group(1)}"
            if source_id and re.match(r"^[A-Z0-9]{10}$", source_id):
                return f"https://www.amazon.com/dp/{source_id}"

        # Canonicalize Walmart URLs
        if s and ("walmart.com" in s or src == "walmart"):
            item_match = re.search(r"/ip/(?:[^/]+/)?(\d+)", s)
            if item_match:
                return f"https://www.walmart.com/ip/{item_match.group(1)}"
            if source_id and source_id.isdigit():
                return f"https://www.walmart.com/ip/{source_id}"

        # Canonicalize Best Buy URLs
        if s and ("bestbuy.com" in s or src == "bestbuy"):
            sku_match = re.search(r"/(\d+)\.p", s) or re.search(r"skuId=(\d+)", s)
            if sku_match:
                return f"https://www.bestbuy.com/site/{sku_match.group(1)}.p?skuId={sku_match.group(1)}"
            if source_id and source_id.isdigit():
                return f"https://www.bestbuy.com/site/{source_id}.p?skuId={source_id}"

        # Strip standard tracking query parameters
        if s:
            try:
                parsed = urllib.parse.urlparse(s)
                query_pairs = urllib.parse.parse_qsl(parsed.query)
                clean_pairs = [
                    (k, val) for k, val in query_pairs
                    if not k.lower().startswith(("utm_", "ref", "tag", "gclid", "fbclid", "sprefix", "crid"))
                ]
                clean_query = urllib.parse.urlencode(clean_pairs)
                return urllib.parse.urlunparse(parsed._replace(query=clean_query))
            except Exception:
                return s

    # If URL is missing or invalid, construct from source_id or title
    if source_id:
        if src == "amazon":
            return f"https://www.amazon.com/dp/{source_id}"
        elif src == "walmart":
            return f"https://www.walmart.com/ip/{source_id}"
        elif src == "bestbuy":
            return f"https://www.bestbuy.com/site/{source_id}.p?skuId={source_id}"

    if title:
        enc_title = urllib.parse.quote_plus(title)
        if src == "amazon":
            return f"https://www.amazon.com/s?k={enc_title}"
        elif src == "walmart":
            return f"https://www.walmart.com/search?q={enc_title}"
        elif src == "bestbuy":
            return f"https://www.bestbuy.com/site/searchpage.jsp?st={enc_title}"

    return None


def _price(v: object) -> float:
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return max(0.0, float(v))
    s = str(v).strip()
    if not s or s.lower() in ("free", "n/a", "none", "null"):
        return 0.0
    cleaned = re.sub(r"[,$€£¥\s]", "", s)
    match = re.search(r"(\d+(?:\.\d{1,2})?)", cleaned)
    if match:
        try:
            return round(float(match.group(1)), 2)
        except ValueError:
            return 0.0
    return 0.0


def _safe_float(v: object) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return round(float(v), 2)
    s = str(v).strip()
    match = re.search(r"(\d+(?:\.\d+)?)", s)
    if match:
        try:
            val = float(match.group(1))
            return min(5.0, round(val, 2)) if val <= 5.0 else round(val, 2)
        except ValueError:
            return None
    return None


def _safe_int(v: object) -> int | None:
    if v is None:
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return int(v)
    s = str(v).strip().replace(",", "")
    if "k" in s.lower():
        k_match = re.search(r"(\d+(?:\.\d+)?)\s*k", s, re.IGNORECASE)
        if k_match:
            try:
                return int(float(k_match.group(1)) * 1000)
            except ValueError:
                pass
    match = re.search(r"(\d+)", s)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None


def _availability(v: object) -> str:
    if not v:
        return "In Stock"
    s = str(v).strip().lower()
    if any(term in s for term in (
        "out of stock", "unavailable", "sold out", "backorder"
    )):
        return "Out of Stock"
    if any(term in s for term in ("only", "left in stock", "few")):
        return "Low Stock"
    return "In Stock"
