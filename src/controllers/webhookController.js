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
      
      // Validate webhook secret if configured
      const secretValidation = this.validateWebhookSecret(req.body.secret);
      if (secretValidation.error) {
        return res.status(secretValidation.status).json(secretValidation.response);
      }
      
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
      
      // Check if this is a team profile
      if (WebhookController.isTeamProfile(profileData)) {
        Logger.info(`Processing team profile: ${profileData.name}`);
        
        // Extract and validate team data
        const teamData = WebhookController.extractTeamData(profileData);
        
        if (!teamData) {
          Logger.warning('Could not extract valid team data from webhook');
          return res.status(400).json({ 
            error: 'Invalid team data', 
            message: 'Required fields missing' 
          });
        }

        // Sync team to Storyblok
        const result = await storyblokService.syncTeam(teamData, eventType);

        if (result.action === 'created') {
          Logger.success(`Created team: ${teamData.name}`);
        } else if (result.action === 'updated') {
          Logger.success(`Updated team: ${teamData.name}`);
        }

        // Return success response for team
        return res.status(200).json({ 
          success: true, 
          message: 'Team synced successfully',
          team: teamData.name,
          campaign: teamData.campaign
        });
      }
      
      // Extract and validate fundraiser data (individual profiles)
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

      // Check if fundraiser is part of a team
      let teamData = null;
      if (profileData.parent && WebhookController.isTeamProfile(profileData.parent)) {
        teamData = {
          name: profileData.parent.name,
          path: profileData.parent.path
        };
        Logger.info(`Fundraiser is part of team: ${teamData.name}`);
      }

      // Sync to Storyblok, passing the event type and team data
      const result = await storyblokService.syncFundraiser(extractedData, eventType, teamData);

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
        campaign: extractedData.campaign,
        team: teamData?.name || null
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
   * Validate webhook secret
   */
  validateWebhookSecret(providedSecret) {
    const webhookSecret = process.env.RAISELY_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      return { error: false }; // No secret configured, skip validation
    }
    
    if (!providedSecret) {
      Logger.error('Webhook secret required but not provided');
      return {
        error: true,
        status: 401,
        response: { 
          error: 'Unauthorized', 
          message: 'Webhook secret required' 
        }
      };
    }
    
    if (providedSecret !== webhookSecret) {
      Logger.error('Invalid webhook secret provided');
      return {
        error: true,
        status: 403,
        response: { 
          error: 'Forbidden', 
          message: 'Invalid webhook secret' 
        }
      };
    }
    
    Logger.success('Webhook secret validated');
    return { error: false };
  }

  /**
   * Check if profile is a team (GROUP type with isCampaignProfile: false)
   */
  static isTeamProfile(profile) {
    return profile.type === 'GROUP' && profile.isCampaignProfile === false;
  }

  /**
   * Extract team data from Raisely profile
   */
  static extractTeamData(raiselyProfile) {
    try {
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

      // Extract campaign information
      let campaignName = 'Default Campaign';
      
      if (profile.campaign) {
        campaignName = profile.campaign.name || profile.campaign.title || profile.campaign;
      } else if (profile.campaignName) {
        campaignName = profile.campaignName;
      } else if (profile.parent) {
        // Find the actual campaign by traversing parent chain
        campaignName = WebhookController.findCampaignFromParent(profile.parent);
      } else if (profile.path) {
        // Extract campaign from path if available
        const pathParts = profile.path.split('/');
        if (pathParts.length > 1) {
          campaignName = pathParts[0];
        }
      }

      // Extract amounts (teams can also have goals and totals)
      const targetAmount = WebhookController.normalizeAmount(profile.goal || profile.target || profile.targetAmount || 0);
      const raisedAmount = WebhookController.normalizeAmount(profile.total || profile.raisedAmount || 0);

      // Build profile URL
      let profileUrl = '';
      if (profile.url) {
        profileUrl = profile.url;
      } else if (profile.campaign?.url && profile.path) {
        const baseUrl = profile.campaign.url.replace(/\/$/, '');
        profileUrl = `${baseUrl}/${profile.path}`;
      } else if (profile.path) {
        profileUrl = profile.path;
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
        status: profile.status || 'DRAFT'
      };

      return extractedData;

    } catch (error) {
      Logger.error('Error extracting team data', error);
      return null;
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
        // Find the actual campaign by traversing parent chain
        campaignName = WebhookController.findCampaignFromParent(profile.parent);
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

      // Build profile URL - prefer provided URL, otherwise construct from campaign URL if available
      let profileUrl = '';
      if (profile.url) {
        profileUrl = profile.url;
      } else if (profile.campaign?.url && profile.path) {
        // Use campaign URL to construct profile URL
        const baseUrl = profile.campaign.url.replace(/\/$/, ''); // Remove trailing slash
        profileUrl = `${baseUrl}/${profile.path}`;
      } else if (profile.path) {
        // Fallback: leave as relative path if no domain available
        profileUrl = profile.path;
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
   * Find the actual campaign by traversing parent hierarchy
   * Campaigns have isCampaignProfile: true, teams/groups have false
   */
  static findCampaignFromParent(parent) {
    if (!parent) {
      return 'Default Campaign';
    }
    
    // If this parent is the campaign profile, use its name
    if (parent.isCampaignProfile === true) {
      return parent.name;
    }
    
    // If this parent has a parent, traverse up the chain
    if (parent.parent) {
      return WebhookController.findCampaignFromParent(parent.parent);
    }
    
    // Fallback to the current parent name if we can't find a campaign
    return parent.name || 'Default Campaign';
  }

  /**
   * Normalize amount values (convert from pence/cents to main currency unit)
   * Raisely stores amounts in the smallest currency unit (e.g., pence for GBP, cents for USD)
   */
  static normalizeAmount(amount) {
    if (!amount || isNaN(amount)) return 0;
    
    // Convert from pence/cents to main currency unit (e.g., 500 pence → £5.00)
    return parseFloat((amount / 100).toFixed(2));
  }

  /**
   * Helper method to load and validate test data
   */
  async loadTestData(filename) {
    const testDataPath = path.join(__dirname, `../../test-data/${filename}`);
    
    if (!fs.existsSync(testDataPath)) {
      throw new Error(`Test data file not found: ${filename}`);
    }

    const testDataContent = fs.readFileSync(testDataPath, 'utf8');
    let testData;
    
    try {
      testData = JSON.parse(testDataContent);
    } catch (parseError) {
      throw new Error(`Invalid JSON in ${filename}: ${parseError.message}`);
    }

    if (!testData.data || !testData.data.data) {
      throw new Error(`Invalid test data structure in ${filename}. Must have: { data: { data: { ... } } }`);
    }

    return testData;
  }

  /**
   * Test endpoint for profile.created events
   */
  async testWebhookCreated(req, res) {
    try {
      const testData = await this.loadTestData('profile-created-webhook.json');
      Logger.test('Testing profile.created event with real webhook data');
      req.body = testData;
      await this.handleRaiselyWebhook(req, res);
    } catch (error) {
      res.status(400).json({ 
        error: 'Test profile.created failed', 
        message: error.message 
      });
    }
  }

  /**
   * Test endpoint for profile.updated events
   */
  async testWebhookUpdated(req, res) {
    try {
      const testData = await this.loadTestData('profile-updated-webhook.json');
      Logger.test('Testing profile.updated event with real webhook data');
      req.body = testData;
      await this.handleRaiselyWebhook(req, res);
    } catch (error) {
      res.status(400).json({ 
        error: 'Test profile.updated failed', 
        message: error.message 
      });
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