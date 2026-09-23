import { env } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../../staff-auth";
import { readPasswordMaterial, type SubmittedPasswordMaterial } from "../../../../password-material";
import { normalizeStaffTeams, normalizeVisibilityPermissions, staffTeamLabels, visibilityPermissionLabels } from "../../../../production-rbac";

type UpdateUserBody = SubmittedPasswordMaterial & {
  displayName?: unknown;
  role?: unknown;
  active?: unknown;
  teams?: unknown;
  permissions?: unknown;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getStaffUser();
  if (!admin || admin.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const targetId = Number(id);
  const body = await request.json() as UpdateUserBody;
  const displayName = String(body.displayName || "").trim();
  const role = ["admin", "production_manager", "production", "graphic", "sales", "sales_manager", "finance", "manager", "staff"].includes(String(body.role)) ? String(body.role) : "graphic";
  const teams = normalizeStaffTeams(body.teams);
  const permissions = normalizeVisibilityPermissions(body.permissions);
  const active = body.active ? 1 : 0;
  const hasPassword = body.passwordHash !== undefined || body.passwordSalt !== undefined || body.passwordLength !== undefined;
  const password = hasPassword ? readPasswordMaterial(body, 8) : null;

  if (displayName.length < 2 || displayName.length > 80) return Response.json({ error: "ชื่อผู้ใช้งานไม่ถูกต้อง" }, { status: 400 });
  if (hasPassword && !password) return Response.json({ error: "รหัสผ่านต้องมี 8–72 ตัวอักษร" }, { status: 400 });
  if (!teams.length) return Response.json({ error: "กรุณาเลือกอย่างน้อย 1 ทีม" }, { status: 400 });
  if (targetId === admin.id && (role !== "admin" || active !== 1)) {
    return Response.json({ error: "ไม่สามารถลดสิทธิ์หรือปิดบัญชีที่กำลังใช้งาน" }, { status: 409 });
  }

  const db = (env as unknown as { DB: D1Database }).DB;
  const target = await db.prepare("SELECT username,display_name FROM staff_users WHERE id=?")
    .bind(targetId).first<Record<string, string>>();
  if (!target) return Response.json({ error: "Not found" }, { status: 404 });

  const statements = [
    password
      ? db.prepare("UPDATE staff_users SET display_name=?,role=?,active=?,password_hash=?,password_salt=?,must_change_password=0 WHERE id=?")
        .bind(displayName, role, active, password.passwordHash, password.passwordSalt, targetId)
      : db.prepare("UPDATE staff_users SET display_name=?,role=?,active=? WHERE id=?")
        .bind(displayName, role, active, targetId),
    db.prepare("DELETE FROM staff_user_teams WHERE user_id=?").bind(targetId),
    db.prepare("DELETE FROM staff_user_permissions WHERE user_id=?").bind(targetId),
    ...teams.map((team) => db.prepare("INSERT INTO staff_user_teams (user_id,team_code) VALUES (?,?)").bind(targetId, team)),
    ...permissions.map((permission) => db.prepare("INSERT INTO staff_user_permissions (user_id,permission_code) VALUES (?,?)").bind(targetId, permission)),
    ...(password ? [db.prepare("DELETE FROM staff_sessions WHERE user_id=?").bind(targetId)] : []),
  ];
  await db.batch(statements);
  await audit(admin, null, password ? "กำหนดรหัสผ่านผู้ใช้งาน" : "แก้ไขผู้ใช้งาน", `${displayName} (@${target.username}) • ${role} • ทีม ${teams.map((team) => staffTeamLabels[team]).join(", ")} • สิทธิ์ ${permissions.map((permission) => visibilityPermissionLabels[permission]).join(", ") || "ตามตำแหน่ง"} • ${active ? "ใช้งาน" : "ปิดบัญชี"}`);
  return Response.json({ ok: true });
}
