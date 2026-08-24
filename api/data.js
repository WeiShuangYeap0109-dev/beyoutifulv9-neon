import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    // Vercel 现在已有 DATABASE_URL
    // 同时兼容之前代码使用的 POSTGRES_URL
    const connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (!connectionString) {
      return res.status(500).json({
        error: 'Database connection string is missing'
      });
    }

    const sql = neon(connectionString);

    // 建立资料表
    await sql`
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // 第一次使用时建立初始资料
    await sql`
      INSERT INTO app_state (id, data)
      VALUES (
        1,
        ${JSON.stringify({
          customers: [],
          appointments: [],
          orders: [],
          packages: [],
          usage: [],
          nextCustomer: 1
        })}::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `;

    // GET：读取资料
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT data
        FROM app_state
        WHERE id = 1
      `;

      return res.status(200).json(
        rows[0]?.data || {
          customers: [],
          appointments: [],
          orders: [],
          packages: [],
          usage: [],
          nextCustomer: 1
        }
      );
    }

    // PUT：保存资料
    if (req.method === 'PUT') {
      const data =
        typeof req.body === 'string'
          ? JSON.parse(req.body)
          : req.body;

      await sql`
        UPDATE app_state
        SET
          data = ${JSON.stringify(data)}::jsonb,
          updated_at = NOW()
        WHERE id = 1
      `;

      return res.status(200).json({ ok: true });
    }

    // DELETE：恢复初始资料
    if (req.method === 'DELETE') {
      const demo = {
        customers: [],
        appointments: [],
        orders: [],
        packages: [],
        usage: [],
        nextCustomer: 1
      };

      await sql`
        UPDATE app_state
        SET
          data = ${JSON.stringify(demo)}::jsonb,
          updated_at = NOW()
        WHERE id = 1
      `;

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET,PUT,DELETE');

    return res.status(405).json({
      error: 'Method not allowed'
    });

  } catch (e) {
    console.error(e);

    return res.status(500).json({
      error: e.message || 'Database error'
    });
  }
}
