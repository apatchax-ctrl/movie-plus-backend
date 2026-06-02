const NodeCache = require('node-cache');

// Instance unique du cache (max 1000 entrées)
const cache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 600,
  maxKeys: 1000,
  useClones: false,
});

// Middleware Express : met en cache les réponses GET
function cacheMiddleware(ttlSeconds) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();

    const key = 'route_' + req.originalUrl;
    const cached = cache.get(key);

    if (cached) {
      console.log(`📦 Cache HIT: ${req.originalUrl}`);
      return res.json(cached);
    }

    // Intercepte res.json pour sauvegarder la réponse
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200 && data?.success) {
        cache.set(key, data, ttlSeconds);
        console.log(`💾 Cache SET: ${req.originalUrl} (TTL: ${ttlSeconds}s)`);
      }
      return originalJson(data);
    };

    next();
  };
}

const setCache  = (key, data, ttl) => cache.set(key, data, ttl);
const getCache  = (key) => cache.get(key);
const delCache  = (key) => cache.del(key);
const flushAll  = () => cache.flushAll();
const getStats  = () => cache.getStats();
const getKeys   = () => cache.keys();

module.exports = {
  cacheMiddleware, setCache, getCache,
  delCache, flushAll, getStats, getKeys
};
