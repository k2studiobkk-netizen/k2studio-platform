"use client";

import { useState } from "react";

export default function TelegramOrderBuilderUpdateSender() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function send() {
    setState("sending");
    setMessage("");
    const response = await fetch("/api/admin/telegram/order-builder-v2", { method: "POST" });
    const result = await response.json() as { message?: string; error?: string };
    setMessage(result.message || result.error || "");
    setState(response.ok ? "sent" : "error");
  }

  return <main className="staffLoginPage">
    <section>
      <span>TELEGRAM ANNOUNCEMENT</span>
      <h1>ประกาศตัวอักษรหน้าสร้างใบงาน</h1>
      <p>แจ้งทีมงานว่าหน้าสร้างใบงานอ่านง่ายขึ้นทั้งคอมและมือถือ ระบบป้องกันการส่งซ้ำไว้แล้ว</p>
      <button type="button" disabled={state === "sending" || state === "sent"} onClick={send}>
        {state === "sending" ? "กำลังส่ง…" : state === "sent" ? "✓ ส่งไป Telegram แล้ว" : "ส่งประกาศไป Telegram"}
      </button>
      {message && <p>{message}</p>}
      <a href="/admin/orders/new">← กลับหน้าสร้างใบงาน</a>
    </section>
  </main>;
}
