#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const storyblokService = require('../src/services/storyblokService');
const Logger = require('../src/utils/logger');
const { validateFundraiserData } = require('../src/types/fundraiser');

class BulkImporter {
  constructor() {
    this.stats = {
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };
    this.errors = [];
  }

  /**
   * Check if profile is a team (GROUP type with isCampaignProfile: false)
   */
  isTeamProfile(profile) {
    return profile.type === 'GROUP' && profile.isCampaignProfile === false;
  }

  /**
   * Extract team data from Raisely profile
   */
  extractTeamData(raiselyProfile) {
    try {
      // Required fields validation
      if (!raiselyProfile.name) {
        Logger.warning('Missing required field: name');
        return null;
      }

      if (!raiselyProfile.path) {
        Logger.warning('Missing required field: path (used for slug)');
        return null;
      }

      // Extract campaign information
      let campaignName = 'Default Campaign';
      
      if (raiselyProfile.campaign) {
        campaignName = raiselyProfile.campaign.name || raiselyProfile.campaign.title || raiselyProfile.campaign;
      } else if (raiselyProfile.campaignName) {
        campaignName = raiselyProfile.campaignName;
      } else if (raiselyProfile.parent) {
        // Find the actual campaign by traversing parent chain
        campaignName = this.findCampaignFromParent(raiselyProfile.parent);
      } else if (raiselyProfile.path) {
        // Extract campaign from path if available
        const pathParts = raiselyProfile.path.split('/');
        if (pathParts.length > 1) {
          campaignName = pathParts[0];
        }
      }

      // Extract amounts (teams can also have goals and totals)
      const targetAmount = this.normalizeAmount(raiselyProfile.goal || raiselyProfile.target || raiselyProfile.targetAmount || 0);
      const raisedAmount = this.normalizeAmount(raiselyProfile.total || raiselyProfile.raisedAmount || 0);

      // Build profile URL
      let profileUrl = '';
      if (raiselyProfile.url) {
        profileUrl = raiselyProfile.url;
      } else if (raiselyProfile.campaign?.url && raiselyProfile.path) {
        const baseUrl = raiselyProfile.campaign.url.replace(/\/$/, '');
        profileUrl = `${baseUrl}/${raiselyProfile.path}`;
      } else if (raiselyProfile.path) {
        profileUrl = raiselyProfile.path;
      }

      const extractedData = {
        name: raiselyProfile.name,
        campaign: campaignName,
        description: raiselyProfile.description || raiselyProfile.story || '',
        targetAmount,
        raisedAmount,
        profileUrl,
        raiselyId: raiselyProfile.uuid || raiselyProfile.id || '',
        path: raiselyProfile.path || '',
        status: raiselyProfile.status || 'DRAFT'
      };

      return extractedData;

    } catch (error) {
      Logger.error('Error extracting team data', error);
      return null;
    }
  }

  /**
   * Extract fundraiser data from Raisely profile (adapted from webhook controller)
   */
  extractFundraiserData(raiselyProfile) {
    try {
      // Required fields validation
      if (!raiselyProfile.name) {
        Logger.warning('Missing required field: name');
        return null;
      }

      if (!raiselyProfile.path) {
        Logger.warning('Missing required field: path (used for slug)');
        return null;
      }

      // Extract campaign information
      let campaignName = 'Default Campaign';
      
      if (raiselyProfile.campaign) {
        campaignName = raiselyProfile.campaign.name || raiselyProfile.campaign.title || raiselyProfile.campaign;
      } else if (raiselyProfile.campaignName) {
        campaignName = raiselyProfile.campaignName;
      } else if (raiselyProfile.parent) {
        // Find the actual campaign by traversing parent chain
        campaignName = this.findCampaignFromParent(raiselyProfile.parent);
      } else if (raiselyProfile.path) {
        // Extract campaign from path if available
        const pathParts = raiselyProfile.path.split('/');
        if (pathParts.length > 1) {
          campaignName = pathParts[0];
        }
      }

      // Extract amounts (handle both cents and dollar amounts)
      const targetAmount = this.normalizeAmount(raiselyProfile.goal || raiselyProfile.target || raiselyProfile.targetAmount || 0);
      const raisedAmount = this.normalizeAmount(raiselyProfile.total || raiselyProfile.raisedAmount || 0);

      // Build profile URL - prefer provided URL, otherwise construct from campaign URL if available
      let profileUrl = '';
      if (raiselyProfile.url) {
        profileUrl = raiselyProfile.url;
      } else if (raiselyProfile.campaign?.url && raiselyProfile.path) {
        // Use campaign URL to construct profile URL
        const baseUrl = raiselyProfile.campaign.url.replace(/\/$/, ''); // Remove trailing slash
        profileUrl = `${baseUrl}/${raiselyProfile.path}`;
      } else if (raiselyProfile.path) {
        // Fallback: leave as relative path if no domain available
        profileUrl = raiselyProfile.path;
      }

      const extractedData = {
        name: raiselyProfile.name,
        campaign: campaignName,
        description: raiselyProfile.description || raiselyProfile.story || '',
        targetAmount,
        raisedAmount,
        profileUrl,
        raiselyId: raiselyProfile.uuid || raiselyProfile.id || '',
        path: raiselyProfile.path || '',
        status: raiselyProfile.status || 'DRAFT'
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
  findCampaignFromParent(parent) {
    if (!parent) {
      return 'Default Campaign';
    }
    
    // If this parent is the campaign profile, use its name
    if (parent.isCampaignProfile === true) {
      return parent.name;
    }
    
    // If this parent has a parent, traverse up the chain
    if (parent.parent) {
      return this.findCampaignFromParent(parent.parent);
    }
    
    // Fallback to the current parent name if we can't find a campaign
    return parent.name || 'Default Campaign';
  }

  /**
   * Normalize amount values (convert from pence/cents to main currency unit)
   * Raisely stores amounts in the smallest currency unit (e.g., pence for GBP, cents for USD)
   */
  normalizeAmount(amount) {
    if (!amount || isNaN(amount)) return 0;
    
    // Convert from pence/cents to main currency unit (e.g., 500 pence → £5.00)
    return parseFloat((amount / 100).toFixed(2));
  }

  /**
   * Load profiles from JSON file
   */
  loadProfiles() {
    const dataPath = path.join(__dirname, '../sync/all-data.json');
    
    if (!fs.existsSync(dataPath)) {
      throw new Error(`Data file not found: ${dataPath}`);
    }

    Logger.info('Loading profiles from all-data.json...');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(rawData);
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid data format. Expected { data: [...] }');
    }

    this.stats.total = data.data.length;
    Logger.success(`Loaded ${this.stats.total} profiles`);
    
    return data.data;
  }

  /**
   * Setup campaign folders for profiles (teams or individuals)
   */
  async setupCampaignFolders(profiles) {
    Logger.section('Setting up Campaign Folders');
    
    // Extract unique campaigns from profiles
    const campaigns = new Set();
    profiles.forEach(profile => {
      let campaignName = null;
      
      if (this.isTeamProfile(profile)) {
        const teamData = this.extractTeamData(profile);
        campaignName = teamData ? teamData.campaign : null;
      } else {
        const fundraiserData = this.extractFundraiserData(profile);
        campaignName = fundraiserData ? fundraiserData.campaign : null;
      }
      
      if (campaignName) {
        campaigns.add(campaignName);
      }
    });
    
    const uniqueCampaigns = Array.from(campaigns);
    Logger.info(`Found ${uniqueCampaigns.length} unique campaigns: ${uniqueCampaigns.join(', ')}`);
    Logger.space();
    
    // Create campaign folders and events sequentially to avoid race conditions  
    for (const campaignName of uniqueCampaigns) {
      try {
        Logger.step(`Setting up: ${campaignName}`);
        
        // Create campaign folder with Team subfolder
        const campaignFolder = await storyblokService.getOrCreateCampaignFolder(campaignName);
        if (!campaignFolder) {
          Logger.error(`✗ Failed to create campaign folder: ${campaignName}`);
          continue;
        }
        
        // Create/find event page for this campaign
        Logger.step(`→ Setting up event: ${campaignName}`);
        let eventStory = await storyblokService.findEventStory(campaignName);
        if (!eventStory) {
          eventStory = await storyblokService.createEventStory(campaignName);
        }
        
        if (eventStory) {
          Logger.success(`→ Event ready: ${campaignName}`);
          
          // Update campaign to reference the event
          await storyblokService.updateCampaignEventReference(campaignFolder, eventStory);
        } else {
          Logger.warning(`→ Event setup failed: ${campaignName}`);
        }
        
        Logger.success(`✓ Complete: ${campaignName} (Campaign ID: ${campaignFolder.id})`);
        
      } catch (error) {
        Logger.error(`✗ Error setting up ${campaignName}:`, error.message);
      }
    }
    
    Logger.success(`Campaign setup complete`);
  }

  /**
   * Process a single profile
   */
  async processProfile(profile, options = {}) {
    const { dryRun = false, forceUpdate = false } = options;
    
    try {
      // Check if this is a team profile
      if (this.isTeamProfile(profile)) {
        Logger.info(`Processing team: ${profile.name}`);
        
        // Extract team data
        const teamData = this.extractTeamData(profile);
        
        if (!teamData) {
          Logger.warning(`Skipping team: ${profile.name || profile.path || 'Unknown'} - Could not extract data`);
          this.stats.skipped++;
          return;
        }

        if (dryRun) {
          Logger.info(`[DRY RUN] Would process team: ${teamData.name} → ${teamData.campaign}`);
          this.stats.processed++;
          return;
        }

        // Sync team to Storyblok
        const result = await storyblokService.syncTeam(teamData, 'profile.created');

        if (result.action === 'created') {
          Logger.success(`✓ Created team: ${teamData.name}`);
          this.stats.created++;
        } else if (result.action === 'updated') {
          Logger.success(`✓ Updated team: ${teamData.name}`);
          this.stats.updated++;
        }

        this.stats.processed++;
        return;
      }
      
      // Extract fundraiser data (individual profiles)
      const extractedData = this.extractFundraiserData(profile);
      
      if (!extractedData) {
        Logger.warning(`Skipping profile: ${profile.name || profile.path || 'Unknown'} - Could not extract data`);
        this.stats.skipped++;
        return;
      }

      // Validate the data
      const validatedData = validateFundraiserData(extractedData);
      if (!validatedData) {
        Logger.warning(`Skipping profile: ${extractedData.name} - Failed validation`);
        this.stats.skipped++;
        return;
      }

      if (dryRun) {
        const teamText = profile.parent && this.isTeamProfile(profile.parent) ? ` (Team: ${profile.parent.name})` : '';
        Logger.info(`[DRY RUN] Would process: ${extractedData.name} → ${extractedData.campaign}${teamText}`);
        this.stats.processed++;
        return;
      }

      // Check if fundraiser is part of a team
      let teamData = null;
      if (profile.parent && this.isTeamProfile(profile.parent)) {
        teamData = {
          name: profile.parent.name,
          path: profile.parent.path
        };
        Logger.progress(`${extractedData.name} → ${extractedData.campaign} (Team: ${teamData.name})`);
      } else {
        Logger.progress(`${extractedData.name} → ${extractedData.campaign}`);
      }

      // Sync to Storyblok with team data
      const result = await storyblokService.syncFundraiser(extractedData, 'profile.created', teamData, forceUpdate);

      if (result.action === 'created') {
        Logger.success(`✓ Created: ${extractedData.name}`);
        this.stats.created++;
      } else if (result.action === 'updated') {
        Logger.success(`✓ Updated: ${extractedData.name}`);
        this.stats.updated++;
      }

      this.stats.processed++;

    } catch (error) {
      Logger.error(`✗ Failed to process profile: ${profile.name || profile.path || 'Unknown'}`, error);
      this.stats.errors++;
      this.errors.push({
        profile: profile.name || profile.path || 'Unknown',
        error: error.message
      });
    }
  }

  /**
   * Filter profiles based on criteria
   */
  filterProfiles(profiles, filters = {}) {
    let filtered = profiles;
    
    // Filter by type (individuals, teams, or both)
    if (filters.type) {
      if (filters.type === 'teams') {
        filtered = filtered.filter(p => this.isTeamProfile(p));
        Logger.info(`Filtered to teams only: ${filtered.length} profiles`);
      } else if (filters.type === 'individuals') {
        filtered = filtered.filter(p => !this.isTeamProfile(p));
        Logger.info(`Filtered to individuals only: ${filtered.length} profiles`);
      }
    }
    
    // Filter by status
    if (filters.status) {
      filtered = filtered.filter(p => p.status === filters.status);
      Logger.info(`Filtered by status '${filters.status}': ${filtered.length} profiles`);
    }
    
    // Filter by campaign
    if (filters.campaign) {
      filtered = filtered.filter(p => {
        const campaignName = this.findCampaignFromParent(p.parent) || p.campaign?.name || '';
        return campaignName.toLowerCase().includes(filters.campaign.toLowerCase());
      });
      Logger.info(`Filtered by campaign '${filters.campaign}': ${filtered.length} profiles`);
    }
    
    // Limit number of profiles
    if (filters.limit && filters.limit > 0) {
      filtered = filtered.slice(0, filters.limit);
      Logger.info(`Limited to first ${filters.limit} profiles`);
    }
    
    return filtered;
  }

  /**
   * Run the bulk import with progress tracking
   */
  async run(options = {}) {
    const { 
      dryRun = false, 
      batchSize = 5, 
      delay = 1000,
      filters = {}
    } = options;

    // Store options for access in other methods
    this.options = options;

    try {
      Logger.section('Bulk Import Starting');
      
      if (dryRun) {
        Logger.warning('DRY RUN MODE - No changes will be made to Storyblok');
      }

      // Load and filter profiles
      const allProfiles = this.loadProfiles();
      let profiles = this.filterProfiles(allProfiles, filters);
      
      if (profiles.length === 0) {
        Logger.warning('No profiles to process after filtering');
        return;
      }

      // If no type filter is specified, process teams first, then individuals
      if (!filters.type) {
        Logger.info('Processing teams first, then individuals for proper references');
        
        // Separate teams and individuals
        const teams = profiles.filter(p => this.isTeamProfile(p));
        const individuals = profiles.filter(p => !this.isTeamProfile(p));
        
        Logger.info(`Found ${teams.length} teams and ${individuals.length} individuals`);
        Logger.space();
        
        // Process teams first
        if (teams.length > 0) {
          Logger.info('🏆 Processing Teams First');
          
          // Pre-create campaign folders with Team subfolders
          if (!dryRun) {
            await this.setupCampaignFolders(teams);
            Logger.space();
          }
          
          await this.processBatch(teams, { dryRun, batchSize, delay });
          Logger.space();
        }
        
        // Then process individuals
        if (individuals.length > 0) {
          Logger.info('👤 Processing Individuals');
          
          // Pre-setup campaign folders for individuals (if not already done by teams)
          if (!dryRun) {
            await this.setupCampaignFolders(individuals);
            Logger.space();
          }
          
          await this.processBatch(individuals, { dryRun, batchSize, delay });
        }
      } else {
        // Process single type as specified
        
        // Setup campaign folders first for both teams and individuals
        if ((filters.type === 'teams' || filters.type === 'individuals') && !dryRun) {
          await this.setupCampaignFolders(profiles);
          Logger.space();
        }
        
        await this.processBatch(profiles, { dryRun, batchSize, delay });
      }

      // Final report
      this.printSummary();

    } catch (error) {
      Logger.error('Bulk import failed', error);
      process.exit(1);
    }
  }

  /**
   * Process a batch of profiles
   */
  async processBatch(profiles, options = {}) {
    const { dryRun = false, batchSize = 5, delay = 1000 } = options;
    
    Logger.summary(`Processing ${profiles.length} profiles in batches of ${batchSize}`);

    // Process in batches
    for (let i = 0; i < profiles.length; i += batchSize) {
      const batch = profiles.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(profiles.length / batchSize);
      
      Logger.section(`Batch ${batchNum}/${totalBatches}`);
      
      // Group profiles by team to avoid race conditions when updating team members
      const teamGroups = new Map();
      const individualsWithoutTeams = [];
      
      for (const profile of batch) {
        if (!this.isTeamProfile(profile) && profile.parent && this.isTeamProfile(profile.parent)) {
          // Individual with team
          const teamKey = `${profile.parent.name}-${profile.parent.path}`;
          if (!teamGroups.has(teamKey)) {
            teamGroups.set(teamKey, []);
          }
          teamGroups.get(teamKey).push(profile);
        } else {
          // Team or individual without team - can process in parallel
          individualsWithoutTeams.push(profile);
        }
      }
      
      // Process teams and individuals without teams in parallel (safe)
      if (individualsWithoutTeams.length > 0) {
        await Promise.all(
          individualsWithoutTeams.map(profile => this.processProfile(profile, { dryRun, forceUpdate: this.options.forceUpdate }))
        );
      }
      
      // Process each team's members sequentially to avoid race conditions
      for (const [teamKey, teamMembers] of teamGroups) {
        Logger.progress(`Processing ${teamMembers.length} members for team: ${teamMembers[0].parent.name}`);
        for (const member of teamMembers) {
          await this.processProfile(member, { dryRun, forceUpdate: this.options.forceUpdate });
        }
      }
      
      // Progress update - need to calculate against total profiles being processed
      const processed = Math.min((batchNum * batchSize), profiles.length);
      const progress = Math.round((processed / profiles.length) * 100);
      Logger.summary(`Progress: ${processed}/${profiles.length} (${progress}%)`);
      
      // Delay between batches to avoid rate limits
      if (i + batchSize < profiles.length && delay > 0) {
        Logger.info(`Waiting ${delay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Print final summary
   */
  printSummary() {
    Logger.section('Import Complete');
    Logger.success(`✓ Total Processed: ${this.stats.processed}`);
    Logger.success(`✓ Created: ${this.stats.created}`);
    Logger.success(`✓ Updated: ${this.stats.updated}`);
    
    if (this.stats.skipped > 0) {
      Logger.warning(`⚠ Skipped: ${this.stats.skipped}`);
    }
    
    if (this.stats.errors > 0) {
      Logger.error(`✗ Errors: ${this.stats.errors}`);
      Logger.space();
      Logger.error('Error Details:');
      this.errors.forEach(err => {
        Logger.error(`  • ${err.profile}: ${err.error}`);
      });
    }
    
    Logger.space();
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const importer = new BulkImporter();
  
  // Set verbose mode if requested
  const verbose = args.includes('--verbose') || args.includes('-v');
  if (verbose) {
    process.env.VERBOSE = 'true';
  }

  const options = {
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    forceUpdate: args.includes('--force-update') || args.includes('-f'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 5,
    delay: parseInt(args.find(arg => arg.startsWith('--delay='))?.split('=')[1]) || 1000,
    filters: {}
  };
  
  // Parse filters
  const typeFilter = args.find(arg => arg.startsWith('--type='))?.split('=')[1];
  if (typeFilter) options.filters.type = typeFilter;
  
  const statusFilter = args.find(arg => arg.startsWith('--status='))?.split('=')[1];
  if (statusFilter) options.filters.status = statusFilter;
  
  const campaignFilter = args.find(arg => arg.startsWith('--campaign='))?.split('=')[1];
  if (campaignFilter) options.filters.campaign = campaignFilter;
  
  const limitFilter = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1]);
  if (limitFilter) options.filters.limit = limitFilter;
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Bulk Import Script - Import all profiles from sync/all-data.json to Storyblok

Usage: node scripts/bulk-import.js [options]

Options:
  --dry-run, -n              Run without making changes (preview mode)
  --force-update, -f         Update existing profiles (fixes currency issues)
  --verbose, -v              Show detailed logging (default: concise)
  --batch-size=N             Process N profiles at a time (default: 5)
  --delay=N                  Wait N milliseconds between batches (default: 1000)
  --type=TYPE                Only import specific type: 'individuals', 'teams', or both (default: both)
  --status=STATUS            Only import profiles with specific status (ACTIVE, DRAFT, etc.)
  --campaign=NAME            Only import profiles containing campaign name
  --limit=N                  Only process first N profiles
  --help, -h                 Show this help message

Examples:
  node scripts/bulk-import.js --dry-run
  node scripts/bulk-import.js --type=teams --status=ACTIVE
  node scripts/bulk-import.js --type=individuals --campaign="Sunderland" --limit=10 --verbose
  node scripts/bulk-import.js --force-update --campaign="Sunderland"
  node scripts/bulk-import.js --status=ACTIVE --batch-size=3
    `);
    process.exit(0);
  }
  
  await importer.run(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    Logger.error('Script failed', error);
    process.exit(1);
  });
}

module.exports = BulkImporter;