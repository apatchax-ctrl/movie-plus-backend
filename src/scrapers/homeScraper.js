const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, HEADERS } = require('../config');
const { cleanText, toAbsoluteUrl, randomDelay } = require('../utils/helpers');

async function scrapePage(url) {
  try {
    console.log(`🔍 Scraping avec axios: ${url}`);
    await randomDelay(500, 1500);

    const response = await axios.get(url, {
      headers: {
        ...HEADERS,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    const films = [];
    const seen = new Set();

    console.log(`📄 HTML reçu: ${response.data.length} caractères`);

    // Cherche tous les liens films
    // Sur fs17.lol les films ont des URLs comme /titre-film-2024/
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href') || '';
      
      // Pattern URL film : /mot-mot-ANNEE/ ou /mot-mot-ANNEE.html
      if (!href.match(/\/[a-z0-9][a-z0-9-]+-(?:19|20)\d{2}\/?(?:\.html)?$/i)) return;
      if (seen.has(href)) return;
      seen.add(href);

      // Cherche l'image
      const img = $(el).find('img').first();
      const imgSrc = img.attr('data-src') || img.attr('data-original') || img.attr('src') || '';

      // Cherche le titre
      const titleEl = $(el).find('.short-title, .title, h2, h3').first();
      const title = titleEl.text().trim() || 
                    $(el).attr('title') || 
                    $(el).text().trim() || '';

      // Cherche la qualité
      const quality = $(el).find('.short-type, .quality, .badge, .label').text().trim();

      // Extrait l'année depuis l'URL
      const yearMatch = href.match(/-((?:19|20)\d{2})\/?(?:\.html)?$/);
      const year = yearMatch ? yearMatch[1] : null;

      // Génère un ID depuis l'URL
      const id = href.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').substring(0, 50);

      if (title.length > 1) {
        films.push({
          id,
          title: cleanText(title),
          posterUrl: imgSrc ? toAbsoluteUrl(imgSrc) : null,
          quality: cleanText(quality) || null,
          year,
          pageUrl: href.startsWith('http') ? href : BASE_URL + href,
          source: 'fs17.lol',
        });
      }
    });

    console.log(`✅ ${films.length} films trouvés sur ${url}`);
    return films;

  } catch (err) {
    console.error(`❌ Erreur axios ${url}:`, err.message);
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
