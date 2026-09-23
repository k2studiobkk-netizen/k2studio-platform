import { CheckoutError, getMember, memberEnv, memberError } from "../../../../member-auth";
import { getStaffUser, canViewOrderSlips } from "../../../../staff-auth";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {id}=await params;const runtime=memberEnv(),member=await getMember(request,runtime);
 const file=await runtime.DB.prepare("SELECT u.file_name,u.file_key,u.kind,o.sales_owner_id,l.member_id FROM customer_order_uploads u JOIN orders o ON o.id=u.order_id JOIN customer_order_links l ON l.order_id=u.order_id WHERE u.id=?").bind(id).first<{file_name:string;file_key:string;kind:string;sales_owner_id:number;member_id:number}>();
 if(!file)throw new CheckoutError("ไม่พบไฟล์",404);
 if(member?.id!==file.member_id){const staff=await getStaffUser();if(!staff||(file.kind==='payment_slip'&&!canViewOrderSlips(staff,Number(file.sales_owner_id))))throw new CheckoutError("ไม่พบไฟล์",404);}
 const object=await runtime.ORDER_FILES.get(file.file_key);if(!object)throw new CheckoutError("ไม่พบไฟล์",404);
 // Always download user uploads; never render uploaded HTML or scripts on our origin.
 return new Response(object.body,{headers:{"content-type":"application/octet-stream","content-disposition":`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
}catch(error){return memberError(error);}}
