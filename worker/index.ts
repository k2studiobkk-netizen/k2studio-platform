/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { sendDueReminders, sendGraphicWorkflowAlerts } from "../app/integrations";
import { runDailyBackup } from "../app/daily-backup";
import { flushMemberEmails } from "../app/member-email";
import type { MemberEnv } from "../app/member-auth";
export { BroadcastHub } from "../app/broadcast-hub";

type SupportedImageFormat = "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/avif" | "rgb" | "rgba";

type WorkerEnv = Cloudflare.Env & {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  GOOGLE_CALENDAR_WEBHOOK_URL?: string;
  INTEGRATION_SECRET?: string;
};

const STAFF_SESSION_COOKIE = "k2_staff_session";
const STAFF_REFRESH_COOKIE = "k2_staff_refresh";
const STAFF_SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
const STAFF_REFRESH_INTERVAL_SECONDS = 30 * 24 * 60 * 60;

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const canonical = env.CANONICAL_HOSTNAME || "order.k2group.site";

    // LINE's in-app browser can open copied links over plain HTTP. Staff
    // sessions use Secure cookies, so force HTTPS before any page or auth
    // handler runs; otherwise the login succeeds in D1 but the browser drops
    // the cookie and sends the user back to the login screen.
    if (url.hostname === canonical && url.protocol === "http:") {
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 308);
    }

    // Sites and the standalone Worker have separate storage resources. Keep
    // the public Sites address as a convenient alias, but send every visitor
    // to the Worker so all reads and writes use the canonical D1 database.
    if (url.hostname.endsWith(".chatgpt.site")) {
      url.hostname = canonical;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 308);
    }

    if (url.pathname === "/api/broadcast/stream") {
      if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("WebSocket upgrade required", { status: 426 });
      }
      const session = request.headers.get("cookie")?.match(/(?:^|;\s*)k2_staff_session=([a-f0-9]{64})(?:;|$)/i)?.[1];
      if (!session) return new Response("Unauthorized", { status: 401 });
      const sessionHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(session)))].map((value) => value.toString(16).padStart(2, "0")).join("");
      const staff = await env.DB.prepare("SELECT u.id FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP AND u.active=1 LIMIT 1").bind(sessionHash).first<{ id: number }>();
      if (!staff) return new Response("Unauthorized", { status: 401 });
      const departments = new Set(["print_cut", "pack", "sale", "production", "packing", "graphic"]);
      const department = departments.has(url.searchParams.get("department") || "") ? String(url.searchParams.get("department")) : "print_cut";
      const screenId = (url.searchParams.get("screenId") || "print-cut-main").replace(/[^a-z0-9_-]/gi, "").slice(0, 80) || "print-cut-main";
      ctx.waitUntil(env.DB.prepare(`INSERT INTO broadcast_screens (screen_key,name,department,last_seen_at) VALUES (?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(screen_key) DO UPDATE SET department=excluded.department,last_seen_at=CURRENT_TIMESTAMP,active=1`).bind(screenId, screenId, department).run());
      const realtimeUrl = new URL(request.url);
      realtimeUrl.search = new URLSearchParams({ screenId, department }).toString();
      return env.BROADCAST_HUB.getByName("k2studio-production").fetch(new Request(realtimeUrl, request));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const supported = new Set<SupportedImageFormat>(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "rgb", "rgba"]);
          const outputFormat: SupportedImageFormat = supported.has(format as SupportedImageFormat) ? format as SupportedImageFormat : "image/webp";
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format: outputFormat, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    let response = await handler.fetch(request, env, ctx);

    // Keep active staff sessions signed in across browser and mobile-app
    // restarts. Browsers cap persistent cookies at 400 days, so refresh that
    // window every 30 days. The marker prevents a D1 write on every request.
    const staffSurface = url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/admin/") || url.pathname.startsWith("/api/orders/");
    const cookieHeader = request.headers.get("cookie") || "";
    const staffSession = cookieHeader.match(/(?:^|;\s*)k2_staff_session=([a-f0-9]{64})(?:;|$)/i)?.[1];
    const refreshCurrent = /(?:^|;\s*)k2_staff_refresh=1(?:;|$)/.test(cookieHeader);
    if (staffSurface && url.pathname !== "/api/staff/logout" && staffSession && !refreshCurrent) {
      const sessionHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(staffSession)))].map((value) => value.toString(16).padStart(2, "0")).join("");
      const expiresAt = new Date(Date.now() + STAFF_SESSION_MAX_AGE_SECONDS * 1000);
      ctx.waitUntil(env.DB.prepare("UPDATE staff_sessions SET expires_at=? WHERE token_hash=? AND expires_at>CURRENT_TIMESTAMP").bind(expiresAt.toISOString(), sessionHash).run());
      const headers = new Headers(response.headers);
      headers.append("set-cookie", `${STAFF_SESSION_COOKIE}=${staffSession}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STAFF_SESSION_MAX_AGE_SECONDS}; Expires=${expiresAt.toUTCString()}`);
      headers.append("set-cookie", `${STAFF_REFRESH_COOKIE}=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STAFF_REFRESH_INTERVAL_SECONDS}`);
      response = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    if (url.hostname === canonical && (url.pathname === "/admin/login" || url.pathname.startsWith("/api/staff/login"))) {
      const headers = new Headers(response.headers);
      // Prevent LINE and other in-app browsers from reusing an old HTTP login
      // document, and remember that this staff surface must always use TLS.
      headers.set("cache-control", "no-store, no-cache, must-revalidate");
      headers.set("pragma", "no-cache");
      headers.set("strict-transport-security", "max-age=31536000");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  },
  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    const tasks = controller.cron === "0 2 * * *"
      ? [sendDueReminders(env), runDailyBackup(env), sendGraphicWorkflowAlerts(env)]
      : [sendGraphicWorkflowAlerts(env)];
    tasks.push(flushMemberEmails(env as unknown as MemberEnv));
    ctx.waitUntil(Promise.allSettled(tasks).then((results)=>{
      const failed=results.filter((result):result is PromiseRejectedResult=>result.status==="rejected");
      if(failed.length)throw new Error(`Scheduled tasks failed: ${failed.map(result=>String(result.reason)).join(" | ")}`);
    }));
  },
} satisfies ExportedHandler<WorkerEnv>;

export default worker;
