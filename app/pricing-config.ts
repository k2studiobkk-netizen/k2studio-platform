export type Thickness = "2.5" | "3";

export const SIZES = [2,3,4,5,6,7,8,9,10] as const;

const retail25 = [
  [79,84,89,94,99,104,109,114,119],
  [29,34,39,44,49,54,59,64,69],
  [25,29,33,37,41,45,49,53,57],
  [20,24,28,32,36,40,44,48,52],
  [17,19,22,25,28,31,34,37,40],
  [14,16,19,22,25,28,31,34,37],
] as const;
const retail3 = [
  [84,89,94,99,104,109,114,119,124],
  [34,39,44,49,54,59,64,69,74],
  [29,33,37,41,45,49,53,57,61],
  [24,28,32,36,40,44,48,52,56],
  [20,22,25,28,31,34,37,40,43],
  [17,19,22,25,28,31,34,37,40],
] as const;
const factory25 = [
  [12,14,17,20,23,26,29,32,35],
  [11,12,15,18,21,24,27,30,33],
  [10,11,14,17,20,23,26,29,32],
  [8,9,12,15,18,21,24,27,30],
  [7,8,11,14,17,20,23,26,29],
  [6.5,7.5,10.5,13.5,16.5,19.5,22.5,25.5,28.5],
] as const;
const factory3 = [
  [null,null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null,null],
] as const;

export const PRICE_TABLES = {
  retail: {"2.5": retail25, "3": retail3, tiers:["1–10","11–29","30–49","50–199","200–499","500–999"]},
  factory: {"2.5": factory25, "3": factory3, tiers:["1,000","3,000","5,000","10,000","20,000","30,000+"]},
  doublePrint: {retail:[3,3,5,5,5,10,10,20,20],factory:[2,2,3,3,3,5,5,15,15]}
} as const;

export const HARDWARE = [
  {code:"A", name:"โซ่ไข่ปลาสีเงิน 10 ซม.", price:0, group:"rings"},
  {code:"B", name:"ห่วงแบน 25 มม. พร้อมโซ่", price:3, group:"rings"},
  {code:"C", name:"ตะขอก้ามปูเล็ก 18 มม.", price:8, group:"clasps"},
  {code:"D", name:"ตะขอตัว U โลหะ 12 × 33 มม.", price:8, group:"u"},
  {code:"E", name:"ตะขอตัว U สี 13 × 33 มม.", price:10, group:"u"},
  {code:"F", name:"ตะขอก้ามปูใหญ่ 30 มม. แบบ 1", price:8, group:"clasps"},
  {code:"G", name:"ตะขอก้ามปูใหญ่ 30 มม. แบบ 2", price:8, group:"clasps"},
  {code:"H", name:"ตะขอหมุน 32 มม. พร้อมห่วง", price:10, group:"clasps"},
  {code:"I", name:"ห่วงกลมสีหรือห่วงลาย", price:5, group:"rings"},
  {code:"J", name:"ตะขอแฟนซี หัวใจ ดาว หรือแมว", price:8, group:"fancy"},
  {code:"K", name:"ตะขอหมุนโลหะสีพิเศษ", price:8, group:"clasps"},
  {code:"L", name:"ตะขอสีแบบเคลือบ", price:10, group:"u"},
  {code:"M", name:"โซ่ไข่ปลาสีเงิน 12 ซม.", price:2, group:"rings"},
  {code:"N", name:"ตะขอขนาด 301–305", price:2, group:"clasps"},
  {code:"O", name:"ห่วงแบน 25 มม. พร้อมโซ่สี", price:5, group:"rings"},
  {code:"P", name:"ตะขอก้ามปูสีคละ", price:10, group:"clasps"},
  {code:"Q", name:"ตะขอตัว D", price:8, group:"u"},
] as const;

export const HARDWARE_GROUPS = [
  {id:"all", name:"ทั้งหมด"},
  {id:"rings", name:"ห่วงและโซ่"},
  {id:"clasps", name:"ตะขอก้ามปู / หมุน"},
  {id:"u", name:"ตะขอ U / D"},
  {id:"fancy", name:"แฟนซี"},
] as const;

// แยกรหัสและตัวเลือกตามแคตตาล็อกอะไหล่ที่ผู้ใช้ส่งมา (A–Q)
export const HARDWARE_VARIANTS: Record<string, string[]> = {
  A: ["เงิน"],
  B: ["เงิน", "ทอง", "ทองเหลือง", "รมดำ"],
  C: ["เงิน", "ทอง", "โรสโกลด์", "รมดำ"],
  D: ["ทอง", "เงิน", "โรสโกลด์", "KC Gold", "ดำ", "ดำด้าน", "บรอนซ์"],
  E: ["เขียวมะนาว", "ม่วง", "ชมพู", "ชมพูเข้ม", "เขียวใบไม้", "ฟ้า", "น้ำเงิน", "เทา", "น้ำตาล", "ส้ม", "เขียวมิ้นท์", "แดง", "เหลืองอ่อน", "ขาว"],
  F: ["เงิน", "ทอง", "โรสโกลด์", "รมดำ", "ดำ"],
  G: ["เงิน", "ทอง", "โรสโกลด์", "รมดำ", "ดำ"],
  H: ["เงิน", "ทอง", "โรสโกลด์", "รมดำ"],
  I: ["เงิน", "ทอง", "โรสโกลด์", "ดำ"],
  J: ["หัวใจ · เงิน", "หัวใจ · ทอง", "หัวใจ · โรสโกลด์", "ดาว · เงิน", "ดาว · ทอง", "แมว · เงิน", "แมว · ทอง"],
  K: ["เงิน", "ทอง", "โรสโกลด์", "ดำ"],
  L: ["เขียว", "ม่วง", "ชมพู", "ส้ม", "มิ้นท์", "แดง", "เหลืองอ่อน"],
  M: ["เงิน"],
  N: ["301 · ทอง", "302 · เงิน", "303 · รมดำ", "304 · เงิน", "305 · ทอง"],
  O: ["เงิน", "ทอง", "โรสโกลด์", "ดำ"],
  P: ["เงิน", "ทอง", "โรสโกลด์", "ดำ", "รมดำ"],
  Q: ["ทอง", "เงิน", "โรสโกลด์", "ดำ"],
};

export function hardwareImagePath(code:string, storedName?:string) {
  // ใบงานเก่า 1 รายการใช้ P ในความหมายเดิม (ห่วงกลม) จึงคงภาพเดิมของใบงานนั้นไว้
  if (code === "P" && storedName?.includes("ห่วงกลม")) return "/assets/hardware-generated-v2/P.png";
  return ["I", "O", "P", "Q"].includes(code)
    ? `/assets/hardware-generated-v3/${code}.png`
    : `/assets/hardware-generated-v2/${code}.png`;
}

export function hardwareColorSwatch(variant:string) {
  const color = variant.split("·").at(-1)?.trim() || variant;
  const swatches:Record<string,string> = {
    เงิน:"#c2cbd0", ทอง:"#d9ad45", ทองเหลือง:"#e6c856", "KC Gold":"#b68b35", บรอนซ์:"#a87749",
    โรสโกลด์:"#d89082", รมดำ:"#57565b", ดำ:"#25262a", ดำด้าน:"#202124", ขาว:"#f5f5f1",
    เขียว:"#6ebc51", เขียวมะนาว:"#99de36", เขียวใบไม้:"#3c994c", เขียวมิ้นท์:"#64c8aa", มิ้นท์:"#69c8b4",
    ม่วง:"#a178c3", ชมพู:"#f2a0bc", ชมพูเข้ม:"#dc5d91", ฟ้า:"#69b7df", น้ำเงิน:"#3d7fca",
    เทา:"#8c9299", น้ำตาล:"#9c694f", ส้ม:"#e9803d", แดง:"#d9575c", เหลืองอ่อน:"#e9d57a",
  };
  return swatches[color] || "#e2e5e7";
}

export function pricingSize(width:number, height:number) {
  return Math.max(2, Math.ceil(Math.max(width || 0, height || 0)));
}

export function calculatePrice(input:{thickness:Thickness;width:number;height:number;quantity:number;sides:1|2;hardwareCode:string;packaging:string;hardwarePrice?:number}) {
  const size = pricingSize(input.width,input.height);
  const hardware = HARDWARE.find(h=>h.code===input.hardwareCode) ?? HARDWARE[0];
  const resolvedHardwarePrice=input.hardwarePrice??hardware.price;
  // The supplied official sheets do not include a verified 3 mm factory table.
  // Never manufacture a quote for this combination; staff must confirm it.
  const manual = size > 10 || resolvedHardwarePrice === null || ["backing","custom"].includes(input.packaging) || (input.thickness === "3" && input.quantity >= 1000);
  if (manual) return {manual:true,size,base:0,print:0,hardware:resolvedHardwarePrice ?? 0,package:0,unit:0,total:0};
  const si = size - 2;
  let row = 0;
  let table: readonly (readonly number[])[];
  if(input.quantity < 1000){
    row = input.quantity<=10?0:input.quantity<=29?1:input.quantity<=49?2:input.quantity<=199?3:input.quantity<=499?4:5;
    table = input.thickness==="2.5"?retail25:retail3;
  } else {
    row = input.quantity>=30000?5:input.quantity>=20000?4:input.quantity>=10000?3:input.quantity>=5000?2:input.quantity>=3000?1:0;
    table = factory25;
  }
  const base=table[row][si];
  const print=input.sides===2?(input.quantity<1000?PRICE_TABLES.doublePrint.retail[si]:PRICE_TABLES.doublePrint.factory[si]):0;
  const unit=base+print+(resolvedHardwarePrice ?? 0);
  return {manual:false,size,base,print,hardware:resolvedHardwarePrice ?? 0,package:0,unit,total:unit*input.quantity};
}
