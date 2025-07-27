# Troubleshooting Guide

## Common Issues

### 1. Team Members Not Added to Teams

**Symptoms:**
- Individual profiles are created successfully
- Team profiles exist
- But team stories don't show linked members

**Possible Causes:**
- Race conditions during bulk import
- Team stories not found
- Incorrect team references in data

**Debugging Steps:**

1. **Check team story exists:**
```bash
npm run bulk-import -- --type=teams --verbose
```

2. **Re-run individuals with verbose logging:**
```bash
npm run bulk-import -- --type=individuals --verbose --limit=5
```

3. **Check for specific team:**
```bash
npm run bulk-import -- --type=individuals --campaign="Campaign Name" --verbose
```

**Solutions:**
- Use sequential processing (already implemented)
- Re-run individuals import to fix missing links
- Check team names match exactly between individuals and teams

### 2. Duplicate Stories Created

**Symptoms:**
- Multiple stories for the same profile
- Slug conflicts in Storyblok

**Possible Causes:**
- Inconsistent slug generation
- Data source contains duplicates
- Interrupted import process

**Debugging Steps:**

1. **Preview import first:**
```bash
npm run bulk-import -- --dry-run --verbose
```

2. **Check for duplicates in source data:**
```bash
# Check sync/all-data.json for duplicate names/paths
```

3. **Limit import scope:**
```bash
npm run bulk-import -- --limit=10 --verbose
```

**Solutions:**
- Use `--dry-run` to preview before importing
- Clean up duplicate stories manually in Storyblok
- Ensure unique identifiers in source data

### 3. Content Type Issues

**Symptoms:**
- Stories lose their `fundraiser` component type
- Content appears empty or malformed

**Possible Causes:**
- Component type overwritten during updates
- Missing content type preservation

**Debugging Steps:**

1. **Check specific story in Storyblok admin**
2. **Review verbose logs for content updates**
3. **Test with single profile:**
```bash
npm run bulk-import -- --limit=1 --verbose
```

**Solutions:**
- The system now automatically preserves component types
- If affected, re-run import to fix component types
- Check Storyblok space has `fundraiser` content type

### 4. Webhook Not Receiving Data

**Symptoms:**
- Webhook endpoint returns 200 but no processing occurs
- No entries in logs

**Possible Causes:**
- Incorrect webhook URL in Raisely
- Missing or incorrect webhook secret
- Firewall blocking requests

**Debugging Steps:**

1. **Test webhook endpoint manually:**
```bash
curl -X POST http://localhost:3000/webhook/raisely \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

2. **Check webhook URL in Raisely admin**

3. **Test with sample data:**
```bash
npm run test-webhook
```

4. **Check server logs:**
```bash
VERBOSE=true npm start
```

**Solutions:**
- Verify webhook URL is publicly accessible
- Check `WEBHOOK_SECRET` environment variable
- Test with ngrok for local development

### 5. API Rate Limit Errors

**Symptoms:**
- 429 Too Many Requests errors
- Import process slows or fails

**Possible Causes:**
- Batch size too large
- Delay between batches too small
- Concurrent processes

**Debugging Steps:**

1. **Reduce batch size:**
```bash
npm run bulk-import -- --batch-size=2 --delay=2000
```

2. **Check current rate limit status in Storyblok**

**Solutions:**
- Increase delay between batches
- Reduce batch size
- Ensure no other processes are using API

### 6. Authentication Errors

**Symptoms:**
- 401 Unauthorized errors
- "Access token required" messages

**Possible Causes:**
- Missing or incorrect API tokens
- Token permissions insufficient
- Token expired

**Debugging Steps:**

1. **Verify environment variables:**
```bash
echo $STORYBLOK_ACCESS_TOKEN
echo $STORYBLOK_SPACE_ID
```

2. **Test API access manually:**
```bash
curl -H "Authorization: Token YOUR_TOKEN" \
  https://api.storyblok.com/v1/spaces/YOUR_SPACE_ID/stories
```

**Solutions:**
- Check `.env` file exists and is loaded
- Verify token has management access
- Generate new token if expired

## Debug Commands

### Verbose Logging

Enable detailed logging for any operation:

```bash
# Environment variable (affects all operations)
VERBOSE=true npm run bulk-import

# Command line flag (affects single operation)
npm run bulk-import -- --verbose
```

### Dry Run Mode

Preview operations without making changes:

```bash
npm run bulk-import -- --dry-run --verbose
```

### Filtered Testing

Test with specific subsets:

```bash
# Test specific campaign
npm run bulk-import -- --campaign="Test Campaign" --verbose

# Test specific type
npm run bulk-import -- --type=teams --verbose

# Test small sample
npm run bulk-import -- --limit=3 --verbose
```

### Webhook Testing

Test webhook processing:

```bash
# Test with sample data
npm run test-webhook

# Test specific webhook type
node scripts/test-webhook.js created
node scripts/test-webhook.js updated
```

## Performance Issues

### Slow Import Process

**Symptoms:**
- Import takes much longer than expected
- High memory usage

**Solutions:**
- Reduce batch size: `--batch-size=3`
- Increase delay: `--delay=2000`
- Process in smaller chunks: `--limit=50`

### Memory Issues

**Symptoms:**
- Process crashes with out-of-memory errors
- High memory usage during import

**Solutions:**
- Process data in smaller batches
- Restart process periodically for large imports
- Monitor memory usage with system tools

## Data Quality Issues

### Missing Required Fields

**Symptoms:**
- "Missing required field" errors
- Profiles skipped during import

**Solutions:**
- Check source data completeness
- Review validation rules in `src/types/fundraiser.js`
- Use verbose logging to identify specific issues

### Incorrect Amount Values

**Symptoms:**
- Fundraising amounts appear too high (e.g., £500 instead of £5)
- Inconsistent currency conversion

**Root Cause:**
Raisely stores amounts in the smallest currency unit (pence for GBP, cents for USD). The system now correctly converts these to the main currency unit.

**Examples:**
- 500 (pence) → £5.00 ✅
- 15000 (pence) → £150.00 ✅

**Debugging:**
```bash
# Check raw amounts in source data
grep -A5 -B5 '"total":\|"goal":' sync/all-data.json | head -20

# Test currency conversion
npm run bulk-import -- --limit=1 --verbose --dry-run
```

**Status:** ✅ Fixed in current version

### Incorrect Campaign Assignment

**Symptoms:**
- Profiles appear in wrong campaigns
- Campaign folders not created

**Solutions:**
- Verify campaign names in source data
- Check campaign name extraction logic
- Ensure consistent campaign naming

## Environment Issues

### Local Development

**Common Issues:**
- Port conflicts
- Environment variables not loaded
- File permissions

**Solutions:**
```bash
# Check port availability
lsof -i :3000

# Verify environment loading
node -e "console.log(process.env.STORYBLOK_ACCESS_TOKEN)"

# Check file permissions
ls -la .env
```

### Production Deployment

**Common Issues:**
- Environment variables not set
- Network connectivity
- Process management

**Solutions:**
- Verify all required environment variables
- Test API connectivity from production environment
- Use process managers like PM2 for reliability

## Getting Help

### Log Analysis

When reporting issues, include:
1. Full error messages
2. Relevant log output (with `--verbose`)
3. Environment details (Node.js version, OS)
4. Steps to reproduce

### Useful Debug Information

```bash
# System information
node --version
npm --version
cat package.json | grep version

# Environment check
env | grep STORYBLOK
env | grep RAISELY

# Process information
ps aux | grep node
```

### Test Data Generation

Create minimal test cases:

```bash
# Create test data file
echo '{"profiles": [{"name": "Test User", "type": "INDIVIDUAL"}]}' > test-data.json

# Test with minimal data
npm run bulk-import -- --limit=1 --verbose
```