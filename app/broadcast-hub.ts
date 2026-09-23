import type { BroadcastEvent } from "./broadcast-types";

type ConnectionInfo = { screenId: string; department: string };

export class BroadcastHub {
  constructor(private readonly ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/publish") {
      const payload = await request.text();
      const delivered = this.publish(payload);
      return Response.json({ delivered });
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    const screenId = (url.searchParams.get("screenId") || "print-cut-main").slice(0, 80);
    const department = (url.searchParams.get("department") || "print_cut").slice(0, 40);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [`screen:${screenId}`, `department:${department}`]);
    server.serializeAttachment({ screenId, department } satisfies ConnectionInfo);
    return new Response(null, { status: 101, webSocket: client });
  }

  private publish(payload: string): number {
    if (payload.length > 64_000) throw new Error("Broadcast payload is too large");
    const event = JSON.parse(payload) as BroadcastEvent;
    let delivered = 0;
    for (const socket of this.ctx.getWebSockets()) {
      const connection = socket.deserializeAttachment() as ConnectionInfo | null;
      const targetMatches = event.type === "production.queue_updated"
        ? event.departments.includes(connection?.department || "")
        : event.type !== "broadcast.created"
          || event.message.targetScope === "all"
          || (event.message.targetScope === "department" && connection?.department === event.message.targetDepartment)
          || (event.message.targetScope === "screen" && connection?.screenId === event.message.targetScreen);
      if (!targetMatches) continue;
      try {
        socket.send(payload);
        delivered += 1;
      } catch {
        socket.close(1011, "Delivery failed");
      }
    }
    return delivered;
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message === "string" && message === "ping") socket.send("pong");
  }

  async webSocketClose(socket: WebSocket, code: number, reason: string): Promise<void> {
    socket.close(code, reason);
  }
}
