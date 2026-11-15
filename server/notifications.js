export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail({ to, subject, text, html }) {
  if (!emailConfigured()) return { sent: false, reason: 'Email delivery is not configured. In-app notifications remain available.' };
  if (!to) return { sent: false, reason: 'Recipient email address is missing.' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, ...(html ? { html } : {}) }),
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Email provider returned ${response.status}`);
  return { sent: true, messageId: payload.id || null };
}
