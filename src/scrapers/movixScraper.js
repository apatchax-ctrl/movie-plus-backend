const browserManager = require('./browser');
const { randomDelay } = require('../utils/helpers');
const { MOVIX_BASE_URL } = require('../config');

async function getVideoFromMovix(tmdbId, title) {
  const page = await browserManager.newPage(false);
  const capturedUrls = [];

  try {
    console.log(`🎬 Movix: ${title} (TMDB: ${tmdbId})`);

    // Intercepte les URLs vidéo
    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      if (url.includes('.m3u8') || url.includes('.mp4')) {
        capturedUrls.push(url);
        console.log('📡 Vidéo:', url.substring(0, 100));
      }
      try { req.continue(); } catch {}
    });

    // Movix utilise les IDs TMDB dans ses URLs
    // Format : movix.golf/movie/TMDB_ID
    const movieUrl = `${MOVIX_BASE_URL}/movie/${tmdbId}`;
    console.log('URL Movix:', movieUrl);

    await page.goto(movieUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await randomDelay(2000, 3000);

    // Clique sur le bouton Regarder
    const watchClicked = await page.evaluate(() => {
      const selectors = [
        'button.watch-btn',
        '.btn-watch',
        'a.watch',
        '[class*="watch"]',
        '[class*="regarder"]',
        'button.play',
        '.play-btn',
      ];
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn) { btn.click(); return sel; }
      }
      // Cherche par texte
      const btns = [...document.querySelectorAll('button, a')];
      for (const btn of btns) {
        const text = btn.textContent.trim().toLowerCase();
        if (text.includes('regarder') || text.includes('watch') || 
            text.includes('play') || text.includes('lecture')) {
          btn.click();
          return btn.textContent.trim();
        }
      }
      return null;
    });

    console.log('Bouton cliqué:', watchClicked);
    await randomDelay(2000, 3000);

    // Gère la popup pub si elle apparaît
    await page.evaluate(() => {
      // Ferme les popups/modals pub
      const closeSelectors = [
        '.close', '.modal-close', '[aria-label="close"]',
        '.close-btn', '#close', '.dismiss',
      ];
      for (const sel of closeSelectors) {
        const btn = document.querySelector(sel);
        if (btn) btn.click();
      }
    });

    await randomDelay(1000, 2000);

    // Clique sur Lecture si présent
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, a')];
      for (const btn of btns) {
        const text = btn.textContent.trim().toLowerCase();
        if (text === 'lecture' || text === 'play' || text === 'lancer') {
          btn.click();
          return btn.textContent.trim();
        }
      }
    });

    await randomDelay(3000, 5000);

    // Récupère les iframes
    const iframeSrc = await page.evaluate(() => {
      const iframes = [...document.querySelectorAll('iframe')];
      for (const iframe of iframes) {
        const src = iframe.src || iframe.getAttribute('data-src') || '';
        if (src && src.startsWith('http') && src.length > 20) {
          return src;
        }
      }
      return null;
    });

    console.log('iframe:', iframeSrc);

    // Cherche dans les URLs capturées
    let videoUrl = capturedUrls.find(u => 
      u.includes('.m3u8') || u.includes('.mp4')
    );

    // Si on a une iframe, l'ouvre
    if (!videoUrl && iframeSrc) {
      videoUrl = await extractFromIframe(iframeSrc);
    }

    // Cherche dans le HTML
    if (!videoUrl) {
      const html = await page.content();
      const m3u8 = html.match(/https?:\/\/[^"'\\s]+\.m3u8[^"'\\s]*/);
      const mp4 = html.match(/https?:\/\/[^"'\\s]+\.mp4[^"'\\s]*/);
      videoUrl = m3u8?.[0] || mp4?.[0] || null;
    }

    if (videoUrl) {
      return {
        videoUrl,
        type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        source: 'movix.golf',
      };
    }

    return null;

  } catch (err) {
    console.error('❌ Erreur Movix:', err.message);
    return null;
  } finally {
    await browserManager.closePage(page);
  }
}

async function extractFromIframe(iframeSrc) {
  const page = await browserManager.newPage(false);
  const capturedUrls = [];

  try {
    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      if (url.includes('.m3u8') || url.includes('.mp4')) {
        capturedUrls.push(url);
      }
      try { req.continue(); } catch {}
    });

    await page.goto(iframeSrc, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await randomDelay(3000, 5000);

    // Clique sur play
    try {
      await page.evaluate(() => {
        const playSelectors = [
          '.jw-icon-display', '.vjs-big-play-button',
          '.play-btn', '[aria-label="Play"]',
          '.plyr__control--overlaid',
        ];
        for (const sel of playSelectors) {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return; }
        }
        document.body.click();
      });
      await randomDelay(2000, 3000);
    } catch {}

    let videoUrl = capturedUrls.find(u => 
      u.includes('.m3u8') || u.includes('.mp4')
    ) || null;

    if (!videoUrl) {
      const html = await page.content();
      const m3u8 = html.match(/https?:\/\/[^"'\\s]+\.m3u8[^"'\\s]*/);
      const mp4 = html.match(/https?:\/\/[^"'\\s]+\.mp4[^"'\\s]*/);
      videoUrl = m3u8?.[0] || mp4?.[0] || null;
    }

    if (!videoUrl) {
      videoUrl = await page.evaluate(() => {
        try {
          if (typeof jwplayer !== 'undefined') {
            return jwplayer().getPlaylistItem()?.file || null;
          }
        } catch {}
        const video = document.querySelector('video');
        return video?.src || null;
      });
    }

    return videoUrl;

  } catch (err) {
    console.error('❌ Erreur iframe:', err.message);
    return null;
  } finally {
    await browserManager.closePage(page);
  }
}

// Debug : inspecte movix.golf pour un film
async function debugMovix(tmdbId) {
  const page = await browserManager.newPage(false);
  try {
    const url = `${MOVIX_BASE_URL}/movie/${tmdbId}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await randomDelay(2000, 3000);

    const result = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, a')]
        .map(el => ({
          tag: el.tagName,
          text: el.textContent.trim().substring(0, 30),
          class: el.className?.substring(0, 50),
          href: el.getAttribute('href'),
        }))
        .filter(el => el.text.length > 0)
        .slice(0, 30);

      return {
        title: document.title,
        url: window.location.href,
        btns,
        bodyLength: document.body.innerHTML.length,
      };
    });

    return result;
  } finally {
    await browserManager.closePage(page);
  }
}

module.exports = { getVideoFromMovix, extractFromIframe, debugMovix };
