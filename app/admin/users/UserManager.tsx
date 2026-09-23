"use client";

import { useState } from "react";
import { createPasswordMaterial } from "../../client-password";
import { defaultStaffTeamsForRole, normalizeStaffTeams, normalizeVisibilityPermissions, staffTeamLabels, staffTeams, visibilityPermissionLabels, visibilityPermissions, type StaffTeam, type VisibilityPermission } from "../../production-rbac";

type Row = Record<string, string | number>;

function teamsFromForm(data: FormData) {
  return normalizeStaffTeams(data.getAll("teams"));
}

function permissionsFromForm(data: FormData) { return normalizeVisibilityPermissions(data.getAll("permissions")); }
function permissionsForRow(row: Row) { return normalizeVisibilityPermissions(row.permissions); }

function teamsForRow(row: Row) {
  const assigned = normalizeStaffTeams(row.teams);
  return assigned.length ? assigned : defaultStaffTeamsForRole(String(row.role));
}

function TeamPicker({ defaultTeams }: { defaultTeams: StaffTeam[] }) {
  return <fieldset className="userTeamPicker">
    <legend>ทีมที่เข้าใช้งานได้ <small>เลือกได้มากกว่า 1 ทีม</small></legend>
    <div>{staffTeams.map((team) => <label className="userTeamOption" key={team}>
      <input type="checkbox" name="teams" value={team} defaultChecked={defaultTeams.includes(team)} />
      <span>{staffTeamLabels[team]}</span>
    </label>)}</div>
  </fieldset>;
}

function PermissionPicker({ defaultPermissions = [] }: { defaultPermissions?: VisibilityPermission[] }) {
  return <fieldset className="userPermissionPicker">
    <legend>สิทธิ์ข้อมูลการเงินและการขาย <small>เลือกเฉพาะข้อมูลที่บุคคลนี้จำเป็นต้องใช้</small></legend>
    <div>{visibilityPermissions.map((permission) => <label className="userPermissionOption" key={permission}>
      <input type="checkbox" name="permissions" value={permission} defaultChecked={defaultPermissions.includes(permission)} />
      <span><b>{visibilityPermissionLabels[permission]}</b><small>{permission}</small></span>
    </label>)}</div>
  </fieldset>;
}

export default function UserManager({
  users,
  currentUserId,
}: {
  users: Row[];
  currentUserId: number;
}) {
  const [message, setMessage] = useState("");

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") || "");
    const confirmation = String(data.get("password_confirmation") || "");
    const teams = teamsFromForm(data);
    const permissions = permissionsFromForm(data);
    if (password !== confirmation) {
      setMessage("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (!teams.length) {
      setMessage("กรุณาเลือกอย่างน้อย 1 ทีม");
      return;
    }
    setMessage("กำลังเข้ารหัสรหัสผ่านบนอุปกรณ์…");
    const passwordMaterial = await createPasswordMaterial(password);
    const response = await fetch("/api/staff/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: data.get("username"),
        displayName: data.get("display_name"),
        role: data.get("role"),
        teams,
        permissions,
        ...passwordMaterial,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "เพิ่มบัญชีไม่สำเร็จ");
      return;
    }
    setMessage("สร้างบัญชีและกำหนดรหัสผ่านแล้ว");
    form.reset();
    setTimeout(() => location.reload(), 800);
  }

  async function update(row: Row, form: HTMLFormElement, changePassword = false) {
    const id = Number(row.id);
    const data = new FormData(form);
    const password = String(data.get("password") || "");
    const teams = teamsFromForm(data);
    const permissions = permissionsFromForm(data);
    if (changePassword && password.length < 8) {
      setMessage("กรุณากรอกรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (!teams.length) {
      setMessage("กรุณาเลือกอย่างน้อย 1 ทีม");
      return;
    }
    setMessage(changePassword ? "กำลังเข้ารหัสรหัสผ่านบนอุปกรณ์…" : "กำลังบันทึก…");
    const passwordMaterial = changePassword ? await createPasswordMaterial(password) : null;
    const response = await fetch(`/api/staff/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: data.get("display_name"),
        role: data.get("role") || row.role,
        active: (data.get("active") ?? String(row.active)) === "1",
        teams,
        permissions,
        ...(passwordMaterial || {}),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "บันทึกไม่สำเร็จ");
      return;
    }
    setMessage(changePassword ? "กำหนดรหัสผ่านใหม่แล้ว สามารถใช้รหัสนี้เข้าสู่ระบบได้ทันที" : "บันทึกข้อมูลผู้ใช้งานแล้ว");
    form.reset();
    setTimeout(() => location.reload(), 1000);
  }

  return (
    <>
      <section className="createUserCard">
        <h2>เพิ่มผู้ใช้งานใหม่</h2>
        <form onSubmit={create}>
          <label>
            ไอดีล็อกอิน
            <input name="username" required pattern="[a-z0-9._-]{3,30}" placeholder="เช่น design01" />
          </label>
          <label>
            ชื่อที่แสดง
            <input name="display_name" required placeholder="ชื่อพนักงาน" />
          </label>
          <label>
            ตำแหน่งหลัก
            <select name="role">
              <option value="sales">ฝ่ายขาย</option>
              <option value="sales_manager">ผู้จัดการฝ่ายขาย</option>
              <option value="finance">บัญชี / การเงิน</option>
              <option value="graphic">กราฟิก</option>
              <option value="production">ฝ่ายผลิต</option>
              <option value="production_manager">ผู้จัดการฝ่ายผลิต</option>
              <option value="admin">ผู้ดูแลระบบ</option>
            </select>
          </label>
          <TeamPicker defaultTeams={["sale"]} />
          <PermissionPicker />
          <label>
            กำหนดรหัสผ่าน
            <input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" />
          </label>
          <label>
            ยืนยันรหัสผ่าน
            <input name="password_confirmation" type="password" required minLength={8} maxLength={72} autoComplete="new-password" />
          </label>
          <button>สร้างบัญชี</button>
        </form>
      </section>

      {message && <div className="userManagerMessage" role="status">{message}</div>}

      <section className="userList">
        <div className="userListHead">
          <h2>บัญชีทั้งหมด</h2>
          <span>{users.length} บัญชี</span>
        </div>
        {users.map((row) => (
          <form key={String(row.id)} className="userRow">
            <div className="userIdentity">
              <b>{row.display_name}</b>
              <span>@{row.username}</span>
              <small>เข้าใช้ล่าสุด: {row.last_login_at || "ยังไม่เคยเข้าสู่ระบบ"}</small>
            </div>
            <label>
              ชื่อที่แสดง
              <input name="display_name" defaultValue={String(row.display_name)} />
            </label>
            <label>
              ตำแหน่งหลัก
              <select name="role" defaultValue={String(row.role)} disabled={Number(row.id) === currentUserId}>
                <option value="staff">ทีมงานเดิม (กราฟิก)</option>
                <option value="manager">หัวหน้างานเดิม (ผู้จัดการฝ่ายผลิต)</option>
                <option value="sales">ฝ่ายขาย</option>
                <option value="sales_manager">ผู้จัดการฝ่ายขาย</option>
                <option value="finance">บัญชี / การเงิน</option>
                <option value="graphic">กราฟิก</option>
                <option value="production">ฝ่ายผลิต</option>
                <option value="production_manager">ผู้จัดการฝ่ายผลิต</option>
                <option value="admin">ผู้ดูแลระบบ</option>
              </select>
            </label>
            <label>
              สถานะ
              <select name="active" defaultValue={String(row.active)} disabled={Number(row.id) === currentUserId}>
                <option value="1">ใช้งาน</option>
                <option value="0">ปิดบัญชี</option>
              </select>
            </label>
            <TeamPicker defaultTeams={teamsForRow(row)} />
            <PermissionPicker defaultPermissions={permissionsForRow(row)} />
            <label>
              กำหนดรหัสผ่านใหม่
              <input name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" />
            </label>
            <div className="userActions">
              <button type="button" onClick={(e) => update(row, e.currentTarget.form!)}>บันทึกข้อมูลและทีม</button>
              <button type="button" className="secondary" onClick={(e) => update(row, e.currentTarget.form!, true)}>เปลี่ยนรหัสผ่าน</button>
            </div>
            <small className="userFlags">ทีมปัจจุบัน: {teamsForRow(row).map((team) => staffTeamLabels[team]).join(" • ")} • สิทธิ์พิเศษ {permissionsForRow(row).length} รายการ</small>
          </form>
        ))}
      </section>
    </>
  );
}
