const browserManager = require('./browser');
const { BASE_URL, URLS, GENRES } = require('../config');
const { cleanText, toAbsoluteUrl, randomDelay } = require('../utils/helpers');
const { scrapePage } = require('./homeScraper');

// Scrape une liste de films depuis n'importe quelle URL de liste
async function scrapeList(url, maxPages = 1) {
  const allFilms = [];
  const seen = new Set();

  for (let p = 1; p <= maxPages; p++) {
    let pageUrl = url;
    
    // Gestion pagination : fs17.lol utilise deux systèmes
    if (p > 1) {
      if (url.includes('cstart=')) {
        pageUrl = url.replace(/cstart=\d*/, `cstart=${(p-1)*20}`);
      } else if (url.includes('xfsearch')) {
        // /xfsearch/pays/Français/page/2/
        pageUrl = url.replace(/\/?$/, `/page/${p}/`);
      } else {
        pageUrl = url + `&cstart=${(p-1)*20}`;
      }
    }

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

// Films français spécifiquement
async function scrapeFrenchFilms(maxPages = 3) {
  const { BASE_URL, URLS } = require('../config');
  const allFilms = [];
  const seen = new Set();

  for (let i = 1; i <= maxPages; i++) {
    const url = i === 1
      ? BASE_URL + URLS.frenchFilms
      : BASE_URL + URLS.frenchPage + i + '/';
    
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
  return allFilms;
}

// Films par genre
async function scrapeByGenre(genre, maxPages = 2) {
  const { BASE_URL, GENRES_URLS } = require('../config');
  const genreUrl = GENRES_URLS[genre.toLowerCase()];
  if (!genreUrl) return [];
  
  const allFilms = [];
  const seen = new Set();

  for (let i = 1; i <= maxPages; i++) {
    const url = i === 1
      ? BASE_URL + genreUrl
      : BASE_URL + genreUrl + 'page/' + i + '/';
    
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
  return allFilms;
}

// Tous les films (page principale de la catégorie)
async function scrapeAllFilms(page = 1) {
  const url = page === 1
    ? BASE_URL + URLS.allFilms
    : `${BASE_URL}${URLS.allFilmsPage}${(page-1)*20}`;
  console.log(`📋 Scraping tous les films, page ${page}...`);
  const films = await scrapePage(url);
  return {
    films,
    page,
    hasNext: films.length >= 18,
  };
}

// Films récents (premiers résultats de la liste principale)
async function scrapeRecent(limit = 20) {
  const films = await scrapeList(BASE_URL + URLS.allFilms, 1);
  return films.slice(0, limit);
}

module.exports = {
  scrapeList, scrapeFrenchFilms,
  scrapeByGenre, scrapeAllFilms, scrapeRecent
};
