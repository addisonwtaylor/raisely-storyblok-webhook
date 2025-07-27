#!/bin/bash

# Test webhook verification functionality
# This script tests various verification scenarios

PORT=${PORT:-3000}
URL="http://localhost:$PORT/webhook/raisely"

echo "Testing webhook verification functionality..."
echo "Server URL: $URL"
echo

# Test 1: GET request (common verification method)
echo "--- Test 1: GET request verification ---"
curl -X GET "$URL" -H "Content-Type: application/json" -w "\nStatus: %{http_code}\n\n"

# Test 2: POST with empty body (blank verification)
echo "--- Test 2: POST with empty body ---"
curl -X POST "$URL" -H "Content-Type: application/json" -d '{}' -w "\nStatus: %{http_code}\n\n"

# Test 3: POST with minimal non-webhook data
echo "--- Test 3: POST with irrelevant data ---"
curl -X POST "$URL" -H "Content-Type: application/json" -d '{"test": "value"}' -w "\nStatus: %{http_code}\n\n"

# Test 4: Valid webhook data (should process normally, not as verification)
echo "--- Test 4: Valid webhook data (should NOT be verification) ---"
curl -X POST "$URL" -H "Content-Type: application/json" -d '{
  "secret": "fZcuvJaU8Q",
  "data": {
    "type": "profile.created",
    "data": {
      "name": "Test User",
      "path": "test-user",
      "uuid": "123-456-789"
    }
  }
}' -w "\nStatus: %{http_code}\n\n"

echo "✅ All verification tests completed!"