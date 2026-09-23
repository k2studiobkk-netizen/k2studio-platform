import { env } from "cloudflare:workers";
import { salesKitProducts, salesRuntimeOrigin } from "../../sales-kit.mjs";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headers = { "cache-control": "no-store", "referrer-policy": "strict-origin-when-cross-origin" };
  if (!/^[a-f0-9]{32}$/.test(token)) return new Response("ไม่พบลิงก์นี้", { status: 404, headers });
  const row = await env.DB.prepare("SELECT l.product_id FROM sales_share_links l JOIN staff_users u ON u.id=l.staff_user_id WHERE l.token=? AND l.active=1 AND u.active=1").bind(token).first<{ product_id: string }>();
  const product = salesKitProducts.find(p => p.id === row?.product_id);
  if (!product) return new Response("ลิงก์นี้ปิดใช้งานหรือไม่พบข้อมูล", { status: 404, headers });
  const destination = new URL(product.destination, salesRuntimeOrigin(env.PUBLIC_SITE_URL || "https://order.k2group.site", request.url));
  destination.searchParams.set("utm_source", "k2_sales"); destination.searchParams.set("utm_medium", "share"); destination.searchParams.set("utm_content", token);
  // Campaign metadata is not a commission entitlement. No public mutation or payout on redirect.
  return new Response(null, { status: 302, headers: { ...headers, location: destination.href } });
}
