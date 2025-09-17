// NAMASTE-ICD-11 Integration App
class NAMASTEApp {
    constructor() {
        this.baseURL = window.location.origin;
        this.selectedNamasteCode = null;
        this.currentMappings = [];
        this.currentFHIRResource = null;
        this.authToken = null;
        this.statistics = {
            mappings: 0,
            fhirResources: 0
        };

        this.initializeApp();
    }

    // Initialize the application
    async initializeApp() {
        this.bindEvents();
        await this.loadStatistics();
        this.showToast('success', 'Application initialized successfully!');
    }

    // Bind event listeners
    bindEvents() {
        // Search functionality
        document.getElementById('namasteSearch').addEventListener('input', 
            this.debounce(this.handleNamasteSearch.bind(this), 300));

        // FHIR generation
        document.getElementById('generateConditionBtn').addEventListener('click', 
            this.generateFHIRCondition.bind(this));

        // API demo
        document.querySelectorAll('[data-endpoint]').forEach(button => {
            button.addEventListener('click', this.testApiEndpoint.bind(this));
        });

        document.getElementById('runDemoBtn').addEventListener('click', 
            this.runCompleteDemo.bind(this));

        // ABHA authentication
        document.getElementById('abhaLoginBtn').addEventListener('click', 
            this.showABHAModal.bind(this));

        document.getElementById('abhaSubmitBtn').addEventListener('click', 
            this.handleABHALogin.bind(this));

        // View controls
        document.getElementById('viewJsonBtn').addEventListener('click', 
            this.toggleFHIRView.bind(this));

        document.getElementById('downloadBtn').addEventListener('click', 
            this.downloadFHIRResource.bind(this));

        // Smooth scrolling for navigation
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    // Debounce utility function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Handle NAMASTE code search
    async handleNamasteSearch(event) {
        const query = event.target.value.trim();
        const resultsContainer = document.getElementById('namasteResults');

        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }

        this.showLoading();

        try {
            const response = await fetch(`${this.baseURL}/api/terminology/namaste?search=${encodeURIComponent(query)}&limit=10`);
            const data = await response.json();

            this.displayNamasteResults(data.results, resultsContainer);

        } catch (error) {
            this.showToast('error', `Search failed: ${error.message}`);
            resultsContainer.innerHTML = '<div class="text-danger">Search failed. Please try again.</div>';
        } finally {
            this.hideLoading();
        }
    }

    // Display NAMASTE search results
    displayNamasteResults(results, container) {
        if (!results || results.length === 0) {
            container.innerHTML = '<div class="text-muted">No results found</div>';
            return;
        }

        const html = results.map(code => `
            <div class="search-result-item" data-code="${code.code}" onclick="app.selectNamasteCode('${code.code}')">
                <div class="search-result-code">${code.code}</div>
                <div class="search-result-title">${code.display}</div>
                <div class="search-result-desc">${code.description}</div>
                <div class="search-result-category">${code.category}</div>
            </div>
        `).join('');

        container.innerHTML = html;
        container.classList.add('fade-in');
    }

    // Select a NAMASTE code and find ICD-11 mappings
    async selectNamasteCode(code) {
        // Update UI selection
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-code="${code}"]`).classList.add('selected');

        // Store selected code
        this.selectedNamasteCode = code;

        // Display selected code info
        await this.displaySelectedNamaste(code);

        // Find ICD-11 mappings
        await this.findICD11Mappings(code);
    }

    // Display selected NAMASTE code information
    async displaySelectedNamaste(code) {
        const container = document.getElementById('selectedNamaste');
        const display = container.querySelector('.code-display');

        try {
            const response = await fetch(`${this.baseURL}/api/terminology/namaste/${code}`);
            const namasteCode = await response.json();

            display.innerHTML = `
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <span class="code-highlight">${namasteCode.code}</span>
                        <h6 class="mt-1 mb-1">${namasteCode.display}</h6>
                    </div>
                    <span class="badge bg-primary">${namasteCode.system}</span>
                </div>
                <p class="text-muted mb-2">${namasteCode.description}</p>
                <div>
                    <small class="text-secondary">
                        <strong>Category:</strong> ${namasteCode.category} |
                        <strong>Keywords:</strong> ${namasteCode.keywords.join(', ')}
                    </small>
                </div>
            `;

            container.style.display = 'block';
            container.classList.add('slide-in');

        } catch (error) {
            this.showToast('error', `Failed to load NAMASTE code details: ${error.message}`);
        }
    }

    // Find and display ICD-11 mappings
    async findICD11Mappings(namasteCode) {
        const statusDiv = document.getElementById('mappingStatus');
        const resultsDiv = document.getElementById('icd11Mappings');

        statusDiv.style.display = 'block';
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Finding ICD-11 mappings...';
        resultsDiv.innerHTML = '';

        try {
            const response = await fetch(`${this.baseURL}/api/mapping/namaste-to-icd11`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    namasteCode: namasteCode,
                    maxResults: 5,
                    confidenceThreshold: 0.3
                })
            });

            const data = await response.json();
            this.currentMappings = data.mappings;

            if (data.mappings.length === 0) {
                statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle text-warning me-2"></i>No mappings found';
                return;
            }

            statusDiv.style.display = 'none';
            this.displayICD11Mappings(data.mappings, resultsDiv);

            // Update statistics
            this.statistics.mappings += data.mappings.length;
            this.updateStatistics();

        } catch (error) {
            statusDiv.innerHTML = '<i class="fas fa-exclamation-circle text-danger me-2"></i>Mapping failed';
            this.showToast('error', `Mapping failed: ${error.message}`);
        }
    }

    // Display ICD-11 mapping results
    displayICD11Mappings(mappings, container) {
        const html = mappings.map(mapping => {
            const confidenceClass = mapping.confidence >= 0.8 ? 'high' : 
                                  mapping.confidence >= 0.6 ? 'medium' : 'low';
            const confidencePercent = Math.round(mapping.confidence * 100);

            return `
                <div class="mapping-item" onclick="app.selectMapping('${mapping.targetCode}')">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="mapping-code">${mapping.targetCode}</div>
                        <span class="mapping-confidence ${confidenceClass}">${confidencePercent}%</span>
                    </div>
                    <div class="mapping-display">${mapping.targetDisplay}</div>
                    <div class="mapping-reasoning">${mapping.reasoning}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        container.classList.add('fade-in');
    }

    // Select a specific mapping
    selectMapping(icd11Code) {
        this.showToast('success', `Selected ICD-11 code: ${icd11Code}`);
        
        // Highlight selected mapping
        document.querySelectorAll('.mapping-item').forEach(item => {
            item.style.backgroundColor = '';
        });
        event.target.closest('.mapping-item').style.backgroundColor = 'rgba(25, 135, 84, 0.1)';
    }

    // Generate FHIR Condition resource
    async generateFHIRCondition() {
        if (!this.selectedNamasteCode) {
            this.showToast('error', 'Please select a NAMASTE code first');
            return;
        }

        this.showLoading();

        try {
            const patientData = {
                id: 'demo-patient-001',
                name: document.getElementById('patientName').value || 'Demo Patient',
                birthDate: document.getElementById('patientDob').value,
                gender: document.getElementById('patientGender').value
            };

            const response = await fetch(`${this.baseURL}/api/fhir/Condition`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    patient: patientData,
                    namasteCode: this.selectedNamasteCode,
                    autoMap: true
                })
            });

            const data = await response.json();
            this.currentFHIRResource = data.resource;

            this.displayFHIRResource(data);
            this.statistics.fhirResources++;
            this.updateStatistics();

            document.getElementById('downloadBtn').disabled = false;
            this.showToast('success', 'FHIR Condition resource generated successfully!');

        } catch (error) {
            this.showToast('error', `FHIR generation failed: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    // Display FHIR resource
    displayFHIRResource(data) {
        const previewContainer = document.getElementById('fhirPreview');

        const summaryHtml = `
            <div class="fhir-summary mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0">
                        <span class="fhir-resource-type">Condition</span>
                        ${data.resource.id}
                    </h6>
                    <small class="text-muted">${new Date().toLocaleString()}</small>
                </div>
                
                <div class="row g-2 mb-3">
                    <div class="col-md-6">
                        <strong>Patient:</strong> ${data.mappingInfo.namaste.display}
                    </div>
                    <div class="col-md-6">
                        <strong>Status:</strong> 
                        <span class="badge bg-success">${data.resource.clinicalStatus.coding[0].display}</span>
                    </div>
                </div>
                
                <div class="mb-2">
                    <strong>Coding Systems:</strong>
                    <div class="mt-1">
                        <span class="badge bg-primary me-2">
                            ${data.mappingInfo.namaste.code} - ${data.mappingInfo.namaste.display}
                        </span>
                        ${data.mappingInfo.icd11 ? `
                            <span class="badge bg-success">
                                ${data.mappingInfo.icd11.code} - ${data.mappingInfo.icd11.display}
                                ${data.mappingInfo.icd11.autoMapped ? '(Auto-mapped)' : ''}
                            </span>
                        ` : ''}
                    </div>
                </div>
                
                <div class="validation-status ${data.validation.valid ? 'success-state' : 'error-state'}">
                    <i class="fas fa-${data.validation.valid ? 'check-circle' : 'exclamation-circle'} me-2"></i>
                    FHIR Validation: ${data.validation.valid ? 'Valid' : 'Invalid'}
                    ${data.validation.warnings.length > 0 ? 
                        `<small class="d-block mt-1">Warnings: ${data.validation.warnings.join(', ')}</small>` : ''}
                </div>
            </div>
        `;

        previewContainer.innerHTML = summaryHtml;
    }

    // Toggle FHIR JSON view
    toggleFHIRView() {
        if (!this.currentFHIRResource) {
            this.showToast('error', 'No FHIR resource to display');
            return;
        }

        const previewContainer = document.getElementById('fhirPreview');
        const btn = document.getElementById('viewJsonBtn');

        if (btn.textContent.includes('JSON')) {
            // Show JSON view
            previewContainer.innerHTML = `
                <div class="fhir-json">${JSON.stringify(this.currentFHIRResource, null, 2)}</div>
            `;
            btn.innerHTML = '<i class="fas fa-eye me-1"></i> Summary';
        } else {
            // Show summary view
            this.displayFHIRResource({
                resource: this.currentFHIRResource,
                mappingInfo: {
                    namaste: {
                        code: this.selectedNamasteCode,
                        display: this.currentFHIRResource.code.coding[0].display
                    },
                    icd11: this.currentFHIRResource.code.coding[1] ? {
                        code: this.currentFHIRResource.code.coding[1].code,
                        display: this.currentFHIRResource.code.coding[1].display,
                        autoMapped: true
                    } : null
                },
                validation: { valid: true, warnings: [] }
            });
            btn.innerHTML = '<i class="fas fa-code me-1"></i> JSON';
        }
    }

    // Download FHIR resource
    downloadFHIRResource() {
        if (!this.currentFHIRResource) {
            this.showToast('error', 'No FHIR resource to download');
            return;
        }

        const jsonString = JSON.stringify(this.currentFHIRResource, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `fhir-condition-${this.currentFHIRResource.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('success', 'FHIR resource downloaded successfully!');
    }

    // Test API endpoint
    async testApiEndpoint(event) {
        const endpoint = event.currentTarget.dataset.endpoint;
        const responseContainer = document.getElementById('apiResponse');

        // Highlight selected endpoint
        document.querySelectorAll('[data-endpoint]').forEach(item => {
            item.classList.remove('active');
        });
        event.currentTarget.classList.add('active');

        // Show loading
        responseContainer.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

        try {
            const url = endpoint.includes('?') ? `${this.baseURL}${endpoint}` : 
                       endpoint.includes('icd11/search') ? `${this.baseURL}${endpoint}?q=fever` : 
                       `${this.baseURL}${endpoint}`;

            const response = await fetch(url);
            const data = await response.json();

            responseContainer.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <small class="text-muted">Response (${response.status})</small>
                    <small class="text-muted">${new Date().toLocaleTimeString()}</small>
                </div>
                <div class="api-json">${JSON.stringify(data, null, 2)}</div>
            `;

        } catch (error) {
            responseContainer.innerHTML = `
                <div class="error-state p-3">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    <strong>Error:</strong> ${error.message}
                </div>
            `;
        }
    }

    // Run complete demo workflow
    async runCompleteDemo() {
        this.showToast('success', 'Running complete demo workflow...');

        try {
            // Step 1: Search for a demo term
            document.getElementById('namasteSearch').value = 'fever';
            await this.handleNamasteSearch({ target: { value: 'fever' } });
            
            await this.sleep(1000);

            // Step 2: Select first result
            const firstResult = document.querySelector('.search-result-item');
            if (firstResult) {
                firstResult.click();
                await this.sleep(2000);

                // Step 3: Generate FHIR resource
                await this.generateFHIRCondition();
                await this.sleep(1000);

                // Step 4: Test API endpoint
                const healthEndpoint = document.querySelector('[data-endpoint="/api/health"]');
                if (healthEndpoint) {
                    healthEndpoint.click();
                }

                this.showToast('success', 'Demo workflow completed successfully!');
            }

        } catch (error) {
            this.showToast('error', `Demo workflow failed: ${error.message}`);
        }
    }

    // Show ABHA modal
    showABHAModal() {
        const modal = new bootstrap.Modal(document.getElementById('abhaModal'));
        modal.show();
    }

    // Handle ABHA login
    async handleABHALogin() {
        const abhaId = document.getElementById('abhaId').value;
        const otp = document.getElementById('abhaOtp').value;

        if (!abhaId || !otp) {
            this.showToast('error', 'Please enter ABHA ID and OTP');
            return;
        }

        this.showLoading();

        try {
            const response = await fetch(`${this.baseURL}/api/auth/abha`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ abhaId, otp })
            });

            const data = await response.json();

            if (data.success) {
                this.authToken = data.access_token;
                document.getElementById('abhaLoginBtn').innerHTML = 
                    '<i class="fas fa-user-check me-1"></i> Authenticated';
                document.getElementById('abhaLoginBtn').classList.replace('btn-outline-light', 'btn-success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('abhaModal'));
                modal.hide();

                this.showToast('success', 'ABHA authentication successful!');
            } else {
                this.showToast('error', data.message || 'Authentication failed');
            }

        } catch (error) {
            this.showToast('error', `Authentication failed: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    // Load and update statistics
    async loadStatistics() {
        try {
            const response = await fetch(`${this.baseURL}/api/terminology/stats`);
            const data = await response.json();

            document.getElementById('namasteCount').textContent = data.namaste.total;
            this.updateStatistics();

        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    }

    // Update statistics display
    updateStatistics() {
        document.getElementById('mappingCount').textContent = this.statistics.mappings;
        document.getElementById('fhirCount').textContent = this.statistics.fhirResources;
    }

    // Utility: Show loading spinner
    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'block';
    }

    // Utility: Hide loading spinner
    hideLoading() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }

    // Utility: Show toast notification
    showToast(type, message) {
        const toastId = type === 'error' ? 'errorToast' : 'successToast';
        const toast = document.getElementById(toastId);
        const toastBody = toast.querySelector('.toast-body');
        
        toastBody.textContent = message;
        
        const bootstrapToast = new bootstrap.Toast(toast);
        bootstrapToast.show();
    }

    // Utility: Sleep function for demo delays
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.app = new NAMASTEApp();
});

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    if (window.app) {
        window.app.showToast('error', 'An unexpected error occurred');
    }
});

// Service worker registration (optional, for offline capability)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        // Uncomment to enable service worker
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => console.log('SW registered'))
        //     .catch(error => console.log('SW registration failed'));
    });
}