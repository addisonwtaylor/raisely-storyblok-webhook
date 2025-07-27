#!/usr/bin/env node

/**
 * Test script to simulate webhook verification requests
 * This tests the new verification handling functionality
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

/**
 * Make a POST request to test the webhook verification
 */
function testVerificationRequest(body, description) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/webhook/raisely',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    console.log(`\n--- Testing: ${description} ---`);
    console.log('Request body:', JSON.stringify(body, null, 2));

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Response:', data);
        
        try {
          const parsedData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            body: parsedData,
            description
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data,
            description
          });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`Error with ${description}:`, err.message);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Make a GET request to test the webhook verification
 */
function testGetVerificationRequest(description) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: '/webhook/raisely',
      method: 'GET',
    };

    console.log(`\n--- Testing: ${description} ---`);

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Response:', data);
        
        try {
          const parsedData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            body: parsedData,
            description
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data,
            description
          });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`Error with ${description}:`, err.message);
      reject(err);
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing webhook verification functionality...');
  console.log(`Server URL: http://${HOST}:${PORT}/webhook/raisely`);

  try {
    // Test 1: GET request verification
    await testGetVerificationRequest('GET request verification');
    
    // Test 2: Completely empty object
    await testVerificationRequest({}, 'Empty object verification');
    
    // Test 3: Object with irrelevant data but no webhook structure
    await testVerificationRequest({ test: 'value' }, 'Object with irrelevant data verification');
    
    // Test 4: Valid webhook data (should NOT be treated as verification)
    await testVerificationRequest({
      secret: process.env.RAISELY_WEBHOOK_SECRET || 'fZcuvJaU8Q',
      data: {
        type: 'profile.created',
        data: {
          name: 'Test User',
          path: 'test-user',
          uuid: '123-456-789'
        }
      }
    }, 'Valid webhook data (should process normally)');

    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Check if server is running first
const healthCheck = http.get(`http://${HOST}:${PORT}/health`, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Server is running');
    runTests();
  } else {
    console.error('❌ Server health check failed');
    process.exit(1);
  }
}).on('error', (err) => {
  console.error('❌ Server is not running. Please start it first with: npm start');
  console.error('Error:', err.message);
  process.exit(1);
});