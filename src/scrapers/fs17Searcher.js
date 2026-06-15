const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://fs15.lol';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Referer': 'https://fs15.lol/',
};

async function searchOnFs17(title, year) {
  try {
    console.log(`🔍 Recherche fs17: ${title} ${year || ''}`);
    
    const query = encodeURIComponent(title);
    const url = `${BASE_URL}/?do=search&subaction=search&story=${query}`;
    
    const res = await axios.get(url, { 
      headers: HEADERS, 
      timeout: 15000 
    });
    
    const $ = cheerio.load(res.data);
    const results = [];

    // Cherche les résultats de recherche
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      
      // Pattern URL film fs17.lol
      if (!href.match(/newsid=\d+/)) return;
      
      const idMatch = href.match(/newsid=(\d+)/);
      if (!idMatch) return;

      results.push({
        id: idMatch[1],
        title: text || `Film #${idMatch[1]}`,
        pageUrl: href.startsWith('http') ? href : BASE_URL + href,
      });
    });

    console.log(`✅ ${results.length} résultats trouvés pour "${title}"`);

    // Retourne le premier résultat
    if (results.length > 0) {
      return results[0].pageUrl;
    }
    
    return null;
  } catch (e) {
    console.error('❌ Erreur recherche fs17:', e.message);
    return null;
  }
}

module.exports = { searchOnFs17 };
