const express = require('express');
const router = express.Router();
const { cacheMiddleware, setCache, getCache } = require('../middleware/cache');
const tmdb = require('../services/tmdbService');
const { getVideoFromMovix, debugMovix } = require('../scrapers/movixScraper');
const { CACHE } = require('../config');

// ── ACCUEIL ──────────────────────────────────────────
// GET /api/films/home
// - Charge en parallèle : trending + nowPlaying + topRated
// - trending = getTrending()
// - recent = getNowPlaying()
// - Cache 30 minutes
// - Retourne { trending, recent, total }

router.get('/films/home', cacheMiddleware(CACHE.HOME), async (req, res) => {
  try {
    const [trending, recent, topRated] = await Promise.all([
      tmdb.getTrending(),
      tmdb.getNowPlaying(),
      tmdb.getTopRated(),
    ]);
    res.json({ 
      success: true, 
      data: { trending, recent, topRated, total: trending.length } 
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── FILMS RÉCENTS ─────────────────────────────────────
router.get('/films/recent', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const films = await tmdb.getNowPlaying();
    res.json({ success: true, data: films, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POPULAIRES ────────────────────────────────────────
router.get('/films/popular', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const films = await tmdb.getPopular();
    res.json({ success: true, data: films, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── FILMS FRANÇAIS ────────────────────────────────────
router.get('/films/french', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const films = await tmdb.getFrenchMovies(page);
    res.json({ success: true, data: films, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── BOLLYWOOD ─────────────────────────────────────────
router.get('/films/bollywood', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const films = await tmdb.getBollywoodMovies();
    res.json({ success: true, data: films, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── PAR GENRE ─────────────────────────────────────────
router.get('/films/genre/:genre', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const genre = req.params.genre.toLowerCase();
    const genreId = tmdb.GENRE_IDS[genre];
    if (!genreId) return res.status(400).json({ 
      success: false, 
      error: `Genre invalide. Valeurs: ${Object.keys(tmdb.GENRE_IDS).join(', ')}` 
    });
    const page = parseInt(req.query.page) || 1;
    const films = await tmdb.getByGenre(genreId, page);
    res.json({ success: true, data: films, genre, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── DÉTAIL FILM ───────────────────────────────────────
router.get('/films/detail/:tmdbId', cacheMiddleware(CACHE.DETAIL), async (req, res) => {
  try {
    const film = await tmdb.getMovieDetail(req.params.tmdbId);
    res.json({ success: true, data: film });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── LIEN VIDÉO ────────────────────────────────────────
router.get('/films/video/:tmdbId', cacheMiddleware(CACHE.VIDEO), async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const title = req.query.title || '';
    const videoData = await getVideoFromMovix(tmdbId, title);
    if (!videoData) return res.status(404).json({ 
      success: false, error: 'Vidéo indisponible' 
    });
    res.json({ success: true, data: videoData });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GENRES LISTE ──────────────────────────────────────
router.get('/films/genres', async (req, res) => {
  try {
    const genres = await tmdb.getGenres();
    res.json({ success: true, data: genres });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── CACHE STATS ───────────────────────────────────────
router.get('/films/cache/stats', (req, res) => {
  const { getStats, getKeys } = require('../middleware/cache');
  res.json({ success: true, stats: getStats(), keys: getKeys().length });
});

// ── DEBUG MOVIX ───────────────────────────────────────
router.get('/films/movix-debug/:tmdbId', async (req, res) => {
  try {
    const result = await debugMovix(req.params.tmdbId);
    res.json({ success: true, data: result });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

module.exports = router;
