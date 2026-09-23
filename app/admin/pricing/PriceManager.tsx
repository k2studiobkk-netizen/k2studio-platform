"use client";

import { useState } from "react";
import { hardwareImagePath } from "../../pricing-config";

type PriceRow = { code: string; name: string; price: number; updatedBy: string; updatedAt: string };

export default function PriceManager({ rows }: { rows: PriceRow[] }) {
  const [message, setMessage] = useState("");
  async function save(code: string, form: HTMLFormElement) {
    const price = Number(new FormData(form).get("price"));
    const response = await fetch("/api/admin/pricing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, price }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setMessage(result.error || "บันทึกราคาไม่สำเร็จ");
    setMessage(`บันทึกราคาอะไหล่ ${code} แล้ว`);
    setTimeout(() => location.reload(), 700);
  }
  return <section className="priceManager">
    {message && <div className="userManagerMessage" role="status">{message}</div>}
    <div className="priceManagerGrid">{rows.map((row) => <form key={row.code}>
      <img src={hardwareImagePath(row.code)} alt={`อะไหล่ ${row.code}`}/>
      <div><b>{row.code} — {row.name}</b><small>{row.updatedAt ? `แก้ล่าสุด ${row.updatedAt} โดย ${row.updatedBy}` : "ราคาเริ่มต้นจากระบบ"}</small></div>
      <label>ราคาเพิ่ม/ชิ้น (บาท)<input name="price" type="number" min="0" max="1000" step="0.01" defaultValue={row.price} required/></label>
      <button type="button" onClick={(event) => save(row.code, event.currentTarget.form!)}>บันทึกราคา</button>
    </form>)}</div>
  </section>;
}
