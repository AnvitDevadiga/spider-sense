// ==========================================
// INTERACTION CODE (Paste in 'Interaction code' tab)
// ==========================================

// Navigate to the product URL with DOM content loaded
navigate(input.url, { wait_until: 'domcontentloaded' });

// Collect the parsed data
collect(parse());


// ==========================================
// PARSER CODE (Paste in 'Parser code' tab)
// ==========================================

// Helper function to extract numeric values from text
const extractNumber = (text) => {
  if (!text) return null;
  const match = text.replace(/,/g, '').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
};

// Extract source_id from current URL
const current_url = $('link[rel="canonical"]').attr('href') || input.url || '';
const source_id_match = current_url.match(/\/ip\/(?:[^\/]+\/)?(\d+)/);
const source_id = source_id_match ? source_id_match[1] : null;

// Extract title
const title = $('h1#main-title').text_sane()
  || $('h1[itemprop="name"]').text_sane()
  || $('h1.prod-ProductTitle').text_sane()
  || null;

// Extract price
const price_text = $('[data-seo-id=hero-price]').text_sane()
  || $('[itemprop=price]').text_sane()
  || $('[data-testid=price-wrap] span').first().text_sane()
  || $('span[itemprop="price"]').text_sane()
  || $('span:contains("$")').first().text_sane()
  || null;
const price = extractNumber(price_text);

// Extract rating
const rating_aria = $('[data-testid=reviews-and-ratings] [aria-label]').attr('aria-label')
  || $('[itemprop="ratingValue"]').text_sane();
const rating = rating_aria ? extractNumber(rating_aria) : null;

// Extract review count
const review_link = $('[data-testid=item-review-section-link]').text_sane()
  || $('[itemprop="reviewCount"]').text_sane();
const review_match = review_link ? review_link.match(/([\d.]+)\s*K?/i) : null;
let review_count = null;
if (review_match) {
  let val = parseFloat(review_match[1]);
  review_count = (review_link && review_link.toLowerCase().includes('k')) ? Math.round(val * 1000) : Math.round(val);
}

// Check availability
const atc_button = $('[data-automation-id=atc], button:contains("Add to cart")');
const availability = atc_button.length > 0 ? 'In Stock' : 'Out of Stock';

// Extract image URL
const image_url = $('img#hero-image-zoom-0').attr('src')
  || $('img[data-testid="hero-image"]').attr('src')
  || $('[data-testid="media-thumbnail"] img').first().attr('src')
  || $('img[loading="eager"]').attr('src')
  || $('img[itemprop="image"]').attr('src')
  || null;

// Extract brand
const brand = $('[data-seo-id=brand-name]').text_sane()
  || $('[itemprop="brand"]').text_sane()
  || 'Walmart';

// Get current timestamp
const scraped_at = new Date().toISOString();

return {
  source: 'walmart',
  source_id,
  title,
  price,
  currency: 'USD',
  rating,
  review_count,
  availability,
  image_url,
  brand,
  url: input.url || current_url,
  scraped_at
};
