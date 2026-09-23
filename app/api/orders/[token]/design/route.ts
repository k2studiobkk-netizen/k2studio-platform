import { env } from "cloudflare:workers";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/i.test(token)) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const assetId = Number(url.searchParams.get("asset"));
  const kind = url.searchParams.get("kind") === "scale" ? "scale" : "mockup";
  const runtime = env as unknown as { DB: D1Database; ORDER_FILES: R2Bucket };
  const design = Number.isInteger(assetId) && assetId > 0
    ? await runtime.DB.prepare(`SELECT da.file_key AS selected_key,da.file_type AS selected_type
      FROM design_assets da
      JOIN design_versions d ON d.id=da.design_version_id
      JOIN orders o ON o.id=d.order_id
      WHERE da.id=? AND o.public_token=? AND d.status IN ('pending','approved','changes_requested')
      LIMIT 1`).bind(assetId, token).first<{ selected_key: string; selected_type: string }>()
    : await runtime.DB.prepare(`SELECT
      CASE WHEN ?='scale' THEN scale_file_key ELSE COALESCE(NULLIF(mockup_file_key,''),file_key) END AS selected_key,
      CASE WHEN ?='scale' THEN scale_file_type ELSE COALESCE(NULLIF(mockup_file_type,''),file_type) END AS selected_type
    FROM design_versions d JOIN orders o ON o.id=d.order_id
    WHERE o.public_token=? AND d.status IN ('pending','approved','changes_requested')
    ORDER BY d.version_no DESC LIMIT 1`)
    .bind(kind, kind, token)
    .first<{ selected_key: string; selected_type: string }>();
  if (!design?.selected_key) return new Response("Not found", { status: 404 });
  const object = await runtime.ORDER_FILES.get(design.selected_key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "content-type": design.selected_type || "image/png", "cache-control": "private, max-age=60", "x-content-type-options": "nosniff" } });
}
