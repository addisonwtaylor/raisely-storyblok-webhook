const storyblokService = require('../services/storyblokService');
const Logger = require('../utils/logger');
const { validateFundraiserData } = require('../types/fundraiser');
const fs = require('fs');
const path = require('path');

class WebhookController {
  /**
   * Handle incoming Raisely webhook for profile created/updated events
   */
  async handleRaiselyWebhook(req, res) {
    try {
      Logger.section('Incoming Webhook');
      Logger.webhook('Received request');
      
      const webhookData = req.body;
      
      // Extract event type from the correct location
      const eventType = webhookData.data.type || webhookData.type || 'unknown';
      
      Logger.webhook(`${eventType} → ${req.body.data?.data?.name || 'Processing'}`);

      // Validate webhook data structure
      if (!webhookData.data) {
        Logger.warning('Invalid webhook payload - missing data field');
        return res.status(400).json({ 
          error: 'Invalid webhook payload', 
          message: 'Missing data field' 
        });
      }

      // Handle different webhook structures
      // Real Raisely webhooks have data.data, test webhooks have data.profile
      const profileData = webhookData.data.data || webhookData.data.profile || webhookData.data;
      

      

      
      // Extract and validate required fields
      const extractedData = WebhookController.extractFundraiserData(profileData);
      
      if (!extractedData) {
        Logger.warning('Could not extract valid fundraiser data from webhook');
        return res.status(400).json({ 
          error: 'Invalid fundraiser data', 
          message: 'Required fields missing' 
        });
      }

      // Additional validation to catch missing fields early
      const validatedData = validateFundraiserData(extractedData);
      if (!validatedData) {
        Logger.error('Fundraiser data failed validation');
        return res.status(400).json({ 
          error: 'Invalid fundraiser data', 
          message: 'Data validation failed' 
        });
      }

      // Sync to Storyblok, passing the event type
      const result = await storyblokService.syncFundraiser(extractedData, eventType);

      if (result.action === 'created') {
        Logger.success(`Created story: ${extractedData.name}`);
      } else if (result.action === 'updated') {
        Logger.success(`Updated story: ${extractedData.name}`);
      }

      // Return success response
      res.status(200).json({ 
        success: true, 
        message: 'Fundraiser synced successfully',
        fundraiser: extractedData.name,
        campaign: extractedData.campaign
      });

    } catch (error) {
      Logger.error('Webhook processing failed', error);
      res.status(500).json({ 
        error: 'Webhook processing failed', 
        message: error.message 
      });
    }
  }

  /**
   * Extract fundraiser data from Raisely webhook payload
   */
  static extractFundraiserData(raiselyProfile) {
    try {
      // Handle different webhook structures
      const profile = raiselyProfile.profile || raiselyProfile;
      
      // Required fields validation
      if (!profile.name) {
        Logger.warning('Missing required field: name');
        return null;
      }

      if (!profile.path) {
        Logger.warning('Missing required field: path (used for slug)');
        return null;
      }

      // Extract campaign information from Raisely webhook
      let campaignName = 'Default Campaign';
      
      if (profile.campaign) {
        campaignName = profile.campaign.name || profile.campaign.title || profile.campaign;
      } else if (profile.campaignName) {
        campaignName = profile.campaignName;
      } else if (profile.parent) {
        // Raisely webhook has parent.name for campaign
        campaignName = profile.parent.name;
      } else if (profile.path) {
        // Extract campaign from path if available
        const pathParts = profile.path.split('/');
        if (pathParts.length > 1) {
          campaignName = pathParts[0];
        }
      }

      // Extract amounts (handle both cents and dollar amounts)
      // Raisely uses 'goal' for target and 'total' for raised amount
      const targetAmount = WebhookController.normalizeAmount(profile.goal || profile.target || profile.targetAmount || 0);
      const raisedAmount = WebhookController.normalizeAmount(profile.total || profile.raisedAmount || 0);

      // Build profile URL
      let profileUrl = '';
      if (profile.url) {
        profileUrl = profile.url;
      } else if (profile.path) {
        // Construct URL if we have a path
        profileUrl = `https://your-raisely-domain.raisely.com/${profile.path}`;
      }

      const extractedData = {
        name: profile.name,
        campaign: campaignName,
        description: profile.description || profile.story || '',
        targetAmount,
        raisedAmount,
        profileUrl,
        raiselyId: profile.uuid || profile.id || '',
        path: profile.path || '',
        status: profile.status || 'DRAFT' // Default to DRAFT if no status
      };



      return extractedData;

    } catch (error) {
      Logger.error('Error extracting fundraiser data', error);
      return null;
    }
  }

  /**
   * Normalize amount values (handle cents vs dollars)
   */
  static normalizeAmount(amount) {
    if (!amount || isNaN(amount)) return 0;
    
    // If amount is likely in cents (> 1000), convert to dollars
    if (amount > 1000) {
      return Math.round(amount / 100);
    }
    
    return Math.round(amount);
  }

  /**
   * Test endpoint for profile.created events
   */
  async testWebhookCreated(req, res) {
    try {
      const testDataPath = path.join(__dirname, '../../test-data/profile-created-webhook.json');
      
      if (!fs.existsSync(testDataPath)) {
        return res.status(400).json({ 
          error: 'Test data file not found', 
          message: 'Please create and populate test-data/profile-created-webhook.json with real webhook data',
          path: testDataPath
        });
      }

      const testDataContent = fs.readFileSync(testDataPath, 'utf8');
      let testData;
      
      try {
        testData = JSON.parse(testDataContent);
      } catch (parseError) {
        return res.status(400).json({ 
          error: 'Invalid JSON in test data file', 
          message: 'Please check the JSON syntax in profile-created-webhook.json',
          parseError: parseError.message
        });
      }

      if (!testData.data || !testData.data.data) {
        return res.status(400).json({ 
          error: 'Invalid test data structure', 
          message: 'Test data must have the structure: { data: { data: { ... } } }'
        });
      }

      Logger.test('Testing profile.created event with real webhook data');
      req.body = testData;
      await this.handleRaiselyWebhook(req, res);

    } catch (error) {
      res.status(500).json({ error: 'Test profile.created failed', message: error.message });
    }
  }

  /**
   * Test endpoint for profile.updated events
   */
  async testWebhookUpdated(req, res) {
    try {
      const testDataPath = path.join(__dirname, '../../test-data/profile-updated-webhook.json');
      
      if (!fs.existsSync(testDataPath)) {
        return res.status(400).json({ 
          error: 'Test data file not found', 
          message: 'Please create and populate test-data/profile-updated-webhook.json with real webhook data',
          path: testDataPath
        });
      }

      const testDataContent = fs.readFileSync(testDataPath, 'utf8');
      let testData;
      
      try {
        testData = JSON.parse(testDataContent);
      } catch (parseError) {
        return res.status(400).json({ 
          error: 'Invalid JSON in test data file', 
          message: 'Please check the JSON syntax in profile-updated-webhook.json',
          parseError: parseError.message
        });
      }

      if (!testData.data || !testData.data.data) {
        return res.status(400).json({ 
          error: 'Invalid test data structure', 
          message: 'Test data must have the structure: { data: { data: { ... } } }'
        });
      }

      Logger.test('Testing profile.updated event with real webhook data');
      req.body = testData;
      await this.handleRaiselyWebhook(req, res);

    } catch (error) {
      res.status(500).json({ error: 'Test profile.updated failed', message: error.message });
    }
  }

  /**
   * Test endpoint to manually trigger webhook processing (legacy - defaults to created)
   */
  async testWebhook(req, res) {
    try {
      Logger.test('Using legacy test endpoint - defaulting to profile.created');
      return this.testWebhookCreated(req, res);
    } catch (error) {
      res.status(500).json({ error: 'Test failed', message: error.message });
    }
  }
}

module.exports = new WebhookController();