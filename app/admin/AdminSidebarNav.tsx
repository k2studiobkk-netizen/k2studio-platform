"use client";

import { useMemo, useState } from "react";
import { hasPermission, type Permission } from "../production-rbac";

type NavItem = { label: string; href: string; primary?: boolean };
type NavGroup = { id: string; label: string; items: NavItem[] };

export default function AdminSidebarNav({ role, permissions = [] }: { role: string; permissions?: Permission[] }) {
  const allowed = (permission: Permission) => hasPermission(role, permission) || permissions.includes(permission);
  const mayManagePricing = ["admin", "sales", "sales_manager"].includes(role) || permissions.includes("finance:manage");
  const groups = useMemo<NavGroup[]>(() => [
    {
      id: "orders",
      label: "งานขาย",
      items: [
        ...(["sales:view_self", "sales:view_team", "sales:view_all"].some(p => allowed(p as Permission)) ? [{ label: "แดชบอร์ดและเครื่องมือขาย", href: "/admin/sales" }] : []),
        ...(allowed("orders:create") ? [{ label: "สร้างใบงานใหม่", href: "/admin/orders/new", primary: true }] : []),
        { label: "รายการใบสั่งงาน", href: "#orders" },
        { label: "เลขพัสดุ / Order Plus", href: "/admin/shipments" },
      ],
    },
    ...(allowed("calendar:view") ? [{
      id: "production",
      label: "การผลิต",
      items: [
        ...(allowed("queue:manage") ? [{ label: "Job Today", href: "/admin/production/today" }] : []),
        { label: "ภาพรวมการผลิต", href: "/admin/production" },
        { label: "ปฏิทินการผลิต", href: "/admin/production/calendar" },
        ...(allowed("broadcast:send") ? [{ label: "ประกาศสด", href: "/admin/production/broadcast" }] : []),
      ],
    }, {
      id: "screens",
      label: "จอทีมงาน",
      items: [
        { label: "Print & Cut", href: "/admin/production/tv?department=print_cut" },
        { label: "Pack", href: "/admin/production/tv?department=pack" },
        { label: "Sale", href: "/admin/production/tv?department=sale" },
      ],
    }] : []),
    ...((mayManagePricing || allowed("commission:manage") || role === "admin") ? [{
      id: "system",
      label: "ตั้งค่าระบบ",
      items: [
        ...(mayManagePricing ? [{ label: "ราคาและอะไหล่", href: "/admin/pricing" }] : []),
        ...(allowed("commission:manage") ? [{ label: "คอมมิชชั่นและช่องทาง", href: "/admin/sales-settings" }] : []),
        ...(role === "admin" ? [{ label: "ผู้ใช้งานและทีม", href: "/admin/users" }, { label: "ระบบสำรองข้อมูล", href: "#backups" }] : []),
      ],
    }] : []),
  ].filter((group) => group.items.length), [role, permissions]);
  const [activeGroup, setActiveGroup] = useState(groups[0]?.id || "");
  const active = groups.find((group) => group.id === activeGroup) || groups[0];

  return <nav className="adminGroupedNav" aria-label="เมนูหลังบ้าน">
    <div className="adminNavGroupTabs" role="tablist" aria-label="หมวดเมนู">
      <a className="adminNavHome active" href="/admin" aria-current="page">ภาพรวม</a>
      {groups.map((group) => <button key={group.id} type="button" role="tab" aria-selected={active?.id === group.id} aria-controls="admin-nav-group-links" onClick={() => setActiveGroup(group.id)}>{group.label}</button>)}
    </div>
    {active && <div className="adminNavLinks" id="admin-nav-group-links" role="tabpanel">
      <span>{active.label}</span>
      {active.items.map((item) => <a className={item.primary ? "adminNavPrimary" : ""} href={item.href} key={item.href}>{item.label}</a>)}
    </div>}
  </nav>;
}
