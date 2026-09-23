import { env } from "cloudflare:workers";

const toBase64=(value:Uint8Array)=>btoa(String.fromCharCode(...value));

export async function GET(request:Request){
 const username=String(new URL(request.url).searchParams.get("username")||"").trim().toLowerCase();
 const db=(env as unknown as{DB:D1Database}).DB;
 const user=/^[a-z0-9._-]{1,64}$/.test(username)?await db.prepare("SELECT password_salt FROM staff_users WHERE username=? AND active=1 LIMIT 1").bind(username).first<{password_salt:string}>():null;
 const randomSalt=crypto.getRandomValues(new Uint8Array(16));
 const challenge=crypto.getRandomValues(new Uint8Array(24));
 return Response.json({
  salt:user?.password_salt||toBase64(randomSalt),
  challenge:toBase64(challenge),
  expires:Date.now()+60_000,
  iterations:100_000,
 },{headers:{"cache-control":"no-store"}});
}
