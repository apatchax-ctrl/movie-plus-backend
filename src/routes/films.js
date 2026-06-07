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
  const networkRequests = [];

  try {
    // Intercepte TOUTES les requêtes réseau
    await page.setRequestInterception(true);
    page.on('request', req => {
      networkRequests.push({
        url: req.url().substring(0, 150),
        type: req.resourceType(),
        method: req.method(),
      });
      req.continue();
    });

    await page.goto(BASE_URL + '/films/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await randomDelay(5000, 6000);

    // Scroll pour forcer le chargement
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await randomDelay(3000, 4000);

    const result = await page.evaluate(() => {
      return {
        shortItems: document.querySelectorAll('.short-item').length,
        allDivClasses: [...new Set(
          [...document.querySelectorAll('div[class]')]
            .map(el => el.className)
            .filter(c => c.length < 60)
        )].slice(0, 60),
        bodyLength: document.body.innerHTML.length,
        // Cherche n'importe quel lien avec une image
        linksWithImg: [...document.querySelectorAll('a')]
          .filter(a => a.querySelector('img'))
          .slice(0, 10)
          .map(a => ({
            href: a.getAttribute('href'),
            imgSrc: a.querySelector('img')?.src,
            parentClass: a.parentElement?.className,
          })),
      };
    });

    // Filtre les requêtes intéressantes (JSON, XHR, fetch)
    const interestingRequests = networkRequests.filter(r => 
      r.type === 'xhr' || 
      r.type === 'fetch' || 
      r.url.includes('.json') ||
      r.url.includes('api') ||
      r.url.includes('ajax')
    );

    res.json({ 
      success: true, 
      data: result,
      networkRequests: interestingRequests.slice(0, 30),
      allRequests: networkRequests.slice(0, 50),
    });
  } catch(e) {
    res.json({ success: false, error: e.message });
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
router.get('/films/video', cacheMiddleware(CACHE.VIDEO), async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ 
      success: false, error: 'Paramètre url manquant' 
    });
    
    const filmUrl = decodeUrl(url);
    const { getVideoUrl } = require('../scrapers/playerScraper');
    
    // Passe directement filmUrl au player scraper
    const videoData = await getVideoUrl([], [], filmUrl);
    
    if (!videoData) return res.status(404).json({ 
      success: false, error: 'Aucun lien vidéo disponible' 
    });
    
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

// ─── DEBUG PLAYER ───────────────────────────────────────
// GET /api/films/player-debug?url=...
router.get('/films/player-debug', async (req, res) => {
  const browserManager = require('../scrapers/browser');
  const { randomDelay } = require('../utils/helpers');
  
  const page = await browserManager.newPage(false);
  try {
    const url = req.query.url || 'https://fs17.lol/index.php?newsid=15126941';
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await randomDelay(3000, 4000);

    const result = await page.evaluate(() => {
      // Cherche TOUT ce qui ressemble à un player
      const iframes = [...document.querySelectorAll('iframe')]
        .map(el => ({
          src: el.src,
          dataSrc: el.getAttribute('data-src'),
          id: el.id,
          class: el.className,
        }));

      const allLinks = [...document.querySelectorAll('a[href]')]
        .filter(a => {
          const href = a.href || '';
          return href.includes('player') || 
                 href.includes('embed') || 
                 href.includes('stream') ||
                 href.includes('video') ||
                 href.includes('watch') ||
                 href.includes('lecteur') ||
                 a.className.includes('player') ||
                 a.className.includes('server') ||
                 a.className.includes('btn');
        })
        .map(a => ({
          href: a.href,
          text: a.textContent.trim().substring(0, 30),
          class: a.className,
          dataId: a.getAttribute('data-id'),
          dataFile: a.getAttribute('data-file'),
          dataPlayer: a.getAttribute('data-player'),
        }));

      const scripts = [...document.querySelectorAll('script')]
        .map(s => s.innerHTML)
        .filter(s => s.includes('player') || 
                     s.includes('file') || 
                     s.includes('source') ||
                     s.includes('jwplayer') ||
                     s.includes('video'))
        .map(s => s.substring(0, 300))
        .slice(0, 5);

      const allClasses = [...new Set(
        [...document.querySelectorAll('[class]')]
          .map(el => el.className)
          .filter(c => c && c.length < 40 &&
            (c.includes('player') || c.includes('server') || 
             c.includes('video') || c.includes('stream') ||
             c.includes('btn') || c.includes('tab')))
      )];

      return { iframes, allLinks, scripts, allClasses,
               bodyLength: document.body.innerHTML.length };
    });

    res.json({ success: true, data: result });
  } catch(e) {
    res.json({ success: false, error: e.message });
  } finally {
    await browserManager.closePage(page);
  }
});

module.exports = router;
