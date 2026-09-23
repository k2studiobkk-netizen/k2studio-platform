import { env } from "cloudflare:workers";
import { sendTelegram } from "../../../../integrations";
import { audit, getStaffUser } from "../../../../staff-auth";

export async function POST() {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });

  const runtime = env as unknown as {
    DB: D1Database;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    PUBLIC_SITE_URL?: string;
  };
  const baseUrl = (runtime.PUBLIC_SITE_URL || "https://order.k2group.site").replace(/\/$/, "");
  const releaseKey = "2026-09-14-print-safe-qr-v1";
  const delivered = await runtime.DB.prepare("SELECT sent_at FROM system_update_notifications WHERE release_key=? LIMIT 1")
    .bind(releaseKey).first<{ sent_at: string }>();
  if (delivered) return Response.json({ ok: true, alreadySent: true, message: "ประกาศนี้ส่งไป Telegram แล้ว" });

  const message = [
    "✅ อัปเดต QR บนใบงาน K2STUDIO",
    "",
    "แก้ปัญหา QR บนใบงานพิมพ์ออกมาไม่ครบหรือสแกนไม่ติดแล้ว",
    "• เพิ่มขนาดและความละเอียดของ QR",
    "• เพิ่มขอบขาวรอบ QR และใช้สีดำเพื่อให้เครื่องพิมพ์อ่านง่าย",
    "• เพิ่มระดับแก้ข้อผิดพลาดสูงสุด",
    "• ป้องกันกล่อง QR ถูกตัดข้ามหน้ากระดาษ",
    "• ปุ่มพิมพ์จะรอจน QR สร้างเสร็จก่อนเปิดหน้าพิมพ์",
    "",
    "กรุณา Reload ใบงานหนึ่งครั้งก่อนพิมพ์ครั้งถัดไป",
  ].join("\n");

  try {
    await sendTelegram(runtime, message, [
      { text: "🖨 เปิดรายการใบงาน", url: `${baseUrl}/admin#orders` },
      { text: "📊 เปิดระบบหลังบ้าน", url: `${baseUrl}/admin` },
    ]);
    await runtime.DB.prepare("INSERT OR IGNORE INTO system_update_notifications (release_key,title,sent_by) VALUES (?,?,?)")
      .bind(releaseKey, "แก้ QR ใบงานสำหรับการพิมพ์", user.id).run();
    await audit(user, null, "ส่งประกาศอัปเดตระบบไป Telegram", releaseKey);
    return Response.json({ ok: true, message: "ส่งประกาศไปยัง Telegram แล้ว" });
  } catch (error) {
    console.error(JSON.stringify({ event: "telegram_finance_visibility_update_error", error: String(error) }));
    return Response.json({ error: "ส่ง Telegram ไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 502 });
  }
}
