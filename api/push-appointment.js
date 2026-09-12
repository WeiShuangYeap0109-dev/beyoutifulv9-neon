import { neon } from "@neondatabase/serverless";
import webpush from "web-push";

function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is missing");
  return neon(url);
}

function normalizeUsername(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function staffUsername(staff = "") {
  const key = normalizeUsername(staff);
  const map = {
    belle: "belle",
    jieyun: "jieyun",
    kelly: "kelly",
    teststaff: "test",
  };
  return map[key] || key;
}

function setupWebPush() {
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error("VAPID environment variables are missing");
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    setupWebPush();
    const sql = getSql();

    await sql` CREATE TABLE IF NOT EXISTS push_subscriptions ( id SERIAL PRIMARY KEY, username TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE, subscription JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW() ) `;

    const bodyData =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { action, customerName, service, date, time, staff } = bodyData;
    const targetUsername = staffUsername(staff);

    if (!targetUsername) {
      return res.status(400).json({ error: "staff is required" });
    }

    const title =
      action === "created"
        ? "🔔 新预约"
        : action === "updated"
        ? "🔔 预约已修改"
        : action === "cancelled"
        ? "🔔 预约已取消"
        : "🔔 预约通知";

    const message = [
      customerName ? `顾客：${customerName}` : "",
      date ? `日期：${date}` : "",
      time ? `时间：${time}` : "",
      service ? `服务：${service}` : "",
      staff ? `员工：${staff}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const payload = JSON.stringify({ title, body: message, url: "/", action });
    const rows = await sql` SELECT id, username, subscription FROM push_subscriptions WHERE LOWER(REPLACE(username, ' ', '')) = ${targetUsername} `;

    const results = [];
    for (const row of rows) {
      try {
        await webpush.sendNotification(row.subscription, payload);
        results.push({ username: row.username, ok: true });
      } catch (error) {
        console.error(`Push failed for ${row.username}:`, error);
        if (error.statusCode === 404 || error.statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE id = ${row.id}`;
        }
        results.push({
          username: row.username,
          ok: false,
          error: error.message || "send failed",
        });
      }
    }

    return res.json({
      ok: true,
      targetUsername,
      matchedSubscriptions: rows.length,
      results,
    });
  } catch (error) {
    console.error("APPOINTMENT PUSH ERROR:", error);
    return res
      .status(500)
      .json({ error: error.message || "Push notification failed" });
  }
}
