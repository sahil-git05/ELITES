const { v4: uuidv4 } = require('uuid');

class FHIRBuilder {
    constructor() {
        this.namasteSystem = 'http://namaste.ayush.gov.in/fhir/CodeSystem/namaste-codes';
        this.icd11System = 'http://id.who.int/icd/release/11/mms';
        this.conceptMapUrl = 'http://namaste.ayush.gov.in/fhir/ConceptMap/namaste-to-icd11';
    }

    /**
     * Create a FHIR CodeSystem for NAMASTE codes
     * @param {Array} namasteCodes - Array of NAMASTE code objects
     * @returns {Object} - FHIR CodeSystem resource
     */
    createNamasteCodeSystem(namasteCodes) {
        const concepts = namasteCodes.map(code => ({
            code: code.code,
            display: code.display,
            definition: code.description,
            property: [
                {
                    code: 'category',
                    valueString: code.category
                },
                {
                    code: 'system',
                    valueString: code.system
                }
            ]
        }));

        return {
            resourceType: 'CodeSystem',
            id: 'namaste-codes',
            url: this.namasteSystem,
            version: '2025.1.0',
            name: 'NAMASTE',
            title: 'National AYUSH Morbidity & Standardized Terminologies Electronic',
            status: 'active',
            experimental: false,
            date: new Date().toISOString(),
            publisher: 'Ministry of AYUSH, Government of India',
            contact: [
                {
                    name: 'All India Institute of Ayurveda (AIIA)',
                    telecom: [
                        {
                            system: 'url',
                            value: 'https://aiia.gov.in'
                        }
                    ]
                }
            ],
            description: 'NAMASTE codes for Ayurveda, Siddha, and Unani traditional medicine disorders',
            jurisdiction: [
                {
                    coding: [
                        {
                            system: 'urn:iso:std:iso:3166',
                            code: 'IN',
                            display: 'India'
                        }
                    ]
                }
            ],
            content: 'complete',
            count: namasteCodes.length,
            concept: concepts
        };
    }

    /**
     * Create a FHIR ConceptMap for NAMASTE to ICD-11 mappings
     * @param {Array} mappings - Array of mapping objects
     * @returns {Object} - FHIR ConceptMap resource
     */
    createConceptMap(mappings) {
        const groups = [{
            source: this.namasteSystem,
            target: this.icd11System,
            element: mappings.map(mapping => ({
                code: mapping.sourceCode,
                display: mapping.sourceDisplay,
                target: [{
                    code: mapping.targetCode,
                    display: mapping.targetDisplay,
                    relationship: this.getRelationshipType(mapping.confidence),
                    comment: `Confidence: ${(mapping.confidence * 100).toFixed(1)}%`
                }]
            }))
        }];

        return {
            resourceType: 'ConceptMap',
            id: 'namaste-to-icd11',
            url: this.conceptMapUrl,
            version: '2025.1.0',
            name: 'NAMASTEToICD11',
            title: 'NAMASTE to ICD-11 Concept Map',
            status: 'active',
            experimental: false,
            date: new Date().toISOString(),
            publisher: 'Ministry of AYUSH, Government of India',
            description: 'Mapping between NAMASTE traditional medicine codes and ICD-11',
            sourceCanonical: this.namasteSystem,
            targetCanonical: this.icd11System,
            group: groups
        };
    }

    /**
     * Create a FHIR Condition resource with double coding
     * @param {Object} patient - Patient reference
     * @param {Object} namasteCode - NAMASTE code object
     * @param {Object} icd11Code - ICD-11 code object
     * @param {Object} encounter - Encounter reference (optional)
     * @returns {Object} - FHIR Condition resource
     */
    createCondition(patient, namasteCode, icd11Code, encounter = null) {
        const condition = {
            resourceType: 'Condition',
            id: uuidv4(),
            meta: {
                versionId: '1',
                lastUpdated: new Date().toISOString(),
                profile: ['http://hl7.org/fhir/StructureDefinition/Condition']
            },
            clinicalStatus: {
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                    code: 'active',
                    display: 'Active'
                }]
            },
            verificationStatus: {
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                    code: 'confirmed',
                    display: 'Confirmed'
                }]
            },
            category: [{
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/condition-category',
                    code: 'problem-list-item',
                    display: 'Problem List Item'
                }]
            }],
            code: {
                coding: [
                    {
                        system: this.namasteSystem,
                        code: namasteCode.code,
                        display: namasteCode.display
                    }
                ],
                text: namasteCode.display
            },
            subject: {
                reference: `Patient/${patient.id}`,
                display: patient.name
            },
            recordedDate: new Date().toISOString()
        };

        // Add ICD-11 coding if provided
        if (icd11Code) {
            condition.code.coding.push({
                system: this.icd11System,
                code: icd11Code.code,
                display: icd11Code.display
            });
        }

        // Add encounter reference if provided
        if (encounter) {
            condition.encounter = {
                reference: `Encounter/${encounter.id}`,
                display: encounter.display || 'Clinical Encounter'
            };
        }

        return condition;
    }

    /**
     * Create a FHIR Bundle with multiple resources
     * @param {Array} resources - Array of FHIR resources
     * @param {string} type - Bundle type (document, transaction, etc.)
     * @returns {Object} - FHIR Bundle resource
     */
    createBundle(resources, type = 'document') {
        return {
            resourceType: 'Bundle',
            id: uuidv4(),
            meta: {
                versionId: '1',
                lastUpdated: new Date().toISOString()
            },
            type: type,
            timestamp: new Date().toISOString(),
            entry: resources.map(resource => ({
                fullUrl: `urn:uuid:${resource.id}`,
                resource: resource
            }))
        };
    }

    /**
     * Create a FHIR ValueSet for terminology expansion
     * @param {Array} codes - Array of codes to include
     * @param {string} system - Code system URL
     * @param {string} title - ValueSet title
     * @returns {Object} - FHIR ValueSet resource
     */
    createValueSet(codes, system, title) {
        return {
            resourceType: 'ValueSet',
            id: uuidv4(),
            url: `${system}/ValueSet/${title.replace(/\s+/g, '-').toLowerCase()}`,
            version: '1.0.0',
            name: title.replace(/\s+/g, ''),
            title: title,
            status: 'active',
            experimental: false,
            date: new Date().toISOString(),
            expansion: {
                identifier: uuidv4(),
                timestamp: new Date().toISOString(),
                contains: codes.map(code => ({
                    system: system,
                    code: code.code,
                    display: code.display
                }))
            }
        };
    }

    /**
     * Create a demo Patient resource
     * @param {Object} patientData - Patient information
     * @returns {Object} - FHIR Patient resource
     */
    createDemoPatient(patientData = {}) {
        return {
            resourceType: 'Patient',
            id: patientData.id || uuidv4(),
            meta: {
                versionId: '1',
                lastUpdated: new Date().toISOString()
            },
            identifier: [
                {
                    use: 'official',
                    type: {
                        coding: [{
                            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                            code: 'MR',
                            display: 'Medical Record Number'
                        }]
                    },
                    system: 'http://hospital.example.org',
                    value: patientData.mrn || 'MRN123456'
                }
            ],
            active: true,
            name: [{
                use: 'official',
                family: patientData.family || 'Sharma',
                given: [patientData.given || 'Rajesh']
            }],
            telecom: [{
                system: 'phone',
                value: patientData.phone || '+91-9876543210',
                use: 'home'
            }],
            gender: patientData.gender || 'male',
            birthDate: patientData.birthDate || '1985-03-15',
            address: [{
                use: 'home',
                line: [patientData.address || '123 Main Street'],
                city: patientData.city || 'New Delhi',
                state: patientData.state || 'Delhi',
                postalCode: patientData.postalCode || '110001',
                country: 'IN'
            }]
        };
    }

    /**
     * Determine relationship type based on confidence score
     * @param {number} confidence - Confidence score (0-1)
     * @returns {string} - FHIR relationship code
     */
    getRelationshipType(confidence) {
        if (confidence >= 0.9) return 'equivalent';
        if (confidence >= 0.7) return 'relatedto';
        if (confidence >= 0.5) return 'wider';
        return 'related';
    }

    /**
     * Validate FHIR resource structure
     * @param {Object} resource - FHIR resource to validate
     * @returns {Object} - Validation result
     */
    validateResource(resource) {
        const errors = [];
        const warnings = [];

        // Basic validation
        if (!resource.resourceType) {
            errors.push('Missing required field: resourceType');
        }

        if (!resource.id) {
            warnings.push('Missing recommended field: id');
        }

        // Resource-specific validation
        switch (resource.resourceType) {
            case 'Condition':
                if (!resource.subject) errors.push('Condition missing required field: subject');
                if (!resource.code) errors.push('Condition missing required field: code');
                break;
                
            case 'Patient':
                if (!resource.name) errors.push('Patient missing required field: name');
                break;
                
            case 'CodeSystem':
                if (!resource.url) errors.push('CodeSystem missing required field: url');
                if (!resource.status) errors.push('CodeSystem missing required field: status');
                break;
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
}

module.exports = FHIRBuilder;