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
router.get('/films/video', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({
      success: false, error: 'URL manquante'
    });
    
    const filmUrl = decodeURIComponent(url);
    const browserManager = require('../scrapers/browser');
    const { randomDelay } = require('../utils/helpers');
    
    const page = await browserManager.newPage(false);
    const capturedUrls = [];
    
    const ignoredDomains = [
      'googlevideo.com', 'youtube.com', 
      'youtu.be', 'ytimg.com',
    ];
    
    const filmDomains = [
      'vidzy', 'uqload', 'dood', 'voe',
      'filmoon', 'streamtape',
    ];
    
    try {
      await page.setRequestInterception(true);
      page.on('request', req => {
        const reqUrl = req.url();
        const isTrailer = ignoredDomains.some(d => reqUrl.includes(d));
        
        if (!isTrailer && reqUrl.includes('.m3u8')) {
          const isFilm = filmDomains.some(d => reqUrl.includes(d));
          if (isFilm) {
            capturedUrls.push(reqUrl);
            console.log('📡 .m3u8 capturé:', reqUrl.substring(0, 100));
          }
        }
        try { req.continue(); } catch {}
      });
      
      await page.goto(filmUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
      
      await randomDelay(2000, 3000);
      
      // Clique sur le premier serveur
      await page.evaluate(() => {
        const servers = document.querySelectorAll(
          '.ftabs a, .movie-players a, .server-btn'
        );
        if (servers.length > 0) {
          servers[0].click();
          console.log('Serveur cliqué');
        }
      });
      
      await randomDelay(3000, 5000);
      
      // Clique sur play
      await page.evaluate(() => {
        const plays = document.querySelectorAll(
          '.jw-icon-display, .vjs-big-play-button, video'
        );
        if (plays.length > 0) plays[0].click();
      });
      
      await randomDelay(3000, 5000);
      
      if (capturedUrls.length > 0) {
        return res.json({
          success: true,
          data: {
            videoUrl: capturedUrls[0],
            type: 'm3u8',
            source: 'fs15.lol',
          }
        });
      }
      
      return res.status(404).json({
        success: false,
        error: 'Aucun lien vidéo trouvé'
      });
      
    } finally {
      await browserManager.closePage(page);
    }
    
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

// ── PURSTREAM DEBUG ───────────────────────
router.get('/films/purstream-debug/:tmdbId', async (req, res) => {
  try {
    const tmdbId = req.params.tmdbId;
    const browserManager = require('../scrapers/browser');
    
    // Encode en base64 : {"type":"movie","id":TMDB_ID}
    const payload = JSON.stringify({ type: 'movie', id: parseInt(tmdbId) });
    const base64 = Buffer.from(payload).toString('base64');
    const watchUrl = `https://purstream.ch/watch/${base64}`;
    
    console.log('🎬 URL Purstream:', watchUrl);
    
    const page = await browserManager.newPage(false);
    const capturedUrls = [];
    
    try {
      await page.setRequestInterception(true);
      page.on('request', req => {
        const url = req.url();
        if (url.includes('.m3u8') || url.includes('master')) {
          capturedUrls.push(url);
          console.log('📡 Capturé:', url.substring(0, 150));
        }
        try { req.continue(); } catch {}
      });

      await page.goto(watchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await new Promise(r => setTimeout(r, 5000));

      const pageData = await page.evaluate(() => ({
        title: document.title,
        bodyLength: document.body.innerHTML.length,
        url: window.location.href,
      }));

      // Clique sur Regarder/Lecture
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button, a')];
        for (const btn of btns) {
          const text = btn.textContent.trim().toLowerCase();
          if (text.includes('regarder') || text.includes('lecture') || 
              text.includes('watch') || text.includes('play')) {
            btn.click();
            return text;
          }
        }
        return null;
      });

      await new Promise(r => setTimeout(r, 5000));

      res.json({
        success: true,
        data: {
          watchUrl,
          pageData,
          capturedUrls,
        }
      });

    } finally {
      await browserManager.closePage(page);
    }

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
      success: false, error: 'Film non trouvé sur fs15.lol'
    });

    res.json({ success: true, data: { fs17Url } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── TRAILER (YouTube key) ─────────────────
// Route helper when no tmdbId provided
router.get('/films/trailer', (req, res) => {
  return res.status(400).json({
    success: false,
    error: "Paramètre 'tmdbId' manquant. Utilisation: /api/films/trailer/:tmdbId"
  });
});

router.get('/films/trailer/', (req, res) => {
  return res.status(400).json({
    success: false,
    error: "Paramètre 'tmdbId' manquant. Utilisation: /api/films/trailer/:tmdbId"
  });
});

// Main trailer route
router.get('/films/trailer/:tmdbId', async (req, res) => {
  try {
    const axios = require('axios');
    const { TMDB_API_KEY, TMDB_BASE_URL } = require('../config');
    
    // Récupère toutes les vidéos (sans forcer la langue) puis filtre
    const allRes = await axios.get(
      `${TMDB_BASE_URL}/movie/${req.params.tmdbId}/videos`,
      { params: { api_key: TMDB_API_KEY } }
    );

    let videos = Array.isArray(allRes.data.results) ? allRes.data.results : [];

    const findFrenchTrailer = (list) => {
      if (!Array.isArray(list)) return null;
      // 1) trailer avec iso_639_1 === 'fr'
      let t = list.find(v => v.type === 'Trailer' && v.site === 'YouTube' && (v.iso_639_1 === 'fr'));
      if (t) return t;
      // 2) trailer dont le nom indique VF / version française / french
      t = list.find(v => v.type === 'Trailer' && v.site === 'YouTube' && /\b(vf|version fran(c|ç)aise|french)\b/i.test(v.name || ''));
      if (t) return t;
      // 3) trailer marqué "official" (au cas où la langue n'est pas renseignée mais c'est la VF la plus pertinente)
      t = list.find(v => v.type === 'Trailer' && v.site === 'YouTube' && v.official === true && /\b(vf|fr)\b/i.test(v.iso_639_1 || ''));
      if (t) return t;
      return null;
    };

    // Cherche d'abord une vidéo explicitement française
    let trailer = findFrenchTrailer(videos);

    // Si introuvable, essaie la requête avec language=fr-FR (parfois différente)
    if (!trailer) {
      const resFr = await axios.get(
        `${TMDB_BASE_URL}/movie/${req.params.tmdbId}/videos`,
        { params: { api_key: TMDB_API_KEY, language: 'fr-FR' } }
      );
      trailer = findFrenchTrailer(resFr.data.results || []);
    }

    // Si toujours rien, retombe sur un trailer anglais (fallback)
    if (!trailer) {
      const resEn = await axios.get(
        `${TMDB_BASE_URL}/movie/${req.params.tmdbId}/videos`,
        { params: { api_key: TMDB_API_KEY, language: 'en-US' } }
      );
      trailer = resEn.data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    }
    
    if (!trailer) return res.status(404).json({
      success: false, error: 'Aucun trailer disponible'
    });
    
    res.json({ success: true, data: { key: trailer.key } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
