import{env}from"cloudflare:workers";import{createStaffSession,passwordProof,safeReturnTo,timingSafeBase64Equal}from"../../../staff-auth";
type LoginBody={username?:FormDataEntryValue|string;proof?:FormDataEntryValue|string;challenge?:FormDataEntryValue|string;expires?:FormDataEntryValue|string|number;returnTo?:FormDataEntryValue|string};

function loginRedirect(request:Request,target:string,error?:"credentials"|"system"){
 const url=new URL("/admin/login",request.url);
 url.searchParams.set("returnTo",target);
 if(error)url.searchParams.set("error",error);
 return url.toString();
}

export async function POST(request:Request){
 const isJson=request.headers.get("content-type")?.includes("application/json")===true;
 const contentLength=Number(request.headers.get("content-length")||0);
 if(contentLength>4096)return Response.json({error:"ข้อมูลเข้าสู่ระบบมีขนาดใหญ่เกินไป"},{status:413,headers:{"cache-control":"no-store"}});
 let body:LoginBody;
 try{
  body=isJson?await request.json()as LoginBody:Object.fromEntries(await request.formData());
 }catch{
  if(isJson)return Response.json({error:"ข้อมูลเข้าสู่ระบบไม่ถูกต้อง"},{status:400,headers:{"cache-control":"no-store"}});
  return Response.redirect(loginRedirect(request,"/admin","system"),303);
 }
 const username=String(body.username||"").trim().toLowerCase(),target=safeReturnTo(String(body.returnTo||""));
 if(!isJson)return Response.redirect(loginRedirect(request,target,"system"),303);
 const proof=String(body.proof||""),challenge=String(body.challenge||""),expires=Number(body.expires||0),now=Date.now();
 const db=(env as unknown as{DB:D1Database}).DB;
 const validUsername=/^[a-z0-9._-]{1,64}$/.test(username);
 const validEnvelope=/^[A-Za-z0-9+/]{32}$/.test(challenge)&&/^[A-Za-z0-9+/]{43}=$/.test(proof)&&Number.isSafeInteger(expires)&&expires>=now-10_000&&expires<=now+90_000;
 const user=validUsername&&validEnvelope?await db.prepare("SELECT id,password_hash,password_salt FROM staff_users WHERE username=? AND active=1 LIMIT 1").bind(username).first<Record<string,string|number>>():null;
 const message=`k2-login\n${username}\n${challenge}\n${expires}`;
 const expected=user&&validEnvelope?await passwordProof(String(user.password_hash),message):"";
 if(!user||!validEnvelope||!timingSafeBase64Equal(proof,expected)){
  if(isJson)return Response.json({error:"ไอดีหรือรหัสผ่านไม่ถูกต้อง"},{status:401,headers:{"cache-control":"no-store"}});
  return Response.redirect(loginRedirect(request,target,"credentials"),303);
 }
 await db.prepare("UPDATE staff_users SET last_login_at=CURRENT_TIMESTAMP,must_change_password=0 WHERE id=?").bind(Number(user.id)).run();
 const cookie=await createStaffSession(Number(user.id));
 if(isJson)return Response.json({ok:true,redirectTo:target},{headers:{"cache-control":"no-store","set-cookie":cookie}});
 return new Response(null,{status:303,headers:{location:target,"cache-control":"no-store","set-cookie":cookie}});
}
