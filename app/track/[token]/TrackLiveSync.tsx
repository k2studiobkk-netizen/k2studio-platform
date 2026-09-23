"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TrackLiveSync() {
  const router = useRouter();
  const [lastSync, setLastSync] = useState("");

  useEffect(() => {
    const sync = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLastSync(new Intl.DateTimeFormat("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date()));
    };
    const interval = window.setInterval(sync, 30000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [router]);

  return <div className="trackingLiveSync" title={lastSync ? `ตรวจล่าสุด ${lastSync}` : "กำลังเชื่อมสถานะล่าสุด"}>
    <i aria-hidden="true" />
    <span>สถานะอัปเดตอัตโนมัติ</span>
  </div>;
}
