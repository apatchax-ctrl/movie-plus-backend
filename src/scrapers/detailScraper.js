const browserManager = require('./browser');
const { BASE_URL } = require('../config');
const { cleanText, toAbsoluteUrl, formatDuration, formatRating, randomDelay, extractIdFromUrl } = require('../utils/helpers');

async function scrapeFilmDetail(filmUrl) {
  const page = await browserManager.newPage(false); // false = ne pas bloquer les images
  
  try {
    console.log(`📄 Détail film: ${filmUrl}`);
    await randomDelay(500, 1500);

    await page.goto(filmUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForSelector('body', { timeout: 10000 });
    await randomDelay(1000, 2000);

    const data = await page.evaluate((baseUrl) => {
      const get = (sel) => document.querySelector(sel);
      const getAll = (sel) => [...document.querySelectorAll(sel)];
      const text = (sel) => get(sel)?.textContent?.trim() || null;

      // === TITRE ===
      const title = text('h1') ||
                    text('.short-title') ||
                    text('.full-title') ||
                    text('title')?.replace(' — FRENCH STREAM', '').trim() ||
                    null;

      // === POSTER ===
      const posterEl = get('.full-poster img, .movie-poster img, .poster img, .short-poster img, img[itemprop="image"]');
      const posterUrl = posterEl?.src || posterEl?.getAttribute('data-src') || null;

      // === DESCRIPTION ===
      const desc = text('.full-text, .description, .short-story, [itemprop="description"], .film-description') ||
                   text('.full-content p') || null;

      // === MÉTADONNÉES ===
      // On cherche dans les listes de détails (.full-info, .movie-info, .film-info, etc.)
      const infoBlock = get('.full-info, .movie-info, .film-info, .details, .short-info') ||
                        document.body;

      const allText = infoBlock.innerText || '';

      const yearMatch = allText.match(/(\d{4})/);
      const year = yearMatch ? yearMatch[1] : null;

      const durationMatch = allText.match(/(\d+h\s?\d*\s?min|\d+\s?min|\d+h)/i);
      const duration = durationMatch ? durationMatch[1] : null;

      // === GENRES ===
      const genreEls = getAll('a[href*="xfsearch/genre"], a[href*="genre"]');
      const genres = genreEls.map(el => el.textContent.trim()).filter(Boolean);

      // === RÉALISATEUR & ACTEURS ===
      const directorEls = getAll('a[href*="xfsearch/realisateur"], a[href*="director"]');
      const director = directorEls[0]?.textContent?.trim() || null;

      const actorEls = getAll('a[href*="xfsearch/acteur"], a[href*="actor"]');
      const actors = actorEls.slice(0, 6).map(el => el.textContent.trim()).filter(Boolean);

      // === LANGUE & QUALITÉ ===
      const langEl = get('.film-lang, .lang, .badge-lang, [class*="lang"]');
      const language = langEl?.textContent?.trim() || null;

      const qualityEl = get('.film-type, .quality, .badge-type, [class*="type"], [class*="quality"]');
      const quality = qualityEl?.textContent?.trim() || null;

      // === NOTE ===
      const ratingEl = get('.vote-result, .rating, .score, [itemprop="ratingValue"]');
      const rating = ratingEl?.textContent?.trim() || null;

      // === PLAYERS (liens vidéo encodés base64) ===
      // Format sur fs17.lol : <a href="/link/BASE64_CODE">
      const playerLinks = getAll('a[href*="/link/"]');
      const players = playerLinks.map((el, i) => ({
        label: `Serveur ${i + 1}`,
        linkPath: el.getAttribute('href'),
      }));

      // === IFRAMES directs (si présents) ===
      const iframes = getAll('iframe[src]');
      const iframeSources = iframes.map((el, i) => ({
        label: `Lecteur ${i + 1}`,
        src: el.getAttribute('src'),
      }));

      return {
        title, posterUrl, desc, year, duration,
        genres, director, actors, language, quality, rating,
        players, iframeSources,
      };
    }, BASE_URL);

    // Nettoyer et formater
    return {
      id: extractIdFromUrl(filmUrl),
      title: cleanText(data.title),
      posterUrl: data.posterUrl ? toAbsoluteUrl(data.posterUrl) : null,
      description: cleanText(data.desc),
      year: data.year,
      duration: formatDuration(data.duration),
      genres: data.genres,
      director: data.director,
      actors: data.actors,
      language: data.language,
      quality: data.quality,
      rating: formatRating(data.rating),
      pageUrl: filmUrl,
      players: data.players.map(p => ({
        ...p,
        fullPath: p.linkPath ? BASE_URL + p.linkPath : null,
      })),
      iframeSources: data.iframeSources,
      source: 'fs17.lol',
    };

  } catch (err) {
    console.error(`❌ Erreur détail ${filmUrl}:`, err.message);
    return null;
  } finally {
    await browserManager.closePage(page);
  }
}

module.exports = { scrapeFilmDetail };
