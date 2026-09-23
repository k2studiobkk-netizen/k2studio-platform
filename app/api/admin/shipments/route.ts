import { env } from "cloudflare:workers";
import { getStaffUser } from "../../../staff-auth";
import { canManageShipments, previewShipments, saveShipments, voidShipment } from "../../../shipments";

const headers = { "cache-control": "private, no-store" };
export async function POST(request: Request) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบก่อน" }, { status: 401, headers });
  if (!canManageShipments(user)) return Response.json({ error: "บัญชีนี้ดูได้ แต่ไม่มีสิทธิ์แก้ไขเลขพัสดุ" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "กรุณาทำรายการจากเว็บไซต์นี้" }, { status: 403, headers });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 415, headers });
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("ไม่มีข้อมูล");
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 64000) { await reader.cancel(); return Response.json({ error: "ข้อมูลเกินขนาดที่กำหนด" }, { status: 413, headers }); } chunks.push(value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object") throw new Error("ข้อมูลไม่ถูกต้อง");
    if (body.action === "void") {
      const ok = await voidShipment(env.DB, Number(body.id), String(body.reason || ""), user);
      return Response.json({ ok }, { status: ok ? 200 : 409, headers });
    }
    if (!Array.isArray(body.rows) || !["preview", "save"].includes(body.action)) throw new Error("รายการไม่ถูกต้อง");
    const orderId = body.orderId === undefined ? undefined : Number(body.orderId);
    if (orderId !== undefined && (!Number.isSafeInteger(orderId) || orderId < 1)) throw new Error("ใบงานไม่ถูกต้อง");
    if (body.action === "preview") return Response.json({ rows: await previewShipments(env.DB, body.rows, orderId) }, { headers });
    const result = await saveShipments(env.DB, body.rows, user, orderId);
    return Response.json(result, { status: result.ok ? 200 : 409, headers });
  } catch (error) {
    console.error(JSON.stringify({ event: "shipment_request_failed", message: error instanceof Error ? error.message : "Unknown" }));
    return Response.json({ error: "บันทึกไม่สำเร็จ กรุณาตรวจข้อมูลหรือกดตรวจสอบใหม่ อาจมีผู้อื่นบันทึกเลขนี้ไปแล้ว" }, { status: 400, headers });
  }
}
