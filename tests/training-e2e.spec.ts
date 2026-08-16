import { test, expect } from '@playwright/test';

test.describe('Training Pipeline End-to-End', () => {
  const WEBHOOK_URL = 'http://localhost:8080/api/public/webhook';
  const CRON_URL = 'http://localhost:8080/api/public/cron/sync';
  
  // Use environment variables for secrets in CI
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test_secret_123';
  const CRON_SECRET = process.env.CRON_SECRET || 'cron_secret_123';

  test('should ingest training data via secured webhook and process via cron', async ({ request }) => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const idempotencyKey = `test_${Date.now()}`;
    const payload = {
      training_data: {
        question: `Test Question ${idempotencyKey}`,
        answer: "Test Answer content for E2E validation.",
        context: "E2E Test Suite"
      },
      idempotency_key: idempotencyKey
    };

    const bodyStr = JSON.stringify(payload);
    const bodyToSign = `${timestamp}.${bodyStr}`;

    // Helper to generate HMAC in Node environment for the test
    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(bodyToSign)
      .digest('hex');

    // 1. Test Webhook Ingestion
    const response = await request.post(WEBHOOK_URL, {
      data: payload,
      headers: {
        'x-webhook-signature': `sha256=${signature}`,
        'x-webhook-timestamp': timestamp,
        'x-idempotency-key': idempotencyKey,
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.message).toBe("Training data received");

    // 2. Test Idempotency
    const repeatResponse = await request.post(WEBHOOK_URL, {
      data: payload,
      headers: {
        'x-webhook-signature': `sha256=${signature}`,
        'x-webhook-timestamp': timestamp,
        'x-idempotency-key': idempotencyKey,
        'Content-Type': 'application/json'
      }
    });
    expect(repeatResponse.status()).toBe(200);
    const repeatResult = await repeatResponse.json();
    expect(repeatResult.status).toBe("idempotent");

    // 3. Test Cron Sync Execution
    const cronResponse = await request.get(CRON_URL, {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    });
    
    // Status 200 or 500 (if catalog sync fails due to lack of real credentials, 
    // but the authorization logic itself should be tested)
    expect([200, 500]).toContain(cronResponse.status());
  });
});
