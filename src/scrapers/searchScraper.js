const browserManager = require('./browser');
const { BASE_URL, URLS } = require('../config');
const { cleanText, toAbsoluteUrl, randomDelay } = require('../utils/helpers');
const { scrapePage } = require('./homeScraper');

async function scrapeSearch(query) {
  const encodedQuery = encodeURIComponent(query);
  // URL de recherche fs17.lol
  const url = `${BASE_URL}/?do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodedQuery}`;
  
  console.log(`🔍 Recherche: "${query}"`);
  
  const page = await browserManager.newPage(true);
  try {
    await randomDelay(500, 1200);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(1000, 2000);

    // Réutilise la même logique d'extraction que scrapePage
    const films = await scrapePage(url);

    return {
      results: films,
      query,
      total: films.length,
    };
  } catch (err) {
    console.error(`❌ Erreur recherche "${query}":`, err.message);
    return { results: [], query, total: 0 };
  } finally {
    await browserManager.closePage(page);
  }
}

module.exports = { scrapeSearch };
