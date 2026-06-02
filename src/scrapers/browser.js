const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { HEADERS } = require('../config');
const { randomDelay } = require('../utils/helpers');

puppeteer.use(StealthPlugin());

class BrowserManager {
  constructor() {
    this.browser = null;
    this.launching = false;
  }

  async getBrowser() {
    if (this.browser) {
      try {
        const pages = await this.browser.pages();
        if (pages !== null) return this.browser;
      } catch {
        this.browser = null;
      }
    }
    if (this.launching) {
      // Attendre que le lancement en cours se termine
      await new Promise(r => setTimeout(r, 2000));
      return this.getBrowser();
    }
    this.launching = true;
    try {
      console.log('🚀 Lancement de Puppeteer...');
      const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Users\\apatcha\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
      ];

      // Vérifier et logger chaque chemin testé
      let executablePath = null;
      for (const p of chromePaths) {
        const exists = fs.existsSync(p);
        console.log(`🔎 Test chemin Chrome: ${p} -> ${exists}`);
        if (!executablePath && exists) executablePath = p;
      }

      if (!executablePath) {
        throw new Error('Chrome non trouvé, installe Google Chrome');
      }

      this.browser = await puppeteer.launch({
        executablePath,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1366,768',
          '--single-process',
          '--no-zygote',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-blink-features=AutomationControlled',
          '--lang=fr-FR',
        ],
        ignoreHTTPSErrors: true,
      });
      this.browser.on('disconnected', () => {
        console.log('⚠️ Browser déconnecté, réinitialisation...');
        this.browser = null;
      });
      console.log('✅ Puppeteer prêt');
      return this.browser;
    } finally {
      this.launching = false;
    }
  }

  async newPage(blockImages = true) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // Anti-détection avancée
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      window.chrome = { runtime: {} };
    });

    await page.setViewport({ width: 1366, height: 768 });
    await page.setExtraHTTPHeaders(HEADERS);

    // Bloquer images/fonts pour aller plus vite (sauf si blockImages=false)
    if (blockImages) {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'font', 'media'].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });
    }

    // Fermer les popups automatiquement
    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    return page;
  }

  async closePage(page) {
    try { await page.close(); } catch {}
  }

  async close() {
    try { if (this.browser) await this.browser.close(); } catch {}
    this.browser = null;
  }
}

// Instance singleton partagée
const browserManager = new BrowserManager();
module.exports = browserManager;
