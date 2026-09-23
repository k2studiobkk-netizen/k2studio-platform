import {env} from "cloudflare:workers";
import {getStaffUser} from "../../../../../staff-auth";
import {parseReceipt,RECEIPT_PREFIX} from "../../../../../customer-design.mjs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 const user=await getStaffUser();if(!user)return Response.json({error:"Unauthorized"},{status:401});
 const {id}=await params;const orderId=Number(id),url=new URL(request.url),receiptId=Number(url.searchParams.get("receipt"));
 if(!Number.isInteger(orderId)||orderId<1||!Number.isInteger(receiptId)||receiptId<1)return new Response("Not found",{status:404});
 const {DB,ORDER_FILES}=env as unknown as {DB:D1Database;ORDER_FILES:R2Bucket};
 const row=await DB.prepare("SELECT note FROM order_status_history WHERE id=? AND order_id=? AND note LIKE ?").bind(receiptId,orderId,RECEIPT_PREFIX+"%").first<{note:string}>();
 const receipt=row&&parseReceipt(row.note);if(!receipt)return new Response("Not found",{status:404});
 const base=`customer-designs/${orderId}/${receipt.storageId}`;
 const manifestObject=await ORDER_FILES.get(`${base}/manifest.json`);if(!manifestObject)return new Response("Not found",{status:404});
 const manifest=await manifestObject.json<{assets:Array<{role:string;key:string;type:string}>}>();
 const role=url.searchParams.get("role")||"manifest";
 const headers={"cache-control":"private, no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; sandbox"};
 if(role==="manifest")return Response.json(manifest,{headers:{...headers,"content-disposition":`attachment; filename="keychain-design-${receiptId}.json"`}});
 const asset=manifest.assets.find(a=>a.role===role);if(!asset||!asset.key.startsWith(base+"/"))return new Response("Not found",{status:404});
 const file=await ORDER_FILES.get(asset.key);if(!file)return new Response("Not found",{status:404});
 return new Response(file.body,{headers:{...headers,"content-type":asset.type,...(role!=="preview"?{"content-disposition":`attachment; filename="${role}.${asset.type==="image/png"?"png":"jpg"}"`}:{})}});
}
