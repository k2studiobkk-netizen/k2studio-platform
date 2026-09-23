"use client";

import { useEffect, useState } from "react";
import { publicStatusLabel } from "../../order-status";

export default function LiveOrderStatus({ token, initialStatus }: { token: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    let active = true;

    async function sync() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/orders/${token}/status`, { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { status?: string };
        if (active && result.status) setStatus(result.status);
      } catch {
        // Keep the last known status when the device is temporarily offline.
      }
    }

    const interval = window.setInterval(sync, 20000);
    const onVisible = () => { if (document.visibilityState === "visible") void sync(); };
    const onFocus = () => void sync();
    const onReleased = () => void sync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("k2-order-released", onReleased);

    const channel = "BroadcastChannel" in window ? new BroadcastChannel("k2-order-status") : null;
    if (channel) channel.onmessage = (event: MessageEvent<{ token?: string; status?: string }>) => {
      if (event.data?.token === token && event.data.status) setStatus(event.data.status);
    };

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("k2-order-released", onReleased);
      channel?.close();
    };
  }, [token]);

  return <>{publicStatusLabel(status)}</>;
}
