"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildCustomerShareMessage, CUSTOMER_LINE_ID, CUSTOMER_LINE_URL } from "./customer-share-message.mjs";
import K2Icon from "./K2Icon";

type MessagePhase = "tracking" | "design";

export default function CustomerShareMessage({
  orderNumber,
  trackingUrl,
  phase = "tracking",
  designVersion,
}: {
  orderNumber: string;
  trackingUrl: string;
  phase?: MessagePhase;
  designVersion?: number;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const message = useMemo(() => buildCustomerShareMessage({ orderNumber, trackingUrl, phase, designVersion }), [designVersion, orderNumber, phase, trackingUrl]);
  useEffect(() => setCopyState("idle"), [message]);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyState("copied");
    } catch {
      // Keep the visible text selected for manual copy when browser clipboard access is blocked.
      const textarea = textRef.current;
      textarea?.focus();
      textarea?.select();
      textarea?.setSelectionRange(0, message.length);
      try { setCopyState(textarea && document.execCommand("copy") ? "copied" : "error"); }
      catch { setCopyState("error"); }
    }
  }

  return <section className={`customerShareMessage ${phase}`}>
    <header>
      <div>
        <span>{phase === "design" ? "DESIGN MESSAGE" : "CUSTOMER TRACKING LINK"}</span>
        <h3>{phase === "design" ? "ข้อความส่งแบบให้ลูกค้า" : "ส่งให้ลูกค้าแอด LINE และติดตามงาน"}</h3>
      </div>
      <b>ใช้ลิงก์เดิมตลอดงาน</b>
    </header>
    <p className="customerShareHelp">กดคัดลอก แล้วนำไปวางในแชตลูกค้า ทีมงานเป็นผู้ส่งเอง ระบบไม่ได้ส่งข้อความอัตโนมัติ</p>
    <textarea ref={textRef} aria-label="ข้อความพร้อมลิงก์สำหรับส่งลูกค้า" readOnly rows={phase === "design" ? 4 : 9} value={message} />
    <div className="customerShareActions">
      <button type="button" onClick={copyMessage}><K2Icon name={copyState === "copied" ? "check" : "clipboard"}/>{copyState === "copied" ? "คัดลอกแล้ว" : "คัดลอกข้อความพร้อมลิงก์"}</button>
      {phase === "tracking" && <a href={CUSTOMER_LINE_URL} target="_blank" rel="noreferrer">LINE {CUSTOMER_LINE_ID}</a>}
      <a href={trackingUrl} target="_blank" rel="noreferrer">เปิดหน้าลูกค้า ↗</a>
    </div>
    <p className="customerCopyStatus" role="status" aria-live="polite">{copyState === "copied" ? "คัดลอกแล้ว นำไปวางในแชตลูกค้าได้เลย" : copyState === "error" ? "คัดลอกอัตโนมัติไม่ได้ กรุณากดค้างหรือคัดลอกข้อความที่เลือกไว้ แล้วนำไปวางในแชตลูกค้า" : ""}</p>
  </section>;
}
