const express = require('express');
const router = express.Router();
const { cacheMiddleware } = require('../middleware/cache');
const { scrapeHome } = require('../scrapers/homeScraper');
const { scrapeFrenchFilms, scrapeByGenre, scrapeAllFilms, scrapeRecent } = require('../scrapers/listScraper');
const { scrapeFilmDetail } = require('../scrapers/detailScraper');
const { getVideoUrl } = require('../scrapers/playerScraper');
const { GENRES, CACHE } = require('../config');
const { decodeUrl } = require('../utils/helpers');

// ─── ACCUEIL ───────────────────────────────────────────
// GET /api/films/home
router.get('/films/home', cacheMiddleware(CACHE.HOME), async (req, res) => {
  try {
    const data = await scrapeHome(2);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/films/recent
router.get('/films/recent', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const films = await scrapeRecent(limit);
    res.json({ success: true, data: films, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/films/all?page=1
router.get('/films/all', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const result = await scrapeAllFilms(page);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── FILMS FRANÇAIS ────────────────────────────────────
// GET /api/films/french
router.get('/films/french', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const films = await scrapeFrenchFilms(3);
    res.json({ success: true, data: films, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── GENRES ────────────────────────────────────────────
// GET /api/films/genres  → liste des genres disponibles
router.get('/films/genres', (req, res) => {
  res.json({ success: true, data: GENRES });
});

router.get('/films/debug', async (req, res) => {
  const browserManager = require('../scrapers/browser');
  const { randomDelay } = require('../utils/helpers');
  const { BASE_URL } = require('../config');
  
  const page = await browserManager.newPage(false);
  try {
    await page.goto(BASE_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await randomDelay(2000, 3000);
    
    const result = await page.evaluate(() => {
      // Retourne les 50 premiers liens de la page
      const links = [...document.querySelectorAll('a[href]')]
        .map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim().substring(0, 50) }))
        .filter(l => l.href && l.href.length > 1)
        .slice(0, 50);
      
      // Retourne aussi toutes les classes CSS utilisées
      const classes = [...new Set(
        [...document.querySelectorAll('[class]')]
          .map(el => el.className)
          .filter(c => c && c.length < 50)
      )].slice(0, 50);
      
      return { links, classes, title: document.title };
    });

    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  } finally {
    await browserManager.closePage(page);
  }
});

// GET /api/films/genre/:genre
router.get('/films/genre/:genre', cacheMiddleware(CACHE.LIST), async (req, res) => {
  try {
    const genre = req.params.genre;
    if (!GENRES.map(g => g.toLowerCase()).includes(genre.toLowerCase())) {
      return res.status(400).json({ success: false, error: `Genre invalide. Valeurs: ${GENRES.join(', ')}` });
    }
    const films = await scrapeByGenre(genre, 2);
    res.json({ success: true, data: films, genre, total: films.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── DÉTAIL FILM ───────────────────────────────────────
// GET /api/films/detail?url=URL_ENCODEE
router.get('/films/detail', cacheMiddleware(CACHE.DETAIL), async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'Paramètre url manquant' });
    const filmUrl = decodeUrl(url);
    const data = await scrapeFilmDetail(filmUrl);
    if (!data) return res.status(404).json({ success: false, error: 'Film non trouvé' });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── LIEN VIDÉO ────────────────────────────────────────
// GET /api/films/video?url=URL_ENCODEE
// Scrape le détail puis extrait le lien vidéo en une seule étape
router.get('/films/video', cacheMiddleware(CACHE.VIDEO), async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ success: false, error: 'Paramètre url manquant' });
    const filmUrl = decodeUrl(url);
    
    // 1. Récupère les sources du film
    const detail = await scrapeFilmDetail(filmUrl);
    if (!detail) return res.status(404).json({ success: false, error: 'Film non trouvé' });
    
    // 2. Extrait le vrai lien vidéo
    const videoData = await getVideoUrl(detail.players, detail.iframeSources);
    if (!videoData) return res.status(404).json({ success: false, error: 'Aucun lien vidéo disponible' });
    
    res.json({ success: true, data: videoData });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── CACHE ADMIN ───────────────────────────────────────
// GET /api/films/cache/stats
router.get('/films/cache/stats', (req, res) => {
  const { getStats, getKeys } = require('../middleware/cache');
  res.json({ success: true, stats: getStats(), keys: getKeys().length });
});

// DELETE /api/films/cache/flush
router.delete('/films/cache/flush', (req, res) => {
  const { flushAll } = require('../middleware/cache');
  flushAll();
  res.json({ success: true, message: 'Cache vidé' });
});

module.exports = router;
