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
      
      Logger.step(`Looking for event: ${campaignName}`);
      
      const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
        with_slug: fullSlug,
        story_only: 1
      });

      if (response.data.stories.length > 0) {
        Logger.success(`Found: ${campaignName}`);
        return response.data.stories[0];
      } else {
        Logger.warning(`Event not found: ${campaignName}`);
        return null;
      }
    } catch (error) {
      Logger.error(`Event lookup failed: ${campaignName}`);
      return null;
    }
  }

  /**
   * Get or create the events folder
   */
  async getOrCreateEventsFolder() {
    try {
      // First do a broader search for any events folder
      const allStoriesResponse = await this.client.get(`spaces/${this.spaceId}/stories`, {
        per_page: 100
      });

      // Look for events folder in all stories
      const eventsFolder = allStoriesResponse.data.stories.find(story => 
        story.is_folder && (story.slug === 'events' || story.name.toLowerCase() === 'events')
      );

      if (eventsFolder) {
        return eventsFolder;
      }

      // Check if there's already an events story (not folder)
      const eventsStory = allStoriesResponse.data.stories.find(story => 
        !story.is_folder && story.slug === 'events'
      );

      if (eventsStory) {
        Logger.warning(`Events exists as story, not folder. Using it anyway.`);
        return eventsStory;
      }

      // Create events folder if it doesn't exist
      Logger.step(`Creating events folder`);
      const folderData = {
        story: {
          name: 'Events',
          slug: 'events',
          is_folder: true,
          published: true,
          content: {}
        }
      };

      const createResponse = await this.client.post(`spaces/${this.spaceId}/stories`, folderData);
      Logger.success(`Created events folder`);
      return createResponse.data.story;
    } catch (error) {
      Logger.error(`Failed to get/create events folder`, error.response?.data || error.message || error);
      return null;
    }
  }

  /**
   * Create an event story as a draft
   */
  async createEventStory(campaignName) {
    try {
      const campaignSlug = this.createSlug(campaignName);
      
      // Get or create the events folder
      const eventsFolder = await this.getOrCreateEventsFolder();
      if (!eventsFolder) {
        Logger.error(`Cannot create event without events folder`);
        return null;
      }
      
      Logger.step(`Creating event: ${campaignName}`);
      
      const storyData = {
        story: {
          name: campaignName,
          slug: campaignSlug,
          parent_id: eventsFolder.id,
          content: {
            component: 'event',
            title: campaignName,
            slug: campaignSlug
          },
          is_folder: false,
          published: false // Keep as draft
        }
      };

      const response = await this.client.post(`spaces/${this.spaceId}/stories`, storyData);
      Logger.success(`Created event: ${campaignName}`);
      return response.data.story;
    } catch (error) {
      Logger.error(`Failed to create event: ${campaignName}`, error);
      return null;
    }
  }

  /**
   * Get or create a campaign folder in Storyblok
   */
  async getOrCreateCampaignFolder(campaignName) {
    try {
      // Ensure fundraisers folder exists first and cache the parent ID
      const fundraisersParentId = await this.getFundraisersParentId();
      
      const campaignSlug = this.createSlug(campaignName);
      const fullSlug = `fundraisers/${campaignSlug}`;

      Logger.step(`Looking for campaign: ${campaignName}`);

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
          Logger.success(`Found: ${campaignName}`);
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
        Logger.success(`Found: ${campaignName}`);
        return exactMatch;
      }

      // Create the campaign folder if it truly doesn't exist
      Logger.warning(`Not found: ${campaignName}`);
      Logger.step(`Creating campaign: ${campaignName}`);
      const folderData = {
        story: {
          name: campaignName,
          slug: campaignSlug,
          parent_id: fundraisersParentId,
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
      Logger.step(`Looking for fundraisers folder`);
      
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
          Logger.success(`Found: fundraisers folder`);
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
        Logger.success(`Found: fundraisers folder`);
        return exactMatch.id;
      }

      // Only create if truly doesn't exist
      Logger.warning(`Not found: fundraisers folder`);
      Logger.step(`Creating fundraisers folder`);
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
      Logger.success(`Created: fundraisers folder`);
      return createResponse.data.story.id;

    } catch (error) {
      Logger.error('Error getting/creating fundraisers parent folder:', error);
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

      // Find or create the event story to reference
      let eventStory = await this.findEventStory(fundraiserData.campaign);
      if (!eventStory) {
        eventStory = await this.createEventStory(fundraiserData.campaign);
      }
      
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

      const actionText = existingFundraiser ? 'Updating' : 'Creating';
      const actionType = existingFundraiser ? 'updated' : 'created';
      Logger.step(`${actionText}: ${storyData.story.name}`);

      let response;
      if (existingFundraiser) {
        // Update existing fundraiser
        response = await this.client.put(
          `spaces/${this.spaceId}/stories/${existingFundraiser.id}`,
          storyData
        );
      } else {
        // Create new fundraiser
        response = await this.client.post(`spaces/${this.spaceId}/stories`, storyData);
      }

      const story = response.data.story;

      // Handle publishing/unpublishing based on status
      if (shouldPublish) {
        try {
          Logger.step('Publishing...');
          const publishResponse = await this.client.get(`spaces/${this.spaceId}/stories/${response.data.story.id}/publish`);
          Logger.info('Published');
        } catch (publishError) {
          Logger.error(`Failed to publish fundraiser ${fundraiserData.name}`, publishError.message);
          if (publishError.response) {
            Logger.error(`Publish error details`, publishError.response.data);
          }
        }
      } else if (fundraiserData.status === 'DRAFT' && existingFundraiser) {
        // If status is DRAFT (archived) and story exists, unpublish it
        try {
          Logger.step(`Unpublishing archived fundraiser: ${fundraiserData.name}`);
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

      return { story: response.data.story, action: actionType };

    } catch (error) {
      Logger.error(`Error creating/updating fundraiser ${fundraiserData.name}`, error);
      throw error;
    }
  }

  /**
   * Sync fundraiser data from Raisely webhook to Storyblok
   * @param {FundraiserData} raiselyData - The fundraiser data
   * @param {string} eventType - The webhook event type
   */
  async syncFundraiser(raiselyData, eventType = 'profile.updated') {
    try {
      Logger.section(`Syncing to Storyblok`);

      // Get or create campaign folder
      const campaignFolder = await this.getOrCreateCampaignFolder(raiselyData.campaign);

      // Use the original extracted data directly instead of reconstructing
      const fundraiserData = raiselyData;

      // For profile.created events, check if fundraiser already exists
      if (eventType === 'profile.created') {
        const fundraiserSlug = fundraiserData.path;
        const fullSlug = `fundraisers/${campaignFolder.slug}/${fundraiserSlug}`;
        
        Logger.step(`Looking for fundraiser: ${fundraiserData.name}`);
        
        const existingResponse = await this.client.get(`spaces/${this.spaceId}/stories`, {
          with_slug: fullSlug,
          story_only: 1
        });

        if (existingResponse.data.stories.length > 0) {
          Logger.success(`Found: ${fundraiserData.name}`);
          Logger.warning(`Fundraiser already exists, skipping creation`);
          return { story: existingResponse.data.stories[0], action: 'found' };
        } else {
          Logger.warning(`Fundraiser not found: ${fundraiserData.name}`);
        }
      }

      // Create or update fundraiser
      const result = await this.createOrUpdateFundraiser(fundraiserData, campaignFolder);

      return result;

    } catch (error) {
      Logger.error('Error syncing fundraiser', error);
      throw error;
    }
  }
}

module.exports = new StoryblokService();