const axios = require('axios');
const { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_URL } = require('../config');

const tmdb = axios.create({
  baseURL: TMDB_BASE_URL,
  params: { api_key: TMDB_API_KEY, language: 'fr-FR' },
  timeout: 10000,
});

// Trending films
async function getTrending() {
  const res = await tmdb.get('/trending/movie/week');
  return res.data.results.map(mapMovie);
}

// Films récents
async function getNowPlaying() {
  const res = await tmdb.get('/movie/now_playing');
  return res.data.results.map(mapMovie);
}

// Films populaires
async function getPopular() {
  const res = await tmdb.get('/movie/popular');
  return res.data.results.map(mapMovie);
}

// Films les mieux notés
async function getTopRated() {
  const res = await tmdb.get('/movie/top_rated');
  return res.data.results.map(mapMovie);
}

// Films à venir
async function getUpcoming() {
  const res = await tmdb.get('/movie/upcoming');
  return res.data.results.map(mapMovie);
}

// Par genre
async function getByGenre(genreId, page = 1) {
  const res = await tmdb.get('/discover/movie', {
    params: {
      with_genres: genreId,
      sort_by: 'popularity.desc',
      page,
    }
  });
  return res.data.results.map(mapMovie);
}

// Films français
async function getFrenchMovies(page = 1) {
  const res = await tmdb.get('/discover/movie', {
    params: {
      with_original_language: 'fr',
      sort_by: 'popularity.desc',
      page,
    }
  });
  return res.data.results.map(mapMovie);
}

// Films indiens (Bollywood)
async function getBollywoodMovies(page = 1) {
  const res = await tmdb.get('/discover/movie', {
    params: {
      with_original_language: 'hi',
      sort_by: 'popularity.desc',
      page,
    }
  });
  return res.data.results.map(mapMovie);
}

// Recherche
async function searchMovies(query, page = 1) {
  const res = await tmdb.get('/search/movie', {
    params: { query, page }
  });
  return res.data.results.map(mapMovie);
}

// Détail film
async function getMovieDetail(tmdbId) {
  const res = await tmdb.get(`/movie/${tmdbId}`, {
    params: { append_to_response: 'credits' }
  });
  return mapMovieDetail(res.data);
}

// Genres liste
async function getGenres() {
  const res = await tmdb.get('/genre/movie/list');
  return res.data.genres;
}

// IDs des genres principaux
const GENRE_IDS = {
  action: 28,
  aventure: 12,
  animation: 16,
  comedie: 35,
  drame: 18,
  horreur: 27,
  thriller: 53,
  romance: 10749,
  'science-fiction': 878,
  historique: 36,
  policier: 80,
  famille: 10751,
  fantastique: 14,
  guerre: 10752,
  western: 37,
  documentaire: 99,
};

// Mapper film simple
function mapMovie(movie) {
  return {
    id: movie.id.toString(),
    tmdbId: movie.id,
    title: movie.title || movie.original_title,
    originalTitle: movie.original_title,
    posterUrl: movie.poster_path 
      ? `${TMDB_IMAGE_URL}${movie.poster_path}`
      : null,
    backdropUrl: movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
      : null,
    description: movie.overview || '',
    rating: movie.vote_average || 0,
    year: movie.release_date?.substring(0, 4) || '',
    genres: [],
    language: movie.original_language,
    popularity: movie.popularity,
    source: 'tmdb',
  };
}

// Mapper film détaillé
function mapMovieDetail(movie) {
  return {
    id: movie.id.toString(),
    tmdbId: movie.id,
    title: movie.title,
    originalTitle: movie.original_title,
    posterUrl: movie.poster_path
      ? `${TMDB_IMAGE_URL}${movie.poster_path}`
      : null,
    backdropUrl: movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
      : null,
    description: movie.overview || '',
    rating: movie.vote_average || 0,
    year: movie.release_date?.substring(0, 4) || '',
    duration: movie.runtime ? `${Math.floor(movie.runtime/60)}h ${movie.runtime%60}min` : '',
    genres: movie.genres?.map(g => g.name) || [],
    director: movie.credits?.crew?.find(c => c.job === 'Director')?.name || '',
    actors: movie.credits?.cast?.slice(0, 6).map(a => a.name) || [],
    language: movie.original_language,
    quality: 'HD',
    source: 'tmdb',
  };
}

module.exports = {
  getTrending, getNowPlaying, getPopular,
  getTopRated, getUpcoming, getByGenre,
  getFrenchMovies, getBollywoodMovies,
  searchMovies, getMovieDetail, getGenres,
  GENRE_IDS,
};
