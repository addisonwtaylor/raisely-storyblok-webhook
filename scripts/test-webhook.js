const axios = require('axios');

// Sample Raisely webhook data structure for testing
const testWebhookData = {
  type: 'profile.created',
  data: {
    profile: {
      name: 'John Doe',
      campaign: {
        name: 'Christmas Fundraiser 2024'
      },
      description: 'Help me raise money for a great cause!',
      target: 100000, // $1000 in cents
      total: 25000,   // $250 in cents
      path: 'christmas-fundraiser-2024/john-doe',
      uuid: 'test-uuid-john-doe-123',
      url: 'https://your-raisely-domain.raisely.com/christmas-fundraiser-2024/john-doe'
    }
  }
};

async function testWebhook() {
  try {
    console.log('🧪 Testing webhook endpoint...');
    
    const response = await axios.post('http://localhost:3000/webhook/raisely', testWebhookData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Raisely-Webhook-Test/1.0'
      }
    });

    console.log('✅ Webhook test successful!');
    console.log('Response:', response.data);

  } catch (error) {
    console.error('❌ Webhook test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testWebhook();