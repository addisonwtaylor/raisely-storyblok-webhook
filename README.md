# Raisely to Storyblok Webhook Service

A Node.js webhook service that automatically syncs fundraiser profile data from Raisely to Storyblok, organizing them by campaign folders.

## Features

- ✅ **Real-time sync** - Processes Raisely webhooks for profile created/updated events
- ✅ **Smart publishing** - Auto-publishes active fundraisers, unpublishes archived ones
- ✅ **Campaign organization** - Automatically creates and organizes campaign folders
- ✅ **Error handling** - Comprehensive error handling with detailed logging
- ✅ **Test endpoints** - Built-in testing with real webhook data
- ✅ **Pretty logging** - Color-coded, timestamped logs for easy debugging

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file and add your credentials:

```bash
cp .env.example .env
```

Edit `.env` and add your Storyblok credentials:

```
STORYBLOK_MANAGEMENT_TOKEN=your_management_token_here
STORYBLOK_SPACE_ID=your_space_id_here
NODE_ENV=development
PORT=3000
```

### 3. Storyblok Content Type Setup

Create a content type called `fundraiser` in your Storyblok space with these fields:
- `name` (Text)
- `campaign` (Text)
- `description` (Textarea)
- `target_amount` (Number)
- `raised_amount` (Number)
- `profile_url` (Text)
- `raisely_id` (Text)
- `last_updated` (Text)

## Usage

### Development

Start the service in development mode:

```bash
npm run dev
```

The service will run on `http://localhost:3000`

### Production

Start the service in production mode:

```bash
npm start
```

For production deployment, set `PORT=8080` in your environment.

## Endpoints

### Production Endpoints

- **`POST /webhook/raisely`** - Main webhook endpoint for Raisely
- **`GET /health`** - Health check endpoint

### Development Endpoints (NODE_ENV=development only)

- **`POST /test/webhook/created`** - Test profile.created events
- **`POST /test/webhook/updated`** - Test profile.updated events

### Testing with Real Data

1. Populate test files with real webhook data:
   - `test-data/profile-created-webhook.json`
   - `test-data/profile-updated-webhook.json`

2. Run tests:
   ```bash
   # Test profile creation
   curl -X POST http://localhost:3000/test/webhook/created
   
   # Test profile updates
   curl -X POST http://localhost:3000/test/webhook/updated
   ```

## Webhook Configuration in Raisely

1. Go to your Raisely admin dashboard
2. Navigate to Settings > Webhooks
3. Add a new webhook with:
   - **URL**: `https://your-domain.com/webhook/raisely`
   - **Events**: Profile Created, Profile Updated
   - **Format**: JSON

## How It Works

### Data Flow

1. **Webhook Received**: Raisely sends profile data when a fundraiser is created/updated
2. **Data Extraction**: Service extracts key fundraiser information
3. **Campaign Folder**: Creates or finds the campaign folder in Storyblok
4. **Fundraiser Story**: Creates new or updates existing fundraiser story
5. **Success Response**: Returns confirmation to Raisely

### Folder Structure in Storyblok

```
/fundraisers/
├── campaign-1-slug/
│   ├── fundraiser-1-slug
│   └── fundraiser-2-slug
├── campaign-2-slug/
│   ├── fundraiser-3-slug
│   └── fundraiser-4-slug
└── ...
```

### Data Mapping

| Raisely Field | Storyblok Field | Notes |
|---------------|-----------------|-------|
| `name` | `name` | Fundraiser name |
| `campaign.name` | `campaign` | Campaign name |
| `description` | `description` | Fundraiser description |
| `target` | `target_amount` | Target amount (normalized) |
| `total` | `raised_amount` | Amount raised (normalized) |
| `url/path` | `profile_url` | Profile URL |
| `uuid/id` | `raisely_id` | Raisely unique ID |

## Error Handling

The service includes comprehensive error handling:
- Invalid webhook payloads
- Missing required fields
- Storyblok API errors
- Network timeouts
- Authentication failures

All errors are logged with timestamps and context.

## Enhanced Logging

The service uses color-coded, structured logging with timestamps:

- 🟢 **SUCCESS** - Operations completed successfully
- 🔵 **INFO** - General information  
- 🟡 **WARNING** - Non-critical issues
- 🔴 **ERROR** - Errors with stack traces
- 🟣 **TEST** - Test-related messages
- 🔵 **STORYBLOK** - Storyblok API operations
- 🟢 **WEBHOOK** - Webhook processing

### Example Log Output

```
─── Webhook Service ───
19:26:26 🚀 Running on port 3000
19:26:26 • Health: http://localhost:3000/health

─── Incoming Webhook ───
19:26:45 📨 Received request
19:26:45 📨 [profile.updated] Processing

─── Syncing Fundraiser ───
19:26:45 🔹 Addison Taylor (Sunderland City Runs)
19:26:45 � [SEARCH] Looking for campaign: Sunderland City Runs
19:26:46 ✓ Found campaign: Sunderland City Runs
19:26:46 ✓ Updated: Addison Taylor
19:26:46 ✓ Unpublished: Addison Taylor
19:26:46 ✓ Sync complete: Addison Taylor
```

## Development

### Project Structure

```
src/
├── controllers/
│   └── webhookController.js    # Webhook request handling
├── services/
│   └── storyblokService.js     # Storyblok API integration
├── utils/
│   └── logger.js               # Logging utilities
└── server.js                   # Express server setup
```

### Adding New Features

1. **New webhook events**: Extend `webhookController.js`
2. **Additional fields**: Update data extraction in `extractFundraiserData()`
3. **New Storyblok operations**: Add methods to `storyblokService.js`

## Deployment

### Environment Variables for Production

```
STORYBLOK_ACCESS_TOKEN=your_production_token
STORYBLOK_SPACE_ID=your_production_space_id
PORT=8080
NODE_ENV=production
```

### Recommended Deployment Platforms

- **Heroku**: Easy deployment with automatic SSL
- **Railway**: Simple Node.js hosting
- **DigitalOcean App Platform**: Managed containers
- **AWS Elastic Beanstalk**: Scalable hosting

## Troubleshooting

### Common Issues

1. **"Access token required"**: Check your `STORYBLOK_ACCESS_TOKEN` in `.env`
2. **"Space not found"**: Verify your `STORYBLOK_SPACE_ID`
3. **Webhook not receiving data**: Check Raisely webhook configuration
4. **Content type errors**: Ensure `fundraiser` content type exists in Storyblok

### Debug Mode

Set `NODE_ENV=development` for detailed error messages and request logging.

## License

MIT License - see LICENSE file for details.