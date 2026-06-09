require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { PORT, NODE_ENV } = require('./config');
const browserManager = require('./scrapers/browser');

const app = express();

// ─── MIDDLEWARES ────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'DELETE'] }));
app.use(compression());
app.use(express.json());
if (NODE_ENV !== 'test') app.use(morgan('dev'));

// ─── RATE LIMITING ─────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  message: { success: false, error: 'Trop de requêtes. Réessaie dans 15 minutes.' }
});
app.use('/api/', limiter);

// ─── ROUTES ─────────────────────────────────────────────
app.use('/api', require('./routes/films'));
app.use('/api', require('./routes/search'));

// ─── HEALTH CHECK ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    env: NODE_ENV,
  });
});

// ─── PAGE D'ACCUEIL ──────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'Movie Plus API',
    version: '1.0.0',
    source: 'fs17.lol',
    endpoints: [
      'GET /health',
      'GET /api/films/home',
      'GET /api/films/recent',
      'GET /api/films/all?page=1',
      'GET /api/films/french',
      'GET /api/films/genres',
      'GET /api/films/genre/:genre',
      'GET /api/films/detail?url=URL',
      'GET /api/films/video?url=URL',
      'GET /api/search?q=query',
      'GET /api/search/suggestions?q=query',
      'GET /api/films/cache/stats',
    ],
  });
});

// ─── 404 ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route '${req.originalUrl}' introuvable` });
});

// ─── ERREUR GLOBALE ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('💥 Erreur:', err.stack);
  res.status(500).json({ success: false, error: 'Erreur serveur interne' });
});

// ─── DÉMARRAGE ───────────────────────────────────────────
async function start() {
  try {
    // Installer Chrome si on est en production et qu'il n'existe pas
    if (process.env.NODE_ENV === 'production') {
      const chromePath = '/opt/render/project/src/node_modules/puppeteer/.local-chromium';
      const { execSync } = require('child_process');
      console.log('📦 Installation de Chrome...');
      try {
        execSync('npx puppeteer browsers install chrome', { 
          stdio: 'inherit',
          cwd: '/opt/render/project/src'
        });
        console.log('✅ Chrome installé');
      } catch (e) {
        console.log('⚠️ Installation Chrome:', e.message);
      }
    }

    await browserManager.getBrowser();
    console.log('✅ Browser initialisé');

    // Vider le cache Render temporairement au démarrage
    const { flushAll } = require('./middleware/cache');
    try {
      flushAll();
      console.log('🗑️ Cache vidé au démarrage');
    } catch (e) {
      console.warn('⚠️ Impossible de vider le cache au démarrage:', e.message);
    }

    app.listen(PORT, () => {
      console.log(`🎬 Movie Plus API démarré → http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('❌ Erreur démarrage:', err);
    process.exit(1);
  }
}

// Fermeture propre
async function shutdown() {
  console.log('\n🛑 Arrêt en cours...');
  await browserManager.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  console.error('💥 Exception non capturée:', err);
});

start();
