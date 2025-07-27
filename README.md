# Raisely to Storyblok Importer

A Node.js application that syncs fundraising profiles from Raisely to Storyblok CMS. Supports both bulk imports and real-time webhook synchronization.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Raisely     │───▶│   This System   │───▶│   Storyblok     │
│   (Source CMS)  │    │                 │    │ (Target CMS)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Local JSON    │
                       │   Data Files    │
                       └─────────────────┘
```

## ✨ Features

- ✅ **Real-time sync** - Processes Raisely webhooks instantly
- ✅ **Bulk import** - Import hundreds of profiles efficiently  
- ✅ **Team support** - Links individual fundraisers to teams
- ✅ **Race condition prevention** - Safe concurrent processing
- ✅ **Data preservation** - Never overwrites existing team members
- ✅ **Campaign organization** - Auto-creates folder structures
- ✅ **Flexible logging** - Concise by default, verbose when needed
- ✅ **Comprehensive testing** - Built-in test utilities

## 📁 Project Structure

```
├── src/
│   ├── controllers/
│   │   └── webhookController.js    # Handles incoming Raisely webhooks
│   ├── services/
│   │   └── storyblokService.js     # Core Storyblok API integration
│   ├── types/
│   │   └── fundraiser.js           # Data validation schemas
│   └── utils/
│       └── logger.js               # Logging utilities
├── scripts/
│   ├── bulk-import.js              # Bulk import from JSON files
│   ├── sync-all-data.js           # Fetch all data from Raisely
│   └── test-webhook.js            # Webhook testing utility
├── sync/
│   └── all-data.json              # Local data cache
├── server.js                      # Express server entry point
└── package.json
```

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- Raisely API access
- Storyblok space with Management API token

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file:

```env
# Storyblok Configuration
STORYBLOK_SPACE_ID=your_space_id
STORYBLOK_ACCESS_TOKEN=your_management_api_token

# Raisely Configuration (for data sync)
RAISELY_API_TOKEN=your_raisely_api_token

# Server Configuration
PORT=3000
WEBHOOK_SECRET=your_webhook_secret

# Logging (optional)
VERBOSE=false
NODE_ENV=development
```

## 📋 Usage

### Bulk Import

Import all profiles from local JSON data:

```bash
# Import everything (teams first, then individuals)
npm run bulk-import

# Import only teams
npm run bulk-import -- --type=teams

# Import only individuals
npm run bulk-import -- --type=individuals

# Dry run (preview without changes)
npm run bulk-import -- --dry-run

# Verbose logging
npm run bulk-import -- --verbose

# Import with filters
npm run bulk-import -- --type=individuals --campaign="Campaign Name" --limit=10
```

### Data Synchronization

Fetch fresh data from Raisely:

```bash
npm run sync-data
```

### Webhook Server

For real-time synchronization:

```bash
npm start
```

The webhook endpoint will be available at: `http://localhost:3000/webhook/raisely`

### Testing

Test webhook functionality:

```bash
npm run test-webhook
```

## 🔧 Configuration Options

### Bulk Import Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run, -n` | Preview mode (no changes) | false |
| `--verbose, -v` | Detailed logging | false |
| `--batch-size=N` | Profiles per batch | 5 |
| `--delay=N` | Delay between batches (ms) | 1000 |
| `--type=TYPE` | Filter: `individuals`, `teams`, or both | both |
| `--status=STATUS` | Filter by status: `ACTIVE`, `DRAFT`, etc. | all |
| `--campaign=NAME` | Filter by campaign name | all |
| `--limit=N` | Process only first N profiles | unlimited |

### Logging Levels

- **Default**: Shows progress, results, warnings, and errors
- **Verbose** (`--verbose` or `VERBOSE=true`): Shows detailed step-by-step information

## 🏗️ Storyblok Structure

The system creates this structure in Storyblok:

```
📁 fundraisers/
├── 📁 campaign-1/
│   ├── 📄 campaign-1 (campaign story)
│   ├── 📄 event-campaign-1 (event story)
│   ├── 📁 team/
│   │   ├── 📄 team-alpha (team story)
│   │   └── 📄 team-beta (team story)
│   ├── 📄 individual-1 (individual story)
│   └── 📄 individual-2 (individual story)
```

All stories use the `fundraiser` component with fields like `name`, `description`, `target_amount`, `raised_amount`, `campaign` (UUID reference), and `team` (array of member UUIDs for teams).

## 🔄 Key Features

### Race Condition Prevention
- **Sequential team processing**: Team members added one at a time
- **Fresh data fetching**: Always gets latest team state before updates
- **Data preservation**: Never overwrites existing team members

### Team Support
- Teams are processed before individuals
- Individuals are automatically linked to their teams
- Team membership is preserved during updates

## 🚨 Troubleshooting

### Quick Fixes

**Team members not added?**
```bash
npm run bulk-import -- --type=individuals --verbose
```

**Import seems broken?**
```bash
npm run bulk-import -- --dry-run --limit=5 --verbose
```

**Need to test webhooks?**
```bash
npm run test-webhook
```

## 📚 Documentation

- **[Architecture Guide](docs/ARCHITECTURE.md)** - System design and data flow
- **[API Reference](docs/API_REFERENCE.md)** - Method documentation and examples  
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🚀 Quick Commands

```bash
# Full import (teams first, then individuals)
npm run bulk-import

# Import with verbose logging
npm run bulk-import -- --verbose

# Test with dry run
npm run bulk-import -- --dry-run --limit=10

# Import only teams
npm run bulk-import -- --type=teams

# Import only individuals  
npm run bulk-import -- --type=individuals

# Start webhook server
npm start

# Fetch fresh data from Raisely
npm run sync-data
```

## 📄 License

MIT License