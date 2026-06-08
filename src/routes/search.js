const express = require('express');
const router = express.Router();
const { cacheMiddleware } = require('../middleware/cache');
const tmdb = require('../services/tmdbService');
const { CACHE } = require('../config');

// GET /api/search?q=batman
router.get('/search', cacheMiddleware(CACHE.SEARCH), async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, error: 'Query trop courte' });
    }
    const results = await tmdb.searchMovies(q);
    res.json({ success: true, results, total: results.length, query: q });
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
