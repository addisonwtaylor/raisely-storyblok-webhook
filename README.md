# Raisely to Storyblok Webhook Service

A Node.js webhook service that automatically syncs fundraiser profile data from Raisely to Storyblok, organizing them by campaign folders.

## Features

- 🔄 Automatic sync of fundraiser profiles from Raisely webhooks
- 📁 Campaign-based folder organization in Storyblok
- ✅ Create new or update existing fundraiser stories
- 🛡️ Built-in security and error handling
- 📊 Comprehensive logging
- 🚀 Ready for both development and production

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
STORYBLOK_ACCESS_TOKEN=your_storyblok_access_token_here
STORYBLOK_SPACE_ID=your_storyblok_space_id_here
PORT=3000
NODE_ENV=development
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

### Webhook Endpoint
- **URL**: `POST /webhook/raisely`
- **Purpose**: Receives Raisely webhook data for profile created/updated events
- **Usage**: Configure this URL in your Raisely webhook settings

### Health Check
- **URL**: `GET /health`
- **Purpose**: Service health monitoring
- **Response**: Current service status and timestamp

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

## Logging

The service provides detailed logging:
- 📨 Webhook events received
- 📁 Folder creation/updates
- ✅ Successful operations
- ⚠️ Warnings for missing data
- ❌ Errors with full context

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