export class MemberRequestError extends Error {constructor(message:string,public status:number){super(message);}}
export async function memberFetch<T>(url:string,body?:unknown):Promise<T>{
 const response=await fetch(url,body?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}:undefined);
 const data=await response.json() as T&{error?:string};
 if(!response.ok)throw new MemberRequestError(data.error||"ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง",response.status);
 return data;
}
