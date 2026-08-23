// ==========================================
// INTERACTION CODE (Paste in 'Interaction code' tab)
// ==========================================

// Navigate to the product URL
navigate(input.url, { wait_until: 'domcontentloaded' });

// Collect the parsed data
collect(parse());


// ==========================================
// PARSER CODE (Paste in 'Parser code' tab)
// ==========================================


// Extract ASIN from URL
let asin = input.url.match(/\/dp\/([A-Z0-9]{10})/)?.[1] || null;

// Extract title
let title = $('#productTitle').text_sane();

// Extract price - try multiple selectors and get first available
let priceText = $('.reinventPriceAccordionT2 .a-offscreen').first().text_sane()
  || $('.apex-pricetopay-value .a-offscreen').first().text_sane()
  || $('#corePrice_feature_div .a-offscreen').first().text_sane()
  || $('#corePriceDisplay_desktop_feature_div .a-offscreen').first().text_sane()
  || $('.a-price .a-offscreen').first().text_sane()
  || $('.a-price-whole').first().text_sane();
let price = priceText ? +priceText.replace(/[^0-9.]/g, '') : null;

// Extract rating
let ratingText = $('#acrPopover .a-icon-alt').first().text_sane()
  || $('.a-icon-alt').first().text_sane();
let rating = ratingText ? +ratingText.match(/[\d.]+/)?.[0] : null;

// Extract review count
let reviewText = $('#acrCustomerReviewText').text_sane();
let review_count = reviewText ? +reviewText.replace(/[^0-9]/g, '') : null;

// Extract availability
let availability = $('#availability .a-size-medium').first().text_sane()
  || $('#availability-message').text_sane()
  || 'In Stock';

// Extract image URL - try multiple selectors including dynamic JSON map
let image_url = $('#landingImage').attr('data-old-hires')
  || $('#landingImage').attr('src')
  || $('#imgBlkFront').attr('src')
  || $('#main-image').attr('src')
  || $('img[data-a-image-name="landingImage"]').attr('src');

let dynamicImg = $('#landingImage').attr('data-a-dynamic-image');
if (!image_url && dynamicImg) {
  try {
    let parsedMap = JSON.parse(dynamicImg);
    image_url = Object.keys(parsedMap)[0];
  } catch(e) {}
}

// Extract brand
let brandText = $('#bylineInfo').text_sane();
let brand = brandText ? brandText.replace(/^Visit the\s+/, '').replace(/\s+Store$/, '').trim() : null;

// Get current timestamp
let scraped_at = new Date().toISOString();

return {
  source: 'amazon',
  source_id: asin,
  title: title || null,
  price: price,
  currency: 'USD',
  rating: rating,
  review_count: review_count,
  availability: availability || null,
  image_url: image_url || null,
  brand: brand,
  url: input.url,
  scraped_at: scraped_at
};
