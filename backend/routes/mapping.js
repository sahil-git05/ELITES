// backend/routes/mapping.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const ICD11Client = require('../utils/icd11-client');

const router = express.Router();
const icd11Client = new ICD11Client();

// Load NAMASTE data
let namasteData = [];
try {
  const dataPath = path.join(__dirname, '../data/namaste-sample.json');
  namasteData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`📚 Loaded ${namasteData.length} NAMASTE codes for mapping routes`);
} catch (error) {
  console.error('❌ Failed to load NAMASTE data:', error.message);
}

/**
 * Helper: Extract keywords from text (very simple tokenizer)
 */
function extractKeywords(text = '') {
  const stop = new Set(['a','an','the','of','and','or','but','in','on','at','to','for','with','by','due','including','disease','disorder']);
  return String(text)
    .toLowerCase()
    .split(/[\s\-,._/]+/)
    .filter(w => w.length > 2 && !stop.has(w));
}

/**
 * Helper: Calculate similarity between NAMASTE and ICD-11 titles with keyword bonus
 */
function similarityScore(namaste, icdTitle, kws = []) {
  const n = (namaste || '').toLowerCase().trim();
  const t = (icdTitle || '').toLowerCase().trim();
  if (!n || !t) return 0;

  if (n === t) return 1.0;
  if (n.includes(t) || t.includes(n)) return 0.9;

  const w1 = n.split(/[\s\-,._/]+/).filter(w => w.length > 2);
  const w2 = t.split(/[\s\-,._/]+/).filter(w => w.length > 2);
  if (!w1.length || !w2.length) return 0;

  let matches = 0;
  for (const a of w1) {
    for (const b of w2) {
      if (a === b) matches += 1;
      else if (a.includes(b) || b.includes(a)) matches += 0.7;
    }
  }
  let score = matches / Math.max(w1.length, w2.length);

  if (Array.isArray(kws) && kws.length) {
    const K = kws.map(k => String(k).toLowerCase());
    const km = K.filter(k => t.includes(k)).length;
    score = Math.min(1, score + (km / K.length) * 0.3);
  }

  return Math.round(score * 100) / 100;
}

/**
 * POST /api/mapping/namaste-to-icd11
 * body: { namasteCode, maxResults?, confidenceThreshold? }
 */
router.post('/namaste-to-icd11', async (req, res) => {
  try {
    const { namasteCode, maxResults = 5, confidenceThreshold = 0.3 } = req.body || {};
    if (!namasteCode) {
      return res.status(400).json({ error: 'namasteCode is required' });
    }

    const src = namasteData.find(x => x.code === namasteCode);
    if (!src) {
      return res.status(404).json({ error: `NAMASTE code ${namasteCode} not found` });
    }

    // Build search terms
    const terms = [
      ...(src.keywords || []),
      ...(src.synonyms || []).map(s => String(s).toLowerCase()),
      ...extractKeywords(src.display),
      ...extractKeywords(src.description)
    ];
    const uniqueTerms = [...new Set(terms)].filter(Boolean);

    // Query ICD-11
    const icdResults = await icd11Client.findMatches(uniqueTerms, maxResults);

    // Score & map
    const scored = icdResults.map(r => {
      const sim = icd11Client.calculateSimilarity(src.display, r.display, src.keywords || []);
      return {
        sourceCode: src.code,
        sourceDisplay: src.display,
        sourceSystem: 'http://namaste.ayush.gov.in/fhir/CodeSystem/namaste-codes',
        targetCode: r.code,
        targetDisplay: r.display,
        targetSystem: 'http://id.who.int/icd/release/11/mms',
        confidence: Math.max(sim, r.confidence || 0),
        matchType: r.type || 'stem',
        reasoning: buildReasoning(sim, src, r)
      };
    });

    // Filter and sort
    const filtered = scored
      .filter(m => (m.confidence || 0) >= Number(confidenceThreshold))
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, Number(maxResults));

    res.json({
      sourceCode: {
        code: src.code,
        display: src.display,
        description: src.description,
        category: src.category
      },
      totalFound: filtered.length,
      searchTermsUsed: uniqueTerms.slice(0, 20),
      mappings: filtered
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Mapping failed', message: e.message });
  }
});

/**
 * POST /api/mapping/icd11-to-namaste
 * body: { icd11Code, maxResults?, confidenceThreshold? }
 */
router.post('/icd11-to-namaste', async (req, res) => {
  try {
    const { icd11Code, maxResults = 5, confidenceThreshold = 0.3 } = req.body || {};
    if (!icd11Code) {
      return res.status(400).json({ error: 'icd11Code is required' });
    }

    const lookups = await icd11Client.search(icd11Code, 1);
    if (!Array.isArray(lookups) || lookups.length === 0) {
      return res.status(404).json({ error: `ICD-11 code ${icd11Code} not found` });
    }
    const icd = lookups[0];

    // Reverse match NAMASTE by similarity of titles/keywords
    const scored = namasteData.map(n => {
      const sim = similarityScore(n.display, icd.display, n.keywords || []);
      return {
        sourceCode: icd.code,
        sourceDisplay: icd.display,
        sourceSystem: 'http://id.who.int/icd/release/11/mms',
        targetCode: n.code,
        targetDisplay: n.display,
        targetSystem: 'http://namaste.ayush.gov.in/fhir/CodeSystem/namaste-codes',
        confidence: sim,
        reasoning: sim >= 0.8
          ? 'Strong semantic similarity'
          : sim >= 0.6
          ? 'Moderate similarity'
          : 'Keyword overlap'
      };
    });

    const filtered = scored
      .filter(m => (m.confidence || 0) >= Number(confidenceThreshold))
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, Number(maxResults));

    res.json({
      sourceCode: { code: icd.code, display: icd.display },
      totalFound: filtered.length,
      mappings: filtered
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Reverse mapping failed', message: e.message });
  }
});

/**
 * POST /api/mapping/batch
 * body: { namasteCodes: string[], maxResultsPerCode?, confidenceThreshold? }
 */
router.post('/batch', async (req, res) => {
  try {
    const { namasteCodes, maxResultsPerCode = 3, confidenceThreshold = 0.3 } = req.body || {};
    if (!Array.isArray(namasteCodes) || namasteCodes.length === 0) {
      return res.status(400).json({ error: 'namasteCodes array is required' });
    }

    const results = [];
    for (const code of namasteCodes) {
      const src = namasteData.find(x => x.code === code);
      if (!src) {
        results.push({ namasteCode: code, success: false, error: 'NAMASTE code not found' });
        continue;
      }

      const terms = [
        ...(src.keywords || []),
        ...(src.synonyms || []).map(s => String(s).toLowerCase()),
        ...extractKeywords(src.display),
        ...extractKeywords(src.description)
      ];
      const uniqueTerms = [...new Set(terms)].filter(Boolean);

      const icdResults = await icd11Client.findMatches(uniqueTerms, maxResultsPerCode);

      const mapped = icdResults
        .map(r => ({
          targetCode: r.code,
          targetDisplay: r.display,
          confidence: icd11Client.calculateSimilarity(src.display, r.display, src.keywords || [])
        }))
        .filter(m => (m.confidence || 0) >= Number(confidenceThreshold))
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, Number(maxResultsPerCode));

      results.push({
        namasteCode: src.code,
        namasteDisplay: src.display,
        count: mapped.length,
        mappings: mapped,
        success: true
      });

      // tiny delay to be polite with the external API
      await new Promise(r => setTimeout(r, 100));
    }

    const successCount = results.filter(r => r.success).length;
    const totalMappings = results.reduce((sum, r) => sum + (r.count || 0), 0);

    res.json({
      totalCodes: namasteCodes.length,
      successful: successCount,
      failed: namasteCodes.length - successCount,
      totalMappings,
      results
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Batch mapping failed', message: e.message });
  }
});

/**
 * GET /api/mapping/suggestions/:code?type=namaste|icd11
 * Quick suggestions for mapping
 */
router.get('/suggestions/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { type = 'namaste' } = req.query;

    if (type === 'namaste') {
      const src = namasteData.find(x => x.code === code);
      if (!src) return res.status(404).json({ error: `NAMASTE code ${code} not found` });

      const terms = [...new Set([...(src.keywords || []), ...(src.synonyms || []).map(s => String(s).toLowerCase())])];
      const icd = await icd11Client.findMatches(terms, 3);

      return res.json({
        source: { code: src.code, display: src.display },
        suggestions: icd.map(r => ({
          code: r.code,
          display: r.display,
          confidence: r.confidence || 0.6,
          reason: 'Keyword & type match'
        }))
      });
    }

    if (type === 'icd11') {
      const resICD = await icd11Client.search(code, 1);
      if (!resICD.length) return res.status(404).json({ error: `ICD-11 code ${code} not found` });

      const icd = resICD[0];
      const kws = extractKeywords(icd.display);
      const suggestions = namasteData
        .filter(n => (n.keywords || []).some(k => kws.includes(String(k).toLowerCase())) || kws.some(k => n.display.toLowerCase().includes(k)))
        .slice(0, 3)
        .map(n => ({
          code: n.code,
          display: n.display,
          confidence: similarityScore(n.display, icd.display, n.keywords || []),
          reason: 'Keyword overlap'
        }));

      return res.json({
        source: { code: icd.code, display: icd.display },
        suggestions
      });
    }

    return res.status(400).json({ error: 'Invalid type; use namaste or icd11' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Suggestions failed', message: e.message });
  }
});

/* Helper to build reasoning text */
function buildReasoning(sim, src, icd) {
  const parts = [];
  if (sim >= 0.8) parts.push('High semantic similarity');
  else if (sim >= 0.6) parts.push('Moderate similarity');
  else parts.push('Keyword match');
  if ((src.keywords || []).some(k => (icd.display || '').toLowerCase().includes(String(k).toLowerCase()))) {
    parts.push('Keyword overlap');
  }
  if ((icd.type || '').toLowerCase() === 'stem') parts.push('ICD-11 category level match');
  return parts.join(', ');
}

module.exports = router;
