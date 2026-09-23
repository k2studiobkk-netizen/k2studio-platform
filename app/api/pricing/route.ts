import { env } from "cloudflare:workers";

export async function GET() {
  const db = (env as unknown as { DB: D1Database }).DB;
  const rows = (
    await db
      .prepare("SELECT hardware_code, price FROM hardware_prices")
      .all<{ hardware_code: string; price: string }>()
  ).results;
  return Response.json({
    hardwarePrices: Object.fromEntries(
      rows.map((row) => [row.hardware_code, Number(row.price)]),
    ),
  });
}
