"use client";

import { useState } from "react";

export default function ProductionReleaseButton({ orderId, canRelease, released, blocker }: { orderId: number; canRelease: boolean; released: boolean; blocker: string }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function release() {
    if (!canRelease || saving) return;
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderStatus: "in_production", note: "ทีมงานส่งต่อเข้าสู่ฝ่ายผลิต" }),
    });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (response.ok) {
      setMessage("ส่งเข้าผลิตแล้ว สถานะและประวัติได้รับการบันทึก");
      setTimeout(() => location.reload(), 700);
    } else {
      setMessage(result.error || "ยังไม่สามารถส่งผลิตได้");
    }
  }

  return <div className={`productionRelease ${canRelease ? "ready" : "blocked"}`}>
    <span>FINAL RELEASE</span>
    <h3>{released ? "งานนี้ส่งเข้าผลิตแล้ว" : "ส่งงานเข้าผลิต"}</h3>
    <p>{released ? "สถานะใบงานเป็นกำลังผลิต และมีชื่อผู้ส่งผลิตในประวัติแล้ว" : blocker}</p>
    {!released && <button type="button" onClick={release} disabled={!canRelease || saving}>{saving ? "กำลังส่งผลิต..." : "ส่งผลิตทันที"}</button>}
    {message && <small>{message}</small>}
  </div>;
}
