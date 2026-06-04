const { BASE_URL } = require('../config');
const { randomDelay } = require('../utils/helpers');
const { scrapePage } = require('./homeScraper');

async function scrapeSearch(query) {
  console.log(`🔍 Recherche: "${query}"`);
  await randomDelay(500, 1200);
  
  // URL de recherche fs17.lol
  const url = BASE_URL + '/?do=search&subaction=search&story=' + encodeURIComponent(query);
  const results = await scrapePage(url);
  
  return {
    results,
    query,
    total: results.length,
  };
}

module.exports = { scrapeSearch };
