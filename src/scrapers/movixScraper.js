const browserManager = require('./browser');
const { randomDelay } = require('../utils/helpers');
const { MOVIX_BASE_URL } = require('../config');

const EMBED_URLS = [
  (tmdbId) => `https://movix.golf/embed/movie/${tmdbId}`,
  (tmdbId) => `https://movix.golf/player/movie/${tmdbId}`,
  (tmdbId) => `https://movix.golf/stream/movie/${tmdbId}`,
  (tmdbId) => `https://vidsrc.to/embed/movie/${tmdbId}`,
  (tmdbId) => `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`,
  (tmdbId) => `https://www.2embed.cc/embed/${tmdbId}`,
  (tmdbId) => `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,
];

async function getVideoFromMovix(tmdbId, title) {
  console.log('🎬 Recherche vidéo pour TMDB:', tmdbId);

  for (const buildUrl of EMBED_URLS) {
    const embedUrl = buildUrl(tmdbId);
    console.log('Essai:', embedUrl);
    const result = await tryEmbedUrl(embedUrl);
    if (result) {
      console.log('✅ Vidéo trouvée via:', embedUrl);
      return result;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  return null;
}

async function tryEmbedUrl(embedUrl) {
  const page = await browserManager.newPage(false);
  const capturedUrls = [];

  try {
    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      if (url.includes('.m3u8') || url.includes('.mp4')) {
        capturedUrls.push(url);
        console.log('📡 Capturé:', url.substring(0, 100));
      }
      try { req.continue(); } catch {}
    });

    await page.goto(embedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await new Promise(r => setTimeout(r, 5000));

    // Clic sur play
    try {
      await page.evaluate(() => {
        const selectors = [
          '.jw-icon-display', '.vjs-big-play-button',
          '.play-btn', '[aria-label="Play"]',
          '.plyr__control--overlaid', 'button.play',
          '#playbtn', '.fp-play',
        ];
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return; }
        }
        document.body.click();
      });
      await new Promise(r => setTimeout(r, 3000));
    } catch {}

    // Cherche vidéo dans les URLs capturées
    let videoUrl = capturedUrls.find(u => 
      u.includes('.m3u8') || u.includes('.mp4')
    );

    // Cherche dans le HTML
    if (!videoUrl) {
      const html = await page.content();
      const m3u8 = html.match(/https?:\/\/[^"'\\s]+\.m3u8[^"'\\s]*/);
      const mp4 = html.match(/https?:\/\/[^"'\\s]+\.mp4[^"'\\s]*/);
      videoUrl = m3u8?.[0] || mp4?.[0] || null;
    }

    // Cherche via jwplayer
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

    if (videoUrl) {
      return {
        videoUrl,
        type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        source: embedUrl,
      };
    }

    return null;

  } catch (err) {
    console.error('❌ Erreur:', embedUrl, err.message);
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
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Attendre que le contenu JS s'exécute
    await new Promise(r => setTimeout(r, 5000));

    // Scroll pour forcer le chargement paresseux
    await page.evaluate(() => window.scrollTo(0, 500));
    await new Promise(r => setTimeout(r, 2000));

    const result = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        bodyLength: document.body.innerHTML.length,
        bodyText: document.body.innerText.substring(0, 500),
        allBtns: [...document.querySelectorAll('button, a')]
          .map(el => ({
            text: el.textContent.trim().substring(0, 30),
            class: el.className?.substring(0, 50),
            href: el.getAttribute('href'),
          }))
          .filter(el => el.text.length > 0)
          .slice(0, 30),
      };
    });

    return result;
  } finally {
    await browserManager.closePage(page);
  }
}

module.exports = { getVideoFromMovix, extractFromIframe, debugMovix };
