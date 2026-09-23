export const broadcastPriorities = ["normal", "important", "urgent", "critical"] as const;
export type BroadcastPriority = typeof broadcastPriorities[number];

export const broadcastDisplayModes = ["top_banner", "bottom_ticker", "large_center", "fullscreen"] as const;
export type BroadcastDisplayMode = typeof broadcastDisplayModes[number];

export const broadcastDepartments = ["print_cut", "pack", "sale", "production", "packing", "graphic"] as const;
export type BroadcastDepartment = typeof broadcastDepartments[number];

export type BroadcastMessage = {
  id: number;
  title: string;
  message: string;
  priority: BroadcastPriority;
  senderName: string;
  displayMode: BroadcastDisplayMode;
  targetScope: "all" | "department" | "screen";
  targetDepartment: string;
  targetScreen: string;
  expireAt: string;
  dismissible: boolean;
  createdAt: string;
};

export type BroadcastEvent =
  | { type: "broadcast.created"; message: BroadcastMessage }
  | { type: "broadcast.closed"; messageId: number }
  | { type: "broadcast.acknowledged"; messageId: number; displayName: string; acknowledgedAt: string }
  | { type: "production.queue_updated"; departments: string[]; workOrderId: number; action: string };

export const priorityLabels: Record<BroadcastPriority, string> = {
  normal: "ทั่วไป",
  important: "สำคัญ",
  urgent: "ด่วน",
  critical: "วิกฤต",
};

export const displayModeLabels: Record<BroadcastDisplayMode, string> = {
  top_banner: "แถบด้านบน",
  bottom_ticker: "ข้อความวิ่งด้านล่าง",
  large_center: "แจ้งเตือนกลางจอ",
  fullscreen: "ฉุกเฉินเต็มจอ",
};
