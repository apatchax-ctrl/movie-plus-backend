const axios = require('axios');

// APIs qui retournent les sources vidéo directement en JSON
// sans avoir besoin de Puppeteer

async function getVideoFromMovix(tmdbId, title) {
  console.log(`🎬 Recherche vidéo: ${title} (TMDB: ${tmdbId})`);

  // Essaie chaque API dans l'ordre
  const strategies = [
    () => tryVidsrcAPI(tmdbId),
    () => tryMoviesAPIClub(tmdbId),
    () => tryAutoembed(tmdbId),
    () => trySuperembed(tmdbId),
  ];

  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result) {
        console.log('✅ Vidéo trouvée:', result.source);
        return result;
      }
    } catch (e) {
      console.error('❌ Stratégie échouée:', e.message);
    }
  }

  return null;
}

// Strategy 1: vidsrc.to API directe
async function tryVidsrcAPI(tmdbId) {
  try {
    // vidsrc.to expose une API JSON
    const apiUrl = `https://vidsrc.to/vapi/movie/w/${tmdbId}`;
    console.log('Essai vidsrc API:', apiUrl);
    
    const res = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://vidsrc.to/',
        'Accept': 'application/json',
      },
      timeout: 15000,
    });

    const data = res.data;
    console.log('vidsrc API réponse:', JSON.stringify(data).substring(0, 200));

    if (data?.result?.sources) {
      const source = data.result.sources[0];
      if (source?.file) {
        return {
          videoUrl: source.file,
          type: source.file.includes('.m3u8') ? 'm3u8' : 'mp4',
          source: 'vidsrc.to',
        };
      }
    }
    return null;
  } catch (e) {
    console.error('vidsrc API erreur:', e.message);
    return null;
  }
}

// Strategy 2: moviesapi.club
async function tryMoviesAPIClub(tmdbId) {
  try {
    const url = `https://moviesapi.club/movie/${tmdbId}`;
    console.log('Essai moviesapi.club:', url);
    
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://moviesapi.club/',
        'Accept': '*/*',
      },
      timeout: 15000,
    });

    const html = res.data;
    
    // Cherche le lien vidéo dans le HTML
    const m3u8 = html.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/);
    const mp4 = html.match(/https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*/);
    
    if (m3u8 || mp4) {
      const videoUrl = m3u8?.[0] || mp4?.[0];
      return {
        videoUrl,
        type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        source: 'moviesapi.club',
      };
    }

    // Cherche dans les scripts
    const fileMatch = html.match(/"file"\s*:\s*"(https?:[^"]+)"/);
    if (fileMatch) {
      return {
        videoUrl: fileMatch[1].replace(/\\/g, ''),
        type: fileMatch[1].includes('.m3u8') ? 'm3u8' : 'mp4',
        source: 'moviesapi.club',
      };
    }

    return null;
  } catch (e) {
    console.error('moviesapi erreur:', e.message);
    return null;
  }
}

// Strategy 3: autoembed.cc
async function tryAutoembed(tmdbId) {
  try {
    const url = `https://autoembed.co/movie/tmdb/${tmdbId}`;
    console.log('Essai autoembed:', url);
    
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://autoembed.co/',
      },
      timeout: 15000,
    });

    const html = res.data;
    const m3u8 = html.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/);
    const mp4 = html.match(/https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*/);
    const file = html.match(/"file"\s*:\s*"(https?:[^"]+)"/);
    
    const videoUrl = m3u8?.[0] || file?.[1]?.replace(/\\/g, '') || mp4?.[0];
    if (videoUrl) {
      return {
        videoUrl,
        type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        source: 'autoembed.co',
      };
    }
    return null;
  } catch (e) {
    console.error('autoembed erreur:', e.message);
    return null;
  }
}

// Strategy 4: superembed
async function trySuperembed(tmdbId) {
  try {
    const url = `https://superembed.stream/movie/${tmdbId}`;
    console.log('Essai superembed:', url);
    
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://superembed.stream/',
      },
      timeout: 15000,
    });

    const html = res.data;
    const m3u8 = html.match(/https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*/);
    const file = html.match(/"file"\s*:\s*"(https?:[^"]+)"/);
    
    const videoUrl = m3u8?.[0] || file?.[1]?.replace(/\\/g, '');
    if (videoUrl) {
      return {
        videoUrl,
        type: videoUrl.includes('.m3u8') ? 'm3u8' : 'mp4',
        source: 'superembed.stream',
      };
    }
    return null;
  } catch (e) {
    console.error('superembed erreur:', e.message);
    return null;
  }
}

// Debug : teste toutes les sources
async function debugMovix(tmdbId) {
  const results = [];
  
  try {
    // Voir le HTML complet de 2embed.cc
    const res = await axios.get(
      `https://www.2embed.cc/embed/${tmdbId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.2embed.cc/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      timeout: 15000,
    });
    
    const html = res.data;
    
    // Cherche tous les scripts
    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    const scripts = scriptMatches
      .map(s => s.replace(/<\/?:script[^>]*>/gi, '').trim())
      .filter(s => s.length > 10)
      .slice(0, 5);
    
    // Cherche les iframes
    const iframes = (html.match(/src=["']([^"']+)["']/gi) || [])
      .map(s => s.replace(/src=["']/i, '').replace(/["']$/, ''))
      .filter(s => s.startsWith('http') || s.startsWith('//'))
      .slice(0, 10);

    results.push({
      url: `https://www.2embed.cc/embed/${tmdbId}`,
      status: res.status,
      length: html.length,
      scripts: scripts.map(s => s.substring(0, 500)),
      iframes,
      // Cherche des patterns spécifiques
      hasIframe: html.includes('<iframe'),
      hasPlayer: html.includes('player') || html.includes('jwplayer'),
      hasSource: html.includes('source') || html.includes('src'),
      // Extrait les URLs interessantes du HTML
      urls: (html.match(/https?:\/\/[^"]+/g) || [])
        .filter(u => u.includes('embed') || u.includes('player') || 
                     u.includes('stream') || u.includes('api'))
        .slice(0, 15),
    });
  } catch (e) {
    results.push({ error: e.message });
  }
  
  return results;
}

module.exports = { getVideoFromMovix, debugMovix };
