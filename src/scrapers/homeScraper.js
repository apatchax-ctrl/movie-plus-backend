const browserManager = require('./browser');
const { BASE_URL, URLS } = require('../config');
const { cleanText, extractIdFromUrl, toAbsoluteUrl, randomDelay } = require('../utils/helpers');

async function scrapePage(url) {
  const page = await browserManager.newPage(true);
  const films = [];
  
  try {
    console.log(`🔍 Scraping: ${url}`);
    await randomDelay(500, 1500);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await randomDelay(2000, 3000);

    // Debug : affiche le HTML pour voir la vraie structure
    const html = await page.content();
    console.log('📄 HTML longueur:', html.length);
    
    // Cherche TOUS les liens qui matchent le pattern film
    const extracted = await page.evaluate((baseUrl) => {
      const results = [];
      const seen = new Set();

      // fs17.lol : les films sont dans des divs avec class "short-item"
      // ou dans des liens directs /NNNNN-titre.html
      const selectors = [
        '.short-item',
        '.news-item',
        '.card',
        'article',
        '.item',
      ];

      const addFilmFromLink = (link) => {
        const href = link.getAttribute('href') || '';
        if (!/\/\d+-[a-z0-9\-]+\.html/i.test(href)) return;
        if (seen.has(href)) return;
        seen.add(href);

        const container = link.closest(selectors.join(',')) || link;
        const img = link.querySelector('img') || container.querySelector('img');
        const titleEl = link.querySelector('.short-title, .title, h2, h3, .name') ||
                        container.querySelector('.short-title, .title, h2, h3, .name');
        const badgeEl = link.querySelector('.short-type, .badge, .quality, .type') ||
                        container.querySelector('.short-type, .badge, .quality, .type');

        const fullUrl = href.startsWith('http') ? href : baseUrl + href;
        const idMatch = href.match(/\/(\d+)-/);

        results.push({
          id: idMatch ? idMatch[1] : null,
          title: titleEl?.textContent?.trim() || link.getAttribute('title') || link.textContent?.trim() || null,
          posterUrl: img ? (img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src')) : null,
          quality: badgeEl?.textContent?.trim() || null,
          pageUrl: fullUrl,
        });
      };

      selectors.forEach(selector => {
        const nodes = document.querySelectorAll(selector);
        nodes.forEach(node => {
          const link = node.querySelector('a[href]');
          if (link) addFilmFromLink(link);
        });
      });

      const links = Array.from(document.querySelectorAll('a[href]'));
      links.forEach(link => addFilmFromLink(link));

      return results;
    }, BASE_URL);

    // Filtrer les résultats valides
    for (const film of extracted) {
      if (film.id && film.pageUrl) {
        films.push({
          id: film.id,
          title: cleanText(film.title) || `Film #${film.id}`,
          posterUrl: film.posterUrl ? toAbsoluteUrl(film.posterUrl) : null,
          quality: cleanText(film.quality),
          pageUrl: film.pageUrl,
          source: 'fs17.lol',
        });
      }
    }

    console.log(`✅ ${films.length} films trouvés sur ${url}`);
    return films;

  } catch (err) {
    console.error(`❌ Erreur scraping ${url}:`, err.message);
    return [];
  } finally {
    await browserManager.closePage(page);
  }
}

// Scrape la page d'accueil (plusieurs pages pour avoir plus de films)
async function scrapeHome(maxPages = 3) {
  const allFilms = [];
  const seen = new Set();

  for (let i = 1; i <= maxPages; i++) {
    const url = i === 1
      ? BASE_URL + URLS.home
      : BASE_URL + URLS.homePage2 + i;
    
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
