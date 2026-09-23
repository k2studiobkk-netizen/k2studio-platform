import { env } from "cloudflare:workers";
import { sendTelegramPhoto } from "../../../../integrations";
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
  const releaseKey = "2026-09-14-graphic-claim-v1";
  const delivered = await runtime.DB.prepare("SELECT sent_at FROM system_update_notifications WHERE release_key=? LIMIT 1")
    .bind(releaseKey).first<{ sent_at: string }>();
  if (delivered) return Response.json({ ok: true, alreadySent: true, message: "ประกาศนี้ส่งไป Telegram แล้ว" });
  const caption = [
    "🎨 อัปเดตระบบงานกราฟิก K2STUDIO",
    "",
    "ตอนนี้เพิ่มปุ่ม ‘รับงานกราฟิก’ ในหน้าใบงานแล้ว",
    "",
    "วิธีใช้งาน",
    "1. เปิดใบงานที่ได้รับมอบหมาย",
    "2. กดปุ่ม ‘รับงานกราฟิก’",
    "3. ระบบจะบันทึกชื่อผู้รับงานและเวลาอัตโนมัติ",
    "4. เมื่อทำแบบเสร็จ ให้อัปโหลดแบบส่งให้ลูกค้าคอนเฟิร์มตามปกติ",
    "",
    "หากไม่มีผู้รับงานหรือไม่มีความคืบหน้าเกิน 24 ชั่วโมง ระบบจะแจ้งเตือนหน้าแดชบอร์ดและ Telegram",
    "เมื่อมีการส่งแบบ อนุมัติ หรือพิมพ์ใบงาน ระบบจะอัปเดตและปิดคำเตือนเดิมอัตโนมัติ",
  ].join("\n");

  try {
    await sendTelegramPhoto(runtime, `${baseUrl}/assets/graphic-claim-update.png`, caption, [
      { text: "🎨 เปิดระบบหลังบ้าน", url: `${baseUrl}/admin` },
    ]);
    await runtime.DB.prepare("INSERT OR IGNORE INTO system_update_notifications (release_key,title,sent_by) VALUES (?,?,?)")
      .bind(releaseKey, "อัปเดตปุ่มรับงานกราฟิก", user.id).run();
    await audit(user, null, "ส่งประกาศอัปเดตระบบไป Telegram", `${releaseKey} • graphic-claim-update.png`);
    return Response.json({ ok: true, message: "ส่งประกาศพร้อมภาพไปยัง Telegram แล้ว" });
  } catch (error) {
    console.error(JSON.stringify({ event: "telegram_graphic_update_error", error: String(error) }));
    return Response.json({ error: "ส่ง Telegram ไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 502 });
  }
}
