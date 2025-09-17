// backend/routes/fhir.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const FHIRBuilder = require('../utils/fhir-builder');
const ICD11Client = require('../utils/icd11-client');

const router = express.Router();
const fhirBuilder = new FHIRBuilder();
const icd11Client = new ICD11Client();

// Load NAMASTE sample data
let namasteData = [];
try {
  const dataPath = path.join(__dirname, '../data/namaste-sample.json');
  namasteData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`📚 Loaded ${namasteData.length} NAMASTE codes for FHIR routes`);
} catch (error) {
  console.error('❌ Failed to load NAMASTE data:', error.message);
}

/**
 * GET /api/fhir/CodeSystem/namaste-codes
 * Return CodeSystem for NAMASTE
 */
router.get('/CodeSystem/namaste-codes', (req, res) => {
  try {
    const codeSystem = fhirBuilder.createNamasteCodeSystem(namasteData);
    res.json(codeSystem);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CodeSystem generation failed' });
  }
});

/**
 * POST /api/fhir/ConceptMap/namaste-to-icd11
 * Accepts mappings and returns a ConceptMap resource
 * body: { mappings: [{sourceCode, sourceDisplay, targetCode, targetDisplay, confidence}] }
 */
router.post('/ConceptMap/namaste-to-icd11', (req, res) => {
  try {
    const { mappings } = req.body || {};
    if (!Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Provide mappings array with sourceCode/sourceDisplay/targetCode/targetDisplay/confidence',
      });
    }
    const conceptMap = fhirBuilder.createConceptMap(mappings);
    res.json(conceptMap);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'ConceptMap generation failed' });
  }
});

/**
 * POST /api/fhir/Condition
 * body: { patient, namasteCode, icd11Code?, encounter?, autoMap? }
 * Returns double-coded Condition (NAMASTE + ICD-11 if provided or auto-mapped)
 */
router.post('/Condition', async (req, res) => {
  try {
    const { patient, namasteCode, icd11Code = null, encounter = null, autoMap = false } = req.body || {};

    if (!patient || !namasteCode) {
      return res.status(400).json({ error: 'patient and namasteCode are required' });
    }

    const namasteDetails = namasteData.find(x => x.code === namasteCode);
    if (!namasteDetails) {
      return res.status(404).json({ error: `NAMASTE code ${namasteCode} not found` });
    }

    let icd11Details = null;
    if (autoMap && !icd11Code) {
      // Use the ICD-11 client to attempt a best match
      const terms = [...(namasteDetails.keywords || []), (namasteDetails.display || '').toLowerCase()];
      const matches = await icd11Client.findMatches([...new Set(terms)], 1);
      if (matches && matches.length > 0) {
        icd11Details = { code: matches[0].code, display: matches[0].display };
      }
    } else if (icd11Code) {
      // Try to lookup the provided ICD-11 code to fill display text
      const results = await icd11Client.search(icd11Code, 1);
      if (results && results.length > 0) {
        icd11Details = { code: results[0].code, display: results[0].display };
      } else {
        icd11Details = { code: icd11Code, display: 'ICD-11 Code' };
      }
    }

    const condition = fhirBuilder.createCondition(
      { id: patient.id, name: patient.name },
      { code: namasteDetails.code, display: namasteDetails.display },
      icd11Details,
      encounter
    );

    const validation = fhirBuilder.validateResource(condition);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid FHIR resource', validation });
    }

    res.json({
      resource: condition,
      mappingInfo: {
        namaste: {
          code: namasteDetails.code,
          display: namasteDetails.display,
          system: fhirBuilder.namasteSystem,
        },
        icd11: icd11Details
          ? { code: icd11Details.code, display: icd11Details.display, system: fhirBuilder.icd11System, autoMapped: autoMap }
          : null,
      },
      validation,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Condition creation failed', message: e.message });
  }
});

/**
 * POST /api/fhir/Bundle
 * body: { resources: [FHIR resources], type? }
 */
router.post('/Bundle', (req, res) => {
  try {
    const { resources, type = 'document' } = req.body || {};
    if (!Array.isArray(resources) || resources.length === 0) {
      return res.status(400).json({ error: 'resources array is required' });
    }

    // Optional validation per-resource
    const validation = resources.map(r => ({
      id: r.id,
      resourceType: r.resourceType,
      validation: fhirBuilder.validateResource(r),
    }));
    const invalid = validation.filter(v => !v.validation.valid);
    if (invalid.length > 0) {
      return res.status(400).json({ error: 'Invalid resources in bundle', invalidResources: invalid });
    }

    const bundle = fhirBuilder.createBundle(resources, type);
    res.json({ bundle, summary: { type, resourceCount: resources.length } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Bundle creation failed' });
  }
});

/**
 * GET /api/fhir/ValueSet/$expand
 * Query params: filter, count
 * Returns a ValueSet.expansion suitable for UI auto-complete
 */
router.get('/ValueSet/$expand', (req, res) => {
  try {
    const { filter = '', count = 20 } = req.query;
    let filtered = [...namasteData];

    if (filter) {
      const f = String(filter).toLowerCase();
      filtered = filtered.filter(
        x =>
          x.display.toLowerCase().includes(f) ||
          x.description.toLowerCase().includes(f) ||
          (x.keywords || []).some(k => String(k).toLowerCase().includes(f))
      );
    }

    const limited = filtered.slice(0, parseInt(count, 10));
    const vs = fhirBuilder.createValueSet(
      limited.map(x => ({ code: x.code, display: x.display })),
      fhirBuilder.namasteSystem,
      'NAMASTE Codes ValueSet'
    );

    res.json(vs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'ValueSet $expand failed' });
  }
});

/**
 * GET /api/fhir/CodeSystem/$lookup
 * Query params: system, code
 * Returns a Parameters resource with properties per FHIR $lookup convention
 */
router.get('/CodeSystem/$lookup', (req, res) => {
  try {
    const { system, code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'code parameter is required' });
    }
    if (system && system !== fhirBuilder.namasteSystem) {
      return res.status(400).json({ error: 'Only NAMASTE CodeSystem lookup supported in this demo' });
    }

    const item = namasteData.find(x => x.code === code);
    if (!item) {
      return res.status(404).json({ error: `Code ${code} not found in NAMASTE` });
    }

    const parameters = {
      resourceType: 'Parameters',
      parameter: [
        { name: 'name', valueString: 'NAMASTE' },
        { name: 'version', valueString: '2025.1.0' },
        { name: 'display', valueString: item.display },
        { name: 'definition', valueString: item.description },
        {
          name: 'property',
          part: [
            { name: 'code', valueString: 'category' },
            { name: 'value', valueString: item.category || '' },
          ],
        },
        {
          name: 'property',
          part: [
            { name: 'code', valueString: 'tm-system' },
            { name: 'value', valueString: item.system || 'AYUSH' },
          ],
        },
      ],
    };

    res.json(parameters);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'CodeSystem $lookup failed' });
  }
});

/**
 * POST /api/fhir/ConceptMap/$translate
 * body: { code, reverse? }
 * For demo: NAMASTE -> ICD-11 suggestions using ICD11Client
 */
router.post('/ConceptMap/$translate', async (req, res) => {
  try {
    const { code, reverse = false } = req.body || {};
    if (!code) return res.status(400).json({ error: 'code is required' });

    if (reverse) {
      // Demo: Reverse not implemented
      return res.status(501).json({ error: 'Reverse translate (ICD-11 -> NAMASTE) not implemented in demo' });
    }

    const src = namasteData.find(x => x.code === code);
    if (!src) {
      return res.status(404).json({ error: `NAMASTE code ${code} not found` });
    }

    const terms = [...(src.keywords || []), (src.display || '').toLowerCase()];
    const results = await icd11Client.findMatches([...new Set(terms)], 3);

    const matches = results.map(r => ({
      equivalence: (r.confidence || 0) >= 0.8 ? 'equivalent' : 'wider',
      concept: { system: fhirBuilder.icd11System, code: r.code, display: r.display },
    }));

    const out = {
      resourceType: 'Parameters',
      parameter: [
        { name: 'result', valueBoolean: matches.length > 0 },
        { name: 'message', valueString: `Found ${matches.length} potential matches` },
        ...matches.map(m => ({
          name: 'match',
          part: [
            { name: 'equivalence', valueCode: m.equivalence },
            { name: 'concept', valueCoding: m.concept },
          ],
        })),
      ],
    };

    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Translate failed' });
  }
});

/**
 * GET /api/fhir/Patient/demo
 * Simple demo patient
 */
router.get('/Patient/demo', (req, res) => {
  try {
    const p = fhirBuilder.createDemoPatient({
      id: 'demo-patient-001',
      given: 'Rajesh',
      family: 'Kumar',
      gender: 'male',
      birthDate: '1980-05-15',
      phone: '+91-9876543210',
      city: 'New Delhi',
    });
    res.json(p);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Demo patient failed' });
  }
});

/**
 * GET /api/fhir/capability
 * Minimal CapabilityStatement for demo
 */
router.get('/capability', (req, res) => {
  try {
    const capability = {
      resourceType: 'CapabilityStatement',
      id: 'namaste-icd11-capability',
      status: 'active',
      date: new Date().toISOString(),
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['json'],
      rest: [
        {
          mode: 'server',
          resource: [
            { type: 'CodeSystem' },
            { type: 'ConceptMap' },
            { type: 'Condition' },
            { type: 'Bundle' },
            { type: 'ValueSet' },
            { type: 'Patient' },
          ],
          security: {
            service: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                    code: 'OAuth',
                    display: 'OAuth2',
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    res.json(capability);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Capability generation failed' });
  }
});

module.exports = router;
