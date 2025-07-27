# API Reference

## StoryblokService

### Core Methods

#### `syncFundraiser(fundraiserData, eventType, teamData)`

Syncs an individual fundraiser profile to Storyblok.

**Parameters:**
- `fundraiserData` (Object) - Fundraiser profile data
- `eventType` (String) - Event type: 'profile.created' or 'profile.updated'  
- `teamData` (Object|null) - Team information if fundraiser belongs to a team

**Returns:** `Promise<{action: string, story: Object}>`

**Example:**
```javascript
const result = await storyblokService.syncFundraiser({
  name: 'John Doe',
  campaign: 'Marathon 2024',
  targetAmount: 1000,
  raisedAmount: 250,
  // ... other fields
}, 'profile.created', {
  name: 'Team Alpha',
  path: 'team-alpha'
});

console.log(result.action); // 'created' or 'updated'
console.log(result.story.uuid); // Story UUID
```

#### `syncTeam(teamData, eventType)`

Syncs a team profile to Storyblok.

**Parameters:**
- `teamData` (Object) - Team profile data
- `eventType` (String) - Event type: 'profile.created' or 'profile.updated'

**Returns:** `Promise<{action: string, story: Object}>`

**Example:**
```javascript
const result = await storyblokService.syncTeam({
  name: 'Team Alpha',
  campaign: 'Marathon 2024',
  description: 'Our amazing team',
  // ... other fields
}, 'profile.created');
```

#### `addTeamMember(teamName, campaignName, memberUuid)`

Adds a team member to an existing team story.

**Parameters:**
- `teamName` (String) - Name of the team
- `campaignName` (String) - Campaign name
- `memberUuid` (String) - UUID of the member story to add

**Returns:** `Promise<void>`

**Example:**
```javascript
await storyblokService.addTeamMember(
  'Team Alpha',
  'Marathon 2024', 
  'abc123-def456-ghi789'
);
```

### Helper Methods

#### `findEventStory(campaignName)`

Finds the event story for a campaign.

**Parameters:**
- `campaignName` (String) - Campaign name

**Returns:** `Promise<Object|null>`

#### `findTeamStory(teamName, campaignName)`

Finds a team story by name within a campaign.

**Parameters:**
- `teamName` (String) - Team name
- `campaignName` (String) - Campaign name

**Returns:** `Promise<Object|null>`

#### `getOrCreateCampaignFolder(campaignName)`

Gets existing campaign folder or creates a new one.

**Parameters:**
- `campaignName` (String) - Campaign name

**Returns:** `Promise<Object>`

## WebhookController

### Main Methods

#### `handleRaiselyWebhook(req, res)`

Processes incoming Raisely webhooks.

**Parameters:**
- `req` (Express.Request) - HTTP request object
- `res` (Express.Response) - HTTP response object

**Returns:** `Promise<void>`

**Webhook Payload Example:**
```javascript
{
  "type": "profile.updated",
  "secret": "webhook_secret",
  "data": {
    "data": {
      "uuid": "abc123",
      "name": "John Doe",
      "campaign": {
        "name": "Marathon 2024"
      },
      "parent": { /* team data if applicable */ }
      // ... other fields
    }
  }
}
```

### Static Helper Methods

#### `isTeamProfile(profile)`

Determines if a profile represents a team.

**Parameters:**
- `profile` (Object) - Profile data

**Returns:** `Boolean`

**Logic:**
```javascript
return profile.type === 'GROUP' && profile.isCampaignProfile === false;
```

#### `extractFundraiserData(raiselyProfile)`

Extracts fundraiser data from Raisely profile.

**Parameters:**
- `raiselyProfile` (Object) - Raw Raisely profile data

**Returns:** `Object|null` - Extracted fundraiser data or null if invalid

#### `extractTeamData(raiselyProfile)`

Extracts team data from Raisely profile.

**Parameters:**
- `raiselyProfile` (Object) - Raw Raisely profile data

**Returns:** `Object|null` - Extracted team data or null if invalid

## Data Structures

### Fundraiser Data Structure

```javascript
{
  name: String,           // Required: Fundraiser name
  campaign: String,       // Required: Campaign name
  description: String,    // Optional: Profile description
  targetAmount: Number,   // Optional: Target amount (default: 0)
  raisedAmount: Number,   // Optional: Raised amount (default: 0)
  profileUrl: String,     // Optional: Raisely profile URL
  raiselyId: String,      // Required: Unique Raisely identifier
  status: String          // Optional: Profile status
}
```

### Team Data Structure

```javascript
{
  name: String,           // Required: Team name
  path: String,           // Required: Team slug/path
  campaign: String,       // Required: Campaign name
  description: String,    // Optional: Team description
  targetAmount: Number,   // Optional: Target amount (default: 0)
  raisedAmount: Number,   // Optional: Raised amount (default: 0)
  profileUrl: String,     // Optional: Raisely profile URL
  raiselyId: String,      // Required: Unique Raisely identifier
  status: String          // Optional: Team status
}
```

### Storyblok Content Structure

```javascript
{
  component: 'fundraiser', // Content type
  name: String,
  description: String,
  target_amount: Number,
  raised_amount: Number,
  profile_url: String,
  raisely_id: String,
  campaign: String,        // Event story UUID
  team: [String],          // Array of member UUIDs (teams only)
  is_team: Boolean         // Whether this is a team profile
}
```

## Error Handling

### Common Error Types

#### ValidationError
Thrown when required fields are missing or invalid.

```javascript
{
  name: 'ValidationError',
  message: 'Missing required field: name',
  field: 'name'
}
```

#### StoryblokAPIError
Thrown when Storyblok API calls fail.

```javascript
{
  name: 'StoryblokAPIError', 
  message: 'Failed to create story',
  statusCode: 422,
  response: { /* API response */ }
}
```

#### WebhookValidationError
Thrown when webhook data is invalid.

```javascript
{
  name: 'WebhookValidationError',
  message: 'Invalid webhook payload',
  payload: { /* received payload */ }
}
```

### Error Response Format

Webhook endpoints return structured error responses:

```javascript
{
  "success": false,
  "error": "ValidationError",
  "message": "Missing required field: name",
  "details": {
    "field": "name",
    "received": null
  }
}
```

## Rate Limiting

### API Rate Limits

Storyblok Management API has the following limits:
- **Requests per second**: 3
- **Requests per hour**: 1000

### Built-in Protection

The system implements rate limiting through:
- **Batch processing**: Configurable batch sizes
- **Inter-batch delays**: Configurable delays between batches
- **Sequential team processing**: Prevents concurrent team updates

## Authentication

### Required Tokens

#### Storyblok Management Token
- **Scope**: Full management access to space
- **Environment**: `STORYBLOK_ACCESS_TOKEN`
- **Usage**: All Storyblok API operations

#### Raisely API Token (Optional)
- **Scope**: Read access to profiles
- **Environment**: `RAISELY_API_TOKEN` 
- **Usage**: Data synchronization scripts only

#### Webhook Secret (Optional)
- **Environment**: `WEBHOOK_SECRET`
- **Usage**: Webhook payload validation

### Token Management

```javascript
// Validate required tokens on startup
if (!process.env.STORYBLOK_ACCESS_TOKEN) {
  throw new Error('STORYBLOK_ACCESS_TOKEN is required');
}

if (!process.env.STORYBLOK_SPACE_ID) {
  throw new Error('STORYBLOK_SPACE_ID is required');
}
```