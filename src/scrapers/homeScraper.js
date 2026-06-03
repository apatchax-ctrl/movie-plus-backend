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
    
    const extracted = await page.evaluate(() => {
      const results = [];
      const seen = new Set();

      // Sur fs17.lol les films sont dans des divs.short-item
      // avec des liens /ANNEE/TITRE/ ou /ID-TITRE.html
      const items = document.querySelectorAll(
        '.short-item, .movie-item, .th-item, .item-films, article.item'
      );

      items.forEach(item => {
        const link = item.querySelector('a[href]');
        const img = item.querySelector('img');
        const titleEl = item.querySelector(
          '.short-title, .title, h2, h3, .movie-title, .name'
        );
        const qualityEl = item.querySelector(
          '.short-type, .quality, .badge, .label'
        );

        const href = link?.getAttribute('href') || '';
        if (!href || seen.has(href)) return;
        seen.add(href);

        results.push({
          href,
          title: titleEl?.textContent?.trim() ||
                 link?.getAttribute('title') || '',
          poster: img?.getAttribute('data-src') ||
                  img?.getAttribute('data-original') ||
                  img?.src || '',
          quality: qualityEl?.textContent?.trim() || '',
        });
      });

      // Fallback : cherche tous les liens avec pattern /films/
      if (results.length === 0) {
        document.querySelectorAll('a[href]').forEach(link => {
          const href = link.getAttribute('href') || '';
          // Pattern URLs films fs17.lol : /titre-film-ANNEE/ ou contient des chiffres
          if (!href.match(/\/[a-z0-9-]+-(?:19|20)\d{2}\/?$/) &&
              !href.match(/\/\d{4,}-/)) return;
          if (seen.has(href)) return;
          seen.add(href);

          const img = link.querySelector('img') ||
                      link.closest('div, article')?.querySelector('img');
          results.push({
            href,
            title: link.getAttribute('title') ||
                   link.textContent?.trim() || '',
            poster: img?.getAttribute('data-src') || img?.src || '',
            quality: '',
          });
        });
      }

      return results;
    });

    // Filtrer les résultats valides
    for (const film of extracted) {
      const href = film.href || '';
      const pageUrl = href.startsWith('http') ? href : BASE_URL + href;
      const id = extractIdFromUrl(href) || null;
      if (id && pageUrl) {
        films.push({
          id,
          title: cleanText(film.title) || `Film #${id}`,
          posterUrl: film.poster ? toAbsoluteUrl(film.poster) : null,
          quality: cleanText(film.quality),
          pageUrl,
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
async function scrapeHome(maxPages = 2) {
  const allFilms = [];
  const seen = new Set();
  const { BASE_URL, URLS } = require('../config');

  for (let i = 1; i <= maxPages; i++) {
    const url = i === 1
      ? BASE_URL + URLS.home
      : BASE_URL + URLS.homePage + i + '/';
    
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
