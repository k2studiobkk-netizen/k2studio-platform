import { env } from "cloudflare:workers";

async function sameSecret(provided: string, expected: string) {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function GET(request: Request) {
  const runtime = env as unknown as { DB: D1Database; ORDER_FILES: R2Bucket; INTEGRATION_SECRET?: string };
  if (!await sameSecret(request.headers.get("x-integration-secret") || "", runtime.INTEGRATION_SECRET || "")) return new Response("Unauthorized", { status: 401 });
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key || key.length > 800) return new Response("Not found", { status: 404 });
  const file = await runtime.DB.prepare(`SELECT file_key,file_name,file_type FROM (
    SELECT artwork_key AS file_key,artwork_name AS file_name,artwork_type AS file_type FROM orders WHERE artwork_key<>''
    UNION ALL SELECT payment_slip_key,payment_slip_name,payment_slip_type FROM orders WHERE payment_slip_key<>''
    UNION ALL SELECT file_key,file_name,file_type FROM order_payment_receipts WHERE file_key<>''
    UNION ALL SELECT file_key,file_name,file_type FROM design_versions WHERE file_key<>''
    UNION ALL SELECT scale_file_key,scale_file_name,scale_file_type FROM design_versions WHERE scale_file_key<>''
    UNION ALL SELECT mockup_file_key,mockup_file_name,mockup_file_type FROM design_versions WHERE mockup_file_key<>''
    UNION ALL SELECT file_key,file_name,file_type FROM design_assets WHERE file_key<>''
    UNION ALL SELECT file_key,file_name,file_type FROM order_progress_photos WHERE file_key<>''
  ) WHERE file_key=? LIMIT 1`).bind(key).first<{ file_key: string; file_name: string; file_type: string }>();
  if (!file) return new Response("Not found", { status: 404 });
  const object = await runtime.ORDER_FILES.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: {
    "content-type": file.file_type || object.httpMetadata?.contentType || "application/octet-stream",
    "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name || "file")}`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  } });
}
