module.exports = {
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL || 'https://fs15.lol',
  NODE_ENV: process.env.NODE_ENV || 'development',

  CACHE: {
    HOME:   parseInt(process.env.CACHE_TTL_HOME)   || 1800,
    LIST:   parseInt(process.env.CACHE_TTL_LIST)   || 3600,
    DETAIL: parseInt(process.env.CACHE_TTL_DETAIL) || 86400,
    SEARCH: parseInt(process.env.CACHE_TTL_SEARCH) || 900,
    VIDEO:  parseInt(process.env.CACHE_TTL_VIDEO)  || 1800,
  },

  // URLs exactes de fs15.lol découvertes par analyse du site
  URLS: {
    home:        '/films/',
    homePage:    '/films/page/',      // + numéro ex: /films/page/2/
    allFilms:    '/films/',
    frenchFilms: '/xfsearch/lang/Fran%C3%A7ais/',
    frenchPage:  '/xfsearch/lang/Fran%C3%A7ais/page/',
    genreBase:   '/films/',           // + genre ex: /films/actions/
    search:      '/?do=search&subaction=search&story=',
  },

  GENRES_URLS: {
    action:         '/films/actions/',
    aventure:       '/films/aventures/',
    animation:      '/films/animations/',
    comedie:        '/films/comedies/',
    drame:          '/films/drames/',
    horreur:        '/films/epouvante-horreurs/',
    historique:     '/films/historiques/',
    famille:        '/films/familles/',
    fantastique:    '/films/fantastiques/',
    policier:       '/films/policiers/',
    romance:        '/films/romances/',
    thriller:       '/films/thrillers/',
    'science-fiction': '/films/science-fictions/',
    western:        '/films/westerns/',
    guerre:         '/films/guerres/',
    espionnage:     '/films/espionnages/',
  },

  // Genres disponibles sur fs15.lol
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
    'Referer': 'https://fs15.lol/',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  }
  ,
  TMDB_API_KEY: process.env.TMDB_API_KEY,
  // Log TMDB key load status
  // (Permet de vérifier en runtime que la variable d'environnement est présente)
  // Ne pas logguer la clé elle-même pour des raisons de sécurité
  __log__: (function(){
    try{ console.log('TMDB KEY:', process.env.TMDB_API_KEY ? 'OK' : 'MANQUANTE'); }catch(e){}
    return true;
  })(),
  TMDB_BASE_URL: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
  TMDB_IMAGE_URL: process.env.TMDB_IMAGE_URL || 'https://image.tmdb.org/t/p/w500',
  MOVIX_BASE_URL: process.env.MOVIX_BASE_URL || 'https://movix.golf',
};
