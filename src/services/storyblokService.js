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
    const campaignSlug = this.createSlug(campaignName);
    const fullSlug = `fundraisers/${campaignSlug}`;
    let folderData = null;

    try {
      // Try to find existing folder
      console.log(`🔍 Looking for existing campaign folder with slug: ${fullSlug}`);
      
      // Get parent ID first
      const parentId = await this.getFundraisersParentId();
      console.log(`🔍 Parent fundraisers folder ID: ${parentId}`);
      
      // List all folders under fundraisers to see what exists
      try {
        const allFolders = await this.client.get(`spaces/${this.spaceId}/stories`, {
          starts_with: parentId,
          is_folder: true
        });
        
        console.log(`🔍 All folders under fundraisers:`, {
          found: allFolders.data.stories.length,
          folders: allFolders.data.stories.map(s => ({ 
            id: s.id, 
            name: s.name, 
            slug: s.slug, 
            full_slug: s.full_slug 
          }))
        });
        
        // Look for existing folder by name or slug
        const existingFolder = allFolders.data.stories.find(s => 
          s.name === campaignName || 
          s.slug === campaignSlug ||
          s.full_slug === fullSlug
        );
        
        if (existingFolder) {
          console.log(`📁 Found existing campaign folder: ${campaignName}`, existingFolder);
          return existingFolder;
        }
      } catch (error) {
        console.log(`🔍 Failed to list folders:`, error.message);
      }
      
      // Also try the original search method
      try {
        const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
          with_slug: fullSlug,
          story_only: 1
        });

        console.log(`🔍 Direct slug search response:`, {
          found: response.data.stories.length,
          stories: response.data.stories.map(s => ({ id: s.id, name: s.name, slug: s.slug, full_slug: s.full_slug }))
        });

        if (response.data.stories.length > 0) {
          console.log(`📁 Found existing campaign folder via slug search: ${campaignName}`);
          return response.data.stories[0];
        }
      } catch (error) {
        console.log(`🔍 Direct slug search failed:`, error.message);
      }

      // Try different folder creation approaches
      console.log(`📁 Attempting to create campaign folder: ${campaignName}`);
      
      // Method 1: Minimal folder structure
      try {
        console.log(`🔧 Method 1: Minimal folder (no content)`);
        const minimalData = {
          story: {
            name: campaignName,
            slug: campaignSlug,
            parent_id: parentId,
            is_folder: true
          }
        };
        
        const response = await this.client.post(`spaces/${this.spaceId}/stories`, minimalData);
        console.log(`✅ Created campaign folder (minimal): ${campaignName}`);
        return response.data.story;
        
      } catch (minimalError) {
        console.log(`❌ Method 1 failed:`, {
          message: minimalError.message,
          status: minimalError.status,
          details: minimalError.response?.data
        });
      }
      
      // Method 2: With empty content
      try {
        console.log(`🔧 Method 2: With empty content`);
        const emptyContentData = {
          story: {
            name: campaignName,
            slug: campaignSlug,
            parent_id: parentId,
            is_folder: true,
            content: {}
          }
        };
        
        const response = await this.client.post(`spaces/${this.spaceId}/stories`, emptyContentData);
        console.log(`✅ Created campaign folder (empty content): ${campaignName}`);
        return response.data.story;
        
      } catch (emptyContentError) {
        console.log(`❌ Method 2 failed:`, {
          message: emptyContentError.message,
          status: emptyContentError.status,
          details: emptyContentError.response?.data
        });
      }
      
      // Method 3: Check what components are available first
      try {
        console.log(`🔧 Method 3: Getting available components`);
        const componentsResponse = await this.client.get(`spaces/${this.spaceId}/components`);
        console.log(`📋 Available components:`, componentsResponse.data.components.map(c => c.name));
        
        // Use the first available component
        const firstComponent = componentsResponse.data.components[0]?.name || 'page';
        console.log(`🔧 Using component: ${firstComponent}`);
        
        const componentData = {
          story: {
            name: campaignName,
            slug: campaignSlug,
            parent_id: parentId,
            is_folder: true,
            content: {
              component: firstComponent
            }
          }
        };
        
        const response = await this.client.post(`spaces/${this.spaceId}/stories`, componentData);
        console.log(`✅ Created campaign folder (with ${firstComponent}): ${campaignName}`);
        return response.data.story;
        
      } catch (componentError) {
        console.log(`❌ Method 3 failed:`, {
          message: componentError.message,
          status: componentError.status,
          details: componentError.response?.data
        });
      }
      
      // Method 4: Final attempt with detailed error logging
      console.log(`🔧 Method 4: Final attempt with detailed logging`);
      folderData = {
        story: {
          name: campaignName,
          slug: campaignSlug,
          parent_id: parentId,
          is_folder: true,
          content: {
            component: 'page'
          }
        }
      };
      
      console.log(`📁 Final attempt with data:`, JSON.stringify(folderData, null, 2));
      const response = await this.client.post(`spaces/${this.spaceId}/stories`, folderData);
      console.log(`✅ Created campaign folder (final attempt): ${campaignName}`);
      return response.data.story;

    } catch (error) {
      console.error(`❌ Error creating campaign folder for ${campaignName}:`, {
        message: error.message,
        status: error.status || error.response?.status,
        response: error.response?.data || 'No response data'
      });
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
      console.error(`❌ Error creating/updating fundraiser ${fundraiserData.name}:`, {
        message: error.message,
        status: error.status,
        response: error.response?.data || error.response,
        requestData: error.config?.data ? JSON.parse(error.config.data) : undefined
      });
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