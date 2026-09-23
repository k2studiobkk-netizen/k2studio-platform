import { env } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../staff-auth";
import { readPasswordMaterial, type SubmittedPasswordMaterial } from "../../../password-material";
import { normalizeStaffTeams, normalizeVisibilityPermissions, staffTeamLabels, visibilityPermissionLabels } from "../../../production-rbac";

type CreateUserBody = SubmittedPasswordMaterial & {
  username?: unknown;
  displayName?: unknown;
  role?: unknown;
  teams?: unknown;
  permissions?: unknown;
};

export async function POST(request: Request) {
  const admin = await getStaffUser();
  if (!admin || admin.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as CreateUserBody;
  const username = String(body.username || "").trim().toLowerCase();
  const displayName = String(body.displayName || "").trim();
  const role = ["admin", "production_manager", "production", "graphic", "sales", "sales_manager", "finance", "manager", "staff"].includes(String(body.role)) ? String(body.role) : "graphic";
  const teams = normalizeStaffTeams(body.teams);
  const permissions = normalizeVisibilityPermissions(body.permissions);
  const password = readPasswordMaterial(body, 8);

  if (!/^[a-z0-9._-]{3,30}$/.test(username) || displayName.length < 2 || displayName.length > 80) {
    return Response.json({ error: "กรุณาตรวจสอบไอดีและชื่อผู้ใช้งาน" }, { status: 400 });
  }
  if (!password) return Response.json({ error: "รหัสผ่านต้องมี 8–72 ตัวอักษร" }, { status: 400 });
  if (!teams.length) return Response.json({ error: "กรุณาเลือกอย่างน้อย 1 ทีม" }, { status: 400 });

  const db = (env as unknown as { DB: D1Database }).DB;
  try {
    await db.batch([
      db.prepare("INSERT INTO staff_users (username,display_name,role,password_hash,password_salt,must_change_password,active) VALUES (?,?,?,?,?,0,1)")
        .bind(username, displayName, role, password.passwordHash, password.passwordSalt),
      ...teams.map((team) => db.prepare("INSERT INTO staff_user_teams (user_id,team_code) SELECT id,? FROM staff_users WHERE username=?")
        .bind(team, username)),
      ...permissions.map((permission) => db.prepare("INSERT INTO staff_user_permissions (user_id,permission_code) SELECT id,? FROM staff_users WHERE username=?").bind(permission, username)),
    ]);
  } catch {
    return Response.json({ error: "ไอดีนี้มีอยู่แล้ว" }, { status: 409 });
  }
  await audit(admin, null, "เพิ่มผู้ใช้งาน", `${displayName} (@${username}) • ${role} • ทีม ${teams.map((team) => staffTeamLabels[team]).join(", ")} • สิทธิ์ ${permissions.map((permission) => visibilityPermissionLabels[permission]).join(", ") || "ตามตำแหน่ง"}`);
  return Response.json({ ok: true });
}
