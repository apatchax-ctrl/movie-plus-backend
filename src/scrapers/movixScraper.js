const axios = require('axios');
const { randomDelay } = require('../utils/helpers');

// Sources vidéo qui retournent directement un embed
// sans nécessiter de clic ou d'interaction
const EMBED_SOURCES = [
  (id) => `https://vidsrc.xyz/embed/movie/${id}`,
  (id) => `https://vidsrc.to/embed/movie/${id}`,
  (id) => `https://vidsrc.me/embed/movie?tmdb=${id}`,
  (id) => `https://www.2embed.cc/embed/${id}`,
  (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
  (id) => `https://embed.su/embed/movie/${id}`,
  (id) => `https://player.videasy.net/movie/${id}`,
  (id) => `https://moviesapi.club/movie/${id}`,
];

async function getVideoFromMovix(tmdbId, title) {
  console.log(`🎬 Recherche vidéo: ${title} (${tmdbId})`);
  
  const browserManager = require('./browser');
  
  for (const getUrl of EMBED_SOURCES) {
    const embedUrl = getUrl(tmdbId);
    console.log('🔍 Essai:', embedUrl);
    
    const page = await browserManager.newPage(false);
    const capturedUrls = [];
    
    try {
      await page.setRequestInterception(true);
      page.on('request', req => {
        const url = req.url();
        if (url.includes('.m3u8') || 
            url.includes('.mp4') ||
            url.includes('master') ||
            url.includes('playlist.m3u')) {
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
            '.jw-icon-display',
            '.vjs-big-play-button', 
            '.play-btn',
            '[aria-label="Play"]',
            '.plyr__control--overlaid',
            'button.play',
            '#playbtn',
            '.fp-play',
            '.player-play-btn',
          ];
          for (const sel of selectors) {
            const btn = document.querySelector(sel);
            if (btn) { btn.click(); return sel; }
          }
          document.body.click();
        });
        await new Promise(r => setTimeout(r, 3000));
      } catch {}

      // Vérifie URLs capturées
      let videoUrl = capturedUrls.find(u => 
        u.includes('.m3u8') || u.includes('.mp4')
      );

      // Cherche dans le HTML
      if (!videoUrl) {
        const html = await page.content();
        console.log('HTML length:', html.length);
        
        const m3u8 = html.match(/https?:\/\/[^"'\\s]+\.m3u8[^"'\\s]*/);
        const mp4 = html.match(/https?:\/\/[^"'\\s]+\.mp4[^"'\\s]*/);
        videoUrl = m3u8?.[0] || mp4?.[0] || null;
      }

      // Cherche via JS player
      if (!videoUrl) {
        videoUrl = await page.evaluate(() => {
          try {
            if (typeof jwplayer !== 'undefined') {
              const item = jwplayer().getPlaylistItem();
              if (item?.file) return item.file;
            }
          } catch {}
          const video = document.querySelector('video');
          if (video?.src && video.src.length > 10) return video.src;
          const source = document.querySelector('video source');
          if (source?.src) return source.src;
          return null;
        });
      }

      if (videoUrl && videoUrl.startsWith('http')) {
        console.log('✅ Vidéo trouvée:', videoUrl.substring(0, 80));
        return {
          videoUrl,
          type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
          source: embedUrl,
        };
      }

    } catch (err) {
      console.error('❌ Erreur:', embedUrl, '-', err.message);
    } finally {
      await browserManager.closePage(page);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('❌ Aucune source vidéo trouvée pour TMDB:', tmdbId);
  return null;
}

async function debugMovix(tmdbId) {
  const browserManager = require('./browser');
  const page = await browserManager.newPage(false);
  const capturedUrls = [];

  try {
    const sources = EMBED_SOURCES.map(fn => fn(tmdbId));
    const results = [];

    for (const url of sources.slice(0, 3)) {
      const p = await browserManager.newPage(false);
      const urls = [];

      try {
        await p.setRequestInterception(true);
        p.on('request', req => {
          urls.push(req.url().substring(0, 100));
          try { req.continue(); } catch {}
        });

        await p.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 20000 
        });
        await new Promise(r => setTimeout(r, 3000));

        const data = await p.evaluate(() => ({
          title: document.title,
          bodyLength: document.body.innerHTML.length,
          hasVideo: !!document.querySelector('video'),
          hasIframe: !!document.querySelector('iframe'),
        }));

        results.push({ url, ...data, networkCount: urls.length });
      } catch (e) {
        results.push({ url, error: e.message });
      } finally {
        await browserManager.closePage(p);
      }
    }

    return results;
  } finally {
    await browserManager.closePage(page);
  }
}

module.exports = { getVideoFromMovix, debugMovix };
