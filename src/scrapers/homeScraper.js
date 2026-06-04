const browserManager = require('./browser');
const { BASE_URL } = require('../config');
const { cleanText, toAbsoluteUrl, randomDelay } = require('../utils/helpers');

async function scrapePage(url) {
  const page = await browserManager.newPage(false);
  const films = [];

  try {
    console.log(`🔍 Scraping: ${url}`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Attendre que les films apparaissent
    try {
      await page.waitForSelector('.short-item', { timeout: 15000 });
      console.log('✅ .short-item trouvé !');
    } catch {
      console.log('⚠️ .short-item pas trouvé, on essaie quand même');
    }

    // Attendre encore un peu
    await randomDelay(3000, 5000);

    // Screenshot pour voir ce que Puppeteer voit réellement
    const screenshot = await page.screenshot({ encoding: 'base64' });
    console.log('📸 Screenshot pris, longueur:', screenshot.length);

    const extracted = await page.evaluate(() => {
      const items = document.querySelectorAll('.short-item');
      console.log('Items trouvés:', items.length);
      
      const results = [];
      items.forEach(item => {
        const link = item.querySelector('a[href]');
        const img = item.querySelector('img');
        const title = item.querySelector('.short-title, h2, h3, .title');
        const quality = item.querySelector('.short-type, .quality, .badge');

        results.push({
          href: link?.getAttribute('href') || '',
          title: title?.textContent?.trim() || img?.getAttribute('alt')?.replace(' affiche','').trim() || '',
          poster: img?.src || img?.getAttribute('data-src') || '',
          quality: quality?.textContent?.trim() || '',
          html: item.innerHTML.substring(0, 200),
        });
      });

      // Si pas de .short-item, retourne le body text pour debug
      if (results.length === 0) {
        return { 
          results: [],
          debug: document.body.innerHTML.substring(0, 2000),
          itemCount: items.length,
        };
      }

      return { results, debug: null, itemCount: items.length };
    });

    console.log(`📊 Items trouvés: ${extracted.itemCount}`);
    if (extracted.debug) {
      console.log('🔍 DEBUG HTML:', extracted.debug.substring(0, 500));
    }

    for (const item of extracted.results || []) {
      if (!item.href) continue;
      films.push({
        id: item.href.replace(/[^a-z0-9]/gi, '-').substring(0, 50),
        title: cleanText(item.title) || 'Film inconnu',
        posterUrl: item.poster || null,
        quality: item.quality || null,
        pageUrl: item.href.startsWith('http') ? item.href : BASE_URL + item.href,
        source: 'fs17.lol',
      });
    }

    console.log(`✅ ${films.length} films valides`);
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
