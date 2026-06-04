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
  const axios = require('axios');
  const cheerio = require('cheerio');
  const { BASE_URL, HEADERS } = require('../config');

  try {
    const response = await axios.get(BASE_URL + '/films/', {
      headers: HEADERS,
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    
    // Tous les liens
    const links = [];
    $('a[href]').each((i, el) => {
      if (i > 80) return;
      links.push({
        href: $(el).attr('href'),
        text: $(el).text().trim().substring(0, 40),
        hasImg: $(el).find('img').length > 0,
        class: $(el).attr('class') || '',
      });
    });

    // Toutes les classes
    const classes = [...new Set(
      $('[class]').map((i, el) => $(el).attr('class')).get()
        .filter(c => c && c.length < 40)
    )].slice(0, 80);

    // Toutes les images
    const imgs = [];
    $('img').each((i, el) => {
      if (i > 20) return;
      imgs.push({
        src: $(el).attr('src')?.substring(0, 80),
        dataSrc: $(el).attr('data-src')?.substring(0, 80),
        alt: $(el).attr('alt')?.substring(0, 30),
        parentClass: $(el).parent().attr('class'),
      });
    });

    res.json({ 
      success: true, 
      htmlLength: response.data.length,
      data: { links, classes, imgs }
    });
  } catch(e) {
    res.json({ success: false, error: e.message });
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
