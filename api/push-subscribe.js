import { neon } from '@neondatabase/serverless';

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is missing');
  return neon(url);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const sql = getSql();

    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        subscription JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const { username, subscription } =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body;

    if (!username || !subscription?.endpoint) {
      return res.status(400).json({
        error: 'username and subscription are required'
      });
    }

    await sql`
      INSERT INTO push_subscriptions
        (username, endpoint, subscription, updated_at)
      VALUES
        (
          ${username},
          ${subscription.endpoint},
          ${JSON.stringify(subscription)}::jsonb,
          NOW()
        )
      ON CONFLICT (endpoint)
      DO UPDATE SET
        username = EXCLUDED.username,
        subscription = EXCLUDED.subscription,
        updated_at = NOW()
    `;

    return res.json({ ok: true });

  } catch (error) {
    console.error('PUSH SUBSCRIBE ERROR:', error);

    return res.status(500).json({
      error: error.message || 'Push subscription failed'
    });
  }
}
