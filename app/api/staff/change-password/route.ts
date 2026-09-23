import { env } from "cloudflare:workers";
import { audit, getStaffUser, safeReturnTo } from "../../../staff-auth";
import { readPasswordMaterial, type SubmittedPasswordMaterial } from "../../../password-material";

type ChangePasswordBody = SubmittedPasswordMaterial & { returnTo?: unknown };

export async function POST(request: Request) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as ChangePasswordBody;
  const password = readPasswordMaterial(body, 10);
  if (!password) return Response.json({ error: "รหัสผ่านต้องมี 10–72 ตัวอักษร" }, { status: 400 });

  const db = (env as unknown as { DB: D1Database }).DB;
  await db.prepare("UPDATE staff_users SET password_hash=?,password_salt=?,must_change_password=0 WHERE id=?")
    .bind(password.passwordHash, password.passwordSalt, user.id).run();
  await audit(user, null, "change_password", "เปลี่ยนรหัสผ่านสำเร็จ");
  return Response.json({ ok: true, redirectTo: safeReturnTo(String(body.returnTo || "")) });
}
