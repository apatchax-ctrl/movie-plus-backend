const browserManager = require('./browser');
const { BASE_URL } = require('../config');
const { cleanText, toAbsoluteUrl, formatDuration, formatRating, randomDelay, extractIdFromUrl } = require('../utils/helpers');
const { getVideoUrl } = require('./playerScraper');

async function scrapeFilmDetail(filmUrl) {
  const page = await browserManager.newPage(false);
  
  try {
    console.log(`📄 Détail: ${filmUrl}`);
    await randomDelay(500, 1500);

    await page.goto(filmUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await randomDelay(2000, 3000);

    const data = await page.evaluate(() => {
      const get = (sel) => document.querySelector(sel);
      const getAll = (sel) => [...document.querySelectorAll(sel)];
      const text = (sel) => get(sel)?.textContent?.trim() || null;

      // Titre
      const title = text('h1.full-title, h1, .film-title, .full-title') ||
                    document.title.replace(' — FRENCH STREAM', '').trim();

      // Poster
      const posterEl = get('.full-poster img, .poster img, img[itemprop="image"]');
      const posterUrl = posterEl?.src || posterEl?.getAttribute('data-src') || null;

      // Description
      const desc = text('.full-text, .film-desc, .description, [itemprop="description"]');

      // Infos
      const allText = document.body.innerText;
      const yearMatch = allText.match(/(\d{4})/);
      const durationMatch = allText.match(/(\d+h\s?\d*\s?min|\d+\s?min|\d+h)/i);

      // Genres
      const genres = getAll('a[href*="/films/"], a[href*="genre"]')
        .map(a => a.textContent.trim())
        .filter(t => t.length > 2 && t.length < 20)
        .slice(0, 5);

      // Players — liens /index.php?newsid=X&player=Y
      const playerLinks = getAll('a[href*="player"], a[href*="lecteur"], .player-btn, .server-btn, a[data-player]');
      const players = playerLinks.map((el, i) => ({
        label: `Serveur ${i + 1}`,
        linkPath: el.getAttribute('href') || el.getAttribute('data-player') || '',
      }));

      // Iframes directs
      const iframes = getAll('iframe[src]');
      const iframeSources = iframes.map((el, i) => ({
        label: `Lecteur ${i + 1}`,
        src: el.getAttribute('src'),
      }));

      // Rating
      const ratingEl = get('.vote-result, .rating, .score');
      const rating = ratingEl?.textContent?.trim() || null;

      return {
        title, posterUrl, desc,
        year: yearMatch?.[1] || null,
        duration: durationMatch?.[1] || null,
        genres, players, iframeSources, rating,
      };
    });

    // Optionnel: tente d'extraire un lien vidéo directement en passant filmUrl
    const videoData = await getVideoUrl(data.players, data.iframeSources, filmUrl);

    return {
      id: filmUrl.match(/newsid=(\d+)/)?.[1] || '0',
      title: cleanText(data.title),
      posterUrl: data.posterUrl,
      description: cleanText(data.desc),
      year: data.year,
      duration: data.duration,
      genres: data.genres,
      rating: formatRating(data.rating),
      pageUrl: filmUrl,
      players: data.players,
      iframeSources: data.iframeSources,
      source: 'fs15.lol',
      video: videoData || null,
    };

  } catch (err) {
    console.error(`❌ Erreur détail:`, err.message);
    return null;
  } finally {
    await browserManager.closePage(page);
  }
}

module.exports = { scrapeFilmDetail };
