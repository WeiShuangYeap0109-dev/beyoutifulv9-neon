import { neon } from '@neondatabase/serverless';

const initialData = {
  customers: [],
  appointments: [],
  orders: [],
  packages: [],
  usage: [],
  nextCustomer: 1
};

async function getSQL() {
  const urls = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL
  ].filter(Boolean);

  if (urls.length === 0) {
    throw new Error('Database connection string is missing');
  }

  let lastError;

  for (const url of urls) {
    try {
      const sql = neon(url);

      // 实际测试连接
      await sql`SELECT 1`;

      return sql;
    } catch (error) {
      lastError = error;
      console.error('Database connection failed, trying next URL...');
    }
  }

  throw lastError || new Error('Database connection failed');
}

export default async function handler(req, res) {
  try {
    const sql = await getSQL();

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
        ${JSON.stringify(initialData)}::jsonb
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
        rows[0]?.data || initialData
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
      await sql`
        UPDATE app_state
        SET
          data = ${JSON.stringify(initialData)}::jsonb,
          updated_at = NOW()
        WHERE id = 1
      `;

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');

    return res.status(405).json({
      error: 'Method not allowed'
    });

  } catch (e) {
    console.error('API ERROR:', e);

    return res.status(500).json({
      error: e.message || 'Database error'
    });
  }
}
