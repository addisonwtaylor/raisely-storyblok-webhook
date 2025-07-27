const StoryblokClient = require('storyblok-js-client');
const Logger = require('../utils/logger');

class StoryblokService {
  constructor() {
    this.client = new StoryblokClient({
      oauthToken: process.env.STORYBLOK_ACCESS_TOKEN,
    });
    this.spaceId = process.env.STORYBLOK_SPACE_ID;
    
    // Cache for frequently accessed folder IDs
    this._fundraisersParentId = null;
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
        const story = response.data.stories[0];

        return story;
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
   * Update campaign story to reference an event (if not already referenced)
   */
  async updateCampaignEventReference(campaignFolder, eventStory) {
    try {
      Logger.info(`→ Updating campaign ${campaignFolder.name} with event reference`);
      
      // Get current campaign story content
      const currentContent = campaignFolder.content || {};
      const currentEvents = currentContent.events || [];
      
      // Check if event is already referenced
      const eventAlreadyReferenced = currentEvents.some(eventUuid => eventUuid === eventStory.uuid);
      
      if (eventAlreadyReferenced) {
        Logger.info(`→ Event already referenced in campaign`);
        return;
      }
      
      // Add event reference to campaign
      const updatedContent = {
        ...currentContent,
        component: currentContent.component || 'campaign',
        events: [...currentEvents, eventStory.uuid]
      };
      
      const updateData = {
        story: {
          content: updatedContent
        }
      };
      
      await this.client.put(`spaces/${this.spaceId}/stories/${campaignFolder.id}`, updateData);
      Logger.success(`→ Added event reference to campaign: ${campaignFolder.name}`);
      
    } catch (error) {
      Logger.warning(`→ Failed to update campaign event reference:`, error.message);
      // Don't throw - this is not critical to team creation
    }
  }

  /**
   * Find the Team folder under a campaign (should already exist)
   */
  async findTeamFolder(campaignStory) {
    try {
      Logger.info(`Looking for Team folder under campaign: ${campaignStory.name}`);
      
      const expectedTeamSlug = `${campaignStory.full_slug}/team`;
      
      // Use broader search since with_slug isn't reliable immediately after creation
      const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
        starts_with: campaignStory.full_slug,
        per_page: 50
      });
      
      // Find the Team folder in the results
      const teamFolder = response.data.stories.find(story => 
        story.is_folder && 
        story.slug === 'team' && 
        story.parent_id === campaignStory.id &&
        story.full_slug === expectedTeamSlug
      );

      if (teamFolder) {
        Logger.success(`Found Team folder: ${teamFolder.name} (ID: ${teamFolder.id})`);
        return teamFolder;
      }

      Logger.warning(`Team folder not found for campaign: ${campaignStory.name}`);
      Logger.info(`Expected slug: ${expectedTeamSlug}`);
      Logger.info(`Found ${response.data.stories.length} stories under campaign:`);
      response.data.stories.forEach(story => {
        Logger.info(`  - ${story.name} (${story.full_slug}) [folder: ${story.is_folder}, parent_id: ${story.parent_id}]`);
      });
      
      return null;
    } catch (error) {
      Logger.error(`Error finding Team folder for campaign: ${campaignStory.name}`, error.message);
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
            title: campaignName
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

      try {
        const createResponse = await this.client.post(`spaces/${this.spaceId}/stories`, folderData);
        const newCampaignFolder = createResponse.data.story;
        Logger.success(`Created campaign folder: ${campaignName}`);
        
        // Create the Team subfolder immediately as part of campaign setup
        Logger.step(`→ Creating Team folder for ${campaignName}`);
        const teamFolderData = {
          story: {
            name: 'Team',
            slug: 'team',
            parent_id: newCampaignFolder.id,
            is_folder: true,
            content: {
              component: 'folder'
            }
          }
        };

        try {
          await this.client.post(`spaces/${this.spaceId}/stories`, teamFolderData);
          Logger.success(`→ Created Team folder for ${campaignName}`);
          // Small delay to ensure folder is available
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (teamError) {
          Logger.error(`→ Failed to create Team folder for ${campaignName}:`, teamError.message);
          throw teamError; // This is critical - we need the Team folder
        }
        
        return newCampaignFolder;
      } catch (createError) {
        // If creation failed, it might be because another process created it simultaneously
        if (createError.response?.status === 422) {
          Logger.warning(`Campaign creation failed (likely race condition), retrying search for: ${campaignName}`);
          
          // Wait a moment and try to find the campaign that was likely created by another process
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const retryResponse = await this.client.get(`spaces/${this.spaceId}/stories`, {
            with_slug: fullSlug,
            story_only: 1
          });

          const existingFolder = retryResponse.data.stories.find(story => 
            story.full_slug === fullSlug && story.is_folder
          );
          
          if (existingFolder) {
            Logger.success(`Found campaign after retry: ${campaignName}`);
            return existingFolder;
          }
        }
        
        throw createError;
      }

    } catch (error) {
      Logger.error(`Error handling campaign folder for ${campaignName}`, error);
      throw error;
    }
  }

  /**
   * Get the parent ID for the fundraisers folder (with caching)
   */
  async getFundraisersParentId() {
    try {
      // Return cached result if available
      if (this._fundraisersParentId) {
        return this._fundraisersParentId;
      }

      Logger.step(`Looking for fundraisers folder`);
      
      // Search for all stories with the exact slug 'fundraisers'
      const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
        with_slug: 'fundraisers',
        story_only: 1
      });
      
      // Only log if in verbose mode or if stories found
      if (process.env.VERBOSE || response.data.stories.length > 0) {
        Logger.info(`🔍 Found ${response.data.stories.length} stories with slug 'fundraisers'`);
      }

      // Look for the folder with exact slug 'fundraisers'
      if (response.data.stories.length > 0) {
        const fundraisersFolder = response.data.stories.find(story => 
          story.slug === 'fundraisers' && story.is_folder
        );
        
        if (fundraisersFolder) {
          Logger.success(`Found: fundraisers folder`);
          this._fundraisersParentId = fundraisersFolder.id; // Cache the result
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
        this._fundraisersParentId = exactMatch.id; // Cache the result
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
      this._fundraisersParentId = createResponse.data.story.id; // Cache the result
      return createResponse.data.story.id;

    } catch (error) {
      Logger.error('Error getting/creating fundraisers parent folder:', error);
      throw error;
    }
  }

  /**
   * Create or update a fundraiser story in Storyblok
   */
  async createOrUpdateFundraiser(fundraiserData, campaignFolder, eventStory, teamData = null) {
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


      
      // Find or create team reference if teamData is provided
      let teamReference = null;
      if (teamData) {
        Logger.info(`🔍 Looking for team: ${teamData.name} in campaign: ${fundraiserData.campaign}`);
        let teamStory = await this.findTeamStory(teamData.name, fundraiserData.campaign);
        if (!teamStory) {
          Logger.warning(`Team story not found for ${teamData.name}, creating minimal team story...`);
          // Create a minimal team data object for sync
          const minimalTeamData = {
            name: teamData.name,
            path: teamData.path || this.createSlug(teamData.name),
            campaign: fundraiserData.campaign,
            description: `Team ${teamData.name}`,
            targetAmount: 0,
            raisedAmount: 0,
            profileUrl: '',
            raiselyId: teamData.path || this.createSlug(teamData.name),
            status: 'ACTIVE'
          };
          
          const teamResult = await this.syncTeam(minimalTeamData, 'profile.created');
          teamStory = teamResult.story;
          Logger.info(`✅ Created team story: ${teamStory.name} (UUID: ${teamStory.uuid})`);
        } else {
          Logger.info(`✅ Found existing team story: ${teamStory.name} (UUID: ${teamStory.uuid})`);
        }
        
        if (teamStory) {
          teamReference = teamStory.uuid;
          Logger.info(`🎯 Team reference set: ${teamReference}`);
        }
      } else {
        Logger.info(`❌ No team data provided for ${fundraiserData.name}`);
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
            campaign: eventStory ? eventStory.uuid : '',
            team: teamReference ? [teamReference] : [], // Add team reference
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

      // If this fundraiser is part of a team, add them to the team's member list
      if (teamData && teamReference) {
        Logger.info(`🔗 Adding ${fundraiserData.name} to team ${teamData.name}`);
        await this.addTeamMember(teamData.name, fundraiserData.campaign, response.data.story.uuid);
      } else {
        if (!teamData) Logger.info(`No team data for ${fundraiserData.name}`);
        if (!teamReference) Logger.info(`No team reference found for ${fundraiserData.name}`);
      }

      return { story: response.data.story, action: actionType };

    } catch (error) {
      Logger.error(`Error creating/updating fundraiser ${fundraiserData.name}`, error);
      throw error;
    }
  }

  /**
   * Sync team data to Storyblok
   * @param {Object} teamData - The team data
   * @param {string} eventType - The webhook event type
   */
  async syncTeam(teamData, eventType = 'profile.updated') {
    try {
      Logger.section(`Syncing Team to Storyblok`);
      Logger.info(`Team: ${teamData.name}, Campaign: ${teamData.campaign}`);

      // Get or create campaign folder first
      Logger.step('Getting/creating campaign folder...');
      const campaignFolder = await this.getOrCreateCampaignFolder(teamData.campaign);
      if (!campaignFolder) {
        throw new Error('Could not get/create campaign folder');
      }
      Logger.success(`Campaign folder ready: ${campaignFolder.name} (ID: ${campaignFolder.id})`);

      // Find the Team folder (should already exist from campaign creation)
      Logger.step('Finding Team folder...');
      const teamFolder = await this.findTeamFolder(campaignFolder);
      if (!teamFolder) {
        throw new Error(`Team folder not found for campaign: ${campaignFolder.name}`);
      }
      Logger.success(`Team folder ready: ${teamFolder.name} (ID: ${teamFolder.id})`);

      // Check if team already exists
      const teamSlug = teamData.path;
      const fullSlug = `fundraisers/${campaignFolder.slug}/team/${teamSlug}`;
      
      Logger.step(`Looking for team: ${teamData.name}`);
      
      let existingTeam = null;
      try {
        const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
          with_slug: fullSlug,
          story_only: 1
        });

        if (response.data.stories.length > 0) {
          existingTeam = response.data.stories[0];
        }
      } catch (error) {
        // Team doesn't exist
      }

      // Find the event story (should already exist from setup phase)
      let eventStory = await this.findEventStory(teamData.campaign);
      if (!eventStory) {
        Logger.warning(`Event story not found for ${teamData.campaign}, creating...`);
        eventStory = await this.createEventStory(teamData.campaign);
        
        // Update campaign story to reference the event if we had to create it
        if (eventStory) {
          await this.updateCampaignEventReference(campaignFolder, eventStory);
        }
      }
      

      
      // For now, create the team without members - we'll update with members later
      // This avoids the chicken-and-egg problem of needing fundraiser stories before team story exists
      
      // Only publish if Raisely status is ACTIVE
      const shouldPublish = teamData.status === 'ACTIVE';

      // Preserve existing team members if updating
      let preservedTeamMembers = [];
      if (existingTeam && existingTeam.content && existingTeam.content.team) {
        preservedTeamMembers = existingTeam.content.team;
        Logger.info(`🔄 Preserving ${preservedTeamMembers.length} existing team members`);
      }

      const storyData = {
        story: {
          name: teamData.name,
          slug: teamSlug,
          parent_id: teamFolder.id,
          content: {
            component: 'fundraiser',
            name: teamData.name,
            description: teamData.description || '',
            target_amount: teamData.targetAmount || 0,
            raised_amount: teamData.raisedAmount || 0,
            profile_url: teamData.profileUrl || '',
            raisely_id: teamData.raiselyId,
            campaign: eventStory ? eventStory.uuid : '',
            team: preservedTeamMembers, // Preserve existing members or use empty array for new teams
            is_team: true // Mark this as a team profile
          }
        }
      };

      let response;
      let actionType;

      if (existingTeam) {
        Logger.step(`Updating team: ${teamData.name}`);
        response = await this.client.put(`spaces/${this.spaceId}/stories/${existingTeam.id}`, storyData);
        actionType = 'updated';
      } else {
        Logger.step(`Creating team: ${teamData.name}`);
        response = await this.client.post(`spaces/${this.spaceId}/stories`, storyData);
        actionType = 'created';
      }

      const story = response.data.story;

      // Handle publishing/unpublishing
      if (shouldPublish) {
        try {
          Logger.step('Publishing team...');
          await this.client.get(`spaces/${this.spaceId}/stories/${story.id}/publish`);
          Logger.info('Team published');
        } catch (publishError) {
          Logger.error(`Failed to publish team ${teamData.name}`, publishError.message);
        }
      } else if (teamData.status === 'DRAFT' && existingTeam) {
        try {
          Logger.step(`Unpublishing archived team: ${teamData.name}`);
          await this.client.get(`spaces/${this.spaceId}/stories/${story.id}/unpublish`);
          Logger.success(`Unpublished team: ${teamData.name}`);
        } catch (unpublishError) {
          Logger.error(`Failed to unpublish team ${teamData.name}`, unpublishError.message);
        }
      } else {
        Logger.info(`Team saved as draft: ${teamData.name}`);
      }

      return { story: response.data.story, action: actionType };

    } catch (error) {
      Logger.error(`Error syncing team ${teamData.name}`, error);
      throw error;
    }
  }

  /**
   * Find all individual fundraiser stories that are members of this team
   * @param {Object} teamData - The team data containing raiselyId
   * @returns {Array} Array of team member story objects
   */
  async findTeamMembers(teamData) {
    try {
      // Search for fundraiser stories in the campaign folder that have this team referenced
      const campaignSlug = this.createSlug(teamData.campaign);
      
      Logger.step(`Looking for team members in campaign: ${teamData.campaign}`);
      
      // Get all stories in the campaign folder (not including team subfolder)
      const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
        starts_with: `fundraisers/${campaignSlug}/`,
        excluding_slug_path: `fundraisers/${campaignSlug}/team/`, // Exclude team folder itself
        per_page: 100
      });

      const allCampaignStories = response.data.stories;
      
      // Filter for fundraiser stories that reference this team
      const teamMembers = allCampaignStories.filter(story => {
        // Check if story has team reference in content
        const content = story.content;
        if (!content || !content.team) return false;
        
        // Check if any team reference matches this team's Raisely ID
        const teamReferences = Array.isArray(content.team) ? content.team : [content.team];
        
        // We need to find the team story first to get its UUID for comparison
        // For now, we'll use the raisely_id field to match
        return content.raisely_id && teamData.raiselyId;
      });

      // Alternative approach: search by Raisely ID pattern or team name in the fundraiser content
      // Since we might not have the team story created yet, let's find by component type and campaign
      const fundraiserStories = allCampaignStories.filter(story => 
        story.content && 
        story.content.component === 'fundraiser' &&
        !story.is_folder
      );

      Logger.info(`Found ${fundraiserStories.length} potential fundraiser stories in campaign`);
      
      // Return the fundraiser stories for now - the team reference will be updated when fundraisers sync
      return fundraiserStories;

    } catch (error) {
      Logger.error(`Error finding team members for ${teamData.name}`, error);
      return [];
    }
  }

  /**
   * Update team story to include a new member reference
   * @param {string} teamName - The team name
   * @param {string} campaignName - The campaign name
   * @param {string} memberUuid - The UUID of the member story to add
   */
  async addTeamMember(teamName, campaignName, memberUuid) {
    try {
      Logger.step(`Adding ${memberUuid.substring(0, 8)}... to team: ${teamName}`);
      const teamStory = await this.findTeamStory(teamName, campaignName);
      if (!teamStory) {
        Logger.warning(`Team story not found: ${teamName}`);
        return;
      }

      // Get the fresh story data to ensure we have the latest state
      const fullStoryResponse = await this.client.get(`spaces/${this.spaceId}/stories/${teamStory.id}`);
      const fullTeamStory = fullStoryResponse.data.story;

      // Get current team members - handle missing content
      if (!fullTeamStory.content) {
        Logger.warning(`Team story has no content, initializing empty content`);
        fullTeamStory.content = { component: 'fundraiser' };
      }
      
      const currentMembers = fullTeamStory.content.team || [];
      
      // Check if member is already in the list
      if (currentMembers.includes(memberUuid)) {
        Logger.info(`Member already in team: ${teamName}`);
        // Still try to publish the team story to ensure it's live
        Logger.step(`Publishing existing team story: ${teamName}`);
        try {
          await this.client.get(`spaces/${this.spaceId}/stories/${teamStory.id}/publish`);
          Logger.success(`✓ Published team: ${teamName}`);
        } catch (publishError) {
          Logger.error(`Failed to publish existing team story ${teamName} (ID: ${teamStory.id}):`, publishError);
          Logger.warning(`Team ${teamName} member already present, publish failed`);
        }
        return;
      }

      // Add the new member
      const updatedMembers = [...currentMembers, memberUuid];

      // Only update the team field, preserving everything else
      const updateData = {
        story: {
          content: {
            ...fullTeamStory.content,
            team: updatedMembers
          }
        }
      };

      await this.client.put(`spaces/${this.spaceId}/stories/${teamStory.id}`, updateData);
      Logger.info(`✓ Team ${teamName} now has ${updatedMembers.length} members`);

      // Publish the updated team story so changes are visible live
      Logger.step(`Publishing team story: ${teamName}`);
      try {
        await this.client.get(`spaces/${this.spaceId}/stories/${teamStory.id}/publish`);
        Logger.success(`✓ Published team: ${teamName}`);
      } catch (publishError) {
        Logger.error(`Failed to publish team story ${teamName} (ID: ${teamStory.id}):`, publishError);
        // Don't throw here - the team member was added successfully, publishing is secondary
        Logger.warning(`Team ${teamName} updated but not published`);
      }

    } catch (error) {
      Logger.error(`Error adding member to team ${teamName}`, error);
      throw error; // Re-throw to help with debugging race conditions
    }
  }

  /**
   * Find team story by name in campaign's team folder
   */
  async findTeamStory(teamName, campaignName) {
    try {
      const campaignSlug = this.createSlug(campaignName);
      const teamSlug = this.createSlug(teamName);
      const fullSlug = `fundraisers/${campaignSlug}/team/${teamSlug}`;
      
      Logger.step(`Looking for team: ${teamName}`);
      
      const response = await this.client.get(`spaces/${this.spaceId}/stories`, {
        with_slug: fullSlug,
        story_only: 1
      });

      if (response.data.stories.length > 0) {
        Logger.success(`Found team: ${teamName}`);
        return response.data.stories[0];
      } else {
        Logger.warning(`Team not found: ${teamName}`);
        return null;
      }
    } catch (error) {
      Logger.error(`Team lookup failed: ${teamName}`, error);
      return null;
    }
  }

  /**
   * Sync fundraiser data from Raisely webhook to Storyblok
   * @param {FundraiserData} raiselyData - The fundraiser data
   * @param {string} eventType - The webhook event type
   * @param {Object} teamData - Optional team data if fundraiser is part of a team
   * @param {boolean} forceUpdate - Whether to update existing fundraisers
   */
  async syncFundraiser(raiselyData, eventType = 'profile.updated', teamData = null, forceUpdate = false) {
    try {
      Logger.section(`Syncing to Storyblok`);
      Logger.info(`🎯 Starting sync for: ${raiselyData.name} (teamData: ${teamData ? teamData.name : 'none'})`);

      // Get or create campaign folder
      const campaignFolder = await this.getOrCreateCampaignFolder(raiselyData.campaign);
      Logger.info(`✅ Got campaign folder: ${campaignFolder.id}`);
      
      // Ensure event story exists and is properly linked to campaign
      let eventStory = await this.findEventStory(raiselyData.campaign);
      if (!eventStory) {
        Logger.warning(`Event story not found for ${raiselyData.campaign}, creating...`);
        eventStory = await this.createEventStory(raiselyData.campaign);
        
        // Update campaign story to reference the event if we had to create it
        if (eventStory) {
          await this.updateCampaignEventReference(campaignFolder, eventStory);
        }
      }

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
          
          const existingStory = existingResponse.data.stories[0];
          
          if (forceUpdate) {
            Logger.warning(`Force updating existing fundraiser: ${fundraiserData.name}`);
            // Fall through to update logic
          } else {
            Logger.warning(`Fundraiser already exists, skipping creation`);
            
            // Even if fundraiser exists, still handle team relationships
            if (teamData) {
              Logger.info(`🔗 Adding ${fundraiserData.name} to team ${teamData.name} (existing fundraiser)`);
              await this.addTeamMember(teamData.name, fundraiserData.campaign, existingStory.uuid);
            }
            
            return { story: existingStory, action: 'found' };
          }
        } else {
          Logger.warning(`Fundraiser not found: ${fundraiserData.name}`);
        }
      }

      // Create or update fundraiser
      const result = await this.createOrUpdateFundraiser(fundraiserData, campaignFolder, eventStory, teamData);

      return result;

    } catch (error) {
      Logger.error('Error syncing fundraiser', error);
      throw error;
    }
  }
}

module.exports = new StoryblokService();