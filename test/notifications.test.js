import test from 'node:test';
import assert from 'node:assert/strict';
import { emailConfigured, sendEmail } from '../server/notifications.js';

function withEnv(values, run) {
  const saved = { RESEND_API_KEY: process.env.RESEND_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  const restore = () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
  return Promise.resolve().then(run).finally(restore);
}

test('email is reported as not configured when the API key or sender is missing', async () => {
  await withEnv({ RESEND_API_KEY: undefined, EMAIL_FROM: undefined }, () => assert.equal(emailConfigured(), false));
  await withEnv({ RESEND_API_KEY: 'test-key', EMAIL_FROM: undefined }, () => assert.equal(emailConfigured(), false));
  await withEnv({ RESEND_API_KEY: undefined, EMAIL_FROM: 'sender@example.com' }, () => assert.equal(emailConfigured(), false));
});

test('email is reported as configured only when both API key and sender exist', async () => {
  await withEnv({ RESEND_API_KEY: 'test-key', EMAIL_FROM: 'sender@example.com' }, () => assert.equal(emailConfigured(), true));
});

test('sendEmail degrades gracefully when email is not configured', async () => {
  await withEnv({ RESEND_API_KEY: undefined, EMAIL_FROM: undefined }, async () => {
    const result = await sendEmail({ to: 'family@example.com', subject: 'Reminder', text: 'Dose due soon' });
    assert.equal(result.sent, false);
    assert.match(result.reason, /not configured/i);
  });
});

test('sendEmail refuses to send without a recipient address', async () => {
  await withEnv({ RESEND_API_KEY: 'test-key', EMAIL_FROM: 'sender@example.com' }, async () => {
    const result = await sendEmail({ subject: 'Reminder', text: 'Dose due soon' });
    assert.equal(result.sent, false);
    assert.match(result.reason, /recipient/i);
  });
});
