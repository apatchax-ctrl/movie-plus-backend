const browserManager = require('./browser');
const { BASE_URL } = require('../config');
const { cleanText, randomDelay } = require('../utils/helpers');

async function scrapePage(url) {
  const page = await browserManager.newPage(false);
  const films = [];

  try {
    console.log(`🔍 Scraping: ${url}`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await randomDelay(3000, 5000);

    const extracted = await page.evaluate((baseUrl) => {
      const results = [];
      const seen = new Set();

      // Les films sont dans .short-in avec liens /index.php?newsid=ID
      const items = document.querySelectorAll('.short-in');
      
      items.forEach(item => {
        const link = item.querySelector('a[href*="newsid"]');
        const img = item.querySelector('img');
        const titleEl = item.querySelector('.short-title');

        const href = link?.getAttribute('href') || '';
        if (!href || seen.has(href)) return;
        seen.add(href);

        // Extrait l'ID depuis newsid=
        const idMatch = href.match(/newsid=(\d+)/);
        if (!idMatch) return;

        const title = titleEl?.textContent?.trim() ||
                      img?.getAttribute('alt')?.replace(' affiche', '').trim() || '';

        const posterUrl = img?.src || 
                          img?.getAttribute('data-src') || '';

        const qualityEl = item.querySelector('.short-type, .quality, .label, .badge');

        results.push({
          id: idMatch[1],
          title,
          posterUrl,
          quality: qualityEl?.textContent?.trim() || '',
          pageUrl: href.startsWith('http') ? href : baseUrl + href,
        });
      });

      return results;
    }, BASE_URL);

    console.log(`✅ ${extracted.length} films trouvés`);

    for (const item of extracted) {
      if (item.id && item.title) {
        films.push({
          id: item.id,
          title: cleanText(item.title),
          posterUrl: item.posterUrl || null,
          quality: item.quality || null,
          pageUrl: item.pageUrl,
          source: 'fs17.lol',
        });
      }
    }

    return films;

  } catch (err) {
    console.error(`❌ Erreur:`, err.message);
    return [];
  } finally {
    await browserManager.closePage(page);
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
