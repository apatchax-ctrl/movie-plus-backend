const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, HEADERS } = require('../config');
const { cleanText, toAbsoluteUrl, randomDelay } = require('../utils/helpers');

async function scrapePage(url) {
  try {
    console.log(`🔍 Scraping: ${url}`);
    await randomDelay(500, 1500);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://fs17.lol/',
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    const films = [];
    const seen = new Set();

    console.log(`📄 HTML: ${response.data.length} chars`);

    // Les films sont dans .short-item avec .short-poster img-box with-mask
    // Structure : .short-item > a[href] > .short-poster > img
    $('.short-item').each((i, el) => {
      const link = $(el).find('a[href]').first();
      const img = $(el).find('.short-poster img, img').first();
      const titleEl = $(el).find('.short-title, h2, h3, .title').first();
      const qualityEl = $(el).find('.short-type, .quality, .badge').first();

      const href = link.attr('href') || '';
      if (!href || seen.has(href)) return;
      seen.add(href);

      const posterUrl = img.attr('src') || 
                        img.attr('data-src') || 
                        img.attr('data-original') || '';
      
      // Titre depuis .short-title ou alt de l'image
      const title = titleEl.text().trim() || 
                    img.attr('alt')?.replace(' affiche', '')?.trim() || 
                    link.attr('title') || '';

      const yearMatch = href.match(/-((?:19|20)\d{2})\/?$/);
      const year = yearMatch ? yearMatch[1] : null;

      // ID depuis l'URL
      const id = href.replace(/^\//, '').replace(/\/$/, '').replace(/[^a-z0-9]/gi, '-');

      if (title.length > 0 && href.length > 1) {
        films.push({
          id,
          title: cleanText(title),
          posterUrl: posterUrl || null,
          quality: qualityEl.text().trim() || null,
          year,
          pageUrl: href.startsWith('http') ? href : BASE_URL + href,
          source: 'fs17.lol',
        });
      }
    });

    console.log(`✅ ${films.length} films trouvés`);
    return films;

  } catch (err) {
    console.error(`❌ Erreur:`, err.message);
    return [];
  }
}

async function scrapeHome(maxPages = 2) {
  const allFilms = [];
  const seen = new Set();

  for (let i = 1; i <= maxPages; i++) {
    const url = i === 1
      ? BASE_URL + '/films/'
      : BASE_URL + '/films/page/' + i + '/';
    
    const films = await scrapePage(url);
    for (const film of films) {
      if (!seen.has(film.id)) {
        seen.add(film.id);
        allFilms.push(film);
      }
    }
    if (films.length === 0) break;
    await randomDelay(1000, 2000);
  }

  return {
    films: allFilms,
    trending: allFilms.slice(0, 10),
    recent: allFilms.slice(0, 20),
    total: allFilms.length,
  };
}

module.exports = { scrapeHome, scrapePage };
