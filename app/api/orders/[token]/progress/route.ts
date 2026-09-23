import { env } from "cloudflare:workers";
import { audit, getStaffUser } from "../../../../staff-auth";

const acceptedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);
const extensionForType: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
const maximumFileSize = 20 * 1024 * 1024;
const maximumTotalSize = 60 * 1024 * 1024;

function imageType(file: File) {
  const declared = file.type.toLowerCase();
  if (acceptedTypes.has(declared)) return declared === "image/jpg" ? "image/jpeg" : declared;
  const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" } as Record<string, string>)[extension] || "";
}

async function uploadablePhoto(images: ImagesBinding, file: File, type: string) {
  if (type !== "image/heic" && type !== "image/heif") {
    return { body: file.stream(), fileName: file.name.slice(0, 180), fileType: type, extension: extensionForType[type] };
  }
  const converted = await images.input(file.stream())
    .transform({ width: 2400, fit: "scale-down" })
    .output({ format: "image/jpeg", quality: 85, anim: false });
  const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 170) || "mobile-photo";
  return { body: converted.image(), fileName: `${baseName}.jpg`, fileType: "image/jpeg", extension: "jpg" };
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/i.test(token)) return new Response("Not found", { status: 404 });
  const photoId = Number(new URL(request.url).searchParams.get("photo"));
  if (!Number.isInteger(photoId) || photoId < 1) return new Response("Not found", { status: 404 });

  const runtime = env as unknown as { DB: D1Database; ORDER_FILES: R2Bucket };
  const photo = await runtime.DB.prepare(`
    SELECT p.file_key,p.file_type
    FROM order_progress_photos p
    JOIN orders o ON o.id=p.order_id
    WHERE p.id=? AND o.public_token=?
    LIMIT 1
  `).bind(photoId, token).first<{ file_key: string; file_type: string }>();
  if (!photo) return new Response("Not found", { status: 404 });
  const object = await runtime.ORDER_FILES.get(photo.file_key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: {
    "content-type": photo.file_type,
    "cache-control": "private, max-age=60",
    "x-content-type-options": "nosniff",
  } });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const user = await getStaffUser();
  if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบทีมงาน" }, { status: 401 });
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/i.test(token)) return Response.json({ error: "ไม่พบใบสั่งงาน" }, { status: 404 });

  const runtime = env as unknown as { DB: D1Database; ORDER_FILES: R2Bucket; IMAGES: ImagesBinding };
  const order = await runtime.DB.prepare("SELECT id,order_number,order_status FROM orders WHERE public_token=? LIMIT 1")
    .bind(token).first<{ id: number; order_number: string; order_status: string }>();
  if (!order) return Response.json({ error: "ไม่พบใบสั่งงาน" }, { status: 404 });

  const form = await request.formData();
  const files = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  const caption = String(form.get("caption") || "").trim().slice(0, 300);
  if (!files.length) return Response.json({ error: "กรุณาเลือกภาพอย่างน้อย 1 ภาพ" }, { status: 400 });
  if (files.length > 10) return Response.json({ error: "อัปโหลดได้ครั้งละไม่เกิน 10 ภาพ" }, { status: 400 });
  if (files.reduce((total, file) => total + file.size, 0) > maximumTotalSize) return Response.json({ error: "ขนาดภาพรวมต้องไม่เกิน 60 MB กรุณาแบ่งอัปโหลดหลายครั้ง" }, { status: 400 });
  const fileTypes = files.map(imageType);
  for (const file of files) {
    if (!imageType(file)) return Response.json({ error: "รองรับเฉพาะ JPG, PNG, WEBP, HEIC และ HEIF" }, { status: 400 });
    if (file.size > maximumFileSize) return Response.json({ error: `ภาพ ${file.name || "จากกล้อง"} มีขนาดเกิน 20 MB` }, { status: 400 });
  }

  const uploaded: Array<{ key: string; fileName: string; fileType: string }> = [];
  try {
    // Progress photos are append-only. Every upload receives a unique object
    // key and a new database row tagged with the status at upload time, so a
    // later stage can never replace photos from an earlier stage.
    for (const [index, file] of files.entries()) {
      const prepared = await uploadablePhoto(runtime.IMAGES, file, fileTypes[index]);
      const key = `orders/${order.id}/progress/${crypto.randomUUID()}.${prepared.extension}`;
      await runtime.ORDER_FILES.put(key, prepared.body, {
        httpMetadata: { contentType: prepared.fileType },
        customMetadata: { orderNumber: order.order_number, uploadedBy: user.username, workflowStatus: order.order_status },
      });
      uploaded.push({ key, fileName: prepared.fileName, fileType: prepared.fileType });
    }
    await runtime.DB.batch(uploaded.map(({ key, fileName, fileType }) => runtime.DB.prepare(`
      INSERT INTO order_progress_photos
      (order_id,status,file_name,file_key,file_type,caption,created_by_id,created_by_name)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(order.id, order.order_status, fileName, key, fileType, caption, user.id, user.displayName)));
    await audit(user, order.id, "อัปโหลดภาพความคืบหน้า", `${uploaded.length} ภาพ • ${caption || "ไม่มีคำอธิบาย"}`);
    return Response.json({ ok: true, count: uploaded.length, status: order.order_status });
  } catch (error) {
    await Promise.all(uploaded.map(({ key }) => runtime.ORDER_FILES.delete(key)));
    console.error("progress photo upload failed", error);
    return Response.json({ error: "อัปโหลดภาพไม่สำเร็จ กรุณาลองอีกครั้ง" }, { status: 500 });
  }
}
