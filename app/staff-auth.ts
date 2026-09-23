import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { defaultStaffTeamsForRole, hasPermission, normalizeStaffTeams, normalizeVisibilityPermissions, normalizedRole, productionRoleLabel, type Permission, type StaffTeam, type VisibilityPermission } from "./production-rbac";

export type StaffUser={id:number;username:string;displayName:string;role:string;teams:StaffTeam[];permissions:VisibilityPermission[];mustChangePassword:boolean};
export const roleLabel=(role:string)=>productionRoleLabel[normalizedRole(role)];
export const canManagePricing=(subject:string|StaffUser)=>can(subject,"finance:manage")||["admin","sales","sales_manager"].includes(normalizedRole(typeof subject==="string"?subject:subject.role));
export const canManageOrderNumber=(role:string)=>hasPermission(role,"orders:edit");
export const can=(subject:string|StaffUser,permission:Permission)=>typeof subject==="string"?hasPermission(subject,permission):hasPermission(subject.role,permission)||subject.permissions.includes(permission as VisibilityPermission);
export const canViewOrderFinance=(user:StaffUser,salesOwnerId:number)=>can(user,"finance:view")||can(user,"sales:view_all")||can(user,"sales:view_team")||(can(user,"sales:view_self")&&user.id===salesOwnerId);
// Sales can record a customer's next installment on their own orders without
// receiving company-wide finance access. The API must use this order-scoped
// check too; a page-only check would be insufficient.
export const canManageOrderFinance=(user:StaffUser,salesOwnerId:number)=>can(user,"finance:manage")||(normalizedRole(user.role)==="sales"&&user.id===salesOwnerId);
export const canViewOrderSlips=(user:StaffUser,salesOwnerId:number)=>can(user,"finance:slips")||canManageOrderFinance(user,salesOwnerId);
const COOKIE="k2_staff_session";
// Chromium caps persistent cookies at 400 days. Using that browser-supported
// maximum keeps staff signed in across browser/app restarts until they choose
// "ออกจากระบบ", clear site data, or an administrator disables the account.
export const STAFF_SESSION_MAX_AGE_SECONDS=400*24*60*60;
const bytes=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const base64=(value:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(value)));
const hex=(value:ArrayBuffer)=>[...new Uint8Array(value)].map(x=>x.toString(16).padStart(2,"0")).join("");
export async function passwordProof(passwordHashBase64:string,message:string){const key=await crypto.subtle.importKey("raw",bytes(passwordHashBase64),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return base64(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(message)))}
export function timingSafeBase64Equal(provided:string,expected:string){
 try{
  // HMAC-SHA256 is always 32 bytes (44 Base64 characters). Reject oversized
  // attacker-controlled input before decoding or looping over it.
  if(provided.length!==44||expected.length!==44)return false;
  const a=bytes(provided),b=bytes(expected);
  if(a.byteLength!==32||b.byteLength!==32)return false;
  let difference=0;
  for(let index=0;index<32;index++)difference|=a[index]^b[index];
  return difference===0;
 }catch{return false}
}
export async function tokenHash(token:string){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)))}
export function safeReturnTo(value:string|null){
 if(!value||value.startsWith("//"))return "/admin";
 if(value.startsWith("/admin"))return value;
 if(/^\/track\/[a-f0-9]{32}$/i.test(value))return value;
 if(/^\/order\/[a-f0-9]{32}\?(?:staff=1(?:&mode=production)?|mode=production&staff=1)$/i.test(value))return value;
 return "/admin";
}
export async function getStaffUser():Promise<StaffUser|null>{const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;const db=(env as unknown as {DB:D1Database}).DB;const row=await db.prepare("SELECT u.id,u.username,u.display_name,u.role,u.must_change_password,COALESCE((SELECT GROUP_CONCAT(t.team_code,',') FROM staff_user_teams t WHERE t.user_id=u.id),'') AS teams,COALESCE((SELECT GROUP_CONCAT(p.permission_code,',') FROM staff_user_permissions p WHERE p.user_id=u.id),'') AS permissions FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP AND u.active=1 LIMIT 1").bind(await tokenHash(token)).first<Record<string,string|number>>();if(!row)return null;const role=String(row.role);const assignedTeams=normalizeStaffTeams(row.teams);return{id:Number(row.id),username:String(row.username),displayName:String(row.display_name),role,teams:assignedTeams.length?assignedTeams:defaultStaffTeamsForRole(role),permissions:normalizeVisibilityPermissions(row.permissions),mustChangePassword:Number(row.must_change_password)===1}}
export async function requireStaff(returnTo="/admin"){const user=await getStaffUser();if(!user)redirect(`/admin/login?returnTo=${encodeURIComponent(returnTo)}`);return user}
export async function createStaffSession(userId:number){
 const raw=crypto.getRandomValues(new Uint8Array(32));
 const token=[...raw].map(x=>x.toString(16).padStart(2,"0")).join("");
 const expiresAt=new Date(Date.now()+STAFF_SESSION_MAX_AGE_SECONDS*1000);
 const db=(env as unknown as {DB:D1Database}).DB;
 await db.prepare("INSERT INTO staff_sessions (user_id,token_hash,expires_at) VALUES (?,?,?)").bind(userId,await tokenHash(token),expiresAt.toISOString()).run();
 return`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STAFF_SESSION_MAX_AGE_SECONDS}; Expires=${expiresAt.toUTCString()}`;
}
export async function destroyStaffSession(){const jar=await cookies();const token=jar.get(COOKIE)?.value;if(token){const db=(env as unknown as {DB:D1Database}).DB;await db.prepare("DELETE FROM staff_sessions WHERE token_hash=?").bind(await tokenHash(token)).run()}return`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
export async function audit(user:StaffUser,orderId:number|null,action:string,details=""){const db=(env as unknown as {DB:D1Database}).DB;await db.prepare("INSERT INTO audit_logs (order_id,user_id,username,display_name,action,details) VALUES (?,?,?,?,?,?)").bind(orderId,user.id,user.username,user.displayName,action,details.slice(0,1000)).run()}
