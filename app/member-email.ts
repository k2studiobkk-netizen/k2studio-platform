import { CheckoutError, randomToken } from "./member-shared";
import type { MemberEnv } from "./member-auth";

export async function sendMemberEmail(runtime:MemberEnv,to:string,subject:string,text:string){
  if(!runtime.MEMBER_EMAIL||!runtime.MEMBER_EMAIL_FROM)throw new CheckoutError("ระบบยืนยันอีเมลกำลังเตรียมพร้อม ตะกร้าของคุณยังอยู่ กรุณาติดต่อ LINE @k2studio",503);
  const html=`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;line-height:1.7"><h1>K2STUDIO</h1><p>${text.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!)).replaceAll("\n","<br>")}</p></div>`;
  await runtime.MEMBER_EMAIL.send({from:{email:runtime.MEMBER_EMAIL_FROM,name:"K2STUDIO"},to,subject,text,html});
}
export async function flushMemberEmails(runtime:MemberEnv){
  if(!runtime.MEMBER_EMAIL||!runtime.MEMBER_EMAIL_FROM)return;
  // Claims are atomic; an expired lease may be retried after a Worker interruption.
  const jobs=await runtime.DB.prepare("SELECT id FROM customer_email_jobs WHERE state<>'sent' AND attempts<8 AND available_at<=? LIMIT 10").bind(Date.now()).all<{id:string}>();
  for(const candidate of jobs.results){
    const lease=randomToken();const job=await runtime.DB.prepare("UPDATE customer_email_jobs SET state='sending',attempts=attempts+1,available_at=?,lock_token=? WHERE id=? AND state<>'sent' AND attempts<8 AND available_at<=? RETURNING recipient,subject,body,attempts").bind(Date.now()+300000,lease,candidate.id,Date.now()).first<{recipient:string;subject:string;body:string;attempts:number}>();
    if(!job)continue;
    try{await sendMemberEmail(runtime,job.recipient,job.subject,job.body);await runtime.DB.prepare("UPDATE customer_email_jobs SET state='sent',sent_at=? WHERE id=? AND lock_token=?").bind(Date.now(),candidate.id,lease).run();}
    catch{await runtime.DB.prepare("UPDATE customer_email_jobs SET state='pending',available_at=? WHERE id=? AND lock_token=?").bind(Date.now()+Math.min(3600000,60000*2**job.attempts),candidate.id,lease).run();}
  }
}
