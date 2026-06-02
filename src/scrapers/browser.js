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
        await this.browser.pages();
        return this.browser;
      } catch {
        this.browser = null;
      }
    }

    if (this.launching) {
      await new Promise(r => setTimeout(r, 2000));
      return this.getBrowser();
    }

    this.launching = true;

    try {
      console.log('🚀 Lancement de Puppeteer...');

      const isProduction = process.env.NODE_ENV === 'production';

      // En production, trouver Chrome installé par puppeteer
      let executablePath;
      if (isProduction) {
        const { executablePath: ep } = require('puppeteer');
        executablePath = await ep();
        console.log('🔎 Chrome path:', executablePath);
      } else {
        const paths = [
          'C:\\Users\\apatcha\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ];
        executablePath = paths.find(p => require('fs').existsSync(p));
        if (!executablePath) throw new Error('Chrome non trouvé');
      }

      this.browser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-blink-features=AutomationControlled',
          '--lang=fr-FR',
        ],
        ignoreHTTPSErrors: true,
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
