import { env } from "cloudflare:workers";

export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(!/^[a-f0-9]{32}$/i.test(token))return new Response("Not found",{status:404});
 const runtime=env as unknown as {DB:D1Database;ORDER_FILES:R2Bucket};
 const order=await runtime.DB.prepare("SELECT artwork_key, artwork_type FROM orders WHERE public_token = ? LIMIT 1").bind(token).first<{artwork_key:string;artwork_type:string}>();
 if(!order?.artwork_key||!order.artwork_type.startsWith("image/"))return new Response("Not found",{status:404});
 const object=await runtime.ORDER_FILES.get(order.artwork_key);
 if(!object)return new Response("Not found",{status:404});
 return new Response(object.body,{headers:{"content-type":order.artwork_type,"content-disposition":"inline","cache-control":"private, max-age=3600","x-content-type-options":"nosniff"}});
}
