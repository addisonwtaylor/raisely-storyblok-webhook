const storyblokService = require('../services/storyblokService');

class WebhookController {
  /**
   * Handle incoming Raisely webhook for profile created/updated events
   */
  async handleRaiselyWebhook(req, res) {
    try {
      console.log('📨 Received Raisely webhook:', req.headers['user-agent'] || 'Unknown');
      
      const webhookData = req.body;
      
      // Log the webhook type and basic info
      console.log('Webhook event:', webhookData.type || 'unknown');
      console.log('Webhook data keys:', Object.keys(webhookData));

      // Validate webhook data structure
      if (!webhookData.data) {
        console.warn('⚠️  No data field in webhook payload');
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
        console.warn('⚠️  Could not extract valid fundraiser data');
        return res.status(400).json({ 
          error: 'Invalid fundraiser data', 
          message: 'Required fields missing' 
        });
      }

      // Sync to Storyblok
      await storyblokService.syncFundraiser(extractedData);

      // Return success response
      res.status(200).json({ 
        success: true, 
        message: 'Fundraiser synced successfully',
        fundraiser: extractedData.name,
        campaign: extractedData.campaign
      });

    } catch (error) {
      console.error('❌ Webhook processing error:', error);
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
        console.warn('⚠️  Missing required field: name');
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

      console.log('📋 Extracted fundraiser data:', {
        name: extractedData.name,
        campaign: extractedData.campaign,
        targetAmount: extractedData.targetAmount,
        raisedAmount: extractedData.raisedAmount,
        status: extractedData.status
      });

      return extractedData;

    } catch (error) {
      console.error('❌ Error extracting fundraiser data:', error);
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
   * Test endpoint to manually trigger webhook processing
   */
  async testWebhook(req, res) {
    try {
      const testData = {
        type: 'profile.created',
        data: {
          profile: {
            name: 'Test Fundraiser',
            campaign: {
              name: 'Test Campaign'
            },
            description: 'This is a test fundraiser',
            target: 50000, // $500 in cents
            total: 15000,  // $150 in cents
            path: 'test-campaign/test-fundraiser',
            uuid: 'test-uuid-123'
          }
        }
      };

      req.body = testData;
      await WebhookController.handleRaiselyWebhook(req, res);

    } catch (error) {
      res.status(500).json({ error: 'Test failed', message: error.message });
    }
  }
}

module.exports = new WebhookController();