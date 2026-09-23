"use client";

import { useEffect, useMemo, useState } from "react";
import { priorityLabels, type BroadcastEvent, type BroadcastMessage } from "../../../broadcast-types";

const active = (item: BroadcastMessage) => !item.expireAt || new Date(item.expireAt).getTime() > Date.now();

export default function LiveBroadcastDisplay({ initialMessages, screenId, department, displayName }: { initialMessages: BroadcastMessage[]; screenId: string; department: string; displayName: string }) {
  const [messages, setMessages] = useState(initialMessages);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry = 1000;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      const scheme = location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${scheme}//${location.host}/api/broadcast/stream?screenId=${encodeURIComponent(screenId)}&department=${encodeURIComponent(department)}`);
      socket.onopen = () => { setConnected(true); retry = 1000; };
      socket.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const payload = JSON.parse(String(event.data)) as BroadcastEvent;
          if (payload.type === "broadcast.created" && active(payload.message)) setMessages((current) => [payload.message, ...current.filter((item) => item.id !== payload.message.id)]);
          if (payload.type === "broadcast.closed") setMessages((current) => current.filter((item) => item.id !== payload.messageId));
          if (payload.type === "production.queue_updated") window.dispatchEvent(new CustomEvent("k2-production-queue-updated", { detail: payload }));
        } catch { /* Ignore malformed network frames. */ }
      };
      socket.onclose = () => { setConnected(false); if (!stopped) { timer = setTimeout(connect, retry); retry = Math.min(15000, retry * 2); } };
      socket.onerror = () => socket?.close();
    };
    connect();
    setNow(new Date());
    setMessages((current) => current.filter(active));
    const clock = setInterval(() => { setNow(new Date()); setMessages((current) => current.filter(active)); }, 1000);
    return () => { stopped = true; clearInterval(clock); clearTimeout(timer); socket?.close(); };
  }, [department, screenId]);

  async function acknowledge(messageId: number) {
    const response = await fetch(`/api/admin/broadcast/${messageId}/acknowledge`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ screenId }) });
    if (response.ok) setMessages((current) => current.filter((item) => item.id !== messageId));
  }

  const ordered = useMemo(() => [...messages].sort((a, b) => ["normal", "important", "urgent", "critical"].indexOf(b.priority) - ["normal", "important", "urgent", "critical"].indexOf(a.priority)), [messages]);
  const full = ordered.find((item) => item.displayMode === "fullscreen");
  const center = ordered.find((item) => item.displayMode === "large_center");
  const top = ordered.filter((item) => item.displayMode === "top_banner");
  const ticker = ordered.filter((item) => item.displayMode === "bottom_ticker");
  const needsAck = (item: BroadcastMessage) => item.priority !== "normal";

  const card = (item: BroadcastMessage, className = "") => <article key={item.id} className={`liveBroadcastCard ${item.priority} ${className}`}><span>{priorityLabels[item.priority]} • {item.senderName}</span><h2>{item.title}</h2><p>{item.message}</p>{needsAck(item) && <button onClick={() => acknowledge(item.id)}>รับทราบแล้ว — {displayName}</button>}</article>;

  return <div className="liveBroadcastLayer" aria-live="assertive">
    <div className={`tvConnection ${connected ? "online" : "offline"}`}><i />{connected ? "LIVE" : "กำลังเชื่อมต่อ…"}<time>{now ? now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}</time></div>
    {top.length > 0 && <div className="liveTopBanners">{top.map((item) => card(item))}</div>}
    {center && <div className="liveCenterAlert">{card(center)}</div>}
    {ticker.length > 0 && <div className="liveBottomTicker"><div>{ticker.map((item) => <span key={item.id}><b>{item.title}</b> — {item.message}　•　</span>)}</div>{ticker.some(needsAck) && <button className="liveTickerAck" onClick={() => acknowledge(ticker.find(needsAck)!.id)}>รับทราบแล้ว</button>}</div>}
    {full && <div className={`liveEmergency ${full.priority}`}>{card(full, "fullscreen")}</div>}
  </div>;
}
