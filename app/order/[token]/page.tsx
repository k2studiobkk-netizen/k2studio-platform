import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import { calculatePrice, hardwareImagePath, type Thickness } from "../../pricing-config";
import { money,publicOrderStatus,statusLabels,thaiDate,thaiPhotoTimestamp } from "../../order-status";
import PrintButton from "./PrintButton";
import ApprovalPanel from "./ApprovalPanel";
import { can, canViewOrderFinance, getStaffUser, requireStaff } from "../../staff-auth";
import { hasPermission } from "../../production-rbac";
import QrCodeImage from "../../QrCodeImage";
import LiveOrderStatus from "./LiveOrderStatus";

export const dynamic="force-dynamic";

export default async function CustomerOrderDocument({params,searchParams}:{params:Promise<{token:string}>,searchParams:Promise<{mode?:string;staff?:string}>}){
 const {token}=await params;
 const {mode,staff}=await searchParams;
 const requestedProductionMode=mode==="production";
 const requestedStaffView=staff==="1";
 const staffUser=requestedStaffView
  ?await requireStaff(`/order/${token}?${requestedProductionMode?"mode=production&":""}staff=1`)
  :await getStaffUser();
 // A signed-in graphic/production user may open the customer URL directly from
 // LINE or Drive. Treat that browser session as a staff document even when the
 // old `?staff=1` marker is missing.
 const staffView=Boolean(staffUser);
 // There is one master paper document for every department. Older production
 // links remain valid but now render this same document.
 const production=false;
 const autoRelease=Boolean(staffUser&&hasPermission(staffUser.role,"work_orders:create"));
 const db=(env as unknown as {DB:D1Database}).DB;
 const order=await db.prepare("SELECT * FROM orders WHERE public_token = ? LIMIT 1").bind(token).first<Record<string,string|number>>();
 if(!order)notFound();
 const canSeeFinance=!staffView||Boolean(staffUser&&canViewOrderFinance(staffUser,Number(order.sales_owner_id||0)));
 const canSeeSlips=!staffView||Boolean(staffUser&&can(staffUser,"finance:slips"));
 const savedChannel=await db.prepare("SELECT name,prefix FROM sales_channels WHERE code=? LIMIT 1").bind(String(order.contact_channel||"")).first<{name:string;prefix:string}>();
 const paymentVerified=Boolean(order.payment_confirmed_at);
 const design=await db.prepare("SELECT id,version_no,note,status,created_by,created_at,customer_note,responded_by,responded_at,scale_file_name,scale_file_key,mockup_file_name,mockup_file_key,file_name,file_key FROM design_versions WHERE order_id = ? AND status IN ('pending','approved','changes_requested') ORDER BY version_no DESC LIMIT 1").bind(Number(order.id)).first<Record<string,string|number>>();
 const storedDesignAssets=design?(await db.prepare("SELECT id,order_item_id,asset_type,file_name,caption,sort_order FROM design_assets WHERE design_version_id=? ORDER BY CASE asset_type WHEN 'scale' THEN 0 ELSE 1 END,sort_order,id").bind(Number(design.id)).all<Record<string,string|number>>()).results:[];
 const designAssets=storedDesignAssets.length?storedDesignAssets:design?[
  ...(design.scale_file_key?[{id:0,order_item_id:0,asset_type:"scale",file_name:String(design.scale_file_name),caption:"",sort_order:1}]:[]),
  ...(design.mockup_file_key?[{id:0,order_item_id:0,asset_type:"mockup",file_name:String(design.mockup_file_name||design.file_name),caption:"",sort_order:1}]:[]),
 ]:[];
 const items=(await db.prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY line_no").bind(Number(order.id)).all<Record<string,string|number>>()).results;
 const adjustments=(await db.prepare("SELECT label,amount FROM order_adjustments WHERE order_id = ? ORDER BY id").bind(Number(order.id)).all<Record<string,string|number>>()).results;
 const progressPhotos=staffView?(await db.prepare("SELECT id,status,file_name,caption,created_by_name,created_at FROM order_progress_photos WHERE order_id=? ORDER BY id ASC").bind(Number(order.id)).all<Record<string,string|number>>()).results:[];
 const paymentReceipts=staffView&&canSeeSlips?(await db.prepare("SELECT id,amount,file_name,file_key,created_by_name,created_at FROM order_payment_receipts WHERE order_id=? ORDER BY id ASC").bind(Number(order.id)).all<Record<string,string|number>>()).results:[];
 const customItems=items.filter(item=>String(item.product_type)==="custom");
 const acrylicItems=items.filter(item=>String(item.product_type||"acrylic_keychain")==="acrylic_keychain");
 const hasCustomItems=customItems.length>0,hasAcrylicItems=acrylicItems.length>0||items.length===0;
 const productLabel=hasCustomItems&&hasAcrylicItems?"สินค้าหลายประเภท":hasCustomItems?"งานสั่งทำอื่น ๆ":"พวงกุญแจอะคริลิก";

 const base=process.env.PUBLIC_SITE_URL||"https://order.k2group.site";
 const trackUrl=`${base}/track/${token}`;
 const hardwareSource=acrylicItems[0]||order;
 const hardwareCode=String(hardwareSource.hardware_code||"A").toUpperCase();
 const hardwareImageCode=/^[A-Q]$/.test(hardwareCode)?hardwareCode:"A";
 const hasArtwork=String(order.artwork_type||"").startsWith("image/")&&Boolean(order.artwork_key);
 const generatedMockup=token==="40d6179278d1f4b3889b3f61042ea90d"?"/assets/mockups/k2sign-b-silver-sample.png":"";
 const quantity=Number(order.quantity);
 const breakdown=calculatePrice({
  thickness:String(order.thickness_mm)==="3"?"3":"2.5" as Thickness,
  width:Number(order.width_cm),height:Number(order.height_cm),quantity,
  sides:Number(order.print_sides)===2?2:1,hardwareCode,packaging:String(order.packaging_type),
 });
 const subtotal=Number(order.estimated_subtotal)||0;
 const baseTotal=breakdown.base*quantity;
 const printTotal=breakdown.print*quantity;
 const hardwareTotal=breakdown.hardware*quantity;
 const serviceTotal=Math.max(0,subtotal-baseTotal-printTotal-hardwareTotal);
 const shippingFee=Number(order.shipping_fee||0);const depositAmount=Number(order.deposit_amount||0);const payableTotal=Number(order.estimated_total)+shippingFee;const outstanding=Math.max(0,payableTotal-depositAmount);const paymentStatusText=outstanding<=0.009?"ชำระเต็มจำนวน":depositAmount>0.009?`ชำระมัดจำแล้ว • ค้าง ฿${money(outstanding)}`:"ยังไม่ชำระ";
 const receiptTotal=paymentReceipts.reduce((sum,receipt)=>sum+Number(receipt.amount||0),0);
 const hasLegacyInstallment=staffView&&Boolean(order.payment_slip_key)&&!paymentReceipts.some(receipt=>String(receipt.file_key)===String(order.payment_slip_key));
 const legacyInstallmentAmount=hasLegacyInstallment?Math.max(0,depositAmount-receiptTotal):0;
 const paymentInstallments=[
  ...(hasLegacyInstallment?[{id:0,amount:legacyInstallmentAmount,fileName:String(order.payment_slip_name||"สลิปตอนสร้างใบงาน"),createdBy:String(order.payment_confirmed_by||"ทีมงานขาย"),createdAt:String(order.payment_confirmed_at||order.created_at||"")}]:[]),
  ...paymentReceipts.map(receipt=>({id:Number(receipt.id),amount:Number(receipt.amount),fileName:String(receipt.file_name),createdBy:String(receipt.created_by_name),createdAt:String(receipt.created_at)})),
 ];
 // Use the prices captured with the order whenever order-item records exist.
 // Recalculating a single-item order here can drift from the submitted price
 // after an administrator changes a hardware price.
 const productPriceRows:ReadonlyArray<readonly [string,string,number,number]>=items.length>0
  ?items.map(item=>[
    String(item.product_type)==="custom"
      ?String(item.item_name||`งานสั่งทำรายการ ${item.line_no}`)
      :`${item.item_name||`รายการ ${item.line_no}`} • ${item.width_cm} × ${item.height_cm} ซม.`,
    String(item.product_type)==="custom"
      ?`${Number(item.quantity).toLocaleString()} หน่วย • ${item.item_description||"ไม่ระบุรายละเอียด"}`
      :`${Number(item.quantity).toLocaleString()} ชิ้น • ${item.thickness_mm} มม. • ${item.print_sides} ด้าน • อะไหล่ ${item.hardware_code} ${item.hardware_color||""}`,
    Number(item.unit_price),
    Number(item.line_total),
   ] as const)
  :[
    ["ตัวพวงกุญแจอะคริลิก",`${order.thickness_mm} มม. / ${order.pricing_size_cm} ซม.`,breakdown.base,baseTotal],
    ["ค่าพิมพ์เพิ่มด้านที่ 2",Number(order.print_sides)===2?"พิมพ์ UV สองด้าน":"พิมพ์ด้านเดียว",breakdown.print,printTotal],
    [`อะไหล่รหัส ${hardwareCode}`,`${order.hardware_name} • ${order.hardware_color||"-"}`,breakdown.hardware,hardwareTotal],
    ["บรรจุภัณฑ์ / บริการอื่น",String(order.packaging_type),quantity?serviceTotal/quantity:0,serviceTotal],
   ];
 const priceRows:ReadonlyArray<readonly [string,string,number,number]>=[...productPriceRows,...adjustments.map(item=>[String(item.label),"รายการเสริม",Number(item.amount),Number(item.amount)] as const)];
 const discountAmount=Number(order.discount_amount||0);
 const channelLabels:Record<string,string>={line:"LINE @k2sign (ข้อมูลเดิม)",other:"อื่น ๆ (ข้อมูลเดิม)"};if(savedChannel)channelLabels[String(order.contact_channel)]=`${savedChannel.prefix} — ${savedChannel.name}`;
 const fileMethodLabels:Record<string,string>={upload:"อัปโหลดในเว็บไซต์",google_drive:"Google Drive",email:"ส่งทางอีเมล"};
 const customerRows=[["ลูกค้า",order.contact_name],["โทรศัพท์",order.phone],["LINE ID",order.line_id||"-"],["อีเมล",order.email||"-"],["เซลล์ผู้รับผิดชอบ",order.sales_owner_name||"ยังไม่ระบุเซลล์"],["ช่องทางติดต่อ",channelLabels[String(order.contact_channel)]||"-"],["ชื่อ Facebook / LINE",order.social_contact_name||"-"],["ช่องทางส่งไฟล์",fileMethodLabels[String(order.file_delivery_method)]||"-"],["ลิงก์/หมายเหตุไฟล์",order.external_file_url||order.file_delivery_note||"-"],["ที่อยู่จัดส่ง",`${order.address||"-"} ${order.province||""}`]];
 const specRows=hasCustomItems?[["ประเภทงาน",productLabel],["รายละเอียด","ดูรายละเอียดแยกตามรายการ"],["จำนวนรายการ",`${items.length} รายการ`],["ไฟล์ผลิต","ยึดตามไฟล์และแบบที่ลูกค้าอนุมัติ"]]:[["วัสดุ","อะคริลิกใส"],["ระบบพิมพ์",`UV • ${order.print_sides} ด้าน`],["รองพื้นขาว","ตามไฟล์งาน"],["วานิช","ไม่ระบุ"],["การตัด","ไดคัทตามแบบ"],["ตำแหน่งรูเจาะ","ตามไฟล์อนุมัติ"],["อะไหล่",`${hardwareCode} • ${order.hardware_name} • ${order.hardware_color||"-"}`],["บรรจุภัณฑ์",order.packaging_type]];
 const itemCount=items.length||1;
 const acrylicSpecs=acrylicItems.length?acrylicItems:[order];
 const thicknessValues=[...new Set(acrylicSpecs.map(item=>String(item.thickness_mm)).filter(Boolean))];
 const printSideValues=[...new Set(acrylicSpecs.map(item=>Number(item.print_sides)===2?"พิมพ์ 2 ด้าน":"พิมพ์ 1 ด้าน"))];
 const thicknessDisplay=thicknessValues.map(value=>`${value} มม.`).join(" / ")||"ไม่ระบุ";
 const printSidesDisplay=printSideValues.join(" / ")||"ไม่ระบุ";
 const visualQuantity=acrylicItems.length?acrylicItems.reduce((sum,item)=>sum+Number(item.quantity||0),0):quantity;
 const imageQuantityLabel=`จำนวนผลิต ${visualQuantity.toLocaleString("th-TH")} ${hasAcrylicItems?"ชิ้น":"หน่วย"}`;
 const summary:[[string,string],...[string,string][]]=[["สินค้า",productLabel],["จำนวนรวม",`${quantity.toLocaleString("th-TH")} หน่วย`],["จำนวนรายการ",`${itemCount} รายการ`]];
 if(!hasCustomItems)summary.push(["ขนาด",items.length>1?"หลายขนาด":`${order.width_cm} × ${order.height_cm} ซม.`],["ความหนา",items.length>1?"ตามรายการ":`${order.thickness_mm} มม.`],["การพิมพ์",items.length>1?"ตามรายการ":`${order.print_sides} ด้าน`]);
 if(items.length>1||hasCustomItems)for(const item of items)summary.push([
  `รายการ ${item.line_no} — ${item.item_name||"พวงกุญแจอะคริลิก"}`,
  String(item.product_type)==="custom"
   ?`${item.item_description||"ไม่ระบุรายละเอียด"}\nจำนวน ${Number(item.quantity).toLocaleString()} หน่วย • ฿${money(item.unit_price)}/หน่วย • รวม ฿${money(item.line_total)}`
   :`ขนาด ${item.width_cm} × ${item.height_cm} ซม. • หนา ${item.thickness_mm} มม. • พิมพ์ ${item.print_sides} ด้าน\nอะไหล่ ${item.hardware_code} — ${item.hardware_name} ${item.hardware_color||""} • แพ็ก ${item.packaging_type}\nจำนวน ${Number(item.quantity).toLocaleString()} ชิ้น • ฿${money(item.unit_price)}/ชิ้น • รวม ฿${money(item.line_total)}`,
 ]);

 const artwork=<>{hasArtwork?<img src={`/api/orders/${token}/artwork`} alt={`ภาพต้นฉบับ ${order.artwork_name}`}/>:<div className="balancedEmpty">ไม่ได้แนบภาพ</div>}<small>{String(order.artwork_name||"ไม่มีไฟล์แนบ")}</small><small className="balancedImageQuantity">{imageQuantityLabel}</small>
</>;
 const assetCounts={scale:designAssets.filter(asset=>asset.asset_type==="scale").length,mockup:designAssets.filter(asset=>asset.asset_type==="mockup").length};
 const sharedDesignAssets=designAssets.filter(asset=>!Number(asset.order_item_id));
 const designAssetSource=(asset:Record<string,string|number>)=>Number(asset.id)>0?`/api/orders/${token}/design?asset=${asset.id}`:`/api/orders/${token}/design?kind=${String(asset.asset_type)==="scale"?"scale":"mockup"}`;
 const progressPhotoPages=Array.from({length:Math.ceil(progressPhotos.length/4)},(_,pageIndex)=>progressPhotos.slice(pageIndex*4,pageIndex*4+4));
 return <main className="balancedPage">
  <nav className="balancedTools" aria-label="เครื่องมือใบสั่งงาน">
<div className="balancedModes"><span className="masterDocumentBadge">ใบงานหลักฉบับเดียว</span></div>
<div>
<a href={`/track/${token}`}>ติดตามสถานะ</a>
<PrintButton orderId={Number(order.id)} autoRelease={autoRelease}/>
</div>
</nav>
  {!production&&design&&<section className="designApprovalSection">
<div>
<span>DESIGN APPROVAL</span>
<h2>ตรวจและยืนยันแบบ V{String(design.version_no)}</h2>
<p>{String(design.note||"กรุณาตรวจรูปทรง ขนาด สี ตำแหน่งรู และอะไหล่ก่อนอนุมัติผลิต")}</p>
</div>
<ApprovalPanel token={token} version={Number(design.version_no)} status={String(design.status)}/>
</section>}
  <article className={`balancedPaper ${production?"productionPaper":"customerPaper"}`}>
   <header className="balancedHeader">
<img src="/assets/k2sign-logo.png" alt="K2SIGN"/>
<div>
<span>{staffView?"MASTER JOB ORDER":"CUSTOMER CONFIRMATION"}</span>
<h1>{staffView?"ใบงานหลัก":"ใบยืนยันคำสั่งผลิต"}</h1>
<p>K2SIGN • Production Order</p>
</div>
<section>
<small>เลขที่ใบสั่งงาน</small>
<b>{order.order_number}</b>
<small>วันที่สร้าง {String(order.created_at)}</small>
</section>
<div className="balancedQrBlock">
<QrCodeImage className="balancedQr" value={trackUrl} width={720} alt={`QR ติดตาม ${order.order_number}`}/>
<small>สแกนติดตามงาน</small>
<span>/track/{token}</span>
</div>
</header>
   {staffView?<section className="productionHero">
<div>
<span>งานที่ผลิต</span>
<b>{productLabel}</b>
<small>{itemCount} รายการ • {quantity.toLocaleString("th-TH")} หน่วย</small>
</div>
<div>
<span>สถานะ</span>
<b><LiveOrderStatus token={token} initialStatus={String(order.order_status)}/></b>
<small>ระดับความเร่งด่วน: ปกติ</small>
</div>
</section>:<div className="balancedStatus">
<span>สถานะปัจจุบัน</span>
<b><LiveOrderStatus token={token} initialStatus={String(order.order_status)}/></b>
<span className="balancedDueDate">กำหนดส่ง <strong>{thaiDate(order.requested_date)}</strong>
</span>
</div>}
   {staffView&&<section className={`productionDueDateCard${order.requested_date?"":" isMissing"}`} aria-label="กำหนดส่งงาน">
<span>DELIVERY DEADLINE</span>
<strong>กำหนดส่งงาน</strong>
<b>{order.requested_date?thaiDate(order.requested_date):"ยังไม่ได้กำหนดวันส่งงาน"}</b>
</section>}
   {hasAcrylicItems&&<section className="balancedCriticalSpecs" aria-label="ข้อมูลสำคัญสำหรับการผลิต">
<div><span>ความหนาอะคริลิก</span><b>{thicknessDisplay}</b></div>
<div><span>ลักษณะการพิมพ์</span><b>{printSidesDisplay}</b></div>
</section>}
   <section className="balancedSummary">{summary.map(([label,value])=>
<div key={label}>
<span>{label}</span>
<b>{String(value)}</b>
</div>)}</section>
   <div className="balancedTitle">
<span>{production?"PRODUCTION SPEC":"ORDER DETAIL"}</span>
<h2>{production?"สเปกที่ต้องผลิต":"ข้อมูลลูกค้าและสเปกผลิต"}</h2>
</div>
   {staffView&&<section className="productionSpecs">{specRows.map(([label,value])=>
<div key={label}>
<span>{label}</span>
<b>{String(value)}</b>
</div>)}</section>}
   <section className="balancedDetails">
<dl>{customerRows.map(([label,value])=>
<div key={label}>
<dt>{label}</dt>
<dd>{String(value)}</dd>
</div>)}</dl>
<dl>{specRows.map(([label,value])=>
<div key={label}>
<dt>{label}</dt>
<dd>{String(value)}</dd>
</div>)}</dl>
</section>
   <div className="balancedTitle">
<span>ITEM VISUAL BRIEF</span>
<h2>ภาพและสเปกแยกตามรายการ</h2>
</div>
   <section className="masterItemSheets">{items.map((item)=>{const itemAssets=designAssets.filter(asset=>Number(asset.order_item_id)===Number(item.id));const isCustom=String(item.product_type)==="custom";const itemHardware=String(item.hardware_code||"A").toUpperCase();const safeHardware=/^[A-Q]$/.test(itemHardware)?itemHardware:"A";return <article className="masterItemSheet" key={String(item.id)}>
    <header><span>รายการ {String(item.line_no).padStart(2,"0")}</span><h3>{String(item.item_name||"พวงกุญแจอะคริลิก")}</h3><b>{Number(item.quantity).toLocaleString("th-TH")} {isCustom?"หน่วย":"ชิ้น"}</b></header>
    <div className="masterItemVisuals">{itemAssets.length?itemAssets.map((asset,index)=><figure key={`${asset.id}-${index}`}><img src={designAssetSource(asset)} alt={`ภาพรายการ ${item.line_no} ${asset.file_name}`}/><figcaption><b>{String(asset.asset_type)==="scale"?"ภาพแบบมีสเกล":"ภาพม็อกอัป"}</b><span>{String(asset.caption||asset.file_name)}</span></figcaption></figure>):<div className="masterItemEmpty"><b>ยังไม่มีภาพของรายการนี้</b><span>กราฟิกสามารถเลือกเลขรายการและเพิ่มได้หลายภาพ</span></div>}</div>
    <div className="masterItemSpecs">{isCustom?<><div><span>รายละเอียด</span><b>{String(item.item_description||"ยังไม่ระบุ")}</b></div></>:<><div><span>ขนาด</span><b>{String(item.width_cm)} × {String(item.height_cm)} ซม.</b></div><div><span>ความหนา</span><b>{String(item.thickness_mm)} มม.</b></div><div><span>การพิมพ์</span><b>{String(item.print_sides)} ด้าน</b></div><div className="masterItemHardware"><img src={hardwareImagePath(safeHardware, String(item.hardware_name))} alt={`อะไหล่ ${itemHardware} รายการ ${item.line_no}`}/><span>อะไหล่ {itemHardware}</span><b>{String(item.hardware_name)} • {String(item.hardware_color||"ไม่ระบุสี")}</b></div></>}</div>
    <footer><span>แพ็กเกจ</span><b>{String(item.packaging_type||"ยังไม่ระบุ")}</b><span>หมายเหตุรายการ</span><b>{String(item.item_description||"-")}</b></footer>
   </article>})}</section>
   <div className="balancedTitle">
<span>VISUAL APPROVAL</span>
<h2>{production?"ภาพอ้างอิงการผลิต":"ภาพยืนยันก่อนผลิต"}</h2>
</div>
	<section className="balancedVisuals">
	<figure>
	<figcaption>ARTWORK ต้นฉบับ</figcaption>{artwork}</figure>
	{sharedDesignAssets.map((asset,index)=>{const type=String(asset.asset_type)==="scale"?"scale":"mockup";const sequence=sharedDesignAssets.slice(0,index+1).filter(item=>item.asset_type===asset.asset_type).length;const total=assetCounts[type];const source=designAssetSource(asset);return <figure key={`${asset.asset_type}-${asset.id}-${index}`}>
	<figcaption>{type==="scale"?"แบบมีสเกลสำหรับผลิต":"ม็อกอัปสินค้าสมจริง"}{total>1?` ${sequence}/${total}`:""}</figcaption>
	<img src={source} alt={`${type==="scale"?"แบบมีสเกล":"ภาพม็อกอัป"} V${design?.version_no} ภาพที่ ${sequence}`}/><small className="balancedImageCaption">{String(asset.caption||asset.file_name)}</small></figure>})}
	{!design&&generatedMockup&&<figure><figcaption>ม็อกอัพสินค้าสมจริง</figcaption><img src={generatedMockup} alt="ภาพม็อกอัพพวงกุญแจอะคริลิก"/><small>ภาพจำลองเพื่อยืนยันก่อนผลิต</small><small className="balancedImageQuantity">{imageQuantityLabel}</small></figure>}
{hasAcrylicItems?<figure className="balancedHardware">
<figcaption>อะไหล่ที่เลือก</figcaption>
<img src={hardwareImagePath(hardwareImageCode, String(order.hardware_name))} alt={`อะไหล่รหัส ${hardwareCode}`}/>
<b>รหัส {hardwareCode}</b>
<small>{String(hardwareSource.hardware_name)} • {String(hardwareSource.hardware_color||"-")}</small>
<small className="balancedImageQuantity">{imageQuantityLabel}</small>
</figure>:<figure className="balancedCustomSpec">
<figcaption>รายละเอียดงานสั่งทำ</figcaption>
<b>{String(customItems[0]?.item_name||"งานสั่งทำอื่น ๆ")}</b>
<small>{String(customItems[0]?.item_description||"ตรวจรายละเอียดในรายการสินค้า")}</small>
<small className="balancedImageQuantity">{imageQuantityLabel}</small>
</figure>}
</section>
   {staffView&&<>
<div className="balancedTitle">
<span>PRODUCTION NOTE</span>
<h2>หมายเหตุและการตรวจสอบ</h2>
</div>
<div className="productionNote">ตรวจสี รูทรง ตำแหน่งรูเจาะ ขอบตัด และอะไหล่ให้ตรงกับภาพอนุมัติก่อนผลิตจริง</div>
<section className="productionChecklist">{["ตรวจไฟล์","ตรวจการพิมพ์","ตรวจการตัด","QC","แพ็กสินค้า"].map((item,index)=>
<div key={item}>
<b>{String(index+1).padStart(2,"0")} {item}</b>
<span>□ ผ่าน</span>
</div>)}</section>
</>}
{canSeeFinance&&<><div className="balancedTitle">
<span>PRICE</span>
<h2>รายละเอียดราคา</h2>
</div>
<section className="balancedPrice">
<div className="balancedPriceHead">
<b>รายการ</b>
<b>รายละเอียด</b>
<b>บาท/ชิ้น</b>
<b>รวม</b>
</div>{priceRows.map(([label,detail,unit,total])=>
<div key={label}>
<b>{label}</b>
<span>{detail}</span>
<span>฿{money(unit)}</span>
<strong>฿{money(total)}</strong>
</div>)}</section>
<section className="balancedTotals">
{discountAmount>0&&<div className="discountTotal">
<span>ส่วนลด</span>
<b>−฿{money(discountAmount)}</b>
</div>}
	<div>
	<span>ฐานภาษี (รวมอะไหล่/ค่าส่ง)</span>
	<b>฿{money(Number(order.estimated_subtotal)+shippingFee)}</b>
	</div>
<div>
<span>VAT ที่บวกเพิ่ม 7%</span>
<b>{Number(order.vat_applied)===1?`฿${money(order.vat_amount)}`:"ไม่บวกเพิ่ม"}</b>
</div>
<div>
<span>ค่าจัดส่ง</span>
<b>฿{money(shippingFee)}</b>
</div>
<div>
<span>ยอดรวมสุทธิ</span>
<b>฿{money(payableTotal)}</b>
</div>
<div>
	<span>รับชำระแล้ว</span>
	<b>฿{money(depositAmount)}</b>
</div>
<div>
<span>ยอดค้างชำระ</span>
	<b>฿{money(outstanding)}</b>
</div>
<div className="paymentStatusTotal">
<span>สถานะการชำระเงิน</span>
<b>{paymentStatusText}</b>
</div>
</section></>}
   {canSeeSlips&&(paymentVerified?<section className="paymentProof">
<img src={`/api/orders/${token}/payment-slip`} alt={`สลิปชำระเงิน ${order.order_number}`}/>
<div>
<span>PAYMENT VERIFIED</span>
<h2>หลักฐานการชำระเงิน</h2>
<p>รับชำระสะสม <b>฿{money(depositAmount)}</b> • ยืนยันล่าสุด {String(order.payment_confirmed_at)}<br/>ไฟล์งวดแรก: {String(order.payment_slip_name)}</p>
</div>
<strong>ตรวจสอบแล้ว ✓</strong>
</section>:Boolean(order.payment_slip_key)?<section className="paymentProof paymentUnverified">
<div>
<span>PAYMENT ATTACHMENT</span>
<h2>แนบหลักฐานการชำระเงินแล้ว</h2>
<p>ทีมงานเก็บไฟล์ไว้เป็นหลักฐานประกอบใบงาน การอนุมัติแบบและการติดตามสถานะใช้ลิงก์นี้ได้ตามปกติ</p>
</div>
<strong>แนบแล้ว ✓</strong>
</section>:null)}
   {staffView&&canSeeFinance&&paymentInstallments.length>0&&<section className="masterPaymentLedger" aria-label="ประวัติการแบ่งชำระ">
    <header><div><span>PAYMENT LEDGER</span><h2>ประวัติการชำระ • {paymentInstallments.length} งวด</h2></div><b>{paymentStatusText}</b></header>
    <div className="masterPaymentLedgerRows">{paymentInstallments.map((installment,index)=><article key={`${installment.id}-${index}`}><i>{index+1}</i><div><b>งวดที่ {index+1} — ฿{money(installment.amount)}</b><span>{installment.fileName}</span></div><small>{installment.createdAt}<br/>{installment.createdBy}</small></article>)}</div>
    <footer><span>ยอดสุทธิ <b>฿{money(payableTotal)}</b></span><span>รับแล้ว <b>฿{money(depositAmount)}</b></span><span>คงเหลือ <strong>฿{money(outstanding)}</strong></span></footer>
   </section>}
   {staffView&&<section className="masterDepartmentFlow" aria-label="การส่งต่องานตามแผนก">
    <header><span>DEPARTMENT HANDOFF</span><h2>ส่งต่องานตามแผนก</h2><p>กระดาษฉบับนี้เดินตามงาน ทุกฝ่ายลงชื่อและเวลาในใบเดียวกัน</p></header>
    <div>{["ฝ่ายขาย / รับงาน","กราฟิก / ตรวจแบบ","Print & Cut / ผลิต","Pack / ตรวจนับ","ส่งมอบ / ปิดงาน"].map((department,index)=><article key={department}><i>{index+1}</i><b>{department}</b><span>□ เสร็จแล้ว</span><small>ผู้รับผิดชอบ __________________</small><small>วันที่ ______ เวลา ______</small><small>หมายเหตุ _____________________</small></article>)}</div>
   </section>}
   <footer className="balancedFooter">
<div>
<b>{staffView?"หมายเหตุสำหรับทุกแผนก":"หมายเหตุ"}</b>
<p>{staffView?"หากพบข้อมูลไม่ตรงกัน ให้หยุดงานและแจ้งผู้รับผิดชอบก่อนดำเนินการ":"ราคาสุดท้ายยืนยันหลังตรวจไฟล์ ระยะเวลาผลิตเริ่มนับเมื่อลูกค้าอนุมัติแบบ"}</p>
</div>
	<div className="balancedSignatures"><>
	<span><small>ผู้จัดทำแบบ / ลงชื่อ</small><b>{String(design?.created_by||"__________________")}</b><small>{design?.created_at?String(design.created_at):"รออัปโหลดแบบ"}</small></span>
	<span><small>ลูกค้าลงชื่อยอมรับ</small><b>{String(design?.responded_by||"__________________")}</b><small>{design?.responded_at?String(design.responded_at):"รอเซ็นยืนยัน"}</small></span>
	</></div>
</footer>
  </article>
  {staffView&&progressPhotoPages.map((photos,pageIndex)=><article className="balancedPaper workOrderPhotoPage" key={`progress-${pageIndex}`}>
   <header className="workOrderPhotoHeader">
    <div><span>PRODUCTION PHOTO LOG</span><h2>ภาพที่ทีมงานบันทึก</h2><p>ใบงาน {String(order.order_number)} • เรียงตามเวลาที่บันทึก</p></div>
    <b>หน้า {pageIndex+1}/{progressPhotoPages.length}</b>
   </header>
   <div className="workOrderPhotoGrid">{photos.map((photo,index)=>{const stage=publicOrderStatus(String(photo.status));return <figure key={String(photo.id)}>
    <div className="workOrderPhotoVisual"><img src={`/api/orders/${token}/progress?photo=${photo.id}`} alt={`ภาพที่ทีมงานบันทึก ${pageIndex*4+index+1} ใบงาน ${String(order.order_number)}`}/><span className="photoCaptureStamp printPhotoCaptureStamp"><b>ถ่ายโดย {String(photo.created_by_name||"ทีม K2SIGN")}</b><small>{thaiPhotoTimestamp(photo.created_at)}</small></span></div>
    <figcaption><b>{String(photo.caption||statusLabels[stage]||"ภาพความคืบหน้า")}</b><span>{statusLabels[stage]} • {String(photo.created_by_name||"ทีม K2SIGN")}</span><small>{thaiPhotoTimestamp(photo.created_at)}</small></figcaption>
   </figure>})}</div>
  </article>)}
 </main>;
}
