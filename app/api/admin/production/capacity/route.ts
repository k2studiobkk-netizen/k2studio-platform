import { env } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../../staff-auth";
import { hasPermission } from "../../../../production-rbac";

const codePattern = /^[A-Z0-9_-]{2,30}$/;

export async function POST(request: Request) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!hasPermission(user.role, "capacity:manage")) return Response.json({ error: "ไม่มีสิทธิ์แก้ Capacity" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action || "");
  const database = (env as unknown as { DB: D1Database }).DB;
  if (action === "machine") {
    const code = String(body.code || "").trim().toUpperCase();
    const name = String(body.name || "").trim().slice(0, 100);
    const department = String(body.department || "").trim().slice(0, 100);
    const minutes = Math.floor(Number(body.dailyCapacityMinutes || 0));
    const busy = Math.floor(Number(body.busyThreshold || 70));
    const nearly = Math.floor(Number(body.nearlyFullThreshold || 90));
    const full = Math.floor(Number(body.fullThreshold || 100));
    if (!codePattern.test(code) || name.length < 2 || minutes < 30 || minutes > 1440 || !(busy > 0 && busy < nearly && nearly < full)) return Response.json({ error: "กรุณาตรวจข้อมูลเครื่องจักรและ Threshold" }, { status: 400 });
    await database.prepare(`INSERT INTO machines (code,name,department,daily_capacity_minutes,busy_threshold,nearly_full_threshold,full_threshold)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,department=excluded.department,daily_capacity_minutes=excluded.daily_capacity_minutes,busy_threshold=excluded.busy_threshold,nearly_full_threshold=excluded.nearly_full_threshold,full_threshold=excluded.full_threshold,updated_at=CURRENT_TIMESTAMP`).bind(code, name, department, minutes, busy, nearly, full).run();
    await audit(user, null, "ตั้งค่าเครื่องจักรและ Capacity", `${code} • ${name} • ${minutes} นาที/วัน • ${busy}/${nearly}/${full}%`);
    return Response.json({ ok: true });
  }
  if (action === "process") {
    const code = String(body.code || "").trim().toUpperCase();
    const name = String(body.name || "").trim().slice(0, 100);
    const sequence = Math.max(0, Math.floor(Number(body.sequenceNo || 0)));
    if (!codePattern.test(code) || name.length < 2) return Response.json({ error: "กรุณาตรวจรหัสและชื่อกระบวนการ" }, { status: 400 });
    await database.prepare(`INSERT INTO production_processes (code,name,sequence_no) VALUES (?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,sequence_no=excluded.sequence_no,updated_at=CURRENT_TIMESTAMP`).bind(code, name, sequence).run();
    await audit(user, null, "ตั้งค่ากระบวนการผลิต", `${code} • ${name}`);
    return Response.json({ ok: true });
  }
  if (action === "rule") {
    const machineId = Number(body.machineId);
    const processId = body.processId ? Number(body.processId) : null;
    const unitsPerHour = Number(body.unitsPerHour || 0);
    const setupMinutes = Math.max(0, Math.floor(Number(body.setupMinutes || 0)));
    const unit = ["items", "sheets", "sets", "hours"].includes(String(body.capacityUnit)) ? String(body.capacityUnit) : "items";
    const notes = String(body.notes || "").trim().slice(0, 500);
    if (!Number.isInteger(machineId) || unitsPerHour <= 0 || unitsPerHour > 100000) return Response.json({ error: "กรุณาระบุเครื่องจักรและกำลังผลิตต่อชั่วโมง" }, { status: 400 });
    await database.prepare("INSERT INTO production_capacity (machine_id,process_id,units_per_hour,setup_minutes,capacity_unit,notes,created_by) VALUES (?,?,?,?,?,?,?)").bind(machineId, processId, unitsPerHour, setupMinutes, unit, notes, user.id).run();
    await audit(user, null, "เพิ่มกฎ Capacity", `Machine ${machineId} • Process ${processId || "-"} • ${unitsPerHour} ${unit}/ชม.`);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "รายการตั้งค่าไม่ถูกต้อง" }, { status: 400 });
}
