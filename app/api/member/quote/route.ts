import { memberEnv, memberError, memberResponse, randomToken, rateLimit, readJson, requireMember, sameOrigin } from "../../../member-auth";
import { quoteCustomerOrder } from "../../../customer-checkout";
import { getVatCollectionPolicy } from "../../../vat-collection-policy.mjs";
export async function GET(){try{const runtime=memberEnv();const rows=await runtime.DB.prepare("SELECT hardware_code,price FROM hardware_prices").all<{hardware_code:string;price:string}>();return memberResponse({prices:Object.fromEntries(rows.results.map(x=>[x.hardware_code,Number(x.price)])),policy:await getVatCollectionPolicy(runtime.DB)});}catch(error){return memberError(error);}}
export async function POST(request:Request){try{
  sameOrigin(request);const runtime=memberEnv();const member=await requireMember(request,runtime);await rateLimit(runtime.DB,`quotes:${member.id}`,30,3600000);
  const rows=await runtime.DB.prepare("SELECT hardware_code,price FROM hardware_prices").all<{hardware_code:string;price:string}>();
  const quote=quoteCustomerOrder(await readJson(request),Object.fromEntries(rows.results.map(x=>[x.hardware_code,Number(x.price)])),await getVatCollectionPolicy(runtime.DB));
  const id=randomToken();const expiresAt=Date.now()+15*60000;
  await runtime.DB.prepare("INSERT INTO customer_quotes(id,member_id,snapshot,order_token,expires_at) VALUES (?,?,?,?,?)").bind(id,member.id,JSON.stringify(quote),crypto.randomUUID().replaceAll("-",""),expiresAt).run();
  return memberResponse({quoteId:id,expiresAt,quote});
}catch(error){return memberError(error);}}
