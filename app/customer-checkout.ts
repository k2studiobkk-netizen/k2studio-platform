import { calculatePrice, HARDWARE, HARDWARE_VARIANTS, type Thickness } from "./pricing-config";
import { CheckoutError } from "./member-auth";
import { vatCollectionDecision } from "./vat-collection-policy.mjs";

export type ArtworkDescriptor={name:string;size:number;type:string;hash:string};
export type CustomerLine={id:string;thickness:Thickness;width:number;height:number;quantity:number;sides:1|2;hardwareCode:string;hardwareColor:string;packaging:string;files:ArtworkDescriptor[]};
export type PricedCustomerLine=CustomerLine&{hardwareName:string;unitPrice:number;lineTotal:number;pricingSize:number};
export type CustomerDetails={name:string;phone:string;address:string;province:string;requestedDate:string;invoiceRequested:boolean;companyName:string;taxId:string;taxAddress:string;branch:string};
export type CustomerQuote={items:PricedCustomerLine[];customer:CustomerDetails;subtotal:number;shipping:number;vat:number;total:number;vatApplied:boolean;vatMode:string;vatRevision:number};
export const ALLOWED_ARTWORK=/\.(png|jpe?g|webp|pdf|ai|psd|zip)$/i;
export function quoteCustomerOrder(input:{items:CustomerLine[];customer:CustomerDetails},prices:Record<string,number>,policy:{mode:string;revision:number}):CustomerQuote{
  if(!input||!Array.isArray(input.items)||!input.items.length||input.items.length>20)throw new CheckoutError("เพิ่มสินค้า 1–20 รายการก่อนดำเนินการต่อ");
  let totalFiles=0,totalBytes=0;const ids=new Set<string>();
  const items=input.items.map(item=>{
    if(!item||typeof item.id!=="string"||!/^[a-zA-Z0-9-]{8,64}$/.test(item.id)||ids.has(item.id))throw new CheckoutError("รายการสินค้าไม่ถูกต้อง");ids.add(item.id);
    const part=HARDWARE.find(x=>x.code===item.hardwareCode);
    if(!part||!HARDWARE_VARIANTS[part.code].includes(item.hardwareColor))throw new CheckoutError("กรุณาตรวจชนิดและสีอะไหล่");
    if(!["2.5","3"].includes(item.thickness)||![1,2].includes(item.sides)||![item.width,item.height].every(x=>Number.isFinite(x)&&x>0&&x<=10)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>1000||!["standard","none"].includes(item.packaging))throw new CheckoutError("สเปกนี้ต้องให้ทีมงานประเมินราคา กรุณาติดต่อ LINE @k2studio");
    if(!Array.isArray(item.files)||item.files.length>3)throw new CheckoutError("แนบไฟล์ได้ไม่เกิน 3 ไฟล์ต่อรายการ");
    const files=item.files.map(file=>{
      if(!file||typeof file.name!=="string"||file.name.length>200||!ALLOWED_ARTWORK.test(file.name)||!Number.isInteger(file.size)||file.size<=0||file.size>15*1024*1024||typeof file.type!=="string"||file.type.length>100||!/^[a-f0-9]{64}$/.test(file.hash))throw new CheckoutError("ไฟล์งานไม่ถูกต้อง หรือมีขนาดเกิน 15 MB");
      totalFiles++;totalBytes+=file.size;return{name:file.name,size:file.size,type:file.type,hash:file.hash};
    });
    const quote=calculatePrice({...item,hardwarePrice:prices[part.code]});
    if(quote.manual||!Number.isFinite(quote.total)||quote.total<=0)throw new CheckoutError("สเปกนี้ต้องให้ทีมงานยืนยันราคาก่อนสั่งซื้อ");
    return {id:item.id,thickness:item.thickness,width:item.width,height:item.height,quantity:item.quantity,sides:item.sides,hardwareCode:part.code,hardwareColor:item.hardwareColor,packaging:item.packaging,files,hardwareName:part.name,unitPrice:quote.unit,lineTotal:quote.total,pricingSize:quote.size};
  });
  if(totalFiles>30||totalBytes>60*1024*1024)throw new CheckoutError("แนบได้รวมไม่เกิน 30 ไฟล์ และ 60 MB ต่อใบงาน");
  const quantity=items.reduce((n,x)=>n+x.quantity,0);
  if(quantity>1000)throw new CheckoutError("มากกว่า 1,000 ชิ้น กรุณาติดต่อทีมงานเพื่อยืนยันค่าจัดส่ง");
  const source=input.customer;if(!source||typeof source.invoiceRequested!=="boolean")throw new CheckoutError("กรุณาเลือกการขอใบกำกับภาษี");
  const text=(key:keyof CustomerDetails,max:number)=>String(source[key]??"").trim().slice(0,max);
  const customer:CustomerDetails={name:text("name",120),phone:text("phone",30),address:text("address",1000),province:text("province",100),requestedDate:text("requestedDate",10),invoiceRequested:source.invoiceRequested,companyName:text("companyName",200),taxId:text("taxId",13),taxAddress:text("taxAddress",1000),branch:text("branch",100)};
  if(!customer.name||!/^[0-9+() -]{8,30}$/.test(customer.phone)||customer.phone.replace(/\D/g,"").length<8||customer.address.length<10||!customer.province)throw new CheckoutError("กรุณากรอกชื่อ เบอร์โทร และที่อยู่จัดส่งให้ครบ");
  const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(customer.requestedDate)||!Number.isFinite(Date.parse(customer.requestedDate))||new Date(customer.requestedDate).toISOString().slice(0,10)!==customer.requestedDate||customer.requestedDate<today)throw new CheckoutError("กรุณาเลือกวันที่ต้องการรับงานตั้งแต่วันนี้เป็นต้นไป");
  if(customer.invoiceRequested&&(!customer.companyName||!/^\d{13}$/.test(customer.taxId)||customer.taxAddress.length<10||!customer.branch))throw new CheckoutError("กรุณากรอกชื่อบริษัท เลขภาษี 13 หลัก สาขา และที่อยู่ใบกำกับภาษี");
  const subtotal=Math.round(items.reduce((n,x)=>n+x.lineTotal,0)*100)/100;
  const shipping=quantity<=100?50:quantity<=300?70:quantity<=500?100:150;
  const vatApplied=vatCollectionDecision(policy.mode,customer.invoiceRequested).addVat;
  const vat=vatApplied?Math.round((subtotal+shipping)*7)/100:0;
  return {items,customer,subtotal,shipping,vat,total:Math.round((subtotal+shipping+vat)*100)/100,vatApplied,vatMode:policy.mode,vatRevision:policy.revision};
}
