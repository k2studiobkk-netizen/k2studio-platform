"use client";

import { useState } from "react";

export default function TelegramFinanceUpdateSender() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function send() {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    setMessage("");
    try {
      const response = await fetch("/api/admin/telegram/finance-visibility-update", { method: "POST" });
      const body = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "ส่งไม่สำเร็จ");
      setState("sent");
      setMessage(body.message || "ส่งแล้ว");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "ส่งไม่สำเร็จ");
    }
  }

  return <section style={{ maxWidth: 760, margin: "40px auto", padding: 24, fontFamily: "var(--font-sans, sans-serif)" }}>
    <a href="/admin" style={{ color: "#17395f" }}>← กลับหน้าแดชบอร์ด</a>
    <div style={{ background: "#fff", border: "1px solid #eadfe3", borderRadius: 24, padding: 24, marginTop: 18, boxShadow: "0 18px 50px rgba(20,35,55,.08)" }}>
      <span style={{ color: "#dd1760", fontWeight: 800, letterSpacing: ".12em" }}>SYSTEM UPDATE</span>
      <h1 style={{ fontSize: "clamp(28px,5vw,42px)", margin: "8px 0" }}>แก้ QR ใบงานสำหรับการพิมพ์</h1>
      <p style={{ fontSize: 18, color: "#5c6674" }}>ส่งวิธีใช้ QR เวอร์ชันใหม่ให้ทีมงานใน Telegram ระบบป้องกันการส่งซ้ำไว้แล้ว</p>
      <button type="button" onClick={send} disabled={state === "sending" || state === "sent"} style={{ width: "100%", minHeight: 58, border: 0, borderRadius: 16, background: state === "sent" ? "#149b63" : "#111827", color: "#fff", fontSize: 20, fontWeight: 800, cursor: "pointer" }}>
        {state === "sending" ? "กำลังส่ง…" : state === "sent" ? "✓ ส่งไป Telegram แล้ว" : "ส่งประกาศไป Telegram"}
      </button>
      {message && <p role="status" style={{ fontSize: 17, fontWeight: 700, color: state === "error" ? "#c0362c" : "#147a52", marginBottom: 0 }}>{message}</p>}
    </div>
  </section>;
}
