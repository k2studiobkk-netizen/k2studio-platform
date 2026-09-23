import LoginForm from "./LoginForm";

export const dynamic = "force-static";

export default function LoginPage() {
  return <main className="staffLoginPage"><section><img src="/assets/k2sign-logo.png" alt="K2SIGN"/><span>STAFF SIGN IN</span><h1>เข้าสู่ระบบทีมงาน</h1><p>ใช้ไอดีและรหัสผ่านของคุณเพื่อจัดการใบสั่งงาน</p><LoginForm /></section></main>;
}
