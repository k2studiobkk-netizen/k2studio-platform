import { waitUntil } from "cloudflare:workers";
import { CheckoutError, memberEnv, memberError, memberResponse, rateLimit, requireMember, sameOrigin } from "../../../member-auth";
import { flushMemberEmails } from "../../../member-email";
import type { CustomerQuote } from "../../../customer-checkout";

export async function GET(request:Request){try{
 const runtime=memberEnv(),member=await requireMember(request,runtime);
 const orders=await runtime.DB.prepare(`SELECT o.id,o.order_number,o.public_token,o.created_at,o.order_status,o.estimated_total,o.shipping_fee,o.deposit_amount,o.requested_date FROM customer_order_links l JOIN orders o ON o.id=l.order_id WHERE l.member_id=? ORDER BY o.id DESC LIMIT 100`).bind(member.id).all();
 return memberResponse({orders:orders.results});
}catch(error){return memberError(error);}}

export async function POST(request:Request){try{
 sameOrigin(request);const runtime=memberEnv(),member=await requireMember(request,runtime);
 await rateLimit(runtime.DB,`orders:${member.id}`,15,3600000);
 if(Number(request.headers.get("content-length")||0)>65*1024*1024)throw new CheckoutError("ไฟล์ทั้งหมดใหญ่เกินไป",413);
 const form=await request.formData();const quoteId=String(form.get("quoteId")||"");
 if(!/^[a-f0-9]{64}$/.test(quoteId)||form.get("confirmed")!=="1")throw new CheckoutError("กรุณาตรวจสอบและยืนยันรายการก่อนสั่งงาน");
 const existing=await runtime.DB.prepare("SELECT o.id,o.order_number FROM customer_order_links l JOIN orders o ON o.id=l.order_id WHERE l.quote_id=? AND l.member_id=?").bind(quoteId,member.id).first<{id:number;order_number:string}>();
 if(existing)return memberResponse({orderId:existing.id,orderNumber:existing.order_number,reused:true});
 const row=await runtime.DB.prepare("SELECT snapshot,order_token,expires_at FROM customer_quotes WHERE id=? AND member_id=?").bind(quoteId,member.id).first<{snapshot:string;order_token:string;expires_at:number}>();
 if(!row||row.expires_at<=Date.now())throw new CheckoutError("ราคาหมดอายุ กรุณาตรวจยอดใหม่",409);
 const quote=JSON.parse(row.snapshot) as CustomerQuote;const token=row.order_token;
 const uploads:Array<{id:string;line:number;name:string;type:string;key:string;file:File}>=[];
 for(const [index,item] of quote.items.entries())for(const [fileIndex,expected] of item.files.entries()){
   const file=form.get(`file-${item.id}-${fileIndex}`);
   if(!(file instanceof File)||file.size!==expected.size||file.name!==expected.name||file.type!==expected.type)throw new CheckoutError("ไฟล์งานเปลี่ยนไป กรุณาตรวจรายการและยืนยันราคาใหม่",409);
   const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()))].map(x=>x.toString(16).padStart(2,"0")).join("");
   if(hash!==expected.hash)throw new CheckoutError("ไฟล์งานไม่ตรงกับรายการที่ยืนยัน",409);
   // Existing tracking pages can render the first artwork inline. Never let
   // an untrusted MIME header turn an SVG/HTML payload into same-origin code.
   const safeType=["image/png","image/jpeg","image/webp"].includes(expected.type)?expected.type:"application/octet-stream";
   uploads.push({id:`${quoteId}-${index}-${fileIndex}`,line:index+1,name:expected.name,type:safeType,key:`customer-orders/${token}/${index+1}/${fileIndex}-${hash}`,file});
 }
 if([...form.keys()].filter(x=>x.startsWith("file-")).length!==uploads.length)throw new CheckoutError("จำนวนไฟล์ไม่ตรงกับรายการ");
 for(const upload of uploads)await runtime.ORDER_FILES.put(upload.key,await upload.file.arrayBuffer(),{httpMetadata:{contentType:upload.type}});
 const c=quote.customer,p=quote.items[0],first=uploads[0];
 // D1 batch commits order, all lines, ownership and email job together. A quote's
 // stable public token and unique link make retries/concurrent submissions idempotent.
 const commands=[runtime.DB.prepare(`INSERT OR IGNORE INTO orders (order_number,public_token,contact_name,phone,email,contact_channel,address,province,requested_date,thickness_mm,width_cm,height_cm,pricing_size_cm,quantity,print_sides,hardware_code,hardware_name,hardware_color,packaging_type,estimated_unit_price,estimated_subtotal,estimated_total,shipping_fee,vat_applied,vat_amount,tax_invoice_requested,vat_policy_mode,vat_policy_revision,artwork_name,artwork_key,artwork_type)
 SELECT 'WEB-' || printf('%04d',MAX(1232,COALESCE(MAX(CASE WHEN instr(order_number,'-') BETWEEN 3 AND 7 AND substr(order_number,instr(order_number,'-')+1) GLOB '[0-9]*' THEN CAST(substr(order_number,instr(order_number,'-')+1) AS INTEGER) END),0))+1),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? FROM orders
 HAVING NOT EXISTS (SELECT 1 FROM orders WHERE public_token=?) AND (SELECT revision FROM vat_collection_settings WHERE id=1)=? AND (SELECT expires_at FROM customer_quotes WHERE id=?)>?`)
 .bind(token,c.name,c.phone,member.email,"customer_web",c.address,c.province,c.requestedDate,p.thickness,String(p.width),String(p.height),p.pricingSize,quote.items.reduce((n,x)=>n+x.quantity,0),p.sides,p.hardwareCode,p.hardwareName,p.hardwareColor,p.packaging,String(p.unitPrice),String(quote.subtotal),String(quote.subtotal+quote.vat),String(quote.shipping),quote.vatApplied?1:0,String(quote.vat),c.invoiceRequested?1:0,quote.vatMode,quote.vatRevision,first?.name||"",first?.key||"",first?.type||"",token,quote.vatRevision,quoteId,Date.now())];
 const orderId="(SELECT id FROM orders WHERE public_token=?)";
 for(const [index,item] of quote.items.entries())commands.push(runtime.DB.prepare(`INSERT OR IGNORE INTO order_items(order_id,line_no,product_type,item_name,item_description,thickness_mm,width_cm,height_cm,pricing_size_cm,quantity,print_sides,hardware_code,hardware_name,hardware_color,packaging_type,unit_price,line_total) VALUES (${orderId},?,'acrylic_keychain',?,'',?,?,?,?,?,?,?,?,?,?,?,?)`).bind(token,index+1,`พวงกุญแจอะคริลิก ${item.width} × ${item.height} ซม.`,item.thickness,String(item.width),String(item.height),item.pricingSize,item.quantity,item.sides,item.hardwareCode,item.hardwareName,item.hardwareColor,item.packaging,String(item.unitPrice),String(item.lineTotal)));
 for(const file of uploads)commands.push(runtime.DB.prepare(`INSERT OR IGNORE INTO customer_order_uploads(id,order_id,line_no,kind,file_name,file_key,file_type) VALUES (?,${orderId},?,'artwork',?,?,?)`).bind(file.id,token,file.line,file.name,file.key,file.type));
 commands.push(runtime.DB.prepare(`INSERT OR IGNORE INTO order_status_history(order_id,status,note) SELECT id,'waiting_for_artwork_review','ลูกค้ายืนยันรายการผ่านสมาชิก • รอชำระเงิน' FROM orders WHERE public_token=? AND NOT EXISTS (SELECT 1 FROM customer_order_links WHERE quote_id=?)`).bind(token,quoteId));
 commands.push(runtime.DB.prepare(`INSERT OR IGNORE INTO customer_order_links(order_id,member_id,quote_id) VALUES (${orderId},?,?)`).bind(token,member.id,quoteId));
 commands.push(runtime.DB.prepare("UPDATE customer_members SET display_name=? WHERE id=?").bind(c.name,member.id));
 const origin=runtime.PUBLIC_SITE_URL||new URL(request.url).origin;
 const itemSummary=quote.items.map((item,index)=>`${index+1}. พวงกุญแจ ${item.width} × ${item.height} ซม. หนา ${item.thickness} มม. พิมพ์ ${item.sides} ด้าน\n${item.quantity} ชิ้น × ${item.unitPrice} บาท · อะไหล่ ${item.hardwareCode} ${item.hardwareColor}\nรวมรายการ ${item.lineTotal.toLocaleString("th-TH")} บาท`).join("\n\n");
 commands.push(runtime.DB.prepare(`INSERT OR IGNORE INTO customer_email_jobs(id,recipient,subject,body) SELECT ?,?,'ยืนยันใบสั่งซื้อ K2STUDIO ' || order_number,? || order_number || ? FROM orders WHERE public_token=?`).bind(`order:${quoteId}`,member.email,`สวัสดีคุณ ${c.name}\nได้รับใบสั่งซื้อ `,` แล้ว\n\n${itemSummary}\n\nค่าสินค้า ${quote.subtotal.toLocaleString("th-TH")} บาท\nค่าจัดส่ง ${quote.shipping} บาท\nVAT ที่บวกเพิ่ม ${quote.vat.toLocaleString("th-TH")} บาท\nยอดรวม ${quote.total.toLocaleString("th-TH")} บาท\nสถานะ: รอชำระเงิน\nดูรายการและติดตามได้ที่ ${origin}/account\nวันที่รับงานที่ระบุจะได้รับการยืนยันจากทีมงานอีกครั้ง\nLINE @k2studio`,token));
 try{await runtime.DB.batch(commands);}catch(error){
   const changed=await runtime.DB.prepare("SELECT revision FROM vat_collection_settings WHERE id=1").first<{revision:number}>();
   if(changed?.revision!==quote.vatRevision||row.expires_at<=Date.now())throw new CheckoutError("ราคา/นโยบายเปลี่ยน กรุณาตรวจยอดใหม่ก่อนยืนยัน",409);throw error;
 }
 const saved=await runtime.DB.prepare("SELECT id,order_number FROM orders WHERE public_token=?").bind(token).first<{id:number;order_number:string}>();
 if(!saved)throw new CheckoutError("กรุณาตรวจยอดใหม่ก่อนยืนยัน",409);
 waitUntil(flushMemberEmails(runtime));
 return memberResponse({orderId:saved.id,orderNumber:saved.order_number},201);
}catch(error){return memberError(error);}}
