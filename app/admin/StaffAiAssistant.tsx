"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type PendingAction = { type: "add_note"; orderId: number; orderNumber: string; note: string };
type Reply = { answer?: string; error?: string; links?: Array<{ label: string; href: string }>; pendingAction?: PendingAction };
type Message = { role: "user" | "assistant"; text: string; links?: Reply["links"]; pendingAction?: PendingAction };

const quickQuestions = ["งานส่งวันนี้", "งานกราฟิกรอรับ", "ขอดูคิวผลิต", "ค้นหาเลขใบงาน"];

export default function StaffAiAssistant() {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: "สวัสดีครับ ผมช่วยค้นหาใบงาน สถานะ กำหนดส่ง ยอดค้าง งานกราฟิก คิวผลิต และช่วยเพิ่มโน้ตได้ครับ" }]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const path = window.location.pathname;
    setAvailable(path.startsWith("/admin") && !path.startsWith("/admin/login") && !path.startsWith("/admin/change-password"));
  }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || loading) return;
    setMessages(current => [...current, { role: "user", text }]);
    setInput(""); setLoading(true);
    const response = await fetch("/api/admin/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text }) });
    const result = await response.json().catch(() => ({})) as Reply;
    setMessages(current => [...current, { role: "assistant", text: result.answer || result.error || "ระบบผู้ช่วยตอบไม่ได้ชั่วคราว กรุณาลองใหม่ครับ", links: result.links, pendingAction: result.pendingAction }]);
    setLoading(false);
  }

  async function confirm(action: PendingAction) {
    if (loading) return;
    setLoading(true);
    const response = await fetch("/api/admin/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmAction: action }) });
    const result = await response.json().catch(() => ({})) as Reply;
    setMessages(current => [...current.map(message => message.pendingAction === action ? { ...message, pendingAction: undefined } : message), { role: "assistant", text: result.answer || result.error || "บันทึกโน้ตไม่สำเร็จ กรุณาลองใหม่ครับ", links: result.links }]);
    setLoading(false);
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(input); }
  if (!available) return null;

  return <aside className={`staffAiAssistant ${open ? "open" : ""}`} aria-label="K2 Assistant">
    {open && <section className="staffAiPanel" role="dialog" aria-modal="true" aria-labelledby="staff-ai-title">
      <header><div><span>K2 AI ASSISTANT</span><b id="staff-ai-title">ผู้ช่วยทีมงาน</b><small>ข้อมูลล่าสุดจากระบบ • ตอบตามสิทธิ์ของคุณ</small></div><button type="button" onClick={() => setOpen(false)} aria-label="ปิดผู้ช่วย">×</button></header>
      <div className="staffAiMessages" ref={scrollRef}>{messages.map((message, index) => <article className={message.role} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "K2" : "คุณ"}</span><p>{message.text}</p>{message.links?.length ? <div className="staffAiLinks">{message.links.map(link => <a href={link.href} key={link.href}>{link.label}</a>)}</div> : null}{message.pendingAction && <button className="staffAiConfirm" type="button" onClick={() => void confirm(message.pendingAction!)}>ยืนยันเพิ่มโน้ต</button>}</article>)}{loading && <article className="assistant loading"><span>K2</span><p>กำลังตรวจข้อมูลล่าสุด…</p></article>}</div>
      <div className="staffAiQuick">{quickQuestions.map(question => <button type="button" key={question} onClick={() => question === "ค้นหาเลขใบงาน" ? setInput("ค้นหา ") : void ask(question)}>{question}</button>)}</div>
      <form onSubmit={submit}><input value={input} onChange={event => setInput(event.target.value)} maxLength={500} placeholder="ถามข้อมูล หรือพิมพ์เลขใบงาน…" aria-label="คำถามถึง K2 Assistant"/><button type="submit" disabled={loading || !input.trim()}>ส่ง</button></form>
    </section>}
    {!open && <button className="staffAiLauncher" type="button" onClick={() => setOpen(true)} aria-expanded="false"><i>AI</i><span>ถาม K2 Assistant</span></button>}
  </aside>;
}
