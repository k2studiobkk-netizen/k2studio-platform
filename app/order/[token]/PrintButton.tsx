"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ReleaseResult = { ok: boolean; error?: string };

async function waitForPrintableQr(timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const codes = Array.from(document.querySelectorAll<HTMLElement>("[data-k2-qr]"));
    const ready = codes.length > 0 && codes.every((element) => {
      if (element.dataset.k2Qr !== "ready") return false;
      return !(element instanceof HTMLImageElement) || (element.complete && element.naturalWidth > 0);
    });
    if (ready) return true;
    await new Promise((resolve) => window.setTimeout(resolve, 80));
  }
  return false;
}

export default function PrintButton({ orderId, autoRelease = false }: { orderId: number; autoRelease?: boolean }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const releasePromise = useRef<Promise<ReleaseResult> | null>(null);

  const releaseForProduction = useCallback(() => {
    if (!autoRelease) return Promise.resolve<ReleaseResult>({ ok: true });
    if (releasePromise.current) return releasePromise.current;

    setMessage("กำลังอนุมัติแบบและส่งเข้าคิวผลิต…");
    const request = fetch(`/api/admin/orders/${orderId}/work-order`, {
      method: "POST",
      keepalive: true,
    }).then(async (response) => {
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return { ok: false, error: result.error || "ส่งเข้าคิวผลิตไม่สำเร็จ กรุณาลองอีกครั้ง" };
      setMessage("อนุมัติแบบและส่งเข้าคิวผลิตแล้ว กำลังเปิดหน้าพิมพ์…");
      window.dispatchEvent(new CustomEvent("k2-order-released"));
      return { ok: true };
    }).catch(() => ({ ok: false, error: "เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง" }));

    releasePromise.current = request;
    void request.then((result) => {
      if (!result.ok) {
        releasePromise.current = null;
        setMessage(result.error || "ส่งเข้าคิวผลิตไม่สำเร็จ กรุณาลองอีกครั้ง");
      }
    });
    return request;
  }, [autoRelease, orderId]);

  useEffect(() => {
    if (!autoRelease) return;
    // Covers Cmd/Ctrl+P and Chrome's Print menu in addition to our button.
    const onBeforePrint = () => { void releaseForProduction(); };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, [autoRelease, releaseForProduction]);

  async function printOrder() {
    if (!autoRelease) {
      setSaving(true);
      setMessage("กำลังเตรียม QR สำหรับพิมพ์…");
      await waitForPrintableQr();
      window.print();
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      const result = await releaseForProduction();
      if (!result.ok) return;
      setMessage("กำลังเตรียม QR ความละเอียดสูงสำหรับพิมพ์…");
      await waitForPrintableQr();
      window.print();
    } finally {
      setSaving(false);
    }
  }

  return <span className="printReleaseAction">
    <button type="button" onClick={printOrder} disabled={saving}>{saving ? "กำลังส่งเข้าผลิต…" : "พิมพ์ / ดาวน์โหลด PDF"}</button>
    {autoRelease && <small aria-live="polite">{message || "กดครั้งเดียว: อนุมัติแบบและส่งเข้าปฏิทินอัตโนมัติ"}</small>}
  </span>;
}
