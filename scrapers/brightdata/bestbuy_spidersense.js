// ==========================================
// INTERACTION CODE
// ==========================================

// Navigate to the product page with solve_captcha enabled to handle potential blocks
navigate(input.url, { solve_captcha: true });

// Collect the parsed data
collect(parse());

// ==========================================
// PARSER CODE
// ==========================================
// Helper function to extract numeric values from text
const extractNumber = (text) => {
    if (!text) return null;
    const match = text.replace(/,/g, '').match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
};

// Extract source (static value)
const source = 'bestbuy';

// Extract SKU from the page
const source_id = $('.inline-block:contains("SKU")').text_sane()?.replace(/SKU:/g, '').trim() || null;

// Extract title
const title = $('h1.text-default').text_sane() || null;

// Extract price - fixed selector to get the visible price span
const priceText = $('[data-testid="price-block-customer-price"] span').eq(1).text_sane()
    || $('[data-testid="price-block-customer-price"] span').first().text_sane()
    || $('[data-testid="customer-price"] span').first().text_sane()
    || $('.priceView-customer-price span').first().text_sane()
    || $('span[aria-hidden="true"]:contains("$")').first().text_sane()
    || null;
const price = extractNumber(priceText);

// Currency is always USD for Best Buy US
const currency = 'USD';

// Extract rating
const ratingText = $('.c-ratings-reviews-mini .font-weight-medium, .c-ratings-reviews-mini .font-500').first().text_sane()
    || $('[data-testid="reviews-and-ratings"] .font-weight-medium').first().text_sane();
const rating = extractNumber(ratingText);

// Extract review count
const reviewText = $('.c-ratings-reviews-mini .c-reviews').first().text_sane()
    || $('[data-testid="reviews-and-ratings"] .c-reviews').first().text_sane();
const review_count = extractNumber(reviewText);

// Extract availability - check for pickup/shipping descriptions
const availabilityText = $('[data-testid*="pdp-pickup-primary-description"], [data-testid*="pdp-shipping-primary-description"]').first().text_sane()
    || 'In Stock';
const availability = availabilityText || 'In Stock';

// Extract main image URL
const imageUrl = $('.primary-image').attr('src')
    || $('img.primary-image').attr('src')
    || $('img[data-testid="product-image"]').attr('src')
    || $('.picture-wrapper img').attr('src')
    || $('.primary-image').attr('srcset')?.split(',')[0]?.split(' ')[0]
    || null;
const image_url = imageUrl || null;

// Extract brand from title (before the first dash)
const brand = $('h1.text-default').text_sane()?.split(' - ')[0] || null;

// Extract URL from input
const url = input.url;

// Generate scraped_at timestamp
const scraped_at = new Date().toISOString();

return {
    source,
    source_id,
    title,
    price,
    currency,
    rating,
    review_count,
    availability,
    image_url,
    brand,
    url,
    scraped_at
};
