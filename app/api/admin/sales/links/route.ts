import { env } from "cloudflare:workers";
import { can, getStaffUser } from "../../../../staff-auth";
import { salesKitProducts, salesRuntimeOrigin } from "../../../../sales-kit.mjs";

const headers = { "cache-control": "private, no-store" };
export async function POST(request: Request) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers });
  if (!["sales:view_self", "sales:view_team", "sales:view_all"].some(p => can(user, p as "sales:view_self"))) return Response.json({ error: "ไม่มีสิทธิ์ใช้เครื่องมือขาย" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "กรุณาทำรายการจากเว็บไซต์นี้" }, { status: 403, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 415, headers });
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error("empty");
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const part = await reader.read(); if (part.done) break; length += part.value.length; if (length > 2048) { await reader.cancel(); return Response.json({ error: "ข้อมูลยาวเกินไป" }, { status: 413, headers }); } chunks.push(part.value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || typeof body.productId !== "string" || typeof body.campaign !== "string") throw new Error("invalid");
    const product = salesKitProducts.find(p => p.id === body.productId), campaign = body.campaign.trim();
    if (!product || campaign.length > 80 || /[\x00-\x1f\x7f]/.test(campaign)) throw new Error("invalid");
    const token = crypto.randomUUID().replaceAll("-", "");
    const origin = salesRuntimeOrigin(env.PUBLIC_SITE_URL || "https://order.k2group.site", request.url);
    // Idempotent per owner/product/campaign. Never accept an owner ID or redirect URL from the client.
    const row = await env.DB.prepare(`INSERT INTO sales_share_links (token,staff_user_id,product_id,campaign)
      SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM sales_share_links WHERE staff_user_id=?)<500
      ON CONFLICT(staff_user_id,product_id,campaign) DO NOTHING RETURNING token`).bind(token, user.id, product.id, campaign, user.id).first<{ token: string }>();
    const saved = row || await env.DB.prepare("SELECT token FROM sales_share_links WHERE staff_user_id=? AND product_id=? AND campaign=? AND active=1").bind(user.id, product.id, campaign).first<{ token: string }>();
    if (!saved) return Response.json({ error: "ถึงจำนวนลิงก์ที่กำหนด กรุณาติดต่อผู้ดูแล" }, { status: 409, headers });
    return Response.json({ url: `${origin}/s/${saved.token}`, kind: "campaign_only" }, { headers });
  } catch (error) {
    console.error(JSON.stringify({ event: "sales_link_create_failed", message: error instanceof Error ? error.message : "Unknown" }));
    return Response.json({ error: "สร้างลิงก์ไม่ได้ กรุณาตรวจข้อมูลและการเตรียมฐานข้อมูลเครื่องมือขาย" }, { status: 400, headers });
  }
}
