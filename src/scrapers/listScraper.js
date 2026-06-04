const { BASE_URL } = require('../config');
const { randomDelay } = require('../utils/helpers');
const { scrapePage } = require('./homeScraper');

// Liste générique depuis n'importe quelle URL
async function scrapeList(url, maxPages = 1) {
  const allFilms = [];
  const seen = new Set();

  for (let p = 1; p <= maxPages; p++) {
    const pageUrl = p === 1 ? url : url + 'page/' + p + '/';
    const films = await scrapePage(pageUrl);
    if (films.length === 0) break;
    for (const film of films) {
      if (!seen.has(film.id)) {
        seen.add(film.id);
        allFilms.push(film);
      }
    }
    await randomDelay(1000, 2000);
  }
  return allFilms;
}

// Films français
async function scrapeFrenchFilms(maxPages = 3) {
  console.log('🇫🇷 Scraping films français...');
  return await scrapeList(BASE_URL + '/xfsearch/lang/Fran%C3%A7ais/', maxPages);
}

// Par genre
async function scrapeByGenre(genre, maxPages = 2) {
  const GENRES_URLS = {
    action:           '/films/actions/',
    aventure:         '/films/aventures/',
    animation:        '/films/animations/',
    comedie:          '/films/comedies/',
    drame:            '/films/drames/',
    horreur:          '/films/epouvante-horreurs/',
    historique:       '/films/historiques/',
    famille:          '/films/familles/',
    fantastique:      '/films/fantastiques/',
    policier:         '/films/policiers/',
    romance:          '/films/romances/',
    thriller:         '/films/thrillers/',
    'science-fiction':'/films/science-fictions/',
    western:          '/films/westerns/',
    guerre:           '/films/guerres/',
    espionnage:       '/films/espionnages/',
  };

  const genreUrl = GENRES_URLS[genre.toLowerCase()];
  if (!genreUrl) return [];
  console.log(`🎬 Scraping genre: ${genre}`);
  return await scrapeList(BASE_URL + genreUrl, maxPages);
}

// Films récents
async function scrapeRecent(limit = 20) {
  const films = await scrapeList(BASE_URL + '/films/', 1);
  return films.slice(0, limit);
}

// Tous les films avec pagination
async function scrapeAllFilms(page = 1) {
  const url = page === 1
    ? BASE_URL + '/films/'
    : BASE_URL + '/films/page/' + page + '/';
  const films = await scrapePage(url);
  return { films, page, hasNext: films.length >= 18 };
}

module.exports = {
  scrapeList, scrapeFrenchFilms,
  scrapeByGenre, scrapeAllFilms, scrapeRecent
};
