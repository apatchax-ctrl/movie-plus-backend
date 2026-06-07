const browserManager = require('./browser');
const { randomDelay } = require('../utils/helpers');

async function getVideoUrl(players = [], iframeSources = [], filmUrl = null) {
  if (!filmUrl) return null;
  
  const page = await browserManager.newPage(false);
  let videoUrl = null;

  try {
    console.log('🎬 Extraction vidéo depuis:', filmUrl);

    // Intercepte les requêtes réseau pour capturer .m3u8 ou .mp4
    const capturedUrls = [];
    await page.setRequestInterception(true);
    
    page.on('request', req => {
      const url = req.url();
      if (url.includes('.m3u8') || 
          url.includes('.mp4') ||
          url.includes('stream') ||
          url.includes('video') ||
          url.includes('playlist')) {
        capturedUrls.push(url);
        console.log('📡 URL capturée:', url.substring(0, 100));
      }
      try { req.continue(); } catch {}
    });

    await page.goto(filmUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await randomDelay(2000, 3000);

    // Cherche et clique sur le premier bouton player disponible
    const clicked = await page.evaluate(() => {
      // Cherche les boutons serveurs dans .movie-players
      const playerBtns = document.querySelectorAll(
        '.movie-players a, .ftabs a, .tabs-box a, ' +
        '.server-btn, .player-btn, [data-file], ' +
        '.tab-item, .ftabs .tabs-sel'
      );
      
      console.log('Boutons player trouvés:', playerBtns.length);
      
      if (playerBtns.length > 0) {
        playerBtns[0].click();
        return true;
      }

      // Cherche dans video-container
      const videoContainer = document.querySelector(
        '.video-container, .movie-player, #player'
      );
      if (videoContainer) {
        videoContainer.click();
        return true;
      }

      return false;
    });

    console.log('Click player:', clicked);
    await randomDelay(3000, 5000);

    // Cherche iframe qui apparaît après le clic
    const iframeSrc = await page.evaluate(() => {
      const iframes = [...document.querySelectorAll('iframe')];
      for (const iframe of iframes) {
        const src = iframe.src || iframe.getAttribute('data-src') || '';
        if (src && 
            !src.includes('newsid') && 
            src.startsWith('http') &&
            src.length > 20) {
          return src;
        }
      }
      return null;
    });

    console.log('iframe trouvé:', iframeSrc);

    // Si on a trouvé une iframe, on l'ouvre pour extraire le vrai lien
    if (iframeSrc) {
      const videoFromIframe = await extractFromIframe(iframeSrc);
      if (videoFromIframe) return videoFromIframe;
    }

    // Cherche dans les URLs capturées
    videoUrl = capturedUrls.find(u => 
      u.includes('.m3u8') || u.includes('.mp4')
    ) || null;

    // Cherche dans le HTML de la page
    if (!videoUrl) {
      const pageContent = await page.content();
      const m3u8Match = pageContent.match(
        /https?:\/\/[^"'\\s\\]+\.m3u8[^"'\\s\\]*/
      );
      const mp4Match = pageContent.match(
        /https?:\/\/[^"'\\s\\]+\.mp4[^"'\\s\\]*/
      );
      videoUrl = m3u8Match?.[0] || mp4Match?.[0] || null;
    }

    // Cherche via jwplayer ou autre player JS
    if (!videoUrl) {
      videoUrl = await page.evaluate(() => {
        // jwplayer
        if (typeof jwplayer !== 'undefined') {
          try {
            const src = jwplayer().getPlaylistItem()?.file;
            if (src) return src;
          } catch {}
        }
        // video tag
        const video = document.querySelector('video source, video');
        if (video) {
          return video.src || video.getAttribute('src') || null;
        }
        return null;
      });
    }

    console.log('URL vidéo finale:', videoUrl);
    
    if (videoUrl) {
      return {
        videoUrl,
        type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        source: 'fs17.lol',
      };
    }

    return null;

  } catch (err) {
    console.error('❌ Erreur extraction vidéo:', err.message);
    return null;
  } finally {
    await browserManager.closePage(page);
  }
}

async function extractFromIframe(iframeSrc) {
  const page = await browserManager.newPage(false);
  let videoUrl = null;

  try {
    console.log('🎬 Extraction depuis iframe:', iframeSrc);

    const capturedUrls = [];
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

    // Clic sur play si bouton présent
    try {
      const playBtn = await page.$(
        '.play-btn, .vjs-big-play-button, ' +
        'button[class*="play"], [aria-label*="play"], ' +
        '.jw-icon-display, #playbtn'
      );
      if (playBtn) {
        await playBtn.click();
        await randomDelay(2000, 3000);
      }
    } catch {}

    videoUrl = capturedUrls.find(u => 
      u.includes('.m3u8') || u.includes('.mp4')
    ) || null;

    if (!videoUrl) {
      const content = await page.content();
      const m3u8 = content.match(/https?:\/\/[^"'\\s\\]+\.m3u8[^"'\\s\\]*/);
      const mp4 = content.match(/https?:\/\/[^"'\\s\\]+\.mp4[^"'\\s\\]*/);
      videoUrl = m3u8?.[0] || mp4?.[0] || null;
    }

    if (!videoUrl) {
      videoUrl = await page.evaluate(() => {
        if (typeof jwplayer !== 'undefined') {
          try { return jwplayer().getPlaylistItem()?.file; } catch {}
        }
        const video = document.querySelector('video');
        return video?.src || null;
      });
    }

    if (videoUrl) {
      return {
        videoUrl,
        type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        source: iframeSrc,
      };
    }
    return null;

  } catch (err) {
    console.error('❌ Erreur iframe:', err.message);
    return null;
  } finally {
    await browserManager.closePage(page);
  }
}

module.exports = { getVideoUrl, extractFromIframe };
