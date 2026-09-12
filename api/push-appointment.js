import { neon } from '@neondatabase/serverless';
import webpush from 'web-push';

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is missing');
  return neon(url);
}

function setupWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    setupWebPush();

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

    const {
      action,
      customerName,
      service,
      date,
      time,
      staff
    } = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

    const title =
      action === 'created'
        ? '🔔 新预约'
        : action === 'updated'
        ? '🔔 预约已修改'
        : action === 'cancelled'
        ? '🔔 预约已取消'
        : '🔔 预约通知';

    const body = [
      customerName ? `顾客：${customerName}` : '',
      date ? `日期：${date}` : '',
      time ? `时间：${time}` : '',
      service ? `服务：${service}` : '',
      staff ? `Staff：${staff}` : ''
    ]
      .filter(Boolean)
      .join('\n');

    const payload = JSON.stringify({
      title,
      body,
      url: '/',
      action
    });

    const rows = await sql`
      SELECT id, username, subscription
      FROM push_subscriptions
      WHERE username IN ('jieyun', 'kelly')
    `;

    const results = [];

    for (const row of rows) {
      try {
        await webpush.sendNotification(
          row.subscription,
          payload
        );

        results.push({
          username: row.username,
          ok: true
        });

      } catch (error) {
        console.error(
          `Push failed for ${row.username}:`,
          error
        );

        if (
          error.statusCode === 404 ||
          error.statusCode === 410
        ) {
          await sql`
            DELETE FROM push_subscriptions
            WHERE id = ${row.id}
          `;
        }

        results.push({
          username: row.username,
          ok: false
        });
      }
    }

    return res.json({
      ok: true,
      results
    });

  } catch (error) {
    console.error('APPOINTMENT PUSH ERROR:', error);

    return res.status(500).json({
      error: error.message || 'Push notification failed'
    });
  }
}
