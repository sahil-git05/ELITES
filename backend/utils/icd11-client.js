const axios = require('axios');

class ICD11Client {
    constructor() {
        this.baseUrl = 'https://clinicaltables.nlm.nih.gov/api/icd11_codes/v3/search';
        this.cache = new Map();
        this.cacheExpiry = 60 * 60 * 1000; // 1 hour
    }

    /**
     * Search ICD-11 codes using the NLM Clinical Tables API
     * @param {string} searchTerm - The term to search for
     * @param {number} maxResults - Maximum number of results to return
     * @returns {Promise<Array>} - Array of search results
     */
    async search(searchTerm, maxResults = 10) {
        if (!searchTerm || searchTerm.trim().length === 0) {
            return [];
        }

        const cacheKey = `${searchTerm.toLowerCase()}_${maxResults}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }

        try {
            const url = `${this.baseUrl}?terms=${encodeURIComponent(searchTerm)}&maxList=${maxResults}`;
            console.log(`🔍 Searching ICD-11: ${searchTerm}`);
            
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'NAMASTE-ICD11-Integration/1.0'
                }
            });

            const results = this.parseResponse(response.data);
            
            // Cache the results
            this.cache.set(cacheKey, {
                data: results,
                timestamp: Date.now()
            });

            console.log(`✅ Found ${results.length} ICD-11 matches for "${searchTerm}"`);
            return results;

        } catch (error) {
            console.error(`❌ ICD-11 search failed for "${searchTerm}":`, error.message);
            return [];
        }
    }

    /**
     * Parse the API response into a standardized format
     * @param {Array} apiResponse - Raw API response
     * @returns {Array} - Parsed results
     */
    parseResponse(apiResponse) {
        if (!apiResponse || !Array.isArray(apiResponse) || apiResponse.length < 4) {
            return [];
        }

        const [totalCount, codes, extraData, displayData, codeSystems] = apiResponse;

        if (!codes || !displayData) {
            return [];
        }

        return codes.map((code, index) => {
            const displayInfo = displayData[index] || [];
            return {
                code: code,
                display: displayInfo[1] || 'Unknown',
                type: displayInfo[2] || 'stem',
                fullDisplay: displayInfo[0] || code,
                system: 'http://id.who.int/icd/release/11/mms',
                searchable: `${code} ${displayInfo[1] || ''}`.toLowerCase(),
                confidence: this.calculateInitialConfidence(displayInfo[2])
            };
        });
    }

    /**
     * Calculate initial confidence score based on match type
     * @param {string} matchType - Type of match (stem, extension, etc.)
     * @returns {number} - Confidence score between 0 and 1
     */
    calculateInitialConfidence(matchType) {
        switch (matchType) {
            case 'stem': return 0.9;
            case 'extension': return 0.8;
            case 'other': return 0.7;
            default: return 0.6;
        }
    }

    /**
     * Find potential matches for NAMASTE terms
     * @param {Array} keywords - Array of keywords to search
     * @param {number} maxResults - Maximum results per keyword
     * @returns {Promise<Array>} - Combined and scored results
     */
    async findMatches(keywords, maxResults = 5) {
        if (!keywords || keywords.length === 0) {
            return [];
        }

        try {
            // Search for each keyword and collect all results
            const allPromises = keywords.map(keyword => 
                this.search(keyword.trim(), maxResults)
            );

            const allResults = await Promise.all(allPromises);
            
            // Flatten and deduplicate results
            const uniqueResults = new Map();
            
            allResults.forEach(results => {
                results.forEach(result => {
                    if (!uniqueResults.has(result.code) || 
                        uniqueResults.get(result.code).confidence < result.confidence) {
                        uniqueResults.set(result.code, result);
                    }
                });
            });

            // Convert back to array and sort by confidence
            return Array.from(uniqueResults.values())
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, maxResults * 2); // Return more results for better mapping

        } catch (error) {
            console.error('Error finding matches:', error);
            return [];
        }
    }

    /**
     * Enhanced similarity calculation between NAMASTE and ICD-11 terms
     * @param {string} namasteTerm - NAMASTE term
     * @param {string} icd11Term - ICD-11 term
     * @param {Array} namasteKeywords - NAMASTE keywords
     * @returns {number} - Similarity score between 0 and 1
     */
    calculateSimilarity(namasteTerm, icd11Term, namasteKeywords = []) {
        if (!namasteTerm || !icd11Term) return 0;

        const term1 = namasteTerm.toLowerCase().trim();
        const term2 = icd11Term.toLowerCase().trim();

        // Exact match
        if (term1 === term2) return 1.0;

        // Check if one contains the other
        if (term1.includes(term2) || term2.includes(term1)) {
            return 0.9;
        }

        // Word-based similarity
        const words1 = term1.split(/[\s\-,._]+/).filter(w => w.length > 2);
        const words2 = term2.split(/[\s\-,._]+/).filter(w => w.length > 2);
        
        if (words1.length === 0 || words2.length === 0) return 0;

        let matches = 0;
        words1.forEach(word1 => {
            words2.forEach(word2 => {
                if (word1 === word2) {
                    matches += 1;
                } else if (word1.includes(word2) || word2.includes(word1)) {
                    matches += 0.7;
                } else if (this.isRelatedTerm(word1, word2)) {
                    matches += 0.5;
                }
            });
        });

        let wordSimilarity = matches / Math.max(words1.length, words2.length);

        // Keyword bonus
        if (namasteKeywords.length > 0) {
            const keywordMatches = namasteKeywords.filter(keyword => 
                term2.includes(keyword.toLowerCase())
            ).length;
            const keywordBonus = keywordMatches / namasteKeywords.length * 0.3;
            wordSimilarity = Math.min(1.0, wordSimilarity + keywordBonus);
        }

        return Math.round(wordSimilarity * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Check if two medical terms are related
     * @param {string} term1 - First term
     * @param {string} term2 - Second term
     * @returns {boolean} - Whether terms are related
     */
    isRelatedTerm(term1, term2) {
        const medicalSynonyms = {
            'fever': ['pyrexia', 'hyperthermia', 'temperature'],
            'diabetes': ['mellitus', 'diabetic'],
            'hypertension': ['blood pressure', 'bp'],
            'heart': ['cardiac', 'cardio'],
            'breathing': ['respiratory', 'pulmonary', 'lung'],
            'joint': ['articular', 'arthritis'],
            'skin': ['dermal', 'dermatitis', 'cutaneous'],
            'kidney': ['renal', 'nephritis'],
            'liver': ['hepatic', 'hepatitis']
        };

        for (const [key, synonyms] of Object.entries(medicalSynonyms)) {
            if ((term1.includes(key) && synonyms.some(s => term2.includes(s))) ||
                (term2.includes(key) && synonyms.some(s => term1.includes(s)))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Clear the search cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ ICD-11 search cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

module.exports = ICD11Client;