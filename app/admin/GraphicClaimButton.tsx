"use client";

import { useState } from "react";

export default function GraphicClaimButton({ orderId, claimedBy, claimedAt, canClaim }: { orderId: number; claimedBy: string; claimedAt: string; canClaim: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (claimedAt) return <div className="graphicClaimed"><i>✓</i><span><b>รับงานกราฟิกแล้ว</b><small>{claimedBy || "ทีมกราฟิก"} • {claimedAt}</small></span></div>;
  if (!canClaim) return <div className="graphicUnclaimed"><i>!</i><span><b>ยังไม่มีกราฟิกรับงาน</b><small>ทีมกราฟิกหรือผู้ดูแลระบบสามารถกดรับงานได้</small></span></div>;
  async function claim() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/graphic-claim`, { method: "POST" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "รับงานไม่สำเร็จ");
      location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "รับงานไม่สำเร็จ"); setBusy(false);
    }
  }
  return <div className="graphicUnclaimed"><i>!</i><span><b>ยังไม่มีกราฟิกรับงาน</b><small>กดรับงานเพื่อให้ผู้จัดการเห็นว่าเริ่มดำเนินการแล้ว</small>{error && <em>{error}</em>}</span><button type="button" disabled={busy} onClick={claim}>{busy ? "กำลังบันทึก…" : "รับงานกราฟิก"}</button></div>;
}
