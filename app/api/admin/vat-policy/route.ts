import { env } from "cloudflare:workers";
import { getStaffUser } from "../../../staff-auth";
import { getVatCollectionPolicy, VAT_POLICY_MODES, vatPolicyModeLabel } from "../../../vat-collection-policy.mjs";

export async function GET() {
  if (!await getStaffUser()) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  try { return Response.json(await getVatCollectionPolicy(env.DB), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "ยังโหลดนโยบาย VAT ไม่ได้ กรุณาลองใหม่" }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "เฉพาะผู้ดูแลระบบเท่านั้น" }, { status: 403 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "ที่มาคำขอไม่ถูกต้อง" }, { status: 403 });
  let body: { mode?: string; revision?: number; confirmed?: boolean };
  try { body = await request.json(); } catch { return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  if (!body || typeof body.mode !== "string" || !VAT_POLICY_MODES.includes(body.mode) || !Number.isSafeInteger(body.revision) || Number(body.revision) < 1 || body.confirmed !== true) return Response.json({ error: "ตรวจโหมดและยืนยันผลต่อใบงานใหม่ก่อน" }, { status: 400 });
  const changeId = crypto.randomUUID();
  try {
    const result = await env.DB.batch([
      env.DB.prepare("UPDATE vat_collection_settings SET mode=?,revision=revision+1,updated_by=?,updated_at=CURRENT_TIMESTAMP,change_id=? WHERE id=1 AND revision=? RETURNING revision").bind(body.mode,user.id,changeId,body.revision),
      env.DB.prepare("INSERT INTO audit_logs (order_id,user_id,username,display_name,action,details) SELECT NULL,?,?,?,?,? FROM vat_collection_settings WHERE id=1 AND change_id=?").bind(user.id,user.username,user.displayName,"เปลี่ยนการเรียกเก็บ VAT",`${vatPolicyModeLabel(body.mode)} • มีผลกับใบงานใหม่เท่านั้น • ไม่ตั้งวันเปลี่ยนอัตโนมัติ`,changeId),
    ]);
    if (!result[0].results.length) return Response.json({ error: "มีผู้แก้ตั้งค่าแล้ว กรุณาโหลดหน้าใหม่ก่อนยืนยัน" }, { status: 409 });
    return Response.json({ ok: true, ...await getVatCollectionPolicy(env.DB) });
  } catch { return Response.json({ error: "บันทึกนโยบาย VAT ไม่สำเร็จ กรุณาตรวจสถานะก่อนลองใหม่" }, { status: 503 }); }
}
