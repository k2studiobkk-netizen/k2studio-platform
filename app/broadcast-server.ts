import { env } from "cloudflare:workers";
import type { BroadcastEvent, BroadcastMessage, BroadcastPriority, BroadcastDisplayMode } from "./broadcast-types";

type BroadcastRow = Record<string, string | number>;

const utcIso = (value: unknown) => {
  const text = String(value || "");
  return text ? `${text.replace(" ", "T")}Z` : "";
};

export function broadcastRowToMessage(row: BroadcastRow): BroadcastMessage {
  return {
    id: Number(row.id),
    title: String(row.title),
    message: String(row.message),
    priority: String(row.priority) as BroadcastPriority,
    senderName: String(row.sender_name),
    displayMode: String(row.display_mode) as BroadcastDisplayMode,
    targetScope: String(row.target_scope) as BroadcastMessage["targetScope"],
    targetDepartment: String(row.target_department || ""),
    targetScreen: String(row.target_screen || ""),
    expireAt: utcIso(row.expire_at),
    dismissible: Number(row.dismissible) === 1,
    createdAt: utcIso(row.created_at),
  };
}

export async function publishBroadcastEvent(event: BroadcastEvent) {
  const stub = (env as unknown as Cloudflare.Env).BROADCAST_HUB.getByName("k2studio-production");
  const response = await stub.fetch("https://broadcast.internal/publish", {
    method: "POST",
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error(`Broadcast delivery failed (${response.status})`);
  const result = await response.json<{ delivered: number }>();
  return result.delivered;
}
