# Documentation Index

This directory contains comprehensive documentation for the Raisely to Storyblok Importer.

## 📚 Available Documentation

### [Architecture Guide](ARCHITECTURE.md)
Detailed system design, data flow, and technical architecture including:
- Component relationships
- Data flow diagrams
- Race condition prevention
- Error handling strategies
- Performance considerations
- Security measures

### [API Reference](API_REFERENCE.md)
Complete API documentation including:
- Method signatures and parameters
- Return values and examples
- Data structures and schemas
- Error types and handling
- Authentication requirements
- Rate limiting information

### [Troubleshooting Guide](TROUBLESHOOTING.md)
Common issues and their solutions:
- Team members not linking properly
- Duplicate story creation
- Content type issues
- Webhook problems
- Performance issues
- Debug commands and techniques

## 🚀 Quick Reference

### Most Common Commands

```bash
# Standard bulk import
npm run bulk-import

# Debug problematic import
npm run bulk-import -- --dry-run --verbose --limit=5

# Fix team member links
npm run bulk-import -- --type=individuals --verbose

# Test webhook functionality
npm run test-webhook
```

### Key Environment Variables

```env
STORYBLOK_SPACE_ID=your_space_id
STORYBLOK_ACCESS_TOKEN=your_management_token
RAISELY_API_TOKEN=your_raisely_token  # For data sync
WEBHOOK_SECRET=your_webhook_secret    # For webhook validation
VERBOSE=true                          # For detailed logging
```

### Important Files

- `sync/all-data.json` - Local cache of Raisely data
- `src/services/storyblokService.js` - Core integration logic
- `scripts/bulk-import.js` - Bulk import functionality
- `src/controllers/webhookController.js` - Webhook handling

## 🔧 Development Workflow

1. **Initial Setup**: Follow README.md quick start
2. **Data Sync**: Run `npm run sync-data` to get fresh data
3. **Test Import**: Use `--dry-run --limit=5` to test
4. **Full Import**: Run bulk import after testing
5. **Webhook Setup**: Configure webhooks for real-time sync

## 🐛 When Things Go Wrong

1. **Check the logs**: Use `--verbose` flag
2. **Test in isolation**: Use `--limit=1` to test single profile
3. **Verify data**: Check `sync/all-data.json` contents
4. **Consult guides**: Review troubleshooting documentation
5. **Test webhooks**: Use `npm run test-webhook`

## 📞 Getting Help

When seeking help, please include:
- Full error messages
- Command used
- Relevant log output (with `--verbose`)
- Environment details (Node.js version, OS)
- Steps to reproduce the issue

## 🔄 Keeping Documentation Updated

When making changes to the system:
1. Update relevant documentation files
2. Add new error scenarios to troubleshooting guide
3. Update API reference for new methods
4. Add examples for new features