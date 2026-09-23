"use client";

import { useEffect, useState } from "react";
import { createPasswordProof } from "../../client-password";

export default function LoginForm({ returnTo: initialReturnTo = "/admin", initialError = "" }: { returnTo?: string; initialError?: string }) {
  const [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState(initialReturnTo);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    // Some chat apps keep showing a previously opened plain-HTTP login page.
    // Web Crypto is unavailable on an insecure origin, so move the entire
    // browser to HTTPS before requesting a challenge or deriving a proof.
    if (window.location.protocol === "http:" && window.location.hostname !== "localhost") {
      const secureUrl = new URL(window.location.href);
      secureUrl.protocol = "https:";
      secureUrl.port = "";
      window.location.replace(secureUrl.toString());
      return;
    }
    const query = new URLSearchParams(window.location.search);
    setReturnTo(query.get("returnTo") || initialReturnTo);
    const queryError = query.get("error");
    if (queryError === "credentials") setError("ไอดีหรือรหัสผ่านไม่ถูกต้อง");
    if (queryError === "system") setError("กรุณารีเฟรชหน้านี้ แล้วเข้าสู่ระบบอีกครั้ง");
  }, [initialReturnTo]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);

    try {
      if (!window.isSecureContext || !window.crypto?.subtle) {
        if (window.location.protocol !== "https:") {
          const secureUrl = new URL(window.location.href);
          secureUrl.protocol = "https:";
          secureUrl.port = "";
          window.location.replace(secureUrl.toString());
          return;
        }
        setError("เบราว์เซอร์นี้ไม่รองรับการเข้าสู่ระบบอย่างปลอดภัย กรุณาเปิดลิงก์ด้วย Chrome หรือ Safari");
        return;
      }
      const username=String(data.get("username")||"").trim().toLowerCase();
      const password=String(data.get("password")||"");
      const challengeResponse=await fetch(`/api/staff/login/challenge?username=${encodeURIComponent(username)}`,{credentials:"same-origin",cache:"no-store"});
      if(!challengeResponse.ok)throw new Error("challenge");
      const challengeData=await challengeResponse.json()as{salt:string;challenge:string;expires:number;iterations:number};
      const message=`k2-login\n${username}\n${challengeData.challenge}\n${challengeData.expires}`;
      const proof=await createPasswordProof(password,challengeData.salt,challengeData.iterations,message);
      const response = await fetch("/api/staff/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username,
          proof,
          challenge:challengeData.challenge,
          expires:challengeData.expires,
          returnTo,
        }),
      });
      const result = (await response.json()) as { error?: string; redirectTo?: string };

      if (response.ok) {
        window.location.assign(result.redirectTo || "/admin");
        return;
      }
      setError(result.error || "เข้าสู่ระบบไม่สำเร็จ");
    } catch {
      setError("เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="staffLoginForm" method="post" action="/api/staff/login" onSubmit={submit}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>
        ไอดีล็อกอิน
        <input
          name="username"
          required
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <label>
        รหัสผ่าน
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          enterKeyHint="go"
        />
      </label>
      {error && <p role="alert" aria-live="assertive">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
      </button>
      <small className="staffLoginMobileHint">บนมือถือสามารถกดปุ่ม Go / ไป บนแป้นพิมพ์เพื่อเข้าสู่ระบบได้</small>
    </form>
  );
}
