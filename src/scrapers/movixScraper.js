const { randomDelay } = require('../utils/helpers');

async function getVideoFromMovix(tmdbId, title) {
  console.log(`🎬 Recherche vidéo: ${title} (${tmdbId})`);
  const browserManager = require('./browser');

  // vidsrc.to fonctionne sur Render
  const embedUrl = `https://vidsrc.to/embed/movie/${tmdbId}`;
  console.log('🔍 URL:', embedUrl);

  const page = await browserManager.newPage(false);
  const capturedUrls = [];

  try {
    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      if (url.includes('.m3u8') || url.includes('.mp4') ||
          url.includes('master') || url.includes('playlist')) {
        capturedUrls.push(url);
        console.log('📡 Capturé:', url.substring(0, 120));
      }
      try { req.continue(); } catch {}
    });

    await page.goto(embedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await new Promise(r => setTimeout(r, 5000));

    // Récupère l'iframe src
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

    console.log('iframe trouvé:', iframeSrc);

    // Vérifie URLs capturées directement
    let videoUrl = capturedUrls.find(u =>
      u.includes('.m3u8') || u.includes('.mp4')
    );

    // Si iframe trouvé, l'ouvre
    if (!videoUrl && iframeSrc) {
      console.log('📺 Ouverture iframe:', iframeSrc);
      const iframePage = await browserManager.newPage(false);
      const iframeUrls = [];

      try {
        await iframePage.setRequestInterception(true);
        iframePage.on('request', req => {
          const url = req.url();
          if (url.includes('.m3u8') || url.includes('.mp4') ||
              url.includes('master') || url.includes('playlist')) {
            iframeUrls.push(url);
            console.log('📡 iframe URL:', url.substring(0, 120));
          }
          try { req.continue(); } catch {}
        });

        await iframePage.goto(iframeSrc, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        await new Promise(r => setTimeout(r, 5000));

        // Clic sur play
        try {
          await iframePage.evaluate(() => {
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
          await new Promise(r => setTimeout(r, 5000));
        } catch {}

        videoUrl = iframeUrls.find(u =>
          u.includes('.m3u8') || u.includes('.mp4')
        );

        // Cherche dans le HTML
        if (!videoUrl) {
          const html = await iframePage.content();
          const m3u8 = html.match(/https?:\/\/[^"'\\s]+\.m3u8[^"'\\s]*/);
          const mp4 = html.match(/https?:\/\/[^"'\\s]+\.mp4[^"'\\s]*/);
          videoUrl = m3u8?.[0] || mp4?.[0] || null;
        }

        // Cherche via JS
        if (!videoUrl) {
          videoUrl = await iframePage.evaluate(() => {
            try {
              if (typeof jwplayer !== 'undefined') {
                const item = jwplayer().getPlaylistItem();
                if (item?.file) return item.file;
              }
            } catch {}
            const video = document.querySelector('video');
            if (video?.src && video.src.startsWith('http')) return video.src;
            return null;
          });
        }

        // Cherche iframes imbriquées
        if (!videoUrl) {
          const nestedIframe = await iframePage.evaluate(() => {
            const iframes = [...document.querySelectorAll('iframe')];
            for (const iframe of iframes) {
              const src = iframe.src || '';
              if (src && src.startsWith('http') && src.length > 20) return src;
            }
            return null;
          });

          if (nestedIframe) {
            console.log('📺 iframe imbriquée:', nestedIframe);
            const result = await extractDeepIframe(nestedIframe, browserManager);
            if (result) videoUrl = result;
          }
        }

      } finally {
        await browserManager.closePage(iframePage);
      }
    }

    if (videoUrl && videoUrl.startsWith('http')) {
      return {
        videoUrl,
        type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        source: 'vidsrc.to',
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

async function extractDeepIframe(url, browserManager) {
  const page = await browserManager.newPage(false);
  const captured = [];

  try {
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.includes('.m3u8') || u.includes('.mp4')) captured.push(u);
      try { req.continue(); } catch {}
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 5000));

    try {
      await page.evaluate(() => { document.body.click(); });
      await new Promise(r => setTimeout(r, 3000));
    } catch {}

    const videoUrl = captured.find(u => u.includes('.m3u8') || u.includes('.mp4'));
    if (videoUrl) return videoUrl;

    const html = await page.content();
    const m3u8 = html.match(/https?:\/\/[^"'\\s]+\.m3u8[^"'\\s]*/);
    return m3u8?.[0] || null;

  } catch { return null; }
  finally { await browserManager.closePage(page); }
}

async function debugMovix(tmdbId) {
  const browserManager = require('./browser');
  const results = [];

  const urls = [
    `https://www.2embed.cc/embed/${tmdbId}`,
    `https://player.videasy.net/movie/${tmdbId}`,
  ];

  for (const url of urls) {
    const page = await browserManager.newPage(false);
    const networkUrls = [];
    try {
      await page.setRequestInterception(true);
      page.on('request', req => {
        networkUrls.push({
          url: req.url().substring(0, 150),
          type: req.resourceType(),
        });
        try { req.continue(); } catch {}
      });

      await page.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 20000 
      });
      
      // Attendre plus longtemps
      await new Promise(r => setTimeout(r, 5000));

      // Clique sur play si présent
      await page.evaluate(() => {
        const selectors = [
          '.play-btn', '.jw-icon-display',
          '.vjs-big-play-button', 'button.play',
          '[aria-label="Play"]', '#playbtn',
        ];
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return; }
        }
        document.body.click();
      });

      await new Promise(r => setTimeout(r, 3000));

      const data = await page.evaluate(() => ({
        title: document.title,
        bodyLength: document.body.innerHTML.length,
        hasVideo: !!document.querySelector('video'),
        videoSrc: document.querySelector('video')?.src || null,
        iframes: [...document.querySelectorAll('iframe')]
          .map(f => ({
            src: f.src || f.getAttribute('data-src') || '',
            id: f.id,
            class: f.className,
          }))
          .filter(f => f.src),
        scripts: [...document.querySelectorAll('script')]
          .map(s => s.innerHTML)
          .filter(s => s.includes('file') || s.includes('source') || 
                       s.includes('m3u8') || s.includes('mp4') ||
                       s.includes('jwplayer') || s.includes('player'))
          .map(s => s.substring(0, 300))
          .slice(0, 3),
        allLinks: [...document.querySelectorAll('a')]
          .map(a => a.href)
          .filter(h => h.includes('embed') || h.includes('player') || 
                       h.includes('stream') || h.includes('video'))
          .slice(0, 5),
      }));

      // URLs réseau intéressantes
      const interesting = networkUrls.filter(r =>
        r.url.includes('embed') || r.url.includes('player') ||
        r.url.includes('stream') || r.url.includes('.m3u8') ||
        r.url.includes('.mp4') || r.type === 'xhr' || r.type === 'fetch'
      );

      results.push({ 
        url, 
        ...data, 
        interesting,
        totalRequests: networkUrls.length 
      });

    } catch (e) {
      results.push({ url, error: e.message });
    } finally {
      await browserManager.closePage(page);
    }
  }
  return results;
}

module.exports = { getVideoFromMovix, debugMovix };
