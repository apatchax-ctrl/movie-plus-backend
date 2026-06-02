const browserManager = require('./browser');
const { BASE_URL } = require('../config');
const { randomDelay } = require('../utils/helpers');
const axios = require('axios');
const { HEADERS } = require('../config');

// Décode un lien /link/BASE64 pour obtenir l'URL du lecteur
// fs17.lol encode les liens vidéo en base64 JSON
async function decodeLinkPath(linkPath) {
  try {
    const fullUrl = linkPath.startsWith('http') ? linkPath : BASE_URL + linkPath;
    
    // La page /link/CODE redirige vers l'URL du lecteur
    const response = await axios.get(fullUrl, {
      headers: HEADERS,
      maxRedirects: 0,
      validateStatus: (s) => s < 400,
      timeout: 10000,
    });

    // Si redirection, l'URL est dans Location header
    if (response.headers.location) {
      return response.headers.location;
    }

    // Sinon, essaie de décoder le base64 manuellement
    const base64Part = linkPath.split('/link/')[1];
    if (base64Part) {
      const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
      const json = JSON.parse(decoded);
      // json contient { file, player_id, video_id }
      // construire l'URL du player
      if (json.file && json.video_id) {
        return `${BASE_URL}/${json.file}?p_id=${json.player_id}&c_id=${json.video_id}`;
      }
    }

    return null;
  } catch (err) {
    console.error('❌ Erreur décodage lien:', err.message);
    return null;
  }
}

// Ouvre un lecteur et intercepte le flux vidéo (.m3u8 ou .mp4)
async function extractVideoFromPlayer(playerUrl) {
  if (!playerUrl) return null;
  
  const page = await browserManager.newPage(false);
  let videoUrl = null;

  try {
    console.log(`🎬 Extraction vidéo depuis: ${playerUrl}`);

    // Intercepter les requêtes réseau pour capturer .m3u8 ou .mp4
    await page.setRequestInterception(true);
    
    page.on('request', (req) => {
      const url = req.url();
      if ((url.includes('.m3u8') || url.includes('.mp4')) && !videoUrl) {
        videoUrl = url;
        console.log(`✅ URL vidéo trouvée: ${url.substring(0, 80)}...`);
      }
      // Ne pas bloquer les requêtes (on a besoin que la page charge)
      try { req.continue(); } catch {}
    });

    await page.goto(playerUrl, {
      waitUntil: 'networkidle2',
      timeout: 20000,
    });

    // Chercher le bouton play et cliquer si nécessaire
    try {
      const playBtn = await page.$('.play-btn, .vjs-big-play-button, button[class*="play"], [aria-label*="play"]');
      if (playBtn) {
        await playBtn.click();
        await randomDelay(2000, 4000);
      }
    } catch {}

    // Attendre encore un peu pour que le flux démarre
    if (!videoUrl) await randomDelay(3000, 5000);

    // Chercher aussi dans le HTML (parfois l'URL est dans le source)
    if (!videoUrl) {
      const content = await page.content();
      const m3u8Match = content.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
      const mp4Match = content.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/);
      videoUrl = m3u8Match?.[0] || mp4Match?.[0] || null;
    }

    return videoUrl;

  } catch (err) {
    console.error('❌ Erreur extraction vidéo:', err.message);
    return null;
  } finally {
    await browserManager.closePage(page);
  }
}

// Fonction principale : prend les players d'un film et retourne le premier lien vidéo
async function getVideoUrl(players = [], iframeSources = []) {
  // Essaie d'abord les players encodés base64
  for (const player of players) {
    const playerUrl = await decodeLinkPath(player.linkPath || player.fullPath);
    if (playerUrl) {
      const videoUrl = await extractVideoFromPlayer(playerUrl);
      if (videoUrl) {
        return {
          videoUrl,
          type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
          source: player.label,
        };
      }
    }
  }

  // Essaie les iframes directs
  for (const iframe of iframeSources) {
    if (iframe.src) {
      const videoUrl = await extractVideoFromPlayer(iframe.src);
      if (videoUrl) {
        return {
          videoUrl,
          type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
          source: iframe.label,
        };
      }
    }
  }

  return null;
}

module.exports = { decodeLinkPath, extractVideoFromPlayer, getVideoUrl };
