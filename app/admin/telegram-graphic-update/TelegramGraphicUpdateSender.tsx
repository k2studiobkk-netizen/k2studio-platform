"use client";

import { useState } from "react";

export default function TelegramGraphicUpdateSender() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function send() {
    if (state === "sending" || state === "sent") return;
    setState("sending");
    setMessage("");
    try {
      const response = await fetch("/api/admin/telegram/graphic-update", { method: "POST" });
      const body = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "ส่งไม่สำเร็จ");
      setState("sent");
      setMessage(body.message || "ส่งแล้ว");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "ส่งไม่สำเร็จ");
    }
  }

  return <section style={{maxWidth:760,margin:"40px auto",padding:24,fontFamily:"var(--font-sans, sans-serif)"}}>
    <a href="/admin" style={{color:"#17395f"}}>← กลับหน้าแดชบอร์ด</a>
    <div style={{background:"#fff",border:"1px solid #eadfe3",borderRadius:24,padding:24,marginTop:18,boxShadow:"0 18px 50px rgba(20,35,55,.08)"}}>
      <span style={{color:"#dd1760",fontWeight:800,letterSpacing:".12em"}}>TELEGRAM ANNOUNCEMENT</span>
      <h1 style={{fontSize:"clamp(28px,5vw,42px)",margin:"8px 0"}}>แจ้งทีมงานกราฟิก</h1>
      <p style={{fontSize:18,color:"#5c6674"}}>ส่งประกาศวิธีใช้ปุ่มรับงานกราฟิก พร้อมภาพด้านล่าง ไปยัง Telegram ที่เชื่อมกับระบบ</p>
      <img src="/assets/graphic-claim-update.png" alt="ตัวอย่างปุ่มรับงานกราฟิก" style={{width:"100%",height:"auto",borderRadius:18,border:"1px solid #e9dfe2",margin:"12px 0 20px"}} />
      <button type="button" onClick={send} disabled={state === "sending" || state === "sent"} style={{width:"100%",minHeight:58,border:0,borderRadius:16,background:state === "sent"?"#149b63":"#111827",color:"#fff",fontSize:20,fontWeight:800,cursor:"pointer"}}>
        {state === "sending" ? "กำลังส่ง…" : state === "sent" ? "✓ ส่งไป Telegram แล้ว" : "ส่งประกาศพร้อมภาพไป Telegram"}
      </button>
      {message && <p role="status" style={{fontSize:17,fontWeight:700,color:state === "error"?"#c0362c":"#147a52",marginBottom:0}}>{message}</p>}
    </div>
  </section>;
}
