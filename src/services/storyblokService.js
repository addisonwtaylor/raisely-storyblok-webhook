const StoryblokClient = require('storyblok-js-client');
const Logger = require('../utils/logger');

class StoryblokService {
  constructor() {
    this.client = new StoryblokClient({
      oauthToken: process.env.STORYBLOK_ACCESS_TOKEN,
    });
    this.spaceId = process.env.STORYBLOK_SPACE_ID;
  }

  /**
   * Create a slug from a string
   */
  createSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim('-'); // Remove leading/trailing hyphens
  }

  /**
   * Find event story by campaign name
   */
  async findEventStory(campaignName) {
    try {
      const campaignSlug = this.createSlug(campaignName);
      const fullSlug = `events/${campaignSlug}`;
      
      Logger.storyblok(`Looking for event story: ${fullSlug}`, 'SEARCH');
      
      const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
        with_slug: fullSlug,
        story_only: 1
      });

      if (response.data.stories.length > 0) {
        Logger.success(`Found event story: ${campaignName} (ID: ${response.data.stories[0].id})`);
        return response.data.stories[0];
      } else {
        Logger.warning(`Event story not found: ${campaignName} (${fullSlug})`);
        return null;
      }
    } catch (error) {
      Logger.error(`Error finding event story ${campaignName}`, error);
      return null;
    }
  }

  /**
   * Get or create a campaign folder in Storyblok
   */
  async getOrCreateCampaignFolder(campaignName) {
    try {
      const campaignSlug = this.createSlug(campaignName);
      const fullSlug = `fundraisers/${campaignSlug}`;

      Logger.storyblok(`Looking for campaign: ${campaignName}`, 'SEARCH');

      // Try to find existing folder with exact slug match
      const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
        with_slug: fullSlug,
        story_only: 1
      });

      if (response.data.stories.length > 0) {
        const existingFolder = response.data.stories.find(story => 
          story.full_slug === fullSlug && story.is_folder
        );
        
        if (existingFolder) {
          Logger.success(`Found campaign: ${campaignName}`);
          return existingFolder;
        }
      }

      // If not found, try broader search to be sure
      const broadResponse = await this.client.get(`spaces/${this.spaceId}/stories`, {
        per_page: 100,
        is_folder: 1
      });
      
      const exactMatch = broadResponse.data.stories.find(story => 
        story.full_slug === fullSlug && story.is_folder
      );
      
      if (exactMatch) {
        Logger.success(`Found campaign: ${campaignName}`);
        return exactMatch;
      }

      // Create the campaign folder if it truly doesn't exist
      console.log(`📁 Campaign folder not found, creating: ${campaignName}`);
      const folderData = {
        story: {
          name: campaignName,
          slug: campaignSlug,
          parent_id: await this.getFundraisersParentId(),
          is_folder: true,
          content: {
            component: 'folder'
          }
        }
      };

      const createResponse = await this.client.post(`spaces/${this.spaceId}/stories`, folderData);
      Logger.success(`Created campaign: ${campaignName}`);
      return createResponse.data.story;

    } catch (error) {
      Logger.error(`Error handling campaign folder for ${campaignName}`, error);
      throw error;
    }
  }

  /**
   * Get the parent ID for the fundraisers folder
   */
  async getFundraisersParentId() {
    try {
      // Search for all stories with the exact slug 'fundraisers'
      const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
        with_slug: 'fundraisers',
        story_only: 1
      });

      // Look for the folder with exact slug 'fundraisers'
      if (response.data.stories.length > 0) {
        const fundraisersFolder = response.data.stories.find(story => 
          story.slug === 'fundraisers' && story.is_folder
        );
        
        if (fundraisersFolder) {
          console.log('✅ Found existing fundraisers folder with ID:', fundraisersFolder.id);
          return fundraisersFolder.id;
        }
      }

      // If not found with exact slug, try broader search but filter more carefully
      const broadResponse = await this.client.get(`spaces/${this.spaceId}/stories`, {
        per_page: 100,
        is_folder: 1
      });
      
      // Find the root fundraisers folder (should have no parent in fundraisers path)
      const exactMatch = broadResponse.data.stories.find(story => 
        story.slug === 'fundraisers' && 
        story.is_folder &&
        story.full_slug === 'fundraisers' // This ensures it's the root folder, not a subfolder
      );
      
      if (exactMatch) {
        console.log('✅ Found existing fundraisers folder via broad search with ID:', exactMatch.id);
        return exactMatch.id;
      }

      // Only create if truly doesn't exist
      console.log('📁 Fundraisers folder not found, creating new one...');
      const folderData = {
        story: {
          name: 'Fundraisers',
          slug: 'fundraisers',
          is_folder: true,
          content: {
            component: 'folder'
          }
        }
      };

      const createResponse = await this.client.post(`spaces/${this.spaceId}/stories`, folderData);
      console.log('✅ Created fundraisers parent folder');
      return createResponse.data.story.id;

    } catch (error) {
      console.error('❌ Error getting/creating fundraisers parent folder:', error);
      throw error;
    }
  }

  /**
   * Create or update a fundraiser story in Storyblok
   */
  async createOrUpdateFundraiser(fundraiserData, campaignFolder) {
    try {
      // Use the path directly from Raisely data instead of slugifying the name
      const fundraiserSlug = fundraiserData.path;
      const fullSlug = `fundraisers/${campaignFolder.slug}/${fundraiserSlug}`;

      // Check if fundraiser already exists
      let existingFundraiser = null;
      try {
        const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
          with_slug: fullSlug,
          story_only: 1
        });

        if (response.data.stories.length > 0) {
          existingFundraiser = response.data.stories[0];
        }
      } catch (error) {
        // Fundraiser doesn't exist
      }

      // Find the event story to reference
      const eventStory = await this.findEventStory(fundraiserData.campaign);
      
      // Only publish if Raisely status is ACTIVE
      const shouldPublish = fundraiserData.status === 'ACTIVE';

      const storyData = {
        story: {
          name: fundraiserData.name,
          slug: fundraiserSlug,
          parent_id: campaignFolder.id,
          content: {
            component: 'fundraiser',
            name: fundraiserData.name,
            campaign: eventStory ? eventStory.uuid : null,
            description: fundraiserData.description || '',
            target_amount: fundraiserData.targetAmount || 0,
            raised_amount: fundraiserData.raisedAmount || 0,
            profile_url: fundraiserData.profileUrl || '',
            raisely_id: fundraiserData.raiselyId || '',

            last_updated: new Date().toISOString()
          }
        }
      };

      let response;
      if (existingFundraiser) {
        // Update existing fundraiser
        response = await this.client.put(
          `spaces/${this.spaceId}/stories/${existingFundraiser.id}`,
          storyData
        );
        Logger.success(`Updated: ${fundraiserData.name}`);
      } else {
        // Create new fundraiser
        response = await this.client.post(`spaces/${this.spaceId}/stories`, storyData);
        Logger.success(`Created: ${fundraiserData.name}`);
      }

      // Handle publishing/unpublishing based on status
      if (shouldPublish) {
        try {
          Logger.storyblok(`Attempting to publish story ID: ${response.data.story.id}`, 'PROCESSING');
          const publishResponse = await this.client.get(`spaces/${this.spaceId}/stories/${response.data.story.id}/publish`);
          Logger.success(`Published: ${fundraiserData.name}`);
        } catch (publishError) {
          Logger.error(`Failed to publish fundraiser ${fundraiserData.name}`, publishError.message);
          if (publishError.response) {
            Logger.error(`Publish error details`, publishError.response.data);
          }
        }
      } else if (fundraiserData.status === 'DRAFT' && existingFundraiser) {
        // If status is DRAFT (archived) and story exists, unpublish it
        try {
          Logger.storyblok(`Attempting to unpublish archived fundraiser: ${response.data.story.id}`, 'PROCESSING');
          const unpublishResponse = await this.client.get(`spaces/${this.spaceId}/stories/${response.data.story.id}/unpublish`);
          Logger.success(`Unpublished: ${fundraiserData.name}`);
        } catch (unpublishError) {
          Logger.error(`Failed to unpublish fundraiser ${fundraiserData.name}`, unpublishError.message);
          if (unpublishError.response) {
            Logger.error(`Unpublish error details`, unpublishError.response.data);
          }
        }
      } else {
        Logger.info(`Saved as draft: ${fundraiserData.name}`);
      }

      return response.data.story;

    } catch (error) {
      Logger.error(`Error creating/updating fundraiser ${fundraiserData.name}`, error);
      throw error;
    }
  }

  /**
   * Sync fundraiser data from Raisely webhook to Storyblok
   */
  async syncFundraiser(raiselyData, eventType = 'profile.updated') {
    try {
      Logger.section('Syncing Fundraiser');
      Logger.storyblok(`${raiselyData.name} (${raiselyData.campaign})`);

      // Get or create campaign folder
      const campaignFolder = await this.getOrCreateCampaignFolder(raiselyData.campaign);

      // Prepare fundraiser data
      const fundraiserData = {
        name: raiselyData.name,
        campaign: raiselyData.campaign,
        description: raiselyData.description,
        targetAmount: raiselyData.targetAmount,
        raisedAmount: raiselyData.raisedAmount,
        profileUrl: raiselyData.profileUrl,
        raiselyId: raiselyData.uuid || raiselyData.id,
        status: raiselyData.status
      };

      // For profile.created events, check if fundraiser already exists
      if (eventType === 'profile.created') {
        const fundraiserSlug = fundraiserData.path;
        const fullSlug = `fundraisers/${campaignFolder.slug}/${fundraiserSlug}`;
        
        Logger.storyblok(`Checking if fundraiser already exists: ${fullSlug}`, 'SEARCH');
        
        const existingResponse = await this.client.get(`spaces/${this.spaceId}/stories`, {
          with_slug: fullSlug,
          story_only: 1
        });

        if (existingResponse.data.stories.length > 0) {
          Logger.warning(`Fundraiser already exists, skipping creation: ${fundraiserData.name}`);
          return existingResponse.data.stories[0];
        }
      }

      // Create or update fundraiser
      const fundraiser = await this.createOrUpdateFundraiser(fundraiserData, campaignFolder);

      Logger.success(`Sync complete: ${fundraiserData.name}`);
      return fundraiser;

    } catch (error) {
      Logger.error('Error syncing fundraiser', error);
      throw error;
    }
  }
}

module.exports = new StoryblokService();