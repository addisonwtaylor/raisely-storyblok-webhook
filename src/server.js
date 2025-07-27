require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const webhookController = require('./controllers/webhookController');
const Logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'raisely-storyblok-webhook'
  });
});

// Webhook endpoint for Raisely
app.post('/webhook/raisely', webhookController.handleRaiselyWebhook.bind(webhookController));

// Handle GET requests for webhook verification (some services use GET for verification)
app.get('/webhook/raisely', (req, res) => {
  Logger.info('Webhook verification via GET request');
  res.status(200).json({ 
    success: true, 
    message: 'Webhook endpoint verified successfully' 
  });
});

// Test endpoints for development
if (process.env.NODE_ENV === 'development') {
  app.post('/test/webhook', webhookController.testWebhook.bind(webhookController));
  app.post('/test/webhook/created', webhookController.testWebhookCreated.bind(webhookController));
  app.post('/test/webhook/updated', webhookController.testWebhookUpdated.bind(webhookController));
}

// Error handling middleware
app.use((err, req, res, next) => {
  Logger.error('Unhandled server error', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  Logger.warning(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  Logger.section('Webhook Service');
  Logger.server(`Running on port ${PORT}`);
  Logger.info(`Health: http://localhost:${PORT}/health`);
  if (process.env.NODE_ENV === 'development') {
    Logger.info(`Test endpoints available`);
  }
  Logger.space();
});

module.exports = app;