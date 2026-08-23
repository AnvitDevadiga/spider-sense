# Bright Data Custom Scrapers — Authoring Notes

This folder contains **5 custom scrapers** for Bright Data Scraper Studio. They are not from the template library — every CSS/XPath selector was authored by the team.

## How to import these into Scraper Studio

1. Sign in to [brightdata.com](https://brightdata.com)
2. Go to **Scrapers** → click the blue **New ⌄** button → select **Develop a scraper (Web Scraper IDE)**
3. For each retailer in this folder, open the `.js` file (e.g. `amazon.js`).
4. Copy the top half into the **Interaction code** tab.
5. Copy the bottom half into the **Parser code** tab.
6. In the bottom left **Input** section, click **+ Add input parameter**, name it `url` and paste a real product URL to test.
7. In the scraper settings, set the Webhook URL to: `https://YOUR-BACKEND-URL/webhook/{source}` (Use ngrok for local testing!)
8. Click **Run log** / play button to test, then click **Finish editing**.
## Schema

All scrapers output the same canonical JSON shape:

```json
{
  "source_id":     "<retailer-specific ID>",
  "title":         "string",
  "price":         "number",
  "currency":      "USD",
  "rating":        "float (0–5) or null",
  "review_count":  "integer or null",
  "availability":  "In Stock | Out of Stock | null",
  "image_url":     "absolute URL",
  "url":           "absolute product URL",
  "brand":         "string or null",
  "category":      "string or null",
  "scraped_at":    "ISO-8601 timestamp"
}
