module.exports = {
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL || 'https://fs17.lol',
  NODE_ENV: process.env.NODE_ENV || 'development',

  CACHE: {
    HOME:   parseInt(process.env.CACHE_TTL_HOME)   || 1800,
    LIST:   parseInt(process.env.CACHE_TTL_LIST)   || 3600,
    DETAIL: parseInt(process.env.CACHE_TTL_DETAIL) || 86400,
    SEARCH: parseInt(process.env.CACHE_TTL_SEARCH) || 900,
    VIDEO:  parseInt(process.env.CACHE_TTL_VIDEO)  || 1800,
  },

  // URLs exactes de fs17.lol découvertes par analyse du site
  URLS: {
    home:           '/',
    homePage2:      '/index.php?cstart=',       // + numéro page ex: cstart=2
    allFilms:       '/index.php?category=films&do=cat',
    allFilmsPage:   '/index.php?category=films&do=cat&cstart=', // + numéro
    frenchFilms:    '/xfsearch/pays/Fran%C3%A7ais/',
    frenchFilmsPage:'/xfsearch/pays/Fran%C3%A7ais/',           // + page/2/
    genreBase:      '/xfsearch/genre/',         // + NomGenre/
    genrePage:      '/xfsearch/genre/',         // + NomGenre/page/2/
    search:         '/?do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=',
    filmBase:       '/',                         // + ID-titre.html  ex: /16550-pacific-rim.html
    linkDecoder:    '/link/',                    // + code_base64
  },

  // Genres disponibles sur fs17.lol
  GENRES: [
    'Action', 'Aventure', 'Animation', 'Biopic', 'Comédie',
    'Drame', 'Documentaire', 'Famille', 'Fantastique', 'Thriller',
    'Romance', 'Science-Fiction', 'Historique', 'Policier', 'Horreur', 'Western'
  ],

  // Headers pour imiter Chrome réel
  HEADERS: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Referer': 'https://fs17.lol/',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  }
};
