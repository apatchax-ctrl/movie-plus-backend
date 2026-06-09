const express = require('express');
const router = express.Router();
const { cacheMiddleware } = require('../middleware/cache');
const { CACHE } = require('../config');

// Import TMDB service
const tmdb = require('../services/tmdbService');

// Import Movix scraper
const { getVideoFromMovix, debugMovix } = require('../scrapers/movixScraper');

// ── HOME ──────────────────────────────────
router.get('/films/home', cacheMiddleware(1800), async (req, res) => {
  try {
    console.log('🎬 Chargement home depuis TMDB...');
    const [trending, recent, topRated] = await Promise.all([
      tmdb.getTrending(),
      tmdb.getNowPlaying(),
      tmdb.getTopRated(),
    ]);
    // S'assure que trending et recent sont différents
    const trendingIds = new Set(trending.map(m => m.id));
    const recentUnique = recent.filter(m => !trendingIds.has(m.id));
    
    console.log(`✅ Home: ${trending.length} trending, ${recentUnique.length} recent`);
    res.json({ 
      success: true, 
      data: { 
        trending, 
        recent: recentUnique, 
        topRated,
        total: trending.length 
      } 
    });
  } catch (e) {
    console.error('❌ Erreur home:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── RECENT ────────────────────────────────
router.get('/films/recent', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const films = await tmdb.getNowPlaying();
    res.json({ success: true, data: films, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POPULAR ───────────────────────────────
router.get('/films/popular', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const films = await tmdb.getPopular();
    res.json({ success: true, data: films, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── TOP RATED ─────────────────────────────
router.get('/films/toprated', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const films = await tmdb.getTopRated();
    res.json({ success: true, data: films, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── UPCOMING ──────────────────────────────
router.get('/films/upcoming', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const films = await tmdb.getUpcoming();
    res.json({ success: true, data: films, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── FRANÇAIS ──────────────────────────────
router.get('/films/french', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const films = await tmdb.getFrenchMovies(page);
    res.json({ success: true, data: films, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── BOLLYWOOD ─────────────────────────────
router.get('/films/bollywood', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const films = await tmdb.getBollywoodMovies(page);
    res.json({ success: true, data: films, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GENRE ─────────────────────────────────
router.get('/films/genre/:genre', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const genre = req.params.genre.toLowerCase();
    const genreId = tmdb.GENRE_IDS[genre];
    if (!genreId) {
      return res.status(400).json({ 
        success: false, 
        error: `Genre invalide. Disponibles: ${Object.keys(tmdb.GENRE_IDS).join(', ')}` 
      });
    }
    const page = parseInt(req.query.page) || 1;
    const films = await tmdb.getByGenre(genreId, page);
    res.json({ success: true, data: films, genre, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── DÉTAIL ────────────────────────────────
router.get('/films/detail/:tmdbId', cacheMiddleware(CACHE.DETAIL), async (req, res) => {
  try {
    const film = await tmdb.getMovieDetail(req.params.tmdbId);
    res.json({ success: true, data: film });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── VIDÉO ─────────────────────────────────
router.get('/films/video/:tmdbId', cacheMiddleware(CACHE.VIDEO), async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const title = req.query.title || '';
    console.log(`🎬 Vidéo pour TMDB ${tmdbId}: ${title}`);
    const videoData = await getVideoFromMovix(tmdbId, title);
    if (!videoData) {
      return res.status(404).json({ 
        success: false, error: 'Vidéo indisponible' 
      });
    }
    res.json({ success: true, data: videoData });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GENRES LISTE ──────────────────────────
router.get('/films/genres', async (req, res) => {
  try {
    const genres = await tmdb.getGenres();
    res.json({ success: true, data: genres });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── CACHE STATS ───────────────────────────
router.get('/films/cache/stats', (req, res) => {
  const { getStats, getKeys } = require('../middleware/cache');
  res.json({ 
    success: true, 
    stats: getStats(), 
    keys: getKeys().length 
  });
});

// ── CACHE FLUSH ───────────────────────────
router.delete('/films/cache/flush', (req, res) => {
  const { flushAll } = require('../middleware/cache');
  flushAll();
  res.json({ success: true, message: 'Cache vidé' });
});

// ── DEBUG MOVIX ───────────────────────────
router.get('/films/movix-debug/:tmdbId', async (req, res) => {
  try {
    const result = await debugMovix(req.params.tmdbId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ── FS17 SEARCH ───────────────────────────
router.get('/films/fs17url/:tmdbId', async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const { title, year } = req.query;
    
    if (!title) return res.status(400).json({
      success: false, error: 'Paramètre title manquant'
    });

    const { searchOnFs17 } = require('../scrapers/fs17Searcher');
    const fs17Url = await searchOnFs17(title, year);
    
    if (!fs17Url) return res.status(404).json({
      success: false, error: 'Film non trouvé sur fs17.lol'
    });

    res.json({ success: true, data: { fs17Url } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
