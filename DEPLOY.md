# Vercel Deployment Guide

## Prerequisites

1. Install Vercel CLI if you haven't already:
   ```bash
   npm i -g vercel
   ```

2. Make sure you have a Vercel account and are logged in:
   ```bash
   vercel login
   ```

## Environment Variables

You'll need to set these environment variables in your Vercel project:

### Required Variables
- `STORYBLOK_ACCESS_TOKEN` - Your Storyblok Management API token
- `STORYBLOK_SPACE_ID` - Your Storyblok space ID

### Optional Variables
- `NODE_ENV` - Set to `production` (automatically set by Vercel)

## Deployment Steps

### 1. First Time Deployment

```bash
# From project root
vercel

# Follow the prompts:
# ? Set up and deploy "~/code/raisely-importer"? [Y/n] y
# ? Which scope do you want to deploy to? [Select your account]
# ? Link to existing project? [N/y] n  
# ? What's your project's name? raisely-storyblok-webhook
# ? In which directory is your code located? ./
```

### 2. Set Environment Variables

```bash
# Set your Storyblok credentials
vercel env add STORYBLOK_ACCESS_TOKEN
vercel env add STORYBLOK_SPACE_ID

# Verify they're set
vercel env ls
```

### 3. Deploy

```bash
# Deploy to production
vercel --prod
```

## After Deployment

Your webhook will be available at:
```
https://your-project-name.vercel.app/webhook/raisely
```

### Test Endpoints (Development Only)
- `https://your-project-name.vercel.app/health` - Health check
- `https://your-project-name.vercel.app/test/webhook/created` - Test profile created
- `https://your-project-name.vercel.app/test/webhook/updated` - Test profile updated

## Configure Raisely Webhook

1. Go to your Raisely campaign settings
2. Find the "Webhooks" or "Integrations" section
3. Add a new webhook with URL: `https://your-project-name.vercel.app/webhook/raisely`
4. Select events: `profile.created`, `profile.updated`

## Monitoring

- View logs: `vercel logs`
- View function analytics in Vercel dashboard
- Monitor webhook calls in Raisely admin

## Troubleshooting

### Common Issues

1. **Environment variables not set**: Run `vercel env ls` to check
2. **Function timeout**: Vercel free tier has 10s timeout, Pro has 60s
3. **Cold starts**: First request after inactivity may be slower

### Debug Deployment

```bash
# View recent logs
vercel logs --follow

# Redeploy with logs
vercel --prod --debug
```

## Local Testing Before Deploy

```bash
# Test locally
yarn dev

# Test webhook endpoints
curl -X POST http://localhost:3000/test/webhook/updated
curl -X GET http://localhost:3000/health
```