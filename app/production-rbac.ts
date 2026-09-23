export const staffRoles = ["sales", "sales_manager", "finance", "graphic", "production", "production_manager", "admin"] as const;
export type StaffRole = typeof staffRoles[number];

export const staffTeams = ["sale", "graphic", "print_cut", "pack"] as const;
export type StaffTeam = typeof staffTeams[number];

export const staffTeamLabels: Record<StaffTeam, string> = {
  sale: "ฝ่ายขาย",
  graphic: "กราฟิก",
  print_cut: "Print & Cut",
  pack: "Pack",
};

export function normalizeStaffTeams(value: unknown): StaffTeam[] {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(source.map((team) => String(team).trim()).filter((team): team is StaffTeam => staffTeams.includes(team as StaffTeam)))];
}

export function defaultStaffTeamsForRole(role: string): StaffTeam[] {
  switch (normalizedRole(role)) {
    case "sales": return ["sale"];
    case "sales_manager": return ["sale"];
    case "finance": return ["sale"];
    case "graphic": return ["graphic"];
    case "production": return ["print_cut", "pack"];
    case "production_manager":
    case "admin": return [...staffTeams];
  }
}

export type Permission =
  | "orders:create"
  | "orders:edit"
  | "work_orders:create"
  | "calendar:view"
  | "production:schedule"
  | "delivery:confirm"
  | "capacity:override"
  | "capacity:manage"
  | "rush:approve"
  | "broadcast:send"
  | "queue:update"
  | "queue:manage"
  | "users:manage"
  | VisibilityPermission;

export const visibilityPermissions = [
  "finance:view",
  "finance:manage",
  "finance:slips",
  "finance:export",
  "sales:view_self",
  "sales:view_team",
  "sales:view_all",
  "commission:view_self",
  "commission:view_all",
  "commission:manage",
] as const;
export type VisibilityPermission = typeof visibilityPermissions[number];

export const visibilityPermissionLabels: Record<VisibilityPermission, string> = {
  "finance:view": "ดูยอดรับชำระและยอดค้าง",
  "finance:manage": "บันทึกและแก้ไขการรับชำระ",
  "finance:slips": "ดูและดาวน์โหลดสลิป",
  "finance:export": "ส่งออกรายงานการเงิน",
  "sales:view_self": "ดูยอดขายและลูกค้าของตัวเอง",
  "sales:view_team": "ดูยอดขายของทีมขาย",
  "sales:view_all": "ดูยอดขายทั้งบริษัท",
  "commission:view_self": "ดูคอมมิชชั่นของตัวเอง",
  "commission:view_all": "ดูคอมมิชชั่นทุกคน",
  "commission:manage": "ตั้งค่าเรตคอมมิชชั่นและช่องทางขาย",
};

export function normalizeVisibilityPermissions(value: unknown): VisibilityPermission[] {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(source.map((permission) => String(permission).trim()).filter((permission): permission is VisibilityPermission => visibilityPermissions.includes(permission as VisibilityPermission)))];
}

export function normalizedRole(role: string): StaffRole {
  if (role === "staff") return "graphic";
  if (role === "manager") return "production_manager";
  return staffRoles.includes(role as StaffRole) ? role as StaffRole : "graphic";
}

const grants: Record<StaffRole, ReadonlySet<Permission>> = {
  sales: new Set(["orders:create", "orders:edit", "calendar:view", "sales:view_self", "commission:view_self"]),
  sales_manager: new Set(["orders:create", "orders:edit", "calendar:view", "sales:view_team", "commission:view_all"]),
  finance: new Set(["calendar:view", "finance:view", "finance:manage", "finance:slips", "finance:export", "sales:view_all"]),
  graphic: new Set(["orders:create", "orders:edit", "work_orders:create", "calendar:view", "queue:update"]),
  production: new Set(["work_orders:create", "calendar:view", "production:schedule", "delivery:confirm", "queue:update"]),
  production_manager: new Set(["orders:create", "orders:edit", "work_orders:create", "calendar:view", "production:schedule", "delivery:confirm", "capacity:override", "capacity:manage", "rush:approve", "broadcast:send", "queue:update", "queue:manage"]),
  admin: new Set(["orders:create", "orders:edit", "work_orders:create", "calendar:view", "production:schedule", "delivery:confirm", "capacity:override", "capacity:manage", "rush:approve", "broadcast:send", "queue:update", "queue:manage", "users:manage", ...visibilityPermissions]),
};

export function hasPermission(role: string, permission: Permission) {
  return grants[normalizedRole(role)].has(permission);
}

export const productionRoleLabel: Record<StaffRole, string> = {
  sales: "ฝ่ายขาย",
  sales_manager: "ผู้จัดการฝ่ายขาย",
  finance: "บัญชี / การเงิน",
  graphic: "กราฟิก",
  production: "ฝ่ายผลิต",
  production_manager: "ผู้จัดการฝ่ายผลิต",
  admin: "ผู้ดูแลระบบ",
};
