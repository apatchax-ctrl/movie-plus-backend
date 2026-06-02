const express = require('express');
const router = express.Router();
const { cacheMiddleware } = require('../middleware/cache');
const { scrapeSearch } = require('../scrapers/searchScraper');
const { CACHE } = require('../config');

// GET /api/search?q=batman
router.get('/search', cacheMiddleware(CACHE.SEARCH), async (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, error: 'Requête trop courte (min 2 caractères)' });
    }
    const result = await scrapeSearch(q);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/search/suggestions?q=bat  → titres seulement pour autocomplétion
router.get('/search/suggestions', cacheMiddleware(600), async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, suggestions: [] });
    const result = await scrapeSearch(q);
    const suggestions = result.results.slice(0, 8).map(f => f.title).filter(Boolean);
    res.json({ success: true, suggestions });
  } catch (e) {
    res.json({ success: true, suggestions: [] });
  }
});

module.exports = router;
