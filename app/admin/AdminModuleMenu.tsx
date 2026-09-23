import { can, canManagePricing } from "../staff-auth";
import type { VisibilityPermission } from "../production-rbac";

type ModuleItem = {
  title: string;
  description: string;
  href: string;
  badge?: string;
  external?: boolean;
};

type ModuleGroup = {
  title: string;
  eyebrow: string;
  items: ModuleItem[];
};

export default function AdminModuleMenu({ role, permissions = [] }: { role: string; permissions?: VisibilityPermission[] }) {
  const allowed = (permission: Parameters<typeof can>[1]) => can(role, permission) || permissions.includes(permission as VisibilityPermission);
  const groups: ModuleGroup[] = [
    {
      eyebrow: "ORDER",
      title: "รับงานและใบสั่งงาน",
      items: [
        ...(["sales:view_self", "sales:view_team", "sales:view_all"].some(p => allowed(p as "sales:view_self")) ? [{ title: "แดชบอร์ดและเครื่องมือขาย", description: "ดูยอดขาย เตรียมลิงก์ แคปชั่น และภาพสำหรับโพสต์", href: "/admin/sales", badge: "SALES" }] : []),
        ...(allowed("orders:create") ? [{ title: "สร้างใบสั่งงาน", description: "เปิดงานใหม่และกรอกข้อมูลลูกค้า", href: "/admin/orders/new", badge: "เริ่มงาน" }] : []),
        { title: "รายการใบสั่งงาน", description: "ค้นหา เปิดดู และแก้ไขใบงานล่าสุด", href: "#orders" },
        { title: "เลขพัสดุ / Order Plus", description: "วางเลขพัสดุ หรือนำเข้า Excel และตรวจคู่ใบงาน", href: "/admin/shipments", badge: "SHIPPING" },
      ],
    },
    ...(allowed("calendar:view") ? [{
      eyebrow: "PRODUCTION",
      title: "ควบคุมการผลิต",
      items: [
        ...(allowed("queue:manage") ? [{ title: "Job Today", description: "รวมงานที่ต้องส่งวันนี้สำหรับผู้บริหาร", href: "/admin/production/today", badge: "TODAY" }] : []),
        { title: "ศูนย์วางแผนการผลิต", description: "ดูภาพรวมคิว โหลดเครื่อง และงานใกล้กำหนด", href: "/admin/production", badge: "Dashboard" },
        { title: "Production Calendar", description: "ดูช่วงวันผลิตจนถึงกำหนดส่ง", href: "/admin/production/calendar" },
        ...(allowed("capacity:manage") ? [{ title: "Machines & Capacity", description: "ตั้งค่าเครื่อง เวลา และกำลังการผลิต", href: "/admin/production/capacity" }] : []),
        ...(allowed("broadcast:send") ? [{ title: "Live Broadcast", description: "ส่งข้อความด่วนไปยังจอทีมงานแบบทันที", href: "/admin/production/broadcast", badge: "LIVE" }] : []),
      ],
    }] : []),
    ...(allowed("calendar:view") ? [{
      eyebrow: "TV DISPLAY",
      title: "จอประจำแผนก",
      items: [
        { title: "Print & Cut", description: "งานรอผลิตและคิวเร่งด่วน", href: "/admin/production/tv?department=print_cut", badge: "TV", external: true },
        { title: "Pack", description: "งานรอแพ็กและงานพร้อมส่ง", href: "/admin/production/tv?department=pack", badge: "TV", external: true },
        { title: "Sale", description: "ดูโหลดงานและวันแนะนำสำหรับรับคิว", href: "/admin/production/tv?department=sale", badge: "TV", external: true },
      ],
    }] : []),
    {
      eyebrow: "SYSTEM",
      title: "ตั้งค่าและดูแลระบบ",
      items: [
        ...(canManagePricing(role) || permissions.includes("finance:manage") ? [{ title: "จัดการราคาอะไหล่", description: "แก้ไขราคาที่ใช้ในแบบฟอร์มใบงาน", href: "/admin/pricing" }] : []),
        ...(allowed("commission:manage") ? [{ title: "คอมมิชชั่นและช่องทางขาย", description: "ตั้งเรตขั้นบันได เพิ่มเพจ และอักษรนำหน้าใบงาน", href: "/admin/sales-settings", badge: "SALES" }] : []),
        ...(role === "admin" ? [{ title: "จัดการผู้ใช้งาน", description: "เพิ่มผู้ใช้ ตั้งรหัสผ่าน และกำหนดสิทธิ์", href: "/admin/users" }] : []),
        ...(role === "admin" ? [{ title: "ระบบสำรองข้อมูล", description: "ตรวจสถานะ Google Drive, Sheet และ PDF", href: "#backups" }] : []),
      ],
    },
  ].filter((group) => group.items.length > 0);

  return <section className="adminModuleLauncher" aria-labelledby="admin-module-title">
    <header>
      <div><span>WORKSPACE</span><h2 id="admin-module-title">ทางลัดสำหรับงานประจำวัน</h2></div>
      <p>เลือกงานที่ต้องทำได้ทันที เมนูจะแสดงตามสิทธิ์ของคุณ</p>
    </header>
    <div className="adminModuleGroups">
      {groups.map((group) => <article className={`adminModuleGroup ${group.eyebrow.toLowerCase().replace(" ", "-")}`} key={group.eyebrow}>
        <div className="adminModuleGroupTitle"><span>{group.eyebrow}</span><h3>{group.title}</h3></div>
        <div className="adminModuleGrid">
          {group.items.map((item) => <a href={item.href} key={item.title} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined}>
            <div>{item.badge && <small>{item.badge}</small>}<b>{item.title}</b><p>{item.description}</p></div>
            <span>เปิด</span>
          </a>)}
        </div>
      </article>)}
    </div>
  </section>;
}
