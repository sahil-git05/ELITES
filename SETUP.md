# 🚀 SETUP INSTRUCTIONS - NAMASTE-ICD-11 Integration

## 📁 Project Structure Overview

```
namaste-icd11-integration/
├── backend/                          # Node.js Backend API
│   ├── package.json                 # Dependencies & scripts  
│   ├── server.js                    # Main server file
│   ├── routes/                      # API route handlers
│   │   ├── terminology.js           # NAMASTE & ICD-11 search
│   │   ├── mapping.js              # Mapping algorithms
│   │   └── fhir.js                 # FHIR resource generation
│   ├── data/
│   │   └── namaste-sample.json     # Sample NAMASTE codes
│   └── utils/
│       ├── icd11-client.js         # ICD-11 API integration
│       └── fhir-builder.js         # FHIR resource builder
└── frontend/                        # Frontend Application
    ├── index.html                   # Main web interface
    ├── styles.css                   # Custom CSS styling
    └── app.js                      # JavaScript application
```

## ⚡ Quick Setup (3 Steps)

### Step 1: Create Project Structure
```bash
# Create main directory
mkdir namaste-icd11-integration
cd namaste-icd11-integration

# Create backend directory
mkdir backend
mkdir backend/routes
mkdir backend/data  
mkdir backend/utils

# Create frontend directory
mkdir frontend
```

### Step 2: Copy Files
Copy all the generated files to their respective locations:

**Backend Files:**
- Copy `package.json` → `backend/package.json`
- Copy `server.js` → `backend/server.js`
- Copy `namaste-sample.json` → `backend/data/namaste-sample.json`
- Copy `icd11-client.js` → `backend/utils/icd11-client.js`
- Copy `fhir-builder.js` → `backend/utils/fhir-builder.js`
- Copy `terminology.js` → `backend/routes/terminology.js`
- Copy `mapping.js` → `backend/routes/mapping.js`
- Copy `fhir.js` → `backend/routes/fhir.js`

**Frontend Files:**
- Copy `index.html` → `frontend/index.html`
- Copy `styles.css` → `frontend/styles.css`
- Copy `app.js` → `frontend/app.js`

**Root Files:**
- Copy `README.md` → `README.md`

### Step 3: Install & Run
```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Start the server
npm start
```

## 🌐 Access the Application

Open your browser and go to:
**http://localhost:3000**

You should see the NAMASTE-ICD-11 Integration interface!

## 🎯 Testing the Demo

### Automatic Demo
1. Click the **"Run Demo"** button in the API section
2. Watch the automated workflow execution

### Manual Testing
1. **Search**: Type "fever" in the NAMASTE search box
2. **Select**: Click on "Vataja Jwara" result
3. **Map**: View the ICD-11 mappings with confidence scores
4. **FHIR**: Click "Generate FHIR Condition" button
5. **API**: Test different API endpoints in the demo section

## 🔧 Troubleshooting

### Common Issues & Solutions:

**Port Already in Use:**
```bash
# Kill process on port 3000
npx kill-port 3000
# Or change port in server.js
```

**CORS Errors:**
- Ensure frontend is served from the same domain as backend
- Check CORS configuration in server.js

**API Timeouts:**
- Check internet connection for ICD-11 API calls
- Increase timeout in icd11-client.js if needed

**Module Not Found:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 📊 Expected Performance

### Loading Times:
- **Application Start**: 3-5 seconds
- **NAMASTE Search**: < 500ms
- **ICD-11 Mapping**: 1-3 seconds
- **FHIR Generation**: < 1 second

### API Response Codes:
- **200**: Success
- **400**: Bad Request (missing parameters)
- **404**: Resource Not Found
- **500**: Internal Server Error

## 🏆 Demo Checklist for Judges

**✅ Must Test:**
1. **Health Check**: GET `/api/health`
2. **NAMASTE Search**: Type "diabetes" or "fever"
3. **ICD-11 Mapping**: Select any NAMASTE code
4. **FHIR Generation**: Create Condition resource
5. **API Demo**: Test multiple endpoints
6. **ABHA Mock**: Try authentication flow

**✅ Key Features to Show:**
- Real-time ICD-11 API integration
- Confidence-based mapping scores
- FHIR R4 compliant resources
- Responsive web interface
- Complete REST API

## 📝 Hackathon Presentation Points

### Technical Innovation:
- "Real WHO ICD-11 API integration, not mock data"
- "Intelligent mapping with confidence scoring"
- "Production-ready FHIR R4 resources"

### Implementation Quality:
- "Complete working prototype in 3 days"
- "15+ NAMASTE codes with scalable architecture"
- "Responsive design works on all devices"

### Real-world Impact:
- "Bridges 5000+ traditional medicine codes with global standards"
- "Enables digital health records for AYUSH sector"
- "Supports dual-coding for insurance claims"

## 🔗 Important URLs

**Application**: http://localhost:3000  
**API Health**: http://localhost:3000/api/health  
**NAMASTE Codes**: http://localhost:3000/api/terminology/namaste  
**ICD-11 Search**: http://localhost:3000/api/terminology/icd11/search?q=fever  
**FHIR CodeSystem**: http://localhost:3000/api/fhir/CodeSystem/namaste-codes  

## 📞 Support During Evaluation

If you encounter any issues during evaluation:

1. **Check Console**: Open browser developer tools (F12) for error messages
2. **Check Server Logs**: Look at terminal output for backend errors  
3. **Restart**: Stop server (Ctrl+C) and run `npm start` again
4. **Alternative**: Use API endpoints directly via curl or Postman

## 🎉 Success Indicators

You'll know everything is working when you see:

✅ "NAMASTE-ICD-11 Integration Server Started!" in terminal  
✅ Web interface loads with hero section and search boxes  
✅ "Application initialized successfully!" toast notification  
✅ NAMASTE search returns results  
✅ ICD-11 mappings appear with confidence scores  
✅ FHIR resources generate and display properly  
✅ API endpoints return JSON responses  

---

**🏥 Ready for SIH 2025 Evaluation!**

The system demonstrates a complete NAMASTE-ICD-11 integration with real API calls, intelligent mapping, and FHIR compliance - perfect for showcasing traditional medicine digitization capabilities.