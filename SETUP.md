# Quick Setup Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Environment Variables

Copy the example file and add your Storyblok credentials:

```bash
cp .env.example .env
```

Edit `.env` and add:
- Your Storyblok access token
- Your Storyblok space ID

## 3. Create Storyblok Content Type

In your Storyblok space, create a new content type called `fundraiser` with these fields:

| Field Name | Field Type | Required |
|------------|------------|----------|
| name | Text | Yes |
| campaign | Text | Yes |
| description | Textarea | No |
| target_amount | Number | No |
| raised_amount | Number | No |
| profile_url | Text | No |
| raisely_id | Text | No |
| last_updated | Text | No |

## 4. Start the Service

For development:
```bash
npm run dev
```

The service will run on http://localhost:3000

## 5. Test the Webhook

Test with sample data:
```bash
npm run test:webhook
```

## 6. Configure Raisely Webhook

In your Raisely admin:
1. Go to Settings > Webhooks
2. Add webhook URL: `https://your-domain.com/webhook/raisely`
3. Select events: Profile Created, Profile Updated
4. Set format to JSON

## Endpoints

- **Webhook**: `POST /webhook/raisely`
- **Health Check**: `GET /health`
- **Test** (dev only): `POST /test/webhook`

## What Happens

1. Raisely sends webhook when fundraiser profile is created/updated
2. Service extracts key data (name, campaign, amounts, etc.)
3. Creates campaign folder in Storyblok if needed
4. Creates or updates fundraiser story in the campaign folder
5. Returns success response to Raisely

Your fundraisers will be organized like:
```
/fundraisers/
├── campaign-1/
│   ├── fundraiser-1
│   └── fundraiser-2
└── campaign-2/
    └── fundraiser-3
```