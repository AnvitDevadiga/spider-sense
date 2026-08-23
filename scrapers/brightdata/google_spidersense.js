// ============================================================================
// Spider-Sense: Bright Data Scraper Studio Google Search Collector
// ============================================================================
// Role: Scraper #1 (Google Scout / Dispatcher)
// Extracts top product URLs for Amazon, Walmart, and Best Buy.
// ============================================================================

// ==========================================
// INTERACTION CODE (Paste in 'Interaction code' tab)
// ==========================================

let targetUrl = input.url;
if (!targetUrl && input.query) {
    targetUrl = `https://www.google.com/search?q=${encodeURIComponent(input.query + " site:amazon.com OR site:walmart.com OR site:bestbuy.com")}`;
}
if (!targetUrl) {
    targetUrl = "https://www.google.com/search?q=" + encodeURIComponent("Sony WH-1000XM5 site:amazon.com OR site:walmart.com OR site:bestbuy.com");
}

navigate(targetUrl, { wait_until: 'domcontentloaded' });

collect(parse());


// ==========================================
// PARSER CODE (Paste in 'Parser code' tab)
// ==========================================

let amazon_url = null;
let walmart_url = null;
let bestbuy_url = null;

// Collect raw hrefs safely across all Bright Data scraper runtime modes
let rawLinks = [];

try {
    if (typeof $ !== 'undefined') {
        $('a').each(function() {
            let h = $(this).attr('href');
            if (h) rawLinks.push(h);
        });
    }
} catch (e) {}

if (rawLinks.length === 0 && typeof document !== 'undefined') {
    try {
        let anchors = document.querySelectorAll('a[href]');
        for (let i = 0; i < anchors.length; i++) {
            let h = anchors[i].getAttribute('href') || anchors[i].href;
            if (h) rawLinks.push(h);
        }
    } catch (e) {}
}

// Extract retailer product URLs from discovered links
for (let i = 0; i < rawLinks.length; i++) {
    let href = rawLinks[i];
    if (!href || typeof href !== 'string') continue;

    // Decode Google tracking redirection URL if present
    if (href.includes('/url?q=')) {
        try {
            href = decodeURIComponent(href.split('/url?q=')[1].split('&')[0]);
        } catch (e) {}
    }

    if (!amazon_url && (href.includes('amazon.com/dp/') || href.includes('amazon.com/gp/product/'))) {
        amazon_url = href.split('?')[0];
    } else if (!walmart_url && href.includes('walmart.com/ip/')) {
        walmart_url = href.split('?')[0];
    } else if (!bestbuy_url && (href.includes('bestbuy.com/site/') || href.includes('bestbuy.com/product/'))) {
        bestbuy_url = href.split('?')[0];
    }
}

return {
    source: 'google',
    amazon_url: amazon_url || null,
    bestbuy_url: bestbuy_url || null,
    walmart_url: walmart_url || null,
    query: input.query || input.url || "",
    scraped_at: new Date().toISOString()
};
