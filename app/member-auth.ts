import { env } from "cloudflare:workers";
import { CheckoutError,digest } from "./member-shared";
export { CheckoutError,digest,randomToken } from "./member-shared";

export type Member = { id:number; email:string; displayName:string };
export type MemberEnv = { DB:D1Database; ORDER_FILES:R2Bucket; MEMBER_EMAIL?:SendEmail; MEMBER_EMAIL_FROM?:string; PUBLIC_SITE_URL?:string };
export const memberEnv = () => env as unknown as MemberEnv;
export const MEMBER_COOKIE = "k2_customer_session";
export const CHALLENGE_COOKIE = "k2_customer_challenge";
export function cookieValue(request:Request,name:string){return (request.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(`${name}=`))?.slice(name.length+1)||"";}
export function memberCookie(request:Request,name:string,value:string,maxAge:number){
  const url=new URL(request.url);const local=["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${local&&url.protocol==="http:"?"":"; Secure"}`;
}
export function sameOrigin(request:Request){
  if(request.headers.get("origin")!==new URL(request.url).origin)throw new CheckoutError("กรุณาทำรายการผ่านหน้าเว็บไซต์ของร้าน",403);
}
export async function readJson(request:Request){
  if(Number(request.headers.get("content-length")||0)>100000)throw new CheckoutError("ข้อมูลใหญ่เกินไป",413);
  const text=await request.text();if(text.length>100000)throw new CheckoutError("ข้อมูลใหญ่เกินไป",413);
  try{return JSON.parse(text);}catch{throw new CheckoutError("ข้อมูลไม่ถูกต้อง");}
}
export function memberResponse(body:unknown,status=200,headers:Record<string,string>={}){return Response.json(body,{status,headers:{"cache-control":"no-store",...headers}});}
export function memberError(error:unknown){
  if(error instanceof CheckoutError)return memberResponse({error:error.message},error.status);
  console.error("customer checkout request failed",error instanceof Error?error.name:"unknown");
  return memberResponse({error:"ระบบยังไม่พร้อมทำรายการ กรุณาลองอีกครั้ง"},503);
}
export async function getMember(request:Request,runtime=memberEnv()):Promise<Member|null>{
  const token=cookieValue(request,MEMBER_COOKIE);if(!/^[a-f0-9]{64}$/.test(token))return null;
  const row=await runtime.DB.prepare("SELECT m.id,m.email,m.display_name FROM customer_sessions s JOIN customer_members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>? AND m.active=1").bind(await digest(token),Date.now()).first<{id:number;email:string;display_name:string}>();
  return row?{id:row.id,email:row.email,displayName:row.display_name}:null;
}
export async function requireMember(request:Request,runtime=memberEnv()){const member=await getMember(request,runtime);if(!member)throw new CheckoutError("กรุณายืนยันอีเมลก่อนดำเนินการชำระเงิน",401);return member;}
export async function rateLimit(db:D1Database,bucket:string,limit:number,windowMs:number){
  const now=Date.now();const row=await db.prepare(`INSERT INTO customer_rate_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count`).bind(bucket,now+windowMs,now,now).first<{count:number}>();
  if(!row||row.count>limit)throw new CheckoutError("ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",429);
}
