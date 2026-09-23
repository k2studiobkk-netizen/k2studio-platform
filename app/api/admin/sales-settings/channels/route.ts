import { env } from "cloudflare:workers";
import { audit, can, getStaffUser } from "../../../../staff-auth";

export async function POST(request:Request){
 const user=await getStaffUser();if(!user)return Response.json({error:"กรุณาเข้าสู่ระบบ"},{status:401});if(!can(user,"commission:manage"))return Response.json({error:"ไม่มีสิทธิ์ตั้งค่าการขาย"},{status:403});
 const body=await request.json() as {action?:string;id?:number;name?:string;prefix?:string;platform?:string;active?:number};const db=(env as unknown as {DB:D1Database}).DB;
 if(body.action==="toggle"){const id=Number(body.id),active=body.active===1?1:0;if(!Number.isInteger(id)||id<1)return Response.json({error:"ช่องทางไม่ถูกต้อง"},{status:400});await db.prepare("UPDATE sales_channels SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(active,id).run();await audit(user,null,active?"เปิดช่องทางขาย":"ปิดช่องทางขาย",`channel #${id}`);return Response.json({ok:true})}
 const name=String(body.name||"").trim().slice(0,80),platform=String(body.platform||"").trim().slice(0,30),prefix=String(body.prefix||"").trim().toUpperCase();if(name.length<2||platform.length<2||!/^[A-Z0-9]{2,6}$/.test(prefix))return Response.json({error:"กรุณาตรวจชื่อ แพลตฟอร์ม และอักษรนำหน้า 2–6 ตัว"},{status:400});
 const code=`custom_${prefix.toLowerCase()}`;try{await db.prepare("INSERT INTO sales_channels (code,name,prefix,platform,sort_order,created_by) VALUES (?,?,?,?,COALESCE((SELECT MAX(sort_order)+10 FROM sales_channels),10),?)").bind(code,name,prefix,platform,user.username).run()}catch{return Response.json({error:"อักษรนำหน้าหรือช่องทางนี้มีอยู่แล้ว"},{status:409})}await audit(user,null,"เพิ่มช่องทางขาย",`${prefix} • ${name} • ${platform}`);return Response.json({ok:true})
}
