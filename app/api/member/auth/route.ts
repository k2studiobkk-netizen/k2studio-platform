import { CHALLENGE_COOKIE, MEMBER_COOKIE, CheckoutError, cookieValue, digest, getMember, memberCookie, memberEnv, memberError, memberResponse, randomToken, rateLimit, readJson, sameOrigin } from "../../../member-auth";
import { sendMemberEmail } from "../../../member-email";

export async function GET(request:Request){try{return memberResponse({member:await getMember(request)});}catch(error){return memberError(error);}}
export async function POST(request:Request){
 try{
  sameOrigin(request);const runtime=memberEnv();const data=await readJson(request);
  if(data.action==="logout"){
    const token=cookieValue(request,MEMBER_COOKIE);if(token)await runtime.DB.prepare("DELETE FROM customer_sessions WHERE token_hash=?").bind(await digest(token)).run();
    return memberResponse({ok:true},200,{"set-cookie":memberCookie(request,MEMBER_COOKIE,"",0)});
  }
  if(data.action==="start"){
    const email=String(data.email||"").trim().toLowerCase();
    if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))throw new CheckoutError("กรุณากรอกอีเมลให้ถูกต้อง");
    const ip=request.headers.get("CF-Connecting-IP")||"local";
    await rateLimit(runtime.DB,`email:${await digest(email)}`,5,3600000);
    await rateLimit(runtime.DB,`ip:${await digest(ip)}`,20,3600000);
    const id=randomToken(),browser=randomToken();
    // Rejection sampling avoids modulo bias in a six-digit OTP.
    let random=crypto.getRandomValues(new Uint32Array(1))[0];while(random>=4294000000)random=crypto.getRandomValues(new Uint32Array(1))[0];
    const code=String(random%1000000).padStart(6,"0");
    await runtime.DB.prepare("INSERT INTO customer_email_challenges(id,email,browser_hash,code_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)").bind(id,email,await digest(browser),await digest(`${id}:${browser}:${code}`),Date.now()+600000,Date.now()).run();
    try{await sendMemberEmail(runtime,email,"รหัสยืนยันอีเมล K2STUDIO",`รหัสยืนยันของคุณคือ ${code}\nรหัสใช้ได้ 10 นาที และใช้ได้ครั้งเดียว\nหากคุณไม่ได้ทำรายการนี้ สามารถละเว้นอีเมลนี้ได้\nทีม K2STUDIO`);}
    catch(error){await runtime.DB.prepare("UPDATE customer_email_challenges SET consumed_at=? WHERE id=?").bind(Date.now(),id).run();throw error;}
    return memberResponse({challengeId:id,email,expiresIn:600},200,{"set-cookie":memberCookie(request,CHALLENGE_COOKIE,browser,600)});
  }
  if(data.action!=="verify")throw new CheckoutError("คำขอไม่ถูกต้อง");
  const id=String(data.challengeId||""),code=String(data.code||""),browser=cookieValue(request,CHALLENGE_COOKIE);
  if(!/^[a-f0-9]{64}$/.test(id)||!/^\d{6}$/.test(code)||!/^[a-f0-9]{64}$/.test(browser))throw new CheckoutError("กรุณาขอรหัสและกรอกรหัส 6 หลักให้ถูกต้อง");
  const row=await runtime.DB.prepare("UPDATE customer_email_challenges SET attempts=attempts+1 WHERE id=? AND browser_hash=? AND expires_at>? AND consumed_at IS NULL AND attempts<5 RETURNING email,code_hash").bind(id,await digest(browser),Date.now()).first<{email:string;code_hash:string}>();
  if(!row||row.code_hash!==await digest(`${id}:${browser}:${code}`))throw new CheckoutError("รหัสไม่ถูกต้องหรือหมดอายุ กรุณาตรวจอีเมลหรือขอรหัสใหม่");
  const consumed=await runtime.DB.prepare("UPDATE customer_email_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL RETURNING id").bind(Date.now(),id).first();
  if(!consumed)throw new CheckoutError("รหัสนี้ถูกใช้แล้ว กรุณาขอรหัสใหม่");
  await runtime.DB.prepare("INSERT INTO customer_members(email,verified_at) VALUES (?,?) ON CONFLICT(email) DO NOTHING").bind(row.email,Date.now()).run();
  const member=await runtime.DB.prepare("SELECT id,email,display_name FROM customer_members WHERE email=? AND active=1").bind(row.email).first<{id:number;email:string;display_name:string}>();
  if(!member)throw new CheckoutError("บัญชีนี้ยังไม่พร้อมใช้งาน กรุณาติดต่อทีมงาน",403);
  const token=randomToken();await runtime.DB.prepare("INSERT INTO customer_sessions(token_hash,member_id,expires_at) VALUES (?,?,?)").bind(await digest(token),member.id,Date.now()+30*86400000).run();
  const response=memberResponse({member:{id:member.id,email:member.email,displayName:member.display_name}});
  response.headers.append("set-cookie",memberCookie(request,MEMBER_COOKIE,token,30*86400));response.headers.append("set-cookie",memberCookie(request,CHALLENGE_COOKIE,"",0));return response;
 }catch(error){return memberError(error);}
}
