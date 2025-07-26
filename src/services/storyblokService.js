const StoryblokClient = require('storyblok-js-client');

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
      
      console.log(`🔍 Looking for event story: ${fullSlug}`);
      
      const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
        with_slug: fullSlug,
        story_only: 1
      });

      if (response.data.stories.length > 0) {
        console.log(`✅ Found event story: ${campaignName} (ID: ${response.data.stories[0].id})`);
        return response.data.stories[0];
      } else {
        console.log(`⚠️ Event story not found: ${campaignName} (${fullSlug})`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error finding event story ${campaignName}:`, error.message);
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

      // Try to find existing folder
      try {
        const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
          with_slug: fullSlug,
          story_only: 1
        });

        if (response.data.stories.length > 0) {
          console.log(`📁 Found existing campaign folder: ${campaignName}`);
          return response.data.stories[0];
        }
      } catch (error) {
        // Folder doesn't exist, we'll create it
        console.log(`📁 Campaign folder not found, will create: ${campaignName}`);
      }

      // Create the campaign folder
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

      const response = await this.client.post(`spaces/${this.spaceId}/stories`, folderData);
      console.log(`✅ Created campaign folder: ${campaignName}`);
      return response.data.story;

    } catch (error) {
      console.error(`❌ Error handling campaign folder for ${campaignName}:`, error);
      throw error;
    }
  }

  /**
   * Get the parent ID for the fundraisers folder
   */
  async getFundraisersParentId() {
    try {
      // Check if fundraisers folder exists
      const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
        starts_with: 'fundraisers',
        is_folder: 1
      });

      if (response.data.stories.length > 0) {
        console.log('✅ Found existing fundraisers folder with ID:', response.data.stories[0].id);
        return response.data.stories[0].id;
      }

      // Create fundraisers folder if it doesn't exist
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
      const fundraiserSlug = this.createSlug(fundraiserData.name);
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
        console.log(`� Updated fundraiser: ${fundraiserData.name}`);
      } else {
        // Create new fundraiser
        response = await this.client.post(`spaces/${this.spaceId}/stories`, storyData);
        console.log(`✅ Created fundraiser: ${fundraiserData.name}`);
      }

      // Publish the story if status is ACTIVE
      if (shouldPublish) {
        try {
          console.log(`🔄 Attempting to publish story ID: ${response.data.story.id}`);
          const publishResponse = await this.client.get(`spaces/${this.spaceId}/stories/${response.data.story.id}/publish`);
          console.log(`📢 Published fundraiser: ${fundraiserData.name} (status: ${fundraiserData.status})`);
        } catch (publishError) {
          console.error(`❌ Failed to publish fundraiser ${fundraiserData.name}:`, publishError.message);
          if (publishError.response) {
            console.error(`❌ Publish error details:`, publishError.response.data);
          }
        }
      } else {
        console.log(`📝 Saved as draft: ${fundraiserData.name} (status: ${fundraiserData.status})`);
      }

      return response.data.story;

    } catch (error) {
      console.error(`❌ Error creating/updating fundraiser ${fundraiserData.name}:`, error);
      throw error;
    }
  }

  /**
   * Sync fundraiser data from Raisely webhook to Storyblok
   */
  async syncFundraiser(raiselyData) {
    try {
      console.log(`🔄 Syncing fundraiser: ${raiselyData.name} from campaign: ${raiselyData.campaign}`);

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

      // Create or update fundraiser
      const fundraiser = await this.createOrUpdateFundraiser(fundraiserData, campaignFolder);

      console.log(`🎉 Successfully synced fundraiser: ${fundraiserData.name}`);
      return fundraiser;

    } catch (error) {
      console.error('❌ Error syncing fundraiser:', error);
      throw error;
    }
  }
}

module.exports = new StoryblokService();