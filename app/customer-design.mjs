export const RECEIPT_PREFIX = "KEYCHAIN_DESIGN:";
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function canSubmitCustomerDesign(order, work) {
 return ["waiting_for_artwork_review", "artwork_changes_requested"].includes(order.order_status)
  && !order.production_released_at && (!work || work.status === "draft");
}
export function parseReceipt(note) {
 const m=String(note).match(/^KEYCHAIN_DESIGN:([a-f0-9-]{36}):([a-f0-9-]{36}) /i);
 return m && UUID.test(m[1]) && UUID.test(m[2]) ? {submissionId:m[1],storageId:m[2]} : null;
}
export function designDimensions(size, aspect, hole) {
 const width=aspect>=1?size:size*aspect, height=aspect>=1?size/aspect:size;
 return {width,height,totalWidth:Math.max(width+1,hole.x+3)-Math.min(-1,hole.x-3),totalHeight:Math.max(height+1,hole.y+3)-Math.min(-1,hole.y-3)};
}
export function validateDesignSpec(raw, hardware, variants) {
 if(!raw || raw.schemaVersion!==1 || raw.material!=="clear_acrylic" || raw.thicknessMm!==2.5)throw Error("สเปกวัสดุไม่ถูกต้อง");
 if(!Number.isInteger(raw.itemId)||raw.itemId<1||!Number.isInteger(raw.quantity)||raw.quantity<1||raw.quantity>1000000)throw Error("รายการหรือจำนวนไม่ถูกต้อง");
 if(![1,2].includes(raw.sides)||!Number.isFinite(raw.sizeMm)||raw.sizeMm<10||raw.sizeMm>80||!Number.isFinite(raw.aspect)||raw.aspect<0.1||raw.aspect>10)throw Error("ขนาดหรือด้านพิมพ์ไม่ถูกต้อง");
 if(!hardware.some(h=>h.code===raw.hardwareCode)||!variants[raw.hardwareCode]?.includes(raw.hardwareColor))throw Error("กรุณาเลือกอะไหล่และสีที่มีในระบบ");
 const hole={x:Number(raw.hole?.x),y:Number(raw.hole?.y)};
 const dims=designDimensions(raw.sizeMm,raw.aspect,hole);
 if(!Number.isFinite(hole.x)||!Number.isFinite(hole.y)||hole.x < -3.2||hole.y < -3.2||hole.x>dims.width+3.2||hole.y>dims.height+3.2)throw Error("ตำแหน่งรูห่วงไม่ถูกต้อง");
 return {schemaVersion:1,itemId:raw.itemId,material:"clear_acrylic",thicknessMm:2.5,sizeMm:raw.sizeMm,aspect:raw.aspect,quantity:raw.quantity,sides:raw.sides,hardwareCode:raw.hardwareCode,hardwareColor:raw.hardwareColor,packaging:"standard",hole:{...hole,diameterMm:3,tabRadiusMm:3,requiresGraphicReview:true},outlineOffsetMm:1,whiteChokeMm:0.3,dimensions:dims,artworkOrientation:"customer_view_unmirrored",printRecipe:raw.sides===2?"C1_WHITE_C2_SINGLE_SURFACE":"REVERSE_SINGLE_SIDE",productionReady:false};
}
export function imageType(bytes) {
 if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return "image/png";
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";
 return null;
}
