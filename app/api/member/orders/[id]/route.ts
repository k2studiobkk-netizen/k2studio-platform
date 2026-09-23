import { CheckoutError, memberEnv, memberError, memberResponse, requireMember } from "../../../../member-auth";
import { publicOrderStatus, statusLabels } from "../../../../order-status";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {id}=await params;const runtime=memberEnv(),member=await requireMember(request,runtime);
 const order=await runtime.DB.prepare(`SELECT o.id,o.order_number,o.public_token,o.order_status,o.contact_name,o.phone,o.address,o.province,o.requested_date,o.estimated_total,o.shipping_fee,o.deposit_amount,o.created_at,q.snapshot FROM customer_order_links l JOIN orders o ON o.id=l.order_id JOIN customer_quotes q ON q.id=l.quote_id WHERE l.order_id=? AND l.member_id=?`).bind(Number(id),member.id).first<Record<string,string|number>>();
 if(!order)throw new CheckoutError("ไม่พบใบสั่งซื้อในบัญชีนี้",404);
 const items=await runtime.DB.prepare("SELECT line_no,item_name,quantity,hardware_code,hardware_color,unit_price,line_total FROM order_items WHERE order_id=? ORDER BY line_no").bind(Number(id)).all();
 const files=await runtime.DB.prepare("SELECT id,line_no,file_name FROM customer_order_uploads WHERE order_id=? AND kind='artwork' ORDER BY line_no,id").bind(Number(id)).all();
 const originalQuote=JSON.parse(String(order.snapshot));delete order.snapshot;
 const status=publicOrderStatus(String(order.order_status));
 return memberResponse({order:{...order,statusLabel:statusLabels[status]||status},items:items.results,files:files.results,invoice:originalQuote.customer.invoiceRequested?{companyName:originalQuote.customer.companyName,taxId:originalQuote.customer.taxId,taxAddress:originalQuote.customer.taxAddress,branch:originalQuote.customer.branch}:null});
}catch(error){return memberError(error);}}
