import { neon } from "@neondatabase/serverless";
// 与 app/services/executionLogs.ts 保持一致
const sql = neon(`${process.env.REMOTE_URL}`);

export const getExecutionLogs = async (current = 1) => {
  const promises = Promise.all([
    sql.query(`select count(*) from script_execution_logs;`),
    sql.query(
      `select * from script_execution_logs order by id desc offset ${
        (current - 1) * 10
      } limit 10;`,
    ),
  ]);
  const [[{ count }], rows] = await promises;
  const temp = rows.map((row) => ({
    ...row,
    execution_duration: JSON.stringify(row.execution_duration),
  }));
  return [count, temp];
};

export const getRedisCount = async () => {
  const redisUrl = `https://brief-kid-53738.upstash.io/get/${process.env.REDIS_KEY}`;
  const rr = await fetch(redisUrl, {
    headers: {
      Authorization: `Bearer ${process.env.REDIS_TOKEN}`,
    },
  });
  const { result } = await rr.json();
  return result;
};

// GET：支持 current 分页参数
export const GET = async (request) => {
  const url = new URL(request.url);
  const current = url.searchParams.get("current") || 1;
  const [count, rows] = await getExecutionLogs(+current);
  return new Response(JSON.stringify({ count, rows }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=UTF-8", via: "zkzk233" },
  });
};

// EdgeOne Node Function 入口
export const onRequestGet = async ({ request }) => GET(request);