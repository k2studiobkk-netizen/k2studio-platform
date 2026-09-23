import { env } from "cloudflare:workers";
import { sendTelegram } from "../../../../integrations";
import { audit, getStaffUser } from "../../../../staff-auth";

export async function POST() {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!(user.role === "admin" || user.role === "production_manager")) {
    return Response.json({ error: "เฉพาะผู้ดูแลระบบหรือผู้จัดการฝ่ายผลิต" }, { status: 403 });
  }

  const runtime = env as unknown as {
    DB: D1Database;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    PUBLIC_SITE_URL?: string;
  };
  const baseUrl = (runtime.PUBLIC_SITE_URL || "https://order.k2group.site").replace(/\/$/, "");
  const releaseKey = "2026-09-21-order-builder-readability-v1";
  const delivered = await runtime.DB.prepare("SELECT sent_at FROM system_update_notifications WHERE release_key=? LIMIT 1")
    .bind(releaseKey).first<{ sent_at: string }>();
  if (delivered) return Response.json({ ok: true, alreadySent: true, message: "ประกาศนี้ส่งไป Telegram แล้ว" });

  const message = [
    "🔠 อัปเดตตัวอักษรหน้าสร้างใบงาน K2STUDIO",
    "",
    "ปรับขนาดตัวอักษรให้ทีมงานอ่านและกรอกข้อมูลง่ายขึ้นแล้ว",
    "",
    "• หัวข้อ ปุ่ม และคำอธิบายใหญ่ขึ้น",
    "• ช่องกรอกบนมือถือใช้ขนาด 16px ไม่ต้องซูม",
    "• ปรับสรุปยอดและวิธีชำระเงินให้อ่านชัดขึ้น",
    "• รองรับทั้งจอคอมและมือถือโดยไม่ล้นหน้าจอ",
    "",
    "หากเปิดหน้าเดิมค้างไว้ ให้รีเฟรช 1 ครั้งเพื่อรับรูปแบบใหม่",
  ].join("\n");

  try {
    await sendTelegram(runtime, message, [
      { text: "🧾 เปิดหน้าสร้างใบงาน", url: `${baseUrl}/admin/orders/new` },
    ]);
    await runtime.DB.prepare("INSERT OR IGNORE INTO system_update_notifications (release_key,title,sent_by) VALUES (?,?,?)")
      .bind(releaseKey, "อัปเดตขนาดตัวอักษรหน้าสร้างใบงาน", user.id).run();
    await audit(user, null, "ส่งประกาศอัปเดตระบบไป Telegram", releaseKey);
    return Response.json({ ok: true, message: "ส่งประกาศไปยัง Telegram แล้ว" });
  } catch (error) {
    console.error(JSON.stringify({ event: "telegram_order_builder_update_error", error: String(error) }));
    return Response.json({ error: "ส่ง Telegram ไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 502 });
  }
}
