// backend/routes/terminology.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const ICD11Client = require('../utils/icd11-client');
const FHIRBuilder = require('../utils/fhir-builder');

const router = express.Router();
const icd11Client = new ICD11Client();
const fhirBuilder = new FHIRBuilder();

// Load NAMASTE sample data
let namasteData = [];
try {
  const dataPath = path.join(__dirname, '../data/namaste-sample.json');
  namasteData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`📚 Loaded ${namasteData.length} NAMASTE codes for terminology routes`);
} catch (error) {
  console.error('❌ Failed to load NAMASTE data:', error.message);
}

/**
 * GET /api/terminology/namaste
 * Query:
 *  - search: text filter across display/description/keywords/synonyms
 *  - category: filter by category
 *  - limit (default 50)
 *  - offset (default 0)
 */
router.get('/namaste', (req, res) => {
  try {
    const { search = '', category = '', limit = 50, offset = 0 } = req.query;

    let list = [...namasteData];

    // Search filter
    if (search && String(search).trim().length > 0) {
      const s = String(search).toLowerCase();
      list = list.filter(item => {
        const inDisplay = item.display?.toLowerCase().includes(s);
        const inDesc = item.description?.toLowerCase().includes(s);
        const inKeywords = (item.keywords || []).some(k => String(k).toLowerCase().includes(s));
        const inSyn = (item.synonyms || []).some(k => String(k).toLowerCase().includes(s));
        return inDisplay || inDesc || inKeywords || inSyn;
      });
    }

    // Category filter
    if (category && String(category).trim().length > 0) {
      const c = String(category).toLowerCase();
      list = list.filter(item => String(item.category || '').toLowerCase().includes(c));
    }

    const start = parseInt(offset, 10) || 0;
    const end = start + (parseInt(limit, 10) || 50);
    const results = list.slice(start, end);

    res.json({
      total: list.length,
      offset: start,
      limit: parseInt(limit, 10) || 50,
      results,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Search failed', message: e.message });
  }
});

/**
 * GET /api/terminology/namaste/:code
 * Return details for a specific NAMASTE code
 */
router.get('/namaste/:code', (req, res) => {
  try {
    const { code } = req.params;
    const item = namasteData.find(x => x.code === code);
    if (!item) {
      return res.status(404).json({ error: `NAMASTE code ${code} not found` });
    }
    res.json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lookup failed', message: e.message });
  }
});

/**
 * GET /api/terminology/icd11/search
 * Query:
 *  - q: query text
 *  - limit: max results
 */
router.get('/icd11/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q || String(q).trim().length === 0) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = await icd11Client.search(String(q), parseInt(limit, 10) || 10);
    res.json({
      query: q,
      total: results.length,
      results,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'ICD-11 search failed', message: e.message });
  }
});

/**
 * GET /api/terminology/categories
 * Return available categories with counts
 */
router.get('/categories', (req, res) => {
  try {
    const counts = new Map();
    namasteData.forEach(item => {
      const c = item.category || 'Uncategorized';
      counts.set(c, (counts.get(c) || 0) + 1);
    });

    const categories = Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category));

    res.json({ total: categories.length, categories });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

/**
 * POST /api/terminology/autocomplete
 * body: { query, systems?: ['namaste','icd11'], limit? }
 * Returns combined suggestions across NAMASTE and ICD-11
 */
router.post('/autocomplete', async (req, res) => {
  try {
    const { query = '', systems = ['namaste', 'icd11'], limit = 5 } = req.body || {};
    const q = String(query).trim();
    if (q.length < 2) {
      return res.json({
        suggestions: [],
        message: 'Query too short - minimum 2 characters required',
      });
    }

    const suggestions = [];

    // NAMASTE local search
    if (systems.includes('namaste')) {
      const local = namasteData
        .filter(item =>
          item.display?.toLowerCase().includes(q.toLowerCase()) ||
          item.description?.toLowerCase().includes(q.toLowerCase()) ||
          (item.keywords || []).some(k => String(k).toLowerCase().includes(q.toLowerCase()))
        )
        .slice(0, parseInt(limit, 10) || 5)
        .map(item => ({
          type: 'namaste',
          code: item.code,
          display: item.display,
          description: item.description,
          system: fhirBuilder.namasteSystem,
        }));
      suggestions.push(...local);
    }

    // ICD-11 external search
    if (systems.includes('icd11')) {
      try {
        const external = await icd11Client.search(q, parseInt(limit, 10) || 5);
        const mapped = external.map(r => ({
          type: 'icd11',
          code: r.code,
          display: r.display,
          description: r.fullDisplay,
          system: fhirBuilder.icd11System,
        }));
        suggestions.push(...mapped);
      } catch (e) {
        console.warn('ICD-11 autocomplete error:', e.message);
      }
    }

    // Simple ordering by match position in display text
    suggestions.sort((a, b) => {
      const am = (a.display || '').toLowerCase().indexOf(q.toLowerCase());
      const bm = (b.display || '').toLowerCase().indexOf(q.toLowerCase());
      if (am === -1 && bm === -1) return 0;
      if (am === -1) return 1;
      if (bm === -1) return -1;
      return am - bm;
    });

    res.json({
      query: q,
      total: suggestions.length,
      suggestions: suggestions.slice(0, (parseInt(limit, 10) || 5) * 2),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Autocomplete failed', message: e.message });
  }
});

/**
 * GET /api/terminology/stats
 * Quick stats about terminology and cache
 */
router.get('/stats', (req, res) => {
  try {
    const stats = {
      namaste: {
        total: namasteData.length,
        categories: [...new Set(namasteData.map(x => x.category || 'Uncategorized'))].length,
        systems: [...new Set(namasteData.map(x => x.system || 'AYUSH'))],
      },
      icd11: {
        cache: icd11Client.getCacheStats(),
        api_endpoint: 'https://clinicaltables.nlm.nih.gov/api/icd11_codes/v3/search',
      },
      fhir: {
        namaste_system: fhirBuilder.namasteSystem,
        icd11_system: fhirBuilder.icd11System,
        concept_map_url: fhirBuilder.conceptMapUrl,
      },
      serverTime: new Date().toISOString(),
    };
    res.json(stats);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get stats', message: e.message });
  }
});

module.exports = router;
