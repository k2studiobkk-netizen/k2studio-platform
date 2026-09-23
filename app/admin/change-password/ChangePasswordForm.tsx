"use client";

import { useState } from "react";
import { createPasswordMaterial } from "../../client-password";

export default function ChangePasswordForm({ returnTo }: { returnTo: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    const confirmation = String(data.get("confirm"));
    if (password !== confirmation) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const passwordMaterial = await createPasswordMaterial(password);
      const response = await fetch("/api/staff/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...passwordMaterial, returnTo }),
      });
      const result = await response.json() as { error?: string; redirectTo?: string };
      if (response.ok) location.href = result.redirectTo || "/admin";
      else setError(result.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } catch {
      setError("เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return <form className="staffLoginForm" onSubmit={submit}>
    <label>รหัสผ่านใหม่<input name="password" type="password" minLength={10} maxLength={72} required autoComplete="new-password" /></label>
    <label>ยืนยันรหัสผ่านใหม่<input name="confirm" type="password" minLength={10} maxLength={72} required autoComplete="new-password" /></label>
    <small>อย่างน้อย 10 ตัวอักษร</small>
    {error && <p role="alert">{error}</p>}
    <button disabled={loading}>{loading ? "กำลังเข้ารหัสและบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>
  </form>;
}
