import { env } from "cloudflare:workers";
import { HARDWARE, HARDWARE_VARIANTS, calculatePrice } from "../../../../pricing-config";
import { canSubmitCustomerDesign, parseReceipt, validateDesignSpec, imageType, UUID, RECEIPT_PREFIX } from "../../../../customer-design.mjs";
const runtime=()=>env as unknown as {DB:D1Database;ORDER_FILES:R2Bucket};
const headers={"cache-control":"no-store"};
const roles=["original_front","front","original_back","back","preview"] as const;
async function context(token:string) {
 if(!/^[a-f0-9]{32}$/i.test(token))return null;
 const {DB}=runtime();
 const order=await DB.prepare("SELECT id,order_number,order_status,production_released_at FROM orders WHERE public_token=?").bind(token).first<{id:number;order_number:string;order_status:string;production_released_at:string}>();
 if(!order)return null;
 const work=await DB.prepare("SELECT status FROM work_orders WHERE order_id=? LIMIT 1").bind(order.id).first<{status:string}>();
 return {order,allowed:canSubmitCustomerDesign(order,work)};
}
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}) {
 try {
 const {token}=await params;const ctx=await context(token);if(!ctx)return Response.json({error:"ไม่พบออเดอร์"},{status:404,headers});
 const {DB}=runtime();
 const items=(await DB.prepare("SELECT id,line_no,item_name,quantity,print_sides,hardware_code,hardware_color,width_cm,height_cm FROM order_items WHERE order_id=? AND product_type='acrylic_keychain' AND thickness_mm='2.5' ORDER BY line_no").bind(ctx.order.id).all()).results;
 const receipts=(await DB.prepare("SELECT id,note,created_at FROM order_status_history WHERE order_id=? AND note LIKE ? ORDER BY id DESC LIMIT 30").bind(ctx.order.id,RECEIPT_PREFIX+"%").all<{id:number;note:string;created_at:string}>()).results.map(row=>({id:row.id,createdAt:row.created_at,submissionId:parseReceipt(row.note)?.submissionId}));
 return Response.json({orderNumber:ctx.order.order_number,canSubmit:ctx.allowed,items,receipts},{headers});
 }catch{return Response.json({error:"ยังโหลดข้อมูลออเดอร์ไม่ได้ กรุณาลองอีกครั้ง"},{status:503,headers})}
}
export async function POST(request:Request,{params}:{params:Promise<{token:string}>}) {
 const {token}=await params;
 const origin=request.headers.get("origin");
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:"คำขอไม่ถูกต้อง"},{status:403,headers});
 if(Number(request.headers.get("content-length")||0)>34*1024*1024)return Response.json({error:"ไฟล์รวมเกิน 34 MB"},{status:413,headers});
 try {
 const ctx=await context(token);if(!ctx)return Response.json({error:"ไม่พบออเดอร์"},{status:404,headers});
 const {DB,ORDER_FILES}=runtime();const form=await request.formData();
 const submissionId=String(form.get("submission_id")||"");if(!UUID.test(submissionId))return Response.json({error:"รหัสการส่งแบบไม่ถูกต้อง"},{status:400,headers});
 const prefix=`${RECEIPT_PREFIX}${submissionId}:`;
 const previous=await DB.prepare("SELECT id FROM order_status_history WHERE order_id=? AND note LIKE ? LIMIT 1").bind(ctx.order.id,prefix+"%").first<{id:number}>();
 if(previous)return Response.json({ok:true,receiptId:previous.id,status:"waiting_for_graphic_review",duplicate:true},{headers});
 if(!ctx.allowed)return Response.json({error:"ออเดอร์นี้อยู่ในขั้นตรวจอนุมัติหรือผลิตแล้ว กรุณาติดต่อทีมงานก่อนแก้แบบ"},{status:409,headers});
 if(form.get("confirmed")!=="1")return Response.json({error:"กรุณายืนยันแบบก่อนส่ง"},{status:400,headers});
 let spec:ReturnType<typeof validateDesignSpec>;
 try{const json=String(form.get("spec")||"");if(json.length>12000)throw Error("ข้อมูลแบบยาวเกินกำหนด");spec=validateDesignSpec(JSON.parse(json),HARDWARE,HARDWARE_VARIANTS)}catch(e){return Response.json({error:e instanceof Error?e.message:"ข้อมูลแบบไม่ถูกต้อง"},{status:400,headers})}
 const item=await DB.prepare("SELECT id FROM order_items WHERE id=? AND order_id=? AND product_type='acrylic_keychain' AND thickness_mm='2.5'").bind(spec.itemId,ctx.order.id).first();
 if(!item)return Response.json({error:"รายการสินค้าไม่อยู่ในออเดอร์นี้"},{status:400,headers});
 const count=await DB.prepare("SELECT COUNT(*) AS n FROM order_status_history WHERE order_id=? AND note LIKE ?").bind(ctx.order.id,RECEIPT_PREFIX+"%").first<{n:number}>();
 if(Number(count?.n)>=50)return Response.json({error:"ออเดอร์นี้ส่งแบบครบจำนวนที่รองรับแล้ว กรุณาติดต่อทีมงาน"},{status:429,headers});
 const files:Array<{role:string;file:File;type:string;bytes:ArrayBuffer}>=[];let total=0;
 for(const role of roles){const file=form.get(role);const required=["original_front","front","preview"].includes(role)||(spec.sides===2&&["original_back","back"].includes(role));
  if(!(file instanceof File)||!file.size){if(required)return Response.json({error:"กรุณาแนบภาพหน้า หลัง และตัวอย่างให้ครบ"},{status:400,headers});continue}
  if(file.size>15*1024*1024)return Response.json({error:"ไฟล์แต่ละภาพต้องไม่เกิน 15 MB"},{status:413,headers});
  total+=file.size;if(total>32*1024*1024)return Response.json({error:"ไฟล์รวมต้องไม่เกิน 32 MB"},{status:413,headers});
  const bytes=await file.arrayBuffer();const type=imageType(new Uint8Array(bytes));if(!type||(!role.startsWith("original_")&&type!=="image/png"))return Response.json({error:"ไฟล์ต้นฉบับต้องเป็น PNG/JPG และภาพที่จัดแบบต้องเป็น PNG"},{status:400,headers});files.push({role,file,type,bytes});
 }
 const priceRow=await DB.prepare("SELECT price FROM hardware_prices WHERE hardware_code=?").bind(spec.hardwareCode).first<{price:string}>();
 const pricing=calculatePrice({thickness:"2.5",width:spec.dimensions.totalWidth/10,height:spec.dimensions.totalHeight/10,quantity:spec.quantity,sides:spec.sides as 1|2,hardwareCode:spec.hardwareCode,packaging:"standard",hardwarePrice:priceRow?Number(priceRow.price):undefined});
 const storageId=crypto.randomUUID();const base=`customer-designs/${ctx.order.id}/${storageId}`;
 const manifest={...spec,submissionId,orderId:ctx.order.id,customerConfirmedAt:new Date().toISOString(),status:"waiting_for_graphic_review",pricing:{...pricing,excludesVat:true,excludesShipping:true},assets:files.map(f=>({role:f.role,name:f.file.name.slice(0,200),type:f.type,key:`${base}/${f.role}.${f.type==="image/png"?"png":"jpg"}`}))};
 for(const [i,f] of files.entries())await ORDER_FILES.put(manifest.assets[i].key,f.bytes,{httpMetadata:{contentType:f.type}});
 await ORDER_FILES.put(`${base}/manifest.json`,JSON.stringify(manifest),{httpMetadata:{contentType:"application/json"}});
 const note=`${prefix}${storageId} ลูกค้ายืนยันแบบรายการ ${spec.itemId} • ${spec.quantity} ชิ้น • รอกราฟิกตรวจ ไม่ใช่อนุมัติผลิต`;
 // Receipt and workflow eligibility are checked atomically. Existing order totals and production approval are untouched.
 await DB.prepare(`INSERT INTO order_status_history(order_id,status,note)
 SELECT id,order_status,? FROM orders o WHERE id=? AND order_status IN ('waiting_for_artwork_review','artwork_changes_requested')
 AND COALESCE(production_released_at,'')='' AND NOT EXISTS(SELECT 1 FROM work_orders WHERE order_id=o.id AND status<>'draft')
 AND NOT EXISTS(SELECT 1 FROM order_status_history WHERE order_id=o.id AND note LIKE ?)
 AND (SELECT COUNT(*) FROM order_status_history WHERE order_id=o.id AND note LIKE ?)<50`)
 .bind(note,ctx.order.id,prefix+"%",RECEIPT_PREFIX+"%").run();
 const receipt=await DB.prepare("SELECT id,note FROM order_status_history WHERE order_id=? AND note LIKE ? LIMIT 1").bind(ctx.order.id,prefix+"%").first<{id:number;note:string}>();
 if(!receipt||parseReceipt(receipt.note)?.storageId!==storageId){await ORDER_FILES.delete([...manifest.assets.map(a=>a.key),`${base}/manifest.json`]);if(!receipt)return Response.json({error:"สถานะงานเปลี่ยนระหว่างส่ง กรุณาโหลดออเดอร์ใหม่"},{status:409,headers})}
 return Response.json({ok:true,receiptId:receipt!.id,status:"waiting_for_graphic_review",trackingPath:`/track/${token}`},{status:201,headers});
 }catch(error){console.error("customer design submission failed",error);return Response.json({error:"ส่งแบบไม่สำเร็จ ภาพของคุณยังอยู่ในหน้านี้ กรุณาลองส่งอีกครั้ง"},{status:503,headers})}
}
