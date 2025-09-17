// backend/server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import routes
const terminologyRoutes = require('./routes/terminology');
const mappingRoutes = require('./routes/mapping');
const fhirRoutes = require('./routes/fhir');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP in dev to allow CDN scripts/styles
    crossOriginEmbedderPolicy: false,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 1000, // IP limit per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// CORS
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);

// Body parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API routes
app.use('/api/terminology', terminologyRoutes);
app.use('/api/mapping', mappingRoutes);
app.use('/api/fhir', fhirRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'NAMASTE-ICD-11 Integration API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Mock ABHA authentication (demo only)
app.post('/api/auth/abha', (req, res) => {
  const { abhaId, otp } = req.body || {};
  if (abhaId && otp) {
    return res.json({
      success: true,
      access_token: `mock_abha_token_${Date.now()}`,
      token_type: 'bearer',
      expires_in: 3600,
      abha_id: abhaId,
      message: 'Authentication successful',
    });
  }
  return res.status(400).json({
    success: false,
    message: 'ABHA ID and OTP are required',
  });
});

// Root → serve app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
🚀 NAMASTE-ICD-11 Integration Server Started!
📡 Server running on: http://localhost:${PORT}
🏥 API Base URL:      http://localhost:${PORT}/api
📊 Health Check:      http://localhost:${PORT}/api/health
🖥️  Frontend:         http://localhost:${PORT}
⚡ Environment:       ${process.env.NODE_ENV || 'development'}
📅 Started at:        ${new Date().toISOString()}
  `);
});

module.exports = app;
