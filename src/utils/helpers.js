const { BASE_URL } = require('../config');

// Délai aléatoire pour imiter un humain
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min = 800, max = 2500) =>
  sleep(Math.floor(Math.random() * (max - min + 1)) + min);

// Nettoie un texte brut
const cleanText = (text) => {
  if (!text) return null;
  return text.replace(/\s+/g, ' ').replace(/[\r\n\t]/g, '').trim();
};

// Extrait l'ID numérique depuis une URL de film
// ex: /16550-pacific-rim-uprising.html  →  "16550"
// ex: https://fs15.lol/16550-pacific-rim.html  →  "16550"
const extractIdFromUrl = (url) => {
  if (!url) return null;
  const match = url.match(/\/(\d+)-/);
  return match ? match[1] : null;
};

// Transforme un chemin relatif en URL absolue
const toAbsoluteUrl = (src) => {
  if (!src) return null;
  if (src.startsWith('http')) return src;
  if (src.startsWith('//')) return 'https:' + src;
  return BASE_URL + (src.startsWith('/') ? '' : '/') + src;
};

// Formate la durée
// "1h52" ou "112 min" ou "1 h 52 min" → "1h 52min"
const formatDuration = (text) => {
  if (!text) return null;
  const clean = text.replace(/\s/g, '').toLowerCase();
  const match1 = clean.match(/(\d+)h(\d+)/);
  if (match1) return `${match1[1]}h ${match1[2]}min`;
  const match2 = clean.match(/(\d+)min/);
  if (match2) {
    const totalMin = parseInt(match2[1]);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }
  return cleanText(text);
};

// Extrait la note numérique
// "Note: 7.8/10" ou "8.4" → 8.4
const formatRating = (text) => {
  if (!text) return null;
  const match = text.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
};

// Encode une URL pour usage comme paramètre query
const encodeUrl = (url) => encodeURIComponent(url);
const decodeUrl = (url) => decodeURIComponent(url);

// Valide qu'une chaîne est une URL valide
const isValidUrl = (str) => {
  try { new URL(str); return true; }
  catch { return false; }
};

// Pagine un tableau
const paginate = (array, page = 1, limit = 20) => {
  const start = (page - 1) * limit;
  return {
    data: array.slice(start, start + limit),
    page,
    limit,
    total: array.length,
    totalPages: Math.ceil(array.length / limit),
    hasNext: start + limit < array.length,
    hasPrev: page > 1,
  };
};

module.exports = {
  sleep, randomDelay, cleanText,
  extractIdFromUrl, toAbsoluteUrl,
  formatDuration, formatRating,
  encodeUrl, decodeUrl, isValidUrl, paginate
};
