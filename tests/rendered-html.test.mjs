import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function importTypeScriptModule(url) {
  const source = await readFile(url, "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}

async function render(path = "/", init = { headers: { accept: "text/html" } }) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, init), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, DB: {}, ORDER_FILES: {},
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("public homepage renders pricing and information without order creation", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /รับผลิตสินค้าพรีเมียม/);
  assert.match(html, /K2STUDIO/);
  assert.match(html, /ของแจกและของที่ระลึก/);
  assert.match(html, /เครื่องเขียนและของใช้สำนักงาน/);
  assert.match(html, /คำนวณราคาเบื้องต้น/);
  assert.match(html, /property="og:site_name" content="K2STUDIO"/);
  assert.match(html, /property="og:image" content="https:\/\/order\.k2group\.site\/og-k2studio\.png"/);
  assert.match(html, /property="og:image:type" content="image\/png"/);
  assert.match(html, /name="twitter:image" content="https:\/\/order\.k2group\.site\/og-k2studio\.png"/);
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-title" content="K2 Order"/);
  assert.doesNotMatch(html, /class="submit"/);
  assert.doesNotMatch(html, /name="artwork"/);
  assert.doesNotMatch(html, /name="payment_slip"/);
  assert.doesNotMatch(html, /ส่งข้อมูลเพื่อเปิดงาน/);
  assert.match(html, /href="\/admin\/login\?returnTo=%2Fadmin%2Forders%2Fnew"/);
  assert.match(html, /Staff Login/);
  assert.match(html, /href="\/price-list"/);
  assert.match(html, /ตารางราคาพวงกุญแจ/);
  assert.match(html, /ดูตารางราคาพวงกุญแจทุกขนาดและจำนวน/);
  assert.match(html, /ผลงานจริง/);
  assert.match(html, /drive\.google\.com\/thumbnail/);
  assert.match(html, /ดูผลงานเพิ่มเติม/);
});

test("order API persists records and uploaded artwork", async () => {
  const home = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const orderEdit = await readFile(new URL("../app/admin/OrderEditForm.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
  const publicArtwork = await readFile(new URL("../app/api/orders/[token]/artwork/route.ts", import.meta.url), "utf8");
  const orderDocument = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const hosting = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"));
  assert.equal(hosting.d1, "DB");
  assert.equal(hosting.r2, "ORDER_FILES");
  assert.match(route, /ORDER_FILES\.put/);
  assert.match(route, /กรุณาเข้าสู่ระบบทีมงานก่อนสร้างใบงาน/);
  assert.match(route, /audit\(staffUser,saved\.id,"สร้างใบงาน"/);
  assert.match(route, /INSERT INTO orders/);
  assert.match(route, /calculatedSubtotal/);
  assert.match(route, /SELECT hardware_code,price FROM hardware_prices/);
  assert.match(home, /รวม ฿\{money\(payableTotal\)\}/);
  assert.match(home, /<b>รายการสินค้า<\/b>\{effectiveItems\.map/);
  assert.match(home, /`฿\$\{money\(payableTotal\)\}/);
  assert.match(route, /items\.reduce\(\(sum,item\)=>sum\+item\.lineTotal/);
  assert.match(route, /15\*1024\*1024/);
  assert.match(route, /payment-slips/);
  assert.match(route, /SELECT code,prefix,name FROM sales_channels/);
  assert.match(route, /printf\('%04d'/);
  assert.match(route, /RETURNING id,order_number/);
  assert.match(home, /salesChannels\.map/);
  assert.match(home, /channel\.prefix/);
  assert.match(home, /className="deliveryDateCard wide"/);
  assert.match(home, /name="requested_date"/);
  assert.match(home, /กำหนดส่งงาน/);
  assert.match(orderEdit, /className="orderDueDateField"/);
  assert.match(orderEdit, /name="requestedDate" type="date"/);
  assert.match(css, /\.deliveryDateCard\{/);
  assert.doesNotMatch(css, /\.order \.formGrid>label:nth-child/);
  assert.match(publicArtwork, /artwork_type\.startsWith\("image\/"\)/);
  assert.match(publicArtwork, /public_token = \?/);
  assert.match(orderDocument, /รายละเอียดราคา/);
  assert.match(home, /เพิ่มรายการนี้ในใบสั่งงาน/);
  assert.match(home, /items_json/);
  assert.match(home, /const orderItems = effectiveItems/);
  assert.match(home, /hasPendingItem/);
  assert.match(orderDocument, /order_items/);
  assert.match(orderDocument, /items\.length>1/);
  assert.match(orderDocument, /ราคาต่อชิ้น|\/ชิ้น/);
  assert.match(orderDocument, /แพ็ก \$\{item\.packaging_type\}/);
  assert.match(orderDocument, /ม็อกอัพสินค้าสมจริง/);
  assert.match(orderDocument, /ฐานภาษี \(รวมอะไหล่\/ค่าส่ง\)/);
  assert.match(schema, /sqliteTable\("orders"/);
  assert.match(schema, /sqliteTable\("hardware_prices"/);
});

test("admin route enforces staff authentication and audit attribution", async () => {
  const admin = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const auth = await readFile(new URL("../app/staff-auth.ts", import.meta.url), "utf8");
  const mutation = await readFile(new URL("../app/api/admin/orders/[id]/route.ts", import.meta.url), "utf8");
  const usersApi = await readFile(new URL("../app/api/staff/users/route.ts", import.meta.url), "utf8");
  const userManager = await readFile(new URL("../app/admin/users/UserManager.tsx", import.meta.url), "utf8");
  const clientPassword = await readFile(new URL("../app/client-password.ts", import.meta.url), "utf8");
  const newOrder = await readFile(new URL("../app/admin/orders/new/page.tsx", import.meta.url), "utf8");
  assert.match(admin, /requireStaff\("\/admin"\)/);
  assert.doesNotMatch(auth, /PBKDF2/);
  assert.match(auth, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(auth, /STAFF_SESSION_MAX_AGE_SECONDS=400\*24\*60\*60/);
  assert.match(auth, /Max-Age=\$\{STAFF_SESSION_MAX_AGE_SECONDS\}/);
  assert.match(auth, /Expires=\$\{expiresAt\.toUTCString\(\)\}/);
  assert.doesNotMatch(auth, /mustChangePassword&&!returnTo/);
  assert.match(mutation, /audit\(user/);
  assert.match(usersApi, /admin\.role\s*!==\s*"admin"/);
  assert.match(usersApi, /readPasswordMaterial\(body, 8\)/);
  assert.doesNotMatch(usersApi, /passwordHash\(/);
  assert.match(userManager, /createPasswordMaterial/);
  assert.match(clientPassword, /PBKDF2/);
  assert.match(usersApi, /VALUES \(\?,\?,\?,\?,\?,0,1\)/);
  assert.match(admin, /export const dynamic = "force-dynamic"/);
  assert.match(newOrder, /requireStaff\("\/admin\/orders\/new"\)/);
  assert.match(newOrder, /<Home\s+canCreateOrder/);
  assert.match(newOrder, /staffName=\{user\.displayName\}/);
  assert.match(newOrder, /canManagePricing=\{canManagePricing\(user\)\}/);
  assert.match(newOrder, /canManageUsers=\{user\.role === "admin"\}/);
  const home = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(home, /สร้างใบสั่งงาน/);
  assert.match(home, /href="\/admin#orders"/);
  assert.match(home, /กลับหน้าหลังบ้าน/);
  assert.match(home, /staffNavName/);
});

test("admin workspace exposes a role-aware menu for every production module", async () => {
  const admin = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const sidebar = await readFile(new URL("../app/admin/AdminSidebarNav.tsx", import.meta.url), "utf8");
  const menu = await readFile(new URL("../app/admin/AdminModuleMenu.tsx", import.meta.url), "utf8");
  const backup = await readFile(new URL("../app/admin/BackupStatus.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(admin, /<AdminModuleMenu role=\{user\.role\}/);
  assert.match(admin, /<AdminSidebarNav role=\{user\.role\}/);
  assert.match(sidebar, /\/admin\/production\/calendar/);
  assert.match(sidebar, /department=print_cut/);
  assert.match(sidebar, /department=pack/);
  assert.match(sidebar, /department=sale/);
  assert.match(sidebar, /adminNavGroupTabs/);
  assert.match(sidebar, /aria-selected/);
  assert.match(menu, /ทางลัดสำหรับงานประจำวัน/);
  assert.match(menu, /ศูนย์วางแผนการผลิต/);
  assert.match(menu, /Live Broadcast/);
  assert.match(menu, /Machines & Capacity/);
  assert.match(menu, /allowed\("broadcast:send"\)/);
  assert.match(menu, /allowed\("capacity:manage"\)/);
  assert.match(menu, /target=\{item\.external \? "_blank"/);
  assert.match(backup, /id="backups"/);
  assert.match(css, /\.adminModuleGroups\{display:grid/);
  assert.match(css, /\.adminModuleLauncher>header/);
  assert.match(css, /Compact grouped navigation/);
});

test("one staff account can be assigned to multiple operational teams", async () => {
  const rbac = await readFile(new URL("../app/production-rbac.ts", import.meta.url), "utf8");
  const auth = await readFile(new URL("../app/staff-auth.ts", import.meta.url), "utf8");
  const manager = await readFile(new URL("../app/admin/users/UserManager.tsx", import.meta.url), "utf8");
  const createUser = await readFile(new URL("../app/api/staff/users/route.ts", import.meta.url), "utf8");
  const updateUser = await readFile(new URL("../app/api/staff/users/[id]/route.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0025_staff_user_teams.sql", import.meta.url), "utf8");
  const backup = await readFile(new URL("../app/daily-backup.ts", import.meta.url), "utf8");
  assert.match(rbac, /staffTeams = \["sale", "graphic", "print_cut", "pack"\]/);
  assert.match(rbac, /defaultStaffTeamsForRole/);
  assert.match(auth, /teams:StaffTeam\[\]/);
  assert.match(auth, /GROUP_CONCAT\(t\.team_code/);
  assert.match(manager, /data\.getAll\("teams"\)/);
  assert.match(manager, /เลือกได้มากกว่า 1 ทีม/);
  assert.match(manager, /บันทึกข้อมูลและทีม/);
  assert.match(createUser, /INSERT INTO staff_user_teams/);
  assert.match(updateUser, /DELETE FROM staff_user_teams WHERE user_id=\?/);
  assert.match(updateUser, /INSERT INTO staff_user_teams/);
  assert.match(schema, /sqliteTable\("staff_user_teams"/);
  assert.match(migration, /CREATE UNIQUE INDEX `idx_staff_user_teams_user_team`/);
  assert.match(backup, /staffTeams/);
});

test("admin dashboard matches the K2STUDIO brand and keeps primary actions easy to find", async () => {
  const admin = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const sidebar = await readFile(new URL("../app/admin/AdminSidebarNav.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(admin, /k2studio-logo-reference-v1\.png/);
  assert.match(admin, /K2STUDIO ADMIN/);
  assert.match(admin, /สร้างใบงานใหม่/);
  assert.match(sidebar, /ปฏิทินการผลิต/);
  assert.match(admin, /adminTopbarCtas/);
  assert.doesNotMatch(admin, /<i>0[1-9]<\/i>/);
  assert.match(css, /K2STUDIO admin workspace/);
  assert.match(css, /--admin-pink:#d9165b/);
  assert.match(css, /\.adminSidebar nav>a\{[^}]*min-height:44px/);
  assert.match(css, /\.adminModuleGroups\{display:grid;grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(css, /\.productionTabs a\.active\{background:#d9165b/);
  assert.match(admin, /ภาพแบบลูกค้าคอนเฟิร์ม/);
  assert.match(admin, /previewsByOrder/);
  assert.match(admin, /design\?asset=/);
  assert.match(admin, /ROW_NUMBER\(\) OVER/);
  assert.match(css, /\.adminOrderPreview\{display:flex/);
  assert.match(css, /scroll-snap-type:x mandatory/);
  assert.match(css, /\.adminTable td\{[^}]*font-size:16px/);
  assert.match(admin, /ค้นหาเลขใบงาน/);
  assert.match(admin, /name="q" type="search"/);
  assert.match(admin, /UPPER\(o\.order_number\) LIKE \?/);
  assert.match(admin, /ค้นหาได้จากเลขเต็มหรือเลขบางส่วน/);
  assert.match(css, /\.adminOrderSearch\{display:grid/);
  assert.match(css, /\.adminOrderSearch input\{[^}]*font-size:16px/);
});

test("mobile staff login remains tappable and does not force a password change", async () => {
  const page = await readFile(new URL("../app/admin/login/page.tsx", import.meta.url), "utf8");
  const form = await readFile(new URL("../app/admin/login/LoginForm.tsx", import.meta.url), "utf8");
  const loginApi = await readFile(new URL("../app/api/staff/login/route.ts", import.meta.url), "utf8");
  const challengeApi = await readFile(new URL("../app/api/staff/login/challenge/route.ts", import.meta.url), "utf8");
  const auth = await readFile(new URL("../app/staff-auth.ts", import.meta.url), "utf8");
  const clientPassword = await readFile(new URL("../app/client-password.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(form, /enterKeyHint="go"/);
  assert.match(page, /dynamic = "force-static"/);
  assert.doesNotMatch(page, /searchParams/);
  assert.match(form, /window\.location\.search/);
  assert.match(form, /window\.location\.protocol === "http:"/);
  assert.match(form, /window\.location\.replace\(secureUrl\.toString\(\)\)/);
  assert.match(form, /window\.isSecureContext/);
  assert.match(form, /Chrome หรือ Safari/);
  assert.match(form, /type="submit"/);
  assert.match(form, /method="post" action="\/api\/staff\/login"/);
  assert.match(form, /type="hidden" name="returnTo"/);
  assert.match(form, /credentials: "same-origin"/);
  assert.match(form, /เชื่อมต่อระบบไม่ได้/);
  assert.match(form, /login\/challenge/);
  assert.match(form, /createPasswordProof/);
  assert.match(clientPassword, /crypto\.subtle\.deriveBits/);
  assert.match(loginApi, /request\.formData\(\)/);
  assert.match(loginApi, /Response\.redirect\(loginRedirect/);
  assert.match(loginApi, /status:303/);
  assert.doesNotMatch(loginApi, /passwordHash\(/);
  assert.doesNotMatch(auth, /PBKDF2/);
  assert.match(loginApi, /passwordProof/);
  assert.match(loginApi, /timingSafeBase64Equal/);
  assert.match(challengeApi, /iterations:100_000/);
  assert.match(challengeApi, /cache-control":"no-store/);
  assert.match(auth, /timingSafeBase64Equal/);
  assert.match(auth, /difference\|=/);
  assert.doesNotMatch(loginApi, /admin\/change-password\?returnTo/);
  assert.match(loginApi, /must_change_password=0/);
  assert.match(loginApi, /cache-control":"no-store/);
  assert.match(css, /min-height:100dvh/);
  assert.match(css, /touch-action:manipulation/);
  assert.match(css, /place-items:start center/);
});

test("mobile admin workspace reflows without requiring browser zoom", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const admin = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(layout, /export const viewport/);
  assert.match(layout, /width: "device-width"/);
  assert.match(layout, /initialScale: 1/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(admin, /data-label="เลขที่งาน"/);
  assert.match(admin, /data-label="สถานะ"/);
  assert.match(admin, />ดูใบงาน</);
  assert.match(css, /Mobile admin workspace/);
  assert.match(css, /\.adminSidebar nav\{display:flex;position:static/);
  assert.match(css, /\.adminTable thead\{display:none\}/);
  assert.match(css, /content:attr\(data-label\)/);
  assert.match(css, /\.orderEditGrid\{grid-template-columns:1fr\}/);
  assert.match(css, /\.adminDetail input[^}]*font-size:16px/);
  assert.match(css, /min-height:48px/);
  assert.match(admin, /adminMobileProductionNav/);
  assert.match(admin, /ปฏิทินงาน/);
  assert.match(css, /\.productionWorkspace :where\(\.productionMetricGrid,\.productionDashboardGrid,\.calendarToolbar,\.calendarSourceLayout,\.productionCalendar\)\{padding:0\}/);
  assert.match(css, /\.productionTabs\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.calendarPaging\{display:grid;grid-template-columns:minmax\(82px,auto\) minmax\(0,1fr\) minmax\(82px,auto\)/);
  assert.match(css, /\.adminShell\{width:100%;grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /\.adminSidebar\{width:100%;min-width:0;max-width:100vw;overflow:hidden\}/);
  assert.match(css, /\.calendarSourceLayout>div\{width:100%;overflow:hidden\}/);
  assert.match(css, /Fluid mobile screens and unmistakable work-order buttons/);
  assert.match(css, /\.adminView\{[^}]*color:#fff!important/);
  assert.match(css, /\.trackingActions a\{[^}]*color:#fff!important/);
  assert.match(css, /@media\(max-width:420px\)/);
  assert.match(css, /\.statusCommandForm\{grid-template-columns:1fr\}/);
  assert.match(css, /\.productionTimeline\{width:100%;overflow-x:auto/);
  assert.match(css, /\.productionCalendar\.day,\.productionCalendar\.week,\.productionCalendar\.month\{width:100%;min-width:0\}/);
});

test("chatgpt.site aliases retain a configurable canonical destination", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(worker, /hostname\.endsWith\("\.chatgpt\.site"\)/);
  assert.match(worker, /Response\.redirect\(url\.toString\(\), 308\)/);
  assert.match(worker, /CANONICAL_HOSTNAME/);
  assert.match(worker, /order\.k2group\.site/);
  assert.match(wrangler, /"routes": \[\]/);
  assert.match(wrangler, /"CANONICAL_HOSTNAME": "localhost"/);
  assert.match(wrangler, /"PUBLIC_SITE_URL": "http:\/\/localhost:8787"/);
});

test("canonical domain forces HTTPS before staff authentication", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-https`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://order.k2group.site/admin/login?returnTo=%2Fadmin"), {
    CANONICAL_HOSTNAME: "order.k2group.site",
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    DB: {}, ORDER_FILES: {},
  }, { waitUntil() {}, passThroughOnException() {} });

  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://order.k2group.site/admin/login?returnTo=%2Fadmin");
});

test("staff login responses disable in-app browser caching and enable HSTS", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /no-store, no-cache, must-revalidate/);
  assert.match(worker, /strict-transport-security/);
  assert.match(worker, /max-age=31536000/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/staff\/login"\)/);
  assert.match(worker, /STAFF_SESSION_MAX_AGE_SECONDS = 400 \* 24 \* 60 \* 60/);
  assert.match(worker, /STAFF_REFRESH_INTERVAL_SECONDS = 30 \* 24 \* 60 \* 60/);
  assert.match(worker, /k2_staff_refresh=1/);
  assert.match(worker, /UPDATE staff_sessions SET expires_at=/);
  assert.match(worker, /url\.pathname !== "\/api\/staff\/logout"/);
});

test("finance and sales permissions are explicit while user accounts remain admin-only", async () => {
  const auth = await readFile(new URL("../app/staff-auth.ts", import.meta.url), "utf8");
  const rbac = await readFile(new URL("../app/production-rbac.ts", import.meta.url), "utf8");
  const sidebar = await readFile(new URL("../app/admin/AdminSidebarNav.tsx", import.meta.url), "utf8");
  const pricingApi = await readFile(new URL("../app/api/admin/pricing/route.ts", import.meta.url), "utf8");
  const usersApi = await readFile(new URL("../app/api/staff/users/route.ts", import.meta.url), "utf8");
  assert.match(rbac, /if \(role === "manager"\) return "production_manager"/);
  assert.match(rbac, /production_manager: new Set\(\[[^\]]*"orders:edit"/);
  assert.match(rbac, /admin: new Set\(\[[^\]]*"users:manage"/);
  assert.match(auth, /finance:manage/);
  assert.match(sidebar, /permissions/);
  assert.match(pricingApi, /canManagePricing\(user\)/);
  assert.match(usersApi, /admin\.role\s*!==\s*"admin"/);
});

test("CPU-heavy password derivation and QR rendering stay in the browser", async () => {
  const clientPassword = await readFile(new URL("../app/client-password.ts", import.meta.url), "utf8");
  const serverAuth = await readFile(new URL("../app/staff-auth.ts", import.meta.url), "utf8");
  const loginApi = await readFile(new URL("../app/api/staff/login/route.ts", import.meta.url), "utf8");
  const qrComponent = await readFile(new URL("../app/QrCodeImage.tsx", import.meta.url), "utf8");
  const adminOrder = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const customerOrder = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");
  const trackingPage = await readFile(new URL("../app/track/[token]/page.tsx", import.meta.url), "utf8");

  assert.match(clientPassword, /PBKDF2/);
  assert.doesNotMatch(serverAuth, /PBKDF2/);
  assert.doesNotMatch(loginApi, /PBKDF2/);
  assert.match(qrComponent, /"use client"/);
  assert.match(qrComponent, /QRCode\.toDataURL/);
  assert.match(qrComponent, /margin: 4/);
  assert.match(qrComponent, /errorCorrectionLevel: "H"/);
  assert.match(qrComponent, /data-k2-qr="ready"/);
  assert.doesNotMatch(adminOrder, /QRCode\.toDataURL|from\s+["']qrcode["']/);
  assert.doesNotMatch(customerOrder, /QRCode\.toDataURL|from\s+["']qrcode["']/);
  assert.doesNotMatch(trackingPage, /QRCode\.toDataURL|from\s+["']qrcode["']/);
});

test("Telegram notices include direct order document links and action buttons", async () => {
  const integrations = await readFile(new URL("../app/integrations.ts", import.meta.url), "utf8");
  const orderApi = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
  assert.match(integrations, /ดูใบงาน/);
  assert.match(integrations, /ใบงานฝ่ายผลิต \/ บันทึก PDF/);
  assert.match(integrations, /inline_keyboard/);
  assert.match(integrations, /\/admin\/orders\/\$\{order\.id\}/);
  assert.match(orderApi, /publicToken,orderNumber/);
});

test("design approval accepts scale, mockup or both before production release", async () => {
  const uploadForm = await readFile(new URL("../app/admin/DesignUploadForm.tsx", import.meta.url), "utf8");
  const designApi = await readFile(new URL("../app/api/admin/orders/[id]/designs/route.ts", import.meta.url), "utf8");
  const designImageApi = await readFile(new URL("../app/api/orders/[token]/design/route.ts", import.meta.url), "utf8");
  const orderDocument = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");
  const approvalPanel = await readFile(new URL("../app/order/[token]/ApprovalPanel.tsx", import.meta.url), "utf8");
  const approvalApi = await readFile(new URL("../app/api/orders/[token]/approval/route.ts", import.meta.url), "utf8");
  const orderMutation = await readFile(new URL("../app/api/admin/orders/[id]/route.ts", import.meta.url), "utf8");
  const statusUpdate = await readFile(new URL("../app/order-status-update.ts", import.meta.url), "utf8");
  const adminList = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");

  assert.match(uploadForm, /name="scale_design"/);
  assert.match(uploadForm, /name="mockup_design"/);
  assert.match(uploadForm, /เลือกอย่างใดอย่างหนึ่งหรือทั้งสองประเภทก็ได้/);
  assert.doesNotMatch(uploadForm, /required type="file"/);
  assert.match(uploadForm, /multiple type="file"/);
  assert.match(uploadForm, /ข้อความใต้ภาพ — กรอกได้อิสระ/);
  assert.match(uploadForm, /name={`\$\{type\}_caption_\$\{index\}`}/);
  assert.match(designApi, /getAll\(name\)/);
  assert.match(designApi, /!scaleFiles\.length && !mockupFiles\.length/);
  assert.match(designApi, /อย่างน้อย 1 ภาพ/);
  assert.match(designApi, /INSERT INTO design_assets/);
  assert.match(designApi, /asset\.caption/);
  assert.match(designApi, /scale_file_name/);
  assert.match(designApi, /mockup_file_name/);
  assert.match(designImageApi, /searchParams\.get\("kind"\) === "scale"/);
  assert.match(designImageApi, /searchParams\.get\("asset"\)/);
  assert.match(orderDocument, /แบบมีสเกลสำหรับผลิต/);
  assert.match(orderDocument, /ม็อกอัพสินค้าสมจริง/);
  assert.match(orderDocument, /asset\.caption\|\|asset\.file_name/);
  assert.doesNotMatch(orderDocument, /asset\.file_name\)\}<\/small><small className="balancedImageQuantity">/);
  assert.match(orderDocument, /ผู้จัดทำแบบ \/ ลงชื่อ/);
  assert.match(orderDocument, /ลูกค้าลงชื่อยอมรับ/);
  assert.match(approvalPanel, /ข้าพเจ้ายืนยันข้อมูลและภาพทั้งหมด/);
  assert.match(approvalPanel, /อนุมัติแบบและยืนยันผลิต/);
  assert.match(approvalPanel, /กรุณากรอกชื่อผู้อนุมัติก่อนกดยืนยัน/);
  assert.match(approvalPanel, /กรุณาติ๊กช่องยืนยันข้อมูลและภาพก่อนอนุมัติ/);
  assert.match(approvalPanel, /scrollIntoView/);
  assert.match(approvalPanel, /response\.json\(\)\.catch/);
  assert.match(approvalApi, /UPDATE orders SET order_status='waiting_for_production'/);
  assert.match(approvalApi, /UPDATE work_orders SET status='waiting_for_production',planned_production_date=\?,confirmed_delivery_date=\?/);
  assert.match(approvalApi, /publishBroadcastEvent/);
  assert.match(orderMutation, /updateOrderStatus/);
  assert.doesNotMatch(statusUpdate, /ต้องให้ลูกค้าเซ็นยืนยันแบบก่อนกดส่งผลิต/);
  assert.doesNotMatch(statusUpdate, /เฉพาะฝ่ายผลิตเท่านั้นที่เปลี่ยนสถานะ/);
  assert.match(statusUpdate, /ส่งเข้าผลิตโดย/);
  assert.match(statusUpdate, /production_released_at=CURRENT_TIMESTAMP/);
  assert.match(statusUpdate, /planned_production_date=COALESCE/);
  assert.match(adminList, /ยอดสุทธิ/);
  assert.match(adminList, /Number\(order\.estimated_total\)\+Number\(order\.shipping_fee\|\|0\)/);
  assert.match(schema, /caption: text\("caption"\)\.notNull\(\)\.default\(""\)/);
});

test("one QR tracking page separates customer viewing from staff updates and order-specific photos", async () => {
  const tracking = await readFile(new URL("../app/track/[token]/page.tsx", import.meta.url), "utf8");
  const staffPanel = await readFile(new URL("../app/track/[token]/TrackStaffPanel.tsx", import.meta.url), "utf8");
  const statusApi = await readFile(new URL("../app/api/orders/[token]/staff-update/route.ts", import.meta.url), "utf8");
  const photoApi = await readFile(new URL("../app/api/orders/[token]/progress/route.ts", import.meta.url), "utf8");
  const photoTimeline = await readFile(new URL("../app/ProgressPhotoTimeline.tsx", import.meta.url), "utf8");
  const auth = await readFile(new URL("../app/staff-auth.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");

  assert.match(tracking, /getStaffUser/);
  assert.match(tracking, /TrackStaffPanel/);
  assert.match(tracking, /Staff Login/);
  assert.match(tracking, /FROM order_progress_photos WHERE order_id=\?/);
  assert.match(photoTimeline, /progress\?photo=/);
  assert.match(staffPanel, /staff-update/);
  assert.match(staffPanel, /อัปเดตสถานะทันที/);
  assert.match(staffPanel, /ลูกค้ายังไม่อนุมัติแบบ แต่ทีมงานสามารถเปลี่ยนสถานะและส่งผลิตได้ทันที/);
  assert.match(staffPanel, /name="photos"[\s\S]*multiple/);
  assert.match(statusApi, /getStaffUser/);
  assert.match(statusApi, /WHERE public_token=\?/);
  assert.match(photoApi, /JOIN orders o ON o.id=p.order_id/);
  assert.match(photoApi, /p.id=\? AND o.public_token=\?/);
  assert.match(photoApi, /orders\/\$\{order\.id\}\/progress/);
  assert.match(photoApi, /INSERT INTO order_progress_photos/);
  assert.match(photoApi, /crypto\.randomUUID\(\)/);
  assert.match(staffPanel, /capture="environment"/);
  assert.match(staffPanel, /ถ่ายรูปตอนนี้/);
  assert.match(staffPanel, /เลือกจากเครื่อง/);
  assert.match(staffPanel, /accept="image\/\*,\.heic,\.heif"/);
  assert.match(photoApi, /"image\/heic"/);
  assert.match(photoApi, /runtime\.IMAGES/);
  assert.match(photoApi, /output\(\{ format: "image\/jpeg"/);
  assert.match(photoApi, /maximumTotalSize/);
  assert.doesNotMatch(photoApi, /(?:DELETE FROM|UPDATE) order_progress_photos/);
  assert.match(tracking, /ORDER BY id ASC/);
  assert.match(tracking, /ProgressPhotoTimeline/);
  assert.match(photoTimeline, /statusSteps\.map/);
  assert.match(photoTimeline, /publicOrderStatus\(String\(photo\.status\)\)/);
  assert.match(photoTimeline, /created_by_name/);
  assert.match(staffPanel, /รูปใหม่จะเพิ่มต่อท้ายโดยไม่ลบรูปเดิม/);
  assert.match(schema, /sqliteTable\("order_progress_photos"/);
  assert.match(auth, /value\.startsWith\("\/admin"\)/);
  assert.match(auth, /\^\\\/track\\\/\[a-f0-9\]\{32\}\$/i);
});

test("graphic staff can save an order-specific Google Drive production link", async () => {
  const adminPage = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const form = await readFile(new URL("../app/admin/ProductionFileLinkForm.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/admin/orders/[id]/production-file/route.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");

  assert.match(adminPage, /ProductionFileLinkForm/);
  assert.match(adminPage, /production_file_url/);
  assert.match(form, /ไฟล์พร้อมผลิตจากกราฟิก/);
  assert.match(form, /เปิดไฟล์พร้อมผลิตใน Google Drive/);
  assert.match(form, /production-file/);
  assert.match(api, /getStaffUser/);
  assert.match(api, /drive\.google\.com/);
  assert.match(api, /production_file_url=\?/);
  assert.match(api, /แก้ไขลิงก์ไฟล์พร้อมผลิต/);
  assert.match(schema, /productionFileUrl: text\("production_file_url"\)/);
});

test("order documents stay available without payment confirmation", async () => {
  const orderDocument = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");
  const adminPage = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const auth = await readFile(new URL("../app/staff-auth.ts", import.meta.url), "utf8");

  assert.match(orderDocument, /requestedStaffView=staff==="1"/);
  assert.match(orderDocument, /await getStaffUser\(\)/);
  assert.match(orderDocument, /await requireStaff/);
  assert.doesNotMatch(orderDocument, /!paymentVerified&&!staffView/);
  assert.doesNotMatch(orderDocument, /รอยืนยันการชำระเงิน/);
  assert.match(orderDocument, /PrintButton/);
  assert.match(adminPage, /เปิด \/ พิมพ์ใบสั่งงาน/);
  assert.match(adminPage, /เปิดใบงานฝ่ายผลิต/);
  assert.match(adminPage, /เปิดฉบับลูกค้า/);
  assert.doesNotMatch(adminPage, /paymentLocked/);
  assert.match(auth, /mode=production&staff=1/);
});

test("staff printing or downloading a work order approves and releases it to the production calendar", async () => {
  const orderDocument = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");
  const printButton = await readFile(new URL("../app/order/[token]/PrintButton.tsx", import.meta.url), "utf8");
  const release = await readFile(new URL("../app/api/admin/orders/[id]/work-order/route.ts", import.meta.url), "utf8");
  const adminPage = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");

  assert.match(orderDocument, /PrintButton orderId=\{Number\(order\.id\)\} autoRelease=\{autoRelease\}/);
  assert.match(printButton, /if \(!autoRelease\)/);
  assert.match(printButton, /fetch\(`\/api\/admin\/orders\/\$\{orderId\}\/work-order`/);
  assert.match(printButton, /keepalive: true/);
  assert.match(printButton, /beforeprint/);
  assert.match(printButton, /await waitForPrintableQr\(\)/);
  assert.match(printButton, /อนุมัติแบบและส่งเข้าปฏิทินอัตโนมัติ/);
  assert.match(release, /UPDATE design_versions SET status='approved'/);
  assert.match(release, /production_released_at=CURRENT_TIMESTAMP/);
  assert.match(release, /"artwork_approved"/);
  assert.match(release, /planned_production_date=COALESCE/);
  assert.match(release, /confirmed_delivery_date=COALESCE/);
  assert.match(release, /calendarReady: Boolean\(targetOrderStatus\)/);
  assert.match(release, /WHERE id=\? AND status='draft' RETURNING status/);
  assert.match(release, /WHERE id=\? AND order_status IN \(\$\{placeholders\}\) RETURNING id/);
  assert.match(adminPage, /ส่งผลิตและเข้าปฏิทินอัตโนมัติ/);
});

test("admin order makes the print action visually primary", async () => {
  const adminPage = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(adminPage, /primaryDocumentAction/);
  assert.match(adminPage, /เปิด \/ พิมพ์ใบสั่งงาน/);
  assert.match(adminPage, /PRINT ORDER/);
  assert.match(css, /\.primaryDocumentAction/);
  assert.match(css, /background:#ff5148/);
});

test("printed order document uses large high-contrast typography", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const orderDocument = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");
  const printButton = await readFile(new URL("../app/order/[token]/PrintButton.tsx", import.meta.url), "utf8");
  assert.match(css, /High-contrast A4 output/);
  assert.match(css, /\.balancedPaper\{-webkit-print-color-adjust:exact;print-color-adjust:exact;color:#000;font-size:10\.5pt/);
  assert.match(css, /\.balancedDetails dd\{font-size:9\.5pt;font-weight:500\}/);
  assert.match(css, /\.balancedPrice>div\{padding:1\.5mm 2mm;font-size:8\.5pt\}/);
  assert.match(css, /\.balancedPriceHead :where\(b,span,strong\).*color:#fff!important/);
  assert.match(orderDocument, /ข้อมูลสำคัญสำหรับการผลิต/);
  assert.match(orderDocument, /ความหนาอะคริลิก/);
  assert.match(orderDocument, /ลักษณะการพิมพ์/);
  assert.match(orderDocument, /imageQuantityLabel/);
  assert.match(orderDocument, /balancedImageQuantity/);
  assert.match(orderDocument, /productionDueDateCard/);
  assert.match(orderDocument, /กำหนดส่งงาน/);
  assert.match(orderDocument, /ยังไม่ได้กำหนดวันส่งงาน/);
  assert.match(orderDocument, /FROM order_progress_photos WHERE order_id=\?/);
  assert.match(orderDocument, /staffView&&progressPhotoPages\.map/);
  assert.match(orderDocument, /ภาพที่ทีมงานบันทึก/);
  assert.match(orderDocument, /slice\(pageIndex\*4,pageIndex\*4\+4\)/);
  assert.match(orderDocument, /progress\?photo=\$\{photo\.id\}/);
  assert.match(css, /\.balancedCriticalSpecs b\{font-size:15pt\}/);
  assert.match(css, /\.balancedStatus>\.balancedDueDate strong\{font-size:13pt\}/);
  assert.match(css, /\.productionDueDateCard>b\{font-size:18pt\}/);
  assert.match(css, /@page balancedOrder\{size:A4 portrait;margin:8mm 9mm\}/);
  assert.match(css, /html,body\{width:auto!important;height:auto!important;min-height:0!important;overflow:visible!important\}/);
  assert.match(css, /\.balancedPaper\{page:balancedOrder;width:auto!important;min-width:0!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;overflow:visible!important/);
  assert.match(css, /\.balancedTitle\{break-after:avoid;page-break-after:avoid\}/);
  assert.match(css, /\.balancedVisuals\{break-inside:auto;page-break-inside:auto\}/);
  assert.match(css, /\.balancedVisuals figure,\.balancedPrice>div\{break-inside:avoid;page-break-inside:avoid\}/);
  assert.match(css, /Print-safe QR/);
  assert.match(css, /\.balancedQrBlock \.balancedQr\{display:block;width:28mm;height:28mm;padding:2mm/);
  assert.match(orderDocument, /width=\{720\}/);
  assert.match(orderDocument, /สแกนติดตามงาน/);
  assert.match(printButton, /waitForPrintableQr/);
  assert.match(css, /\.workOrderPhotoGrid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.workOrderPhotoPage\{page:balancedOrder;[\s\S]*break-before:page/);
});

test("admin order detail shows every saved order image as an actual preview", async () => {
  const adminOrder = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(adminOrder, /ภาพที่บันทึกในใบงาน/);
  assert.ok(adminOrder.indexOf("adminSavedImageGalleryPrimary") < adminOrder.indexOf("adminDocumentBar"));
  assert.match(adminOrder, /ทีมงานทุกฝ่ายที่เข้าสู่ระบบจะเห็นภาพ/);
  assert.match(adminOrder, /hasArtworkPreview/);
  assert.match(adminOrder, /designAssets\.map/);
  assert.match(adminOrder, /progressPhotos\.map/);
  assert.match(adminOrder, /\/api\/orders\/\$\{publicToken\}\/artwork/);
  assert.match(adminOrder, /\/api\/orders\/\$\{publicToken\}\/design\?asset=\$\{asset\.id\}/);
  assert.match(adminOrder, /\/api\/orders\/\$\{publicToken\}\/progress\?photo=\$\{photo\.id\}/);
  assert.match(css, /\.adminSavedImageGrid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:520px\)\{\.adminSavedImageGallery/);
});

test("staff can take a progress photo from a searched order without scanning its QR", async () => {
  const adminOrder = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const uploader = await readFile(new URL("../app/admin/QuickProgressPhotoUpload.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(adminOrder, /QuickProgressPhotoUpload/);
  assert.ok(adminOrder.indexOf("QuickProgressPhotoUpload token=") < adminOrder.indexOf("adminSavedImageGalleryPrimary"));
  assert.match(uploader, /ถ่ายรูปงานตอนนี้/);
  assert.match(uploader, /capture="environment"/);
  assert.match(uploader, /accept="image\/\*,\.heic,\.heif"/);
  assert.match(uploader, /\/api\/orders\/\$\{token\}\/progress/);
  assert.match(uploader, /router\.refresh\(\)/);
  assert.match(css, /\.quickProgressPhoto\{/);
  assert.match(css, /@media\(max-width:560px\)\{\.quickProgressPhoto/);
});

test("admin list and order detail automatically refresh the simplified workflow", async () => {
  const sync = await readFile(new URL("../app/admin/AdminLiveSync.tsx", import.meta.url), "utf8");
  const adminPage = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const orderPage = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const shareMessage = await readFile(new URL("../app/CustomerShareMessage.tsx", import.meta.url), "utf8");
  const statusForm = await readFile(new URL("../app/admin/StatusForm.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(sync, /router\.refresh\(\)/);
  assert.match(sync, /setInterval\(sync, 60000\)/);
  assert.match(sync, /visibilityState !== "visible"/);
  assert.match(adminPage, /AdminLiveSync/);
  assert.match(orderPage, /AdminLiveSync/);
  assert.match(orderPage, /publicOrderStatus/);
  assert.match(orderPage, /workflowOverviewCard/);
  assert.match(orderPage, /adminStatusCommand/);
  assert.ok(orderPage.indexOf("adminStatusCommand") < orderPage.indexOf("adminDocumentBar"));
  assert.match(orderPage, /CustomerShareMessage/);
  assert.match(orderPage, /phase="design"/);
  assert.match(orderPage, /<StatusForm/);
  assert.match(orderPage, /ทีมงานทุกฝ่ายสามารถอัปเดตขั้นตอนต่อไปได้ทันที/);
  assert.match(statusForm, /status === "packing".*return "ready_to_ship"/);
  assert.match(statusForm, /\["ready_to_ship", "shipped"\].*return "completed"/);
  assert.match(statusForm, /เปลี่ยนเป็นขั้นตอนถัดไป/);
  assert.match(statusForm, /เลือกสถานะอื่น \/ เพิ่มหมายเหตุ/);
  assert.match(css, /\.adminStatusCommand\{[^}]*background:#111/);
  assert.match(css, /@media\(max-width:560px\)\{\.adminStatusCommand\{position:sticky/);
  assert.match(shareMessage, /คัดลอกข้อความพร้อมลิงก์/);
  const shareTemplate = await readFile(new URL("../app/customer-share-message.mjs", import.meta.url), "utf8");
  assert.match(shareTemplate, /ติดตามสถานะ และอนุมัติแบบได้จากลิงก์นี้ตลอดจนจบงาน/);
});

test("printed order document receives status changes without reloading the full Worker page", async () => {
  const orderDocument = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");
  const liveStatus = await readFile(new URL("../app/order/[token]/LiveOrderStatus.tsx", import.meta.url), "utf8");
  const statusApi = await readFile(new URL("../app/api/orders/[token]/status/route.ts", import.meta.url), "utf8");

  assert.match(orderDocument, /LiveOrderStatus/);
  assert.match(liveStatus, /api\/orders\/\$\{token\}\/status/);
  assert.match(liveStatus, /setInterval\(sync, 20000\)/);
  assert.match(liveStatus, /visibilitychange/);
  assert.match(liveStatus, /BroadcastChannel\("k2-order-status"\)/);
  assert.match(statusApi, /SELECT order_status FROM orders WHERE public_token=\?/);
  assert.match(statusApi, /no-store, max-age=0/);
});

test("tracking page keeps one customer link and exposes one five-stage workflow", async () => {
  const tracking = await readFile(new URL("../app/track/[token]/page.tsx", import.meta.url), "utf8");
  const staffPanel = await readFile(new URL("../app/track/[token]/TrackStaffPanel.tsx", import.meta.url), "utf8");
  const liveSync = await readFile(new URL("../app/track/[token]/TrackLiveSync.tsx", import.meta.url), "utf8");
  const status = await readFile(new URL("../app/order-status.ts", import.meta.url), "utf8");

  assert.doesNotMatch(tracking, /payment_confirmed_at/);
  assert.match(tracking, /status='approved'/);
  assert.match(tracking, /TrackLiveSync/);
  assert.match(tracking, /customerDesignApproval/);
  assert.match(tracking, /ApprovalPanel/);
  assert.match(tracking, /statusSteps\.map/);
  assert.match(staffPanel, /ผลิตเสร็จ → ส่งห้อง Pack/);
  assert.match(staffPanel, /แพ็กเสร็จ → พร้อมส่ง/);
  assert.match(staffPanel, /stage === "completed"/);
  assert.match(staffPanel, /statusSteps\.map/);
  assert.match(status, /"completed",\n\] as const/);
  assert.match(status, /\["shipped", "completed"\].*return "completed"/);
  assert.doesNotMatch(staffPanel, /paymentVerified/);
  assert.match(staffPanel, /<select/);
  assert.match(liveSync, /router\.refresh\(\)/);
  assert.match(liveSync, /setInterval\(sync, 30000\)/);
});

test("CPU safeguards bound login work and keep daily backups linear", async () => {
  const auth = await readFile(new URL("../app/staff-auth.ts", import.meta.url), "utf8");
  const login = await readFile(new URL("../app/api/staff/login/route.ts", import.meta.url), "utf8");
  const backup = await readFile(new URL("../app/daily-backup.ts", import.meta.url), "utf8");

  assert.match(auth, /provided\.length!==44/);
  assert.match(login, /contentLength>4096/);
  assert.match(login, /validUsername&&validEnvelope/);
  assert.match(backup, /function groupRows/);
  assert.doesNotMatch(backup, /source\.filter/);
  assert.doesNotMatch(backup, /JSON\.stringify\(payload, null, 2\)/);
});

test("production calendar is the delivery source of truth with role-protected capacity scheduling", async () => {
  const migration = await readFile(new URL("../drizzle/0021_production_calendar.sql", import.meta.url), "utf8");
  const rbac = await readFile(new URL("../app/production-rbac.ts", import.meta.url), "utf8");
  const capacity = await readFile(new URL("../app/production-capacity.ts", import.meta.url), "utf8");
  const workOrderSync = await readFile(new URL("../app/work-order-sync.ts", import.meta.url), "utf8");
  const createWorkOrder = await readFile(new URL("../app/api/admin/orders/[id]/work-order/route.ts", import.meta.url), "utf8");
  const schedule = await readFile(new URL("../app/api/admin/work-orders/[id]/schedule/route.ts", import.meta.url), "utf8");
  const calendar = await readFile(new URL("../app/admin/production/calendar/page.tsx", import.meta.url), "utf8");
  const detail = await readFile(new URL("../app/admin/WorkOrderPlanningPanel.tsx", import.meta.url), "utf8");

  for (const table of ["customers", "products", "machines", "production_processes", "production_capacity", "work_orders", "production_schedule", "rush_requests", "notifications", "work_order_status_history", "attachments"]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS \\\`${table}\\\``));
  }
  assert.match(rbac, /production_manager/);
  assert.match(rbac, /"delivery:confirm"/);
  assert.match(rbac, /normalizedRole/);
  assert.match(capacity, /setupMinutes \+ \(quantity \/ unitsPerHour\) \* 60/);
  assert.match(workOrderSync, /customer_requested_date/);
  assert.match(createWorkOrder, /waiting_for_production/);
  assert.match(schedule, /confirmed_delivery_date/);
  assert.match(schedule, /Production capacity for this date is full/);
  assert.match(schedule, /capacity:override/);
  assert.match(schedule, /estimateProductionMinutes/);
  assert.match(calendar, /view === "day"/);
  assert.match(calendar, /view === "week"/);
  assert.match(calendar, /view === "month"/);
  assert.match(detail, /วันที่ลูกค้าต้องการ/);
  assert.match(detail, /วันส่งที่ฝ่ายผลิตยืนยัน/);
  assert.match(detail, /เพิ่มซ้ำได้เมื่อแบ่งงานหลายวัน/);
});

test("live broadcast persists history and pushes targeted messages to read-only TV screens", async () => {
  const migration = await readFile(new URL("../drizzle/0022_live_broadcast.sql", import.meta.url), "utf8");
  const hub = await readFile(new URL("../app/broadcast-hub.ts", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/admin/broadcast/route.ts", import.meta.url), "utf8");
  const tv = await readFile(new URL("../app/admin/production/tv/LiveBroadcastDisplay.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");

  for (const table of ["broadcast_messages", "broadcast_acknowledgements", "broadcast_screens"]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS \\\`${table}\\\``));
  }
  assert.match(config, /"BROADCAST_HUB"/);
  assert.match(config, /"new_sqlite_classes": \["BroadcastHub"\]/);
  assert.match(worker, /\/api\/broadcast\/stream/);
  assert.match(worker, /staff_sessions/);
  assert.match(hub, /acceptWebSocket/);
  assert.match(hub, /getWebSockets/);
  assert.match(hub, /targetScope === "department"/);
  assert.match(api, /INSERT INTO broadcast_messages/);
  assert.match(api, /broadcast:send/);
  assert.match(tv, /new WebSocket/);
  assert.match(tv, /broadcast\.created/);
  assert.match(tv, /รับทราบแล้ว/);
  assert.match(tv, /liveEmergency/);
});

test("department dashboards move jobs between Print & Cut and Pack with realtime audit history", async () => {
  const migration = await readFile(new URL("../drizzle/0023_department_dashboards.sql", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/admin/production/tv/DepartmentDashboard.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/admin/production/tv/page.tsx", import.meta.url), "utf8");
  const queueApi = await readFile(new URL("../app/api/admin/production/queue/route.ts", import.meta.url), "utf8");
  const dataApi = await readFile(new URL("../app/api/admin/production/dashboard/route.ts", import.meta.url), "utf8");
  const server = await readFile(new URL("../app/production-dashboard-server.ts", import.meta.url), "utf8");
  const hub = await readFile(new URL("../app/broadcast-hub.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const backup = await readFile(new URL("../app/daily-backup.ts", import.meta.url), "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS `production_queue_events`/);
  assert.match(migration, /dashboard_note/);
  assert.match(page, /department=print_cut/);
  assert.match(page, /department=pack/);
  assert.match(page, /department=sale/);
  assert.match(page, /departmentAliases/);
  assert.match(page, /production: "print_cut"/);
  assert.match(page, /packing: "pack"/);
  assert.match(page, /requireStaff\(canonicalReturnTo\)/);
  assert.match(page, /redirect\(canonicalReturnTo\)/);
  assert.match(dashboard, /pageSize = 9/);
  assert.match(page, /แสดง 9 งานต่อหน้า/);
  assert.match(dashboard, /job\.deliveryDate === payload\.date/);
  assert.match(dashboard, /job\.deliveryDate < payload\.date/);
  assert.match(dashboard, /departmentOverdueMark/);
  assert.match(css, /@keyframes dueDateBlink/);
  assert.match(dashboard, /ผลิตเสร็จแล้ว → ส่งห้อง Pack/);
  assert.match(dashboard, /นำออกจากคิว/);
  assert.match(dashboard, /เหตุผลที่นำออกจากคิว/);
  assert.match(dashboard, /โน้ตจากผู้ดูแล/);
  assert.match(dashboard, /10000/);
  assert.match(queueApi, /waiting_for_packing/);
  assert.match(queueApi, /toStatus = "packing"/);
  assert.match(queueApi, /INSERT INTO production_queue_events/);
  assert.match(queueApi, /queue:manage/);
  assert.doesNotMatch(queueApi, /action === "complete" && !hasPermission/);
  assert.match(page, /canUpdate canManage=/);
  assert.match(queueApi, /production\.queue_updated/);
  assert.match(dataApi, /cache-control.*no-store/);
  assert.match(server, /design_asset_id/);
  assert.match(server, /priority='urgent'/);
  assert.match(hub, /event\.departments\.includes/);
  assert.match(css, /@keyframes urgentCardGlow/);
  assert.match(backup, /queueEvents: productionQueueEvents/);
});

test("Job Today gives managers a live card wall for every order due today", async () => {
  const page = await readFile(new URL("../app/admin/production/today/page.tsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/admin/production/today/TodayDashboard.tsx", import.meta.url), "utf8");
  const endpoint = await readFile(new URL("../app/api/admin/production/today/route.ts", import.meta.url), "utf8");
  const server = await readFile(new URL("../app/production-dashboard-server.ts", import.meta.url), "utf8");
  const admin = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const menu = await readFile(new URL("../app/admin/AdminModuleMenu.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /requireStaff\("\/admin\/production\/today"\)/);
  assert.match(page, /hasPermission\(user\.role, "queue:manage"\)/);
  assert.match(page, /งานที่ต้องส่งวันนี้/);
  assert.match(endpoint, /cache-control": "no-store/);
  assert.match(endpoint, /loadTodayDashboard/);
  assert.match(server, /confirmed_delivery_date=\?/);
  assert.match(server, /wo\.status<>'cancelled'/);
  assert.match(dashboard, /setInterval\(\(\) => void refresh\(\), 60000\)/);
  assert.match(dashboard, /todayJobCard \$\{current\.key\} \$\{urgent \? "urgent"/);
  assert.match(dashboard, /href=\{`\/admin\/orders\/\$\{job\.orderId\}`\}/);
  assert.match(admin, /href="\/admin\/production\/today"/);
  assert.match(menu, /title: "Job Today"/);
  assert.match(css, /\.todayJobCard\.urgent\{[^}]*animation:todayUrgentGlow/);
  assert.match(css, /\.todayDashboardGrid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test("production calendar shows production-to-delivery spans and a due-today rail", async () => {
  const calendar = await readFile(new URL("../app/admin/production/calendar/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(calendar, /ช่วงผลิต → กำหนดส่ง/);
  assert.match(calendar, /planned_production_date<=\?/);
  assert.match(calendar, /confirmed_delivery_date>=\?/);
  assert.match(calendar, /งานส่งวันนี้/);
  assert.match(calendar, /gridColumn/);
  assert.match(css, /\.productionTimeline/);
  assert.match(css, /\.calendarDueToday/);
});

test("incoming orders automatically sync to an editable production draft", async () => {
  const canonicalStatusMigration = await readFile(new URL("../drizzle/0024_unify_order_status.sql", import.meta.url), "utf8");
  const sync = await readFile(new URL("../app/work-order-sync.ts", import.meta.url), "utf8");
  const createOrder = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
  const editOrder = await readFile(new URL("../app/api/admin/orders/[id]/details/route.ts", import.meta.url), "utf8");
  const release = await readFile(new URL("../app/api/admin/orders/[id]/work-order/route.ts", import.meta.url), "utf8");
  const numberRoute = await readFile(new URL("../app/api/admin/orders/[id]/number/route.ts", import.meta.url), "utf8");
  const statusUpdate = await readFile(new URL("../app/order-status-update.ts", import.meta.url), "utf8");
  const panel = await readFile(new URL("../app/admin/WorkOrderPlanningPanel.tsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/production-dashboard-server.ts", import.meta.url), "utf8");
  const editForm = await readFile(new URL("../app/admin/OrderEditForm.tsx", import.meta.url), "utf8");

  assert.match(sync, /export async function syncWorkOrderFromOrder/);
  assert.match(sync, /UPDATE work_orders SET work_order_number=/);
  assert.match(sync, /"draft"/);
  assert.match(sync, /function initialWorkOrderStatus/);
  assert.match(sync, /"quality_check", "packing", "ready_to_ship", "shipped", "completed"/);
  assert.match(sync, /เชื่อมใบงานเก่าเข้าระบบการผลิต/);
  assert.match(canonicalStatusMigration, /SET\s+`status` = \(/);
  assert.match(canonicalStatusMigration, /IN \('shipped','completed','cancelled'\) THEN 1/);
  assert.match(sync, /Queue, schedule, priority, notes and production status are deliberately preserved/);
  assert.match(createOrder, /syncWorkOrderFromOrder\(runtime\.DB/);
  assert.match(editOrder, /syncWorkOrderFromOrder\(db, orderId/);
  assert.match(editOrder, /productionSynced: true/);
  assert.match(release, /workOrderStatus === "draft"/);
  assert.match(release, /waiting_for_production: "waiting_for_production"/);
  assert.match(release, /production\.queue_updated/);
  assert.doesNotMatch(release, /payment_confirmed_at/);
  assert.match(numberRoute, /UPDATE work_orders SET work_order_number=/);
  assert.doesNotMatch(statusUpdate, /ต้องกดออกใบงานฝ่ายผลิตก่อน/);
  assert.match(statusUpdate, /if \(!linkedWorkOrder\) linkedWorkOrder = await syncWorkOrderFromOrder/);
  assert.match(statusUpdate, /productionStatuses\.has\(orderStatus\)/);
  assert.match(statusUpdate, /const workOrderStatus = orderStatus/);
  assert.match(statusUpdate, /\["shipped", "completed", "cancelled"\]\.includes\(workOrderStatus\)/);
  assert.doesNotMatch(statusUpdate, /orderStatus === "completed" \? "ready_to_ship"/);
  assert.doesNotMatch(statusUpdate, /payment_confirmed_at/);
  assert.match(panel, /AUTO-SYNCED PRODUCTION DRAFT/);
  assert.match(panel, /ทีมงานทุกฝ่ายสามารถเปลี่ยนสถานะ/);
  assert.match(panel, /การอนุมัติแบบของลูกค้าไม่ล็อกการส่งผลิต/);
  assert.doesNotMatch(panel, /ออกใบงาน → เข้าไลน์ผลิตทันที/);
  assert.match(dashboard, /wo\.status IN \('waiting_for_production','in_production'\)/);
  assert.match(editForm, /id="order-edit"/);
});

test("staff progress photos show the uploader and Thai capture time directly on every image", async () => {
  const status = await readFile(new URL("../app/order-status.ts", import.meta.url), "utf8");
  const adminOrder = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const timeline = await readFile(new URL("../app/ProgressPhotoTimeline.tsx", import.meta.url), "utf8");
  const orderDocument = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(status, /export function thaiPhotoTimestamp/);
  assert.match(status, /timeZone:"Asia\/Bangkok"/);
  assert.match(adminOrder, /className="photoCaptureStamp"/);
  assert.match(timeline, /className="photoCaptureStamp"/);
  assert.match(orderDocument, /className="photoCaptureStamp printPhotoCaptureStamp"/);
  assert.match(adminOrder, /ถ่ายโดย/);
  assert.match(timeline, /ถ่ายโดย/);
  assert.match(css, /\.photoCaptureStamp\{/);
  assert.match(css, /@media print\{\.printPhotoCaptureStamp/);
});

test("job-order workspace uses one-tap task cards and requires documented full payment before closing", async () => {
  const adminOrder = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const paymentForm = await readFile(new URL("../app/admin/PaymentSlipForm.tsx", import.meta.url), "utf8");
  const paymentApi = await readFile(new URL("../app/api/admin/orders/[id]/payment-slip/route.ts", import.meta.url), "utf8");
  const orderApi = await readFile(new URL("../app/api/admin/orders/[id]/route.ts", import.meta.url), "utf8");
  const statusUpdate = await readFile(new URL("../app/order-status-update.ts", import.meta.url), "utf8");
  const queue = await readFile(new URL("../app/api/admin/production/queue/route.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0026_order_payment_receipts.sql", import.meta.url), "utf8");
  const backup = await readFile(new URL("../app/daily-backup.ts", import.meta.url), "utf8");

  assert.match(adminOrder, /ข้อมูลสำคัญที่ต้องใช้ทำงาน/);
  assert.match(adminOrder, /id="design-tools"/);
  assert.match(adminOrder, /id="production-file-tools"/);
  assert.match(adminOrder, /id="payment-tools"/);
  assert.match(adminOrder, /paymentQuickAccess/);
  assert.match(adminOrder, /เพิ่มการชำระงวดถัดไปได้ตรงนี้/);
  assert.match(adminOrder, /บัญชีนี้ยังไม่มีสิทธิ์แนบสลิปงวดถัดไป/);
  assert.match(adminOrder, /บันทึกและแก้ไขการรับชำระ/);
  assert.match(adminOrder, /ศูนย์จัดการใบงาน/);
  assert.match(adminOrder, /orderToolPrimaryGrid/);
  assert.match(adminOrder, /orderToolSecondaryGrid/);
  assert.match(adminOrder, /<details className="orderToolDisclosure orderToolPrimary/);
  assert.match(adminOrder, /ประวัติใบงาน/);
  assert.match(css, /\.orderToolPrimaryGrid\{grid-template-columns:repeat\(3/);
  assert.match(css, /@media\(max-width:600px\).*\.orderToolPrimaryGrid,.orderToolSecondaryGrid\{grid-template-columns:1fr/s);
  assert.match(paymentForm, /ยอดชำระงวดที่/);
  assert.match(paymentForm, /canManage/);
  assert.match(paymentForm, /กดเพื่อถ่ายรูปหรือเลือกรูปจากมือถือ/);
  assert.match(paymentForm, /ประวัติการชำระทั้งหมด/);
  assert.match(paymentApi, /INSERT INTO order_payment_receipts/);
  assert.match(paymentApi, /paid \+ amount/);
  assert.match(orderApi, /ยอดรับชำระต้องบันทึกพร้อมสลิป/);
  assert.match(statusUpdate, /paymentLockedStatuses/);
  assert.match(statusUpdate, /ยอดค้างชำระ/);
  assert.match(queue, /ยังเปลี่ยนเป็นพร้อมส่งไม่ได้/);
  assert.match(schema, /orderPaymentReceipts/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `order_payment_receipts`/);
  assert.match(backup, /paymentReceipts/);
  assert.match(backup, /schemaVersion: 10/);
  assert.match(backup, /shipmentsByOrder/);
});

test("payments can be split into unlimited numbered installments with one auditable ledger", async () => {
  const createApi = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
  const receiptApi = await readFile(new URL("../app/api/admin/orders/[id]/payment-slip/route.ts", import.meta.url), "utf8");
  const adminOrder = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const paymentForm = await readFile(new URL("../app/admin/PaymentSlipForm.tsx", import.meta.url), "utf8");
  const orderDocument = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");

  assert.match(createApi, /บันทึกเป็นการชำระงวดที่ 1 แล้ว/);
  assert.match(createApi, /receiptId:initialReceiptId/);
  assert.match(createApi, /INSERT INTO order_payment_receipts/);
  assert.match(receiptApi, /Math\.min\(total, paid \+ amount\)/);
  assert.match(adminOrder, /ORDER BY id ASC/);
  assert.match(adminOrder, /legacySlipIsReceipt/);
  assert.match(paymentForm, /แบ่งชำระได้หลายงวด/);
  assert.match(paymentForm, /nextInstallment/);
  assert.match(paymentForm, /งวดที่ \{index \+ 1/);
  assert.match(orderDocument, /masterPaymentLedger/);
  assert.match(orderDocument, /ประวัติการชำระ/);
});

test("management dashboards keep warning about unpaid delivery-day orders until they are paid or closed", async () => {
  const server = await readFile(new URL("../app/production-dashboard-server.ts", import.meta.url), "utf8");
  const today = await readFile(new URL("../app/admin/production/today/TodayDashboard.tsx", import.meta.url), "utf8");
  const production = await readFile(new URL("../app/admin/production/page.tsx", import.meta.url), "utf8");

  assert.match(server, /export async function loadPaymentDueAlerts/);
  assert.match(server, /confirmed_delivery_date,''\),o\.requested_date\)<=\?/);
  assert.match(server, /wo\.status NOT IN \('completed','cancelled'\)/);
  assert.match(server, /deposit_amount/);
  assert.match(today, /มียอดค้างชำระถึงวันส่งงาน/);
  assert.match(today, /paymentAlerts\.map/);
  assert.match(production, /งานถึงกำหนดส่งแต่ยังมียอดค้าง/);
  assert.match(production, /ค้างรวม/);
});

test("admin dashboard highlights cumulative received revenue from all payment installments", async () => {
  const admin = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const paymentForm = await readFile(new URL("../app/admin/PaymentSlipForm.tsx", import.meta.url), "utf8");
  const paymentApi = await readFile(new URL("../app/api/admin/orders/[id]/payment-slip/route.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(admin, /can\(user,"finance:view"\)/);
  assert.match(admin, /SELECT SUM\(amount\) FROM payment_events/);
  assert.match(admin, /order_status<>'cancelled'/);
  assert.match(admin, /ยอดรับชำระสะสม ณ ปัจจุบัน/);
  assert.match(admin, /คำนวณจากยอดที่บันทึกรับชำระจริงทุกงวด/);
  assert.match(admin, /รับชำระวันนี้/);
  assert.match(admin, /รวมยอดจากสลิปที่บันทึกวันนี้/);
  assert.match(admin, /รับชำระเดือนนี้/);
  assert.match(admin, /date\(payment_at,'\+7 hours'\)/);
  assert.match(admin, /strftime\('%Y-%m',payment_at,'\+7 hours'\)/);
  assert.match(admin, /FROM order_payment_receipts r JOIN orders o/);
  assert.match(admin, /ยอดค้างรอรับ/);
  assert.match(admin, /เพิ่มยอดขายวันนี้/);
  assert.match(paymentApi, /revenueRecordedToday: evidenceOnly \? 0 : amount/);
  assert.match(paymentForm, /เพิ่มรายรับวันนี้/);
  assert.match(paymentForm, /ไม่เพิ่มยอดรายรับซ้ำ/);
  assert.match(css, /\.adminRevenueHero\{/);
});

test("new orders require an explicit payment state and show it clearly on every work-order view", async () => {
  const home = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const createApi = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
  const adminOrder = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const paymentForm = await readFile(new URL("../app/admin/PaymentSlipForm.tsx", import.meta.url), "utf8");
  const orderDocument = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");

  assert.match(home, /สถานะการชำระเงิน \*/);
  assert.match(home, /ชำระเต็มจำนวน/);
  assert.match(home, /ชำระมัดจำ/);
  assert.match(home, /แนบสลิปยอดมัดจำ/);
  assert.match(home, /paymentSlipName/);
  assert.match(home, /frontPaymentSlip/);
  assert.match(home, /ยังไม่ชำระ/);
  assert.match(createApi, /\["paid_full","deposit","unpaid"\]/);
  assert.match(createApi, /paymentStatus==="paid_full"\)depositAmount=payableTotal/);
  assert.match(createApi, /ยอดมัดจำต้องมากกว่า 0 และน้อยกว่ายอดสุทธิ/);
  assert.match(createApi, /มีสลิปแนบอยู่ กรุณาเลือกชำระเต็มจำนวนหรือชำระมัดจำ/);
  assert.match(adminOrder, /paymentStatusText/);
  assert.match(paymentForm, /paymentStateHeadline/);
  assert.match(orderDocument, /สถานะการชำระเงิน/);
  assert.match(orderDocument, /รับชำระแล้ว/);
});

test("payment slips are read asynchronously and compared with the staff-entered amount", async () => {
  const createApi = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
  const receiptApi = await readFile(new URL("../app/api/admin/orders/[id]/payment-slip/route.ts", import.meta.url), "utf8");
  const analyzeApi = await readFile(new URL("../app/api/admin/orders/[id]/payment-slip/analyze/route.ts", import.meta.url), "utf8");
  const analyzer = await readFile(new URL("../app/payment-slip-analysis.ts", import.meta.url), "utf8");
  const adminOrder = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const paymentForm = await readFile(new URL("../app/admin/PaymentSlipForm.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0027_payment_slip_analyses.sql", import.meta.url), "utf8");
  const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");

  assert.match(wrangler, /"ai"\s*:\s*\{\s*"binding"\s*:\s*"AI"/s);
  assert.match(createApi, /waitUntil\(analyzePaymentSlip/);
  assert.match(receiptApi, /waitUntil\(analyzePaymentSlip/);
  assert.match(analyzeApi, /status: "queued"/);
  assert.match(analyzer, /@cf\/moondream\/moondream3\.1-9B-A2B/);
  assert.match(analyzer, /IMAGES\.input/);
  assert.match(analyzer, /slipAmountStatus/);
  assert.match(analyzer, /answerFromResult/);
  assert.match(analyzer, /Vision models occasionally return JSON-like output/);
  assert.match(analyzer, /Recover each known field independently/);
  assert.match(adminOrder, /payment_slip_analyses/);
  assert.match(adminOrder, /parseSlipAnswer\(String\(item\.raw_result\)\)/);
  assert.match(adminOrder, /recoveredStatus/);
  assert.match(adminOrder, /recovered\?\.confidence \|\| item\.confidence/);
  assert.match(paymentForm, /AI อ่านยอดตรงกับที่บันทึก/);
  assert.match(paymentForm, /ยอดในสลิปไม่ตรง/);
  assert.match(paymentForm, /ทีมงานต้องเปิดสลิปตรวจซ้ำ/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `payment_slip_analyses`/);

  const { parseSlipAnswer, slipAmountStatus } = await importTypeScriptModule(new URL("../app/payment-slip-analysis.ts", import.meta.url));
  const liveK21248Answer = `{
    "amount": 10600.0,
    "date": null,
    "time": 22:45,
    "reference": "XXX-X-XXX206-6",
    "sender": "Krungthai",
    "receiver": "fluffi.th",
    "confidence": "high",
    "note": null
  }`;
  const parsed = parseSlipAnswer(liveK21248Answer);
  assert.equal(parsed.amount, 10600);
  assert.equal(parsed.transactionTime, "22:45");
  assert.equal(parsed.referenceNo, "XXX-X-XXX206-6");
  assert.equal(parsed.confidence, "high");
  assert.equal(slipAmountStatus(parsed.amount, 10600), "matched");
});

test("one master work order keeps multiple approved images paired with each product line", async () => {
  const document = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");
  const adminOrder = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const upload = await readFile(new URL("../app/admin/DesignUploadForm.tsx", import.meta.url), "utf8");
  const uploadApi = await readFile(new URL("../app/api/admin/orders/[id]/designs/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0028_design_assets_per_order_item.sql", import.meta.url), "utf8");

  assert.match(document, /ใบงานหลักฉบับเดียว/);
  assert.match(document, /ภาพและสเปกแยกตามรายการ/);
  assert.match(document, /ส่งต่องานตามแผนก/);
  assert.match(document, /designAssets\.filter\(asset=>Number\(asset\.order_item_id\)===Number\(item\.id\)\)/);
  assert.match(adminOrder, /const itemAssets = designAssets\.filter/);
  assert.match(adminOrder, /ภาพแบบรายการนี้/);
  assert.match(adminOrder, /อะไหล่รายการนี้/);
  assert.match(adminOrder, /jobArtworkPreviews/);
  assert.match(css, /\.visualJobMedia\.itemAssetPair/);
  assert.match(upload, /name="order_item_id"/);
  assert.match(upload, /รายการละหลายภาพ/);
  assert.match(uploadApi, /INSERT INTO design_assets \(design_version_id,order_item_id/);
  assert.match(uploadApi, /previousAssets\.filter/);
  assert.match(migration, /ADD `order_item_id` integer/);
});

test("admin product sales summary stays collapsed behind a compact button", async () => {
  const admin = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const insights = await readFile(new URL("../app/admin/ProductSalesInsights.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(admin, /<ProductSalesInsights rows=\{productSales\} performanceRows=\{performanceRows\} customerRows=\{customerInsights\}/);
  assert.match(admin, /FROM order_items oi JOIN orders o/);
  assert.match(admin, /o\.order_status<>'cancelled'/);
  assert.match(admin, /'today' AS period/);
  assert.match(admin, /'previous_month' AS period/);
  assert.match(insights, /useState<"product"\|"salesperson"\|"channel"\|"customer"\|null>\(null\)/);
  assert.match(insights, /อันดับเซลล์/);
  assert.match(insights, /สินค้าขายดี/);
  assert.match(insights, /ช่องทางขาย/);
  assert.match(insights, /วิเคราะห์ลูกค้า/);
  assert.match(insights, /ยอดขาย/);
  assert.match(insights, /จำนวน/);
  assert.match(insights, /aria-expanded=\{view===button\.key\}/);
  assert.match(css, /\.productInsightsToggle\{/);
  assert.match(css, /\.productMixRows\{display:grid/);
});

test("orders store an editable salesperson and feed channel and customer analytics", async () => {
  const home = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const create = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
  const edit = await readFile(new URL("../app/admin/OrderEditForm.tsx", import.meta.url), "utf8");
  const editApi = await readFile(new URL("../app/api/admin/orders/[id]/details/route.ts", import.meta.url), "utf8");
  const admin = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0029_sales_analytics.sql", import.meta.url), "utf8");
  const document = await readFile(new URL("../app/order/[token]/page.tsx", import.meta.url), "utf8");

  assert.match(home, /name="sales_owner_id"/);
  assert.match(create, /sales_owner_id,sales_owner_name/);
  assert.match(create, /เซลล์ผู้รับผิดชอบที่ใช้งานอยู่/);
  assert.match(edit, /name="salesOwnerId"/);
  assert.match(editApi, /order_sales_assignment_history/);
  assert.match(editApi, /เปลี่ยนเซลล์ผู้รับผิดชอบ/);
  assert.match(admin, /'salesperson' AS kind/);
  assert.match(admin, /'channel'/);
  assert.match(admin, /customer_orders/);
  assert.match(document, /เซลล์ผู้รับผิดชอบ/);
  assert.match(migration, /idx_orders_sales_owner_created/);
});

test("admin can configure sales channels and tiered commissions", async () => {
  const page = await readFile(new URL("../app/admin/sales-settings/page.tsx", import.meta.url), "utf8");
  const manager = await readFile(new URL("../app/admin/sales-settings/SalesSettingsManager.tsx", import.meta.url), "utf8");
  const createOrder = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0030_commission_and_sales_channels.sql", import.meta.url), "utf8");
  const commission = await importTypeScriptModule(new URL("../app/commission.mjs", import.meta.url));

  assert.match(page, /คอมมิชชั่นและช่องทางขาย/);
  assert.match(manager, /เรตคอมมิชชั่นแบบขั้นบันได/);
  assert.match(manager, /เพิ่มช่องทาง/);
  assert.match(createOrder, /FROM sales_channels WHERE code=\? AND active=1/);
  assert.match(dashboard, /calculateCommission/);
  assert.match(migration, /CREATE TABLE `sales_channels`/);
  assert.match(migration, /CREATE TABLE `commission_tiers`/);
  const result = commission.calculateCommission(150000, 7, "2026-09-13", [
    { salesOwnerId: 0, tierName: "กลาง", minSales: 0, maxSales: null, ratePercent: 2, effectiveFrom: "2026-01-01", effectiveTo: "" },
    { salesOwnerId: 7, tierName: "Gold", minSales: 100000, maxSales: 300000, ratePercent: 4, effectiveFrom: "2026-09-01", effectiveTo: "" },
  ]);
  assert.deepEqual(result, { rate: 4, amount: 6000, tierName: "Gold" });
});

test("source snapshot excludes historical credential and customer-specific repair payloads", async () => {
  const correction = await readFile(new URL("../drizzle/0031_correct_verified_sales_owners.sql", import.meta.url), "utf8");
  const credentialRepair = await readFile(new URL("../drizzle/0010_cloudflare_password_hashes.sql", import.meta.url), "utf8");
  const staffSchema = await readFile(new URL("../drizzle/0009_staff_auth_and_audit.sql", import.meta.url), "utf8");
  assert.match(correction, /SELECT 1;/);
  assert.match(credentialRepair, /SELECT 1;/);
  assert.doesNotMatch(correction, /UPDATE `orders`/);
  assert.doesNotMatch(credentialRepair, /SET `password_hash`/);
  assert.match(staffSchema, /CREATE TABLE `staff_users`/);
  assert.doesNotMatch(staffSchema, /INSERT INTO `staff_users`/);
});

test("graphic workflow is claimed explicitly and alerts once after 24 hours", async () => {
  const admin = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const order = await readFile(new URL("../app/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
  const claim = await readFile(new URL("../app/api/admin/orders/[id]/graphic-claim/route.ts", import.meta.url), "utf8");
  const upload = await readFile(new URL("../app/api/admin/orders/[id]/designs/route.ts", import.meta.url), "utf8");
  const integrations = await readFile(new URL("../app/integrations.ts", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const migration = await readFile(new URL("../drizzle/0033_graphic_workflow_alerts.sql", import.meta.url), "utf8");
  const alertPolicy = await readFile(new URL("../app/graphic-alert-policy.ts", import.meta.url), "utf8");

  assert.match(admin, /งานกราฟิกที่ต้องติดตาม/);
  assert.match(admin, /ยังไม่มีคนรับ/);
  assert.match(admin, /รอลูกค้าคอนเฟิร์ม/);
  assert.match(order, /ผู้รับผิดชอบงานกราฟิก/);
  assert.match(claim, /graphic_claimed_at=CURRENT_TIMESTAMP/);
  assert.match(claim, /user\.teams\.includes\("graphic"\)/);
  assert.match(upload, /graphic_claimed_by_id=CASE/);
  assert.match(integrations, /unclaimed_24h/);
  assert.match(integrations, /working_24h/);
  assert.match(integrations, /confirmation_24h/);
  assert.match(integrations, /INSERT OR IGNORE INTO graphic_alert_deliveries/);
  assert.match(integrations, /อัปเดตงานกราฟิกแล้ว/);
  assert.match(integrations, /resolved_notified_at=CURRENT_TIMESTAMP/);
  assert.match(integrations, /o\.created_at>=\?/);
  assert.match(admin, /GRAPHIC_ALERT_START_LABEL/);
  assert.match(alertPolicy, /2026-09-14 06:30:00/);
  assert.match(worker, /sendGraphicWorkflowAlerts/);
  assert.match(wrangler, /"5 \* \* \* \*"/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS `idx_graphic_alert_order_type`/);
  assert.match(migration, /`stage_key` text NOT NULL/);
});

test("K2 Assistant answers from live role-aware data and confirms notes before writing", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const assistant = await readFile(new URL("../app/admin/StaffAiAssistant.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/admin/assistant/route.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(layout, /StaffAiAssistant/);
  assert.match(assistant, /ถาม K2 Assistant/);
  assert.match(assistant, /งานส่งวันนี้/);
  assert.match(assistant, /ยืนยันเพิ่มโน้ต/);
  assert.match(api, /getStaffUser/);
  assert.match(api, /canViewOrderFinance/);
  assert.match(api, /GRAPHIC_ALERT_START_AT/);
  assert.match(api, /LIMIT 12/);
  assert.match(api, /confirmAction/);
  assert.match(api, /INSERT INTO order_status_history/);
  assert.match(api, /เพิ่มโน้ตผ่าน K2 Assistant/);
  assert.match(css, /\.staffAiAssistant\{/);
  assert.match(assistant, /!open && <button className="staffAiLauncher"/);
  assert.match(css, /\.staffAiAssistant\.open\{width:min\(430px,calc\(100vw - 24px\)\)\}/);
  assert.match(css, /\.staffAiPanel>\*\{width:100%;min-width:0;box-sizing:border-box\}/);
  assert.match(css, /\.staffAiPanel\{padding:0\}/);
  assert.match(css, /\.staffAiQuick\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:720px\)\{\.staffAiAssistant\.open\{inset:0/);
});

test("staff creates a multi-item order from one POS workspace with explicit review and payment state", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const builder = await readFile(new URL("../app/StaffOrderBuilder.tsx", import.meta.url), "utf8");
  const orderApi = await readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(page, /if \(props\.canCreateOrder\) return <StaffOrderBuilder/);
  assert.match(builder, /เพิ่มได้หลายรายการในใบงานเดียว/);
  assert.match(builder, /เพิ่มรายการลงใบงาน/);
  assert.match(builder, /ตรวจสอบก่อนยืนยัน/);
  assert.match(builder, /ยังไม่ชำระเงิน/);
  assert.match(builder, /เพิ่มสลิปภายหลัง/);
  assert.match(builder, /\/api\/admin\/orders\/\$\{orderId\}\/payment-slip/);
  assert.match(orderApi, /orderId:saved\.id/);
  assert.match(css, /\.staffOrderShell\{display:grid;grid-template-columns:/);
  assert.match(css, /@media\(max-width:680px\)\{\.staffOrderPage/);
});

test("order builder readability release can notify the staff Telegram group once", async () => {
  const route = await readFile(new URL("../app/api/admin/telegram/order-builder-v2/route.ts", import.meta.url), "utf8");
  const sender = await readFile(new URL("../app/admin/telegram-order-builder-v2/TelegramOrderBuilderUpdateSender.tsx", import.meta.url), "utf8");

  assert.match(route, /2026-09-21-order-builder-readability-v1/);
  assert.match(route, /ช่องกรอกบนมือถือใช้ขนาด 16px/);
  assert.match(route, /ไม่ล้นหน้าจอ/);
  assert.match(route, /INSERT OR IGNORE INTO system_update_notifications/);
  assert.match(route, /sendTelegram\(runtime/);
  assert.match(sender, /\/api\/admin\/telegram\/order-builder-v2/);
});
