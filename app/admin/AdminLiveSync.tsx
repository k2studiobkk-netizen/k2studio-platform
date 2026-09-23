"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLiveSync() {
  const router = useRouter();
  const [lastSync, setLastSync] = useState("");

  useEffect(() => {
    const sync = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLastSync(new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()));
    };
    // Full server refreshes are deliberately infrequent on the Workers Free
    // CPU budget. Edits still refresh immediately after they are saved.
    const interval = window.setInterval(sync, 60000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [router]);

  return <div className="adminLiveSync" title={lastSync ? `ตรวจล่าสุด ${lastSync}` : "กำลังเชื่อมสถานะล่าสุด"}>
    <i aria-hidden="true" />
    <span>ซิงก์สถานะอัตโนมัติ</span>
  </div>;
}
