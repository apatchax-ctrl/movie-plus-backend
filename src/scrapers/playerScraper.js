const browserManager = require('./browser');
const { randomDelay } = require('../utils/helpers');

async function getVideoUrl(players = [], iframeSources = [], filmUrl = null) {
  if (!filmUrl) return null;
  
  const page = await browserManager.newPage(false);
  const capturedUrls = [];

  try {
    console.log('🎬 Extraction vidéo:', filmUrl);

    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      if (url.includes('.m3u8') || 
          url.includes('.mp4') ||
          url.includes('master') ||
          url.includes('playlist')) {
        capturedUrls.push(url);
        console.log('📡 Capturé:', url.substring(0, 120));
      }
      try { req.continue(); } catch {}
    });

    await page.goto(filmUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await randomDelay(2000, 3000);

    // Cherche les boutons serveurs VIDZY, UQLOAD, DOOD, VOE, FILMOON
    const serverClicked = await page.evaluate(() => {
      // Les serveurs sont dans des tabs en bas du player
      const selectors = [
        '.movie-players .ftabs a',
        '.ftabs .tabs-sel a',
        '.server-item',
        '.player-server',
        'a[data-tab]',
        '.tab-item',
        // Cherche par texte
      ];

      for (const sel of selectors) {
        const btns = document.querySelectorAll(sel);
        if (btns.length > 0) {
          console.log(`Trouvé ${btns.length} serveurs avec: ${sel}`);
          btns[0].click();
          return { found: true, selector: sel, count: btns.length };
        }
      }

      // Cherche par texte VIDZY, UQLOAD etc
      const allLinks = document.querySelectorAll('a, button, div[onclick]');
      for (const el of allLinks) {
        const text = el.textContent.trim().toUpperCase();
        if (['VIDZY','UQLOAD','DOOD','VOE','FILMOON','STREAMTAPE',
             'VUDEO','SIBNET'].includes(text)) {
          console.log('Serveur trouvé par texte:', text);
          el.click();
          return { found: true, selector: text, count: 1 };
        }
      }

      return { found: false };
    });

    console.log('Serveur cliqué:', JSON.stringify(serverClicked));
    await randomDelay(3000, 5000);

    // Récupère l'iframe qui s'est chargé après le clic
    const iframeSrc = await page.evaluate(() => {
        const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        const src = iframe.src || iframe.getAttribute('data-src') || '';
        if (src && 
            src.startsWith('http') && 
            !src.includes('fs15.lol') &&
            src.length > 20) {
          console.log('iframe trouvé:', src);
          return src;
        }
      }
      return null;
    });

    console.log('iframe src:', iframeSrc);

    // Ouvre l'iframe pour extraire la vidéo
    if (iframeSrc) {
      const result = await extractFromIframe(iframeSrc);
      if (result) return result;
    }

    // Vérifie les URLs capturées directement
    const videoUrl = capturedUrls.find(u => 
      u.includes('.m3u8') || u.includes('.mp4')
    );

      if (videoUrl) {
      return {
        videoUrl,
        type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        source: 'fs15.lol',
      };
    }

    // Cherche dans le HTML final
    const html = await page.content();
    const m3u8 = html.match(/https?:\/\/[^"'\\s]+\.m3u8[^"'\\s]*/);
    const mp4 = html.match(/https?:\/\/[^"'\\s]+\.mp4[^"'\\s]*/);
    
    if (m3u8 || mp4) {
      const url = m3u8?.[0] || mp4?.[0];
      return {
        videoUrl: url,
        type: url.includes('.m3u8') ? 'm3u8' : 'mp4',
        source: 'fs15.lol',
      };
    }

    return null;

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    return null;
  } finally {
    await browserManager.closePage(page);
  }
}

async function extractFromIframe(iframeSrc) {
  const page = await browserManager.newPage(false);
  const capturedUrls = [];

  try {
    console.log('🎬 Iframe:', iframeSrc.substring(0, 100));

    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      if (url.includes('.m3u8') || 
          url.includes('.mp4') ||
          url.includes('master') ||
          url.includes('playlist')) {
        capturedUrls.push(url);
        console.log('📡 Iframe capturé:', url.substring(0, 120));
      }
      try { req.continue(); } catch {}
    });

    await page.goto(iframeSrc, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await randomDelay(2000, 3000);

    // Clique sur play
    try {
      const played = await page.evaluate(() => {
        const playSelectors = [
          '.play-btn', '.jw-icon-display', '#play-btn',
          '.vjs-big-play-button', '[aria-label="Play"]',
          '.plyr__control--overlaid', '.fp-play',
          'button.play', '.player-play',
        ];
        for (const sel of playSelectors) {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return sel; }
        }
        // Clic au centre de la page
        document.body.click();
        return 'body';
      });
      console.log('Play cliqué:', played);
      await randomDelay(3000, 5000);
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
        // jwplayer
        try {
          if (typeof jwplayer !== 'undefined') {
            const item = jwplayer().getPlaylistItem();
            if (item?.file) return item.file;
          }
        } catch {}
        // video tag
        const video = document.querySelector('video');
        if (video?.src) return video.src;
        const source = document.querySelector('video source');
        if (source?.src) return source.src;
        return null;
      });
    }

    if (videoUrl) {
      return {
        videoUrl,
        type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        source: iframeSrc.substring(0, 50),
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
