"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import K2Icon from "./K2Icon";
import CustomerShareMessage from "./CustomerShareMessage";
import { calculateCustomLineTotal } from "./custom-order-item.mjs";
import { VAT_ALL_ORDERS, VAT_POLICY_MODES, vatCollectionDecision } from "./vat-collection-policy.mjs";
import { calculatePrice, HARDWARE, HARDWARE_GROUPS, HARDWARE_VARIANTS, hardwareColorSwatch, hardwareImagePath, type Thickness } from "./pricing-config";

type Props = {
  staffName?: string;
  staffId?: number;
  salesUsers?: Array<{ id: number; name: string; username: string }>;
  salesChannels?: Array<{ code: string; name: string; prefix: string; platform: string }>;
  canManagePricing?: boolean;
  canManageUsers?: boolean;
};

type ProductType = "acrylic_keychain" | "custom";
type PaymentStatus = "" | "paid_full" | "deposit" | "unpaid";
type Item = {
  productType: ProductType;
  itemName: string;
  description: string;
  thickness: string;
  width: number;
  height: number;
  pricingSize: number;
  quantity: number;
  sides: number;
  hardwareCode: string;
  hardwareName: string;
  hardwareColor: string;
  packaging: string;
  unitPrice: number;
  lineTotal: number;
};

const money = (value: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: value % 1 ? 2 : 0 }).format(value);
const inputDate = (offset: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function StaffOrderBuilder({
  staffName = "",
  staffId = 0,
  salesUsers = [],
  salesChannels = [],
  canManagePricing = false,
  canManageUsers = false,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [productType, setProductType] = useState<ProductType>("acrylic_keychain");
  const [thickness, setThickness] = useState<Thickness>("2.5");
  const [width, setWidth] = useState(5);
  const [height, setHeight] = useState(5);
  const [quantity, setQuantity] = useState(100);
  const [sides, setSides] = useState<1 | 2>(1);
  const [hardware, setHardware] = useState("A");
  const [hardwareColor, setHardwareColor] = useState("เงิน");
  const [hardwareGroup, setHardwareGroup] = useState("all");
  const [packaging, setPackaging] = useState("standard");
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customUnitPrice, setCustomUnitPrice] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [hardwarePrices, setHardwarePrices] = useState<Record<string, number>>({});
  const [artworkPreview, setArtworkPreview] = useState("");
  const [artworkName, setArtworkName] = useState("");
  const [artworkError, setArtworkError] = useState("");
  const [invoiceRequested, setInvoiceRequested] = useState<boolean | null>(null);
  const [vatPolicy, setVatPolicy] = useState<{ mode: string; revision: number } | null>(null);
  const [vatPolicyError, setVatPolicyError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/admin/vat-policy", { cache: "no-store" }).then(async response => {
      const result = await response.json() as { error?: string; mode: string; revision: number };
      if (!response.ok || !VAT_POLICY_MODES.includes(result.mode) || !Number.isSafeInteger(result.revision) || result.revision < 1) throw new Error(result.error || "โหลดนโยบาย VAT ไม่สำเร็จ");
      if (active) setVatPolicy(result);
    }).catch(error => { if (active) setVatPolicyError(error instanceof Error ? error.message : "โหลดนโยบาย VAT ไม่สำเร็จ"); });
    return () => { active = false; };
  }, []);
  const includeVat = Boolean(vatPolicy && invoiceRequested !== null && vatCollectionDecision(vatPolicy.mode, invoiceRequested).addVat);
  const [shippingFee, setShippingFee] = useState(0);
  const [requestedDate, setRequestedDate] = useState(() => inputDate(3));
  const [rushMode, setRushMode] = useState<"normal" | "urgent">("normal");
  const [rushFee, setRushFee] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("");
  const [depositAmount, setDepositAmount] = useState(0);
  const [paymentSlipName, setPaymentSlipName] = useState("");
  const [itemError, setItemError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [reviewCustomer, setReviewCustomer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [orderId, setOrderId] = useState(0);
  const [orderNo, setOrderNo] = useState("");
  const [publicToken, setPublicToken] = useState("");
  const [customerTrackingUrl, setCustomerTrackingUrl] = useState("");
  const [postOutstanding, setPostOutstanding] = useState(0);
  const [postPaymentAmount, setPostPaymentAmount] = useState(0);
  const [postPaymentFile, setPostPaymentFile] = useState<File | null>(null);
  const [postPaymentMessage, setPostPaymentMessage] = useState("");
  const [postPaymentBusy, setPostPaymentBusy] = useState(false);

  useEffect(() => {
    fetch("/api/pricing")
      .then((response) => response.json())
      .then((result) => setHardwarePrices((result as { hardwarePrices?: Record<string, number> }).hardwarePrices || {}))
      .catch(() => setHardwarePrices({}));
  }, []);

  const selectedHardware = HARDWARE.find((entry) => entry.code === hardware) || HARDWARE[0];
  const quote = useMemo(() => calculatePrice({
    thickness,
    width,
    height,
    quantity,
    sides,
    hardwareCode: hardware,
    packaging,
    hardwarePrice: hardwarePrices[hardware],
  }), [thickness, width, height, quantity, sides, hardware, packaging, hardwarePrices]);
  const currentItem = useMemo<Item>(() => productType === "custom" ? {
    productType,
    itemName: customName.trim(),
    description: customDescription.trim(),
    thickness: "",
    width: 0,
    height: 0,
    pricingSize: 0,
    quantity: customQuantity,
    sides: 0,
    hardwareCode: "-",
    hardwareName: "ไม่ใช้",
    hardwareColor: "",
    packaging: "custom_order",
    unitPrice: customUnitPrice,
    lineTotal: calculateCustomLineTotal(customQuantity, customUnitPrice),
  } : {
    productType,
    itemName: `พวงกุญแจอะคริลิก ${width} × ${height} ซม.`,
    description: "",
    thickness,
    width,
    height,
    pricingSize: quote.size,
    quantity,
    sides,
    hardwareCode: hardware,
    hardwareName: selectedHardware.name,
    hardwareColor,
    packaging,
    unitPrice: quote.unit,
    lineTotal: quote.total,
  }, [productType, customName, customDescription, customQuantity, customUnitPrice, thickness, width, height, quote.size, quote.unit, quote.total, quantity, sides, hardware, selectedHardware.name, hardwareColor, packaging]);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const vat = includeVat ? Math.round((subtotal + shippingFee) * 7) / 100 : 0;
  const total = subtotal + shippingFee + vat + rushFee;
  const paid = paymentStatus === "paid_full" ? total : paymentStatus === "deposit" ? depositAmount : 0;
  const outstanding = Math.max(0, total - paid);

  function chooseArtwork(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setArtworkError("");
    setArtworkName("");
    setArtworkPreview("");
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["png", "jpg", "jpeg", "pdf", "ai", "psd", "zip"].includes(extension || "")) {
      setArtworkError("รองรับ PNG, JPG, PDF, AI, PSD และ ZIP");
      event.target.value = "";
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setArtworkError("ไฟล์ต้องมีขนาดไม่เกิน 15 MB");
      event.target.value = "";
      return;
    }
    setArtworkName(file.name);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setArtworkPreview(String(reader.result));
      reader.readAsDataURL(file);
    }
  }

  function addOrUpdateItem() {
    setItemError("");
    if (productType === "custom" && (customName.trim().length < 2 || customDescription.trim().length < 2 || customQuantity < 1 || customUnitPrice < 0)) {
      setItemError("กรอกชื่อ รายละเอียด จำนวน และราคางานสั่งทำให้ครบ");
      return;
    }
    if (productType === "acrylic_keychain" && quote.manual) {
      setItemError("สเปกนี้ต้องให้ทีมงานยืนยันราคา กรุณาใช้งานสั่งทำหรือเปลี่ยนสเปก");
      return;
    }
    setItems((current) => editingIndex === null
      ? [...current, { ...currentItem }]
      : current.map((item, index) => index === editingIndex ? { ...currentItem } : item));
    setEditingIndex(null);
    if (productType === "custom") {
      setCustomName("");
      setCustomDescription("");
      setCustomQuantity(1);
      setCustomUnitPrice(0);
    }
  }

  function editItem(index: number) {
    const item = items[index];
    setEditingIndex(index);
    setProductType(item.productType);
    if (item.productType === "custom") {
      setCustomName(item.itemName);
      setCustomDescription(item.description);
      setCustomQuantity(item.quantity);
      setCustomUnitPrice(item.unitPrice);
    } else {
      setThickness(item.thickness === "3" ? "3" : "2.5");
      setWidth(item.width);
      setHeight(item.height);
      setQuantity(item.quantity);
      setSides(item.sides === 2 ? 2 : 1);
      setHardware(item.hardwareCode);
      setHardwareColor(item.hardwareColor);
      setPackaging(item.packaging);
    }
    document.getElementById("staff-product-config")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openReview() {
    setSubmitError("");
    if (!items.length) {
      setItemError("เพิ่มสินค้าอย่างน้อย 1 รายการก่อนตรวจสอบใบงาน");
      document.getElementById("staff-product-config")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!formRef.current?.reportValidity()) return;
    if (!paymentStatus) {
      setSubmitError("กรุณาเลือกวิธีการชำระเงิน");
      return;
    }
    if (!vatPolicy || invoiceRequested === null) {
      setSubmitError(vatPolicyError || "กรุณาเลือกการขอใบกำกับ และรอโหลดนโยบาย VAT ให้ครบก่อน");
      return;
    }
    const data = new FormData(formRef.current);
    setReviewCustomer(String(data.get("name") || ""));
    setReviewConfirmed(false);
    setReviewOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewConfirmed || submitting || !vatPolicy || invoiceRequested === null) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const data = new FormData(event.currentTarget);
      const primary = items[0];
      data.set("items_json", JSON.stringify(items));
      data.set("thickness_mm", primary.thickness);
      data.set("width_cm", String(primary.width));
      data.set("height_cm", String(primary.height));
      data.set("pricing_size_cm", String(primary.pricingSize));
      data.set("quantity", String(items.reduce((sum, item) => sum + item.quantity, 0)));
      data.set("print_sides", String(primary.sides));
      data.set("hardware_code", primary.hardwareCode);
      data.set("hardware_name", primary.hardwareName);
      data.set("hardware_color", primary.hardwareColor);
      data.set("packaging_type", primary.packaging);
      data.set("estimated_unit_price", String(primary.unitPrice));
      data.set("estimated_subtotal", String(subtotal));
      data.set("vat_applied", includeVat ? "1" : "0");
      data.set("tax_invoice_requested", invoiceRequested ? "1" : "0");
      data.set("vat_policy_revision", String(vatPolicy.revision));
      data.set("vat_amount", String(vat));
      data.set("estimated_total", String(subtotal + vat + rushFee));
      data.set("shipping_fee", String(shippingFee));
      data.set("payment_status", paymentStatus);
      data.set("deposit_amount", String(paid));
      data.set("rush_mode", rushMode);
      data.set("requested_speed_days", String(Math.max(0, Math.round((new Date(`${requestedDate}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000))));
      data.set("delivery_tier", rushMode === "urgent" ? "staff_priority" : "");
      data.set("rush_fee", String(rushFee));
      data.set("rush_note", rushMode === "urgent" ? "ฝ่ายขายเลือกงานเร่งด่วนจากหน้าสร้างใบงาน" : "");
      const response = await fetch("/api/orders", { method: "POST", body: data });
      const result = await response.json() as { orderId?: number; orderNumber?: string; publicToken?: string; error?: string };
      if (!response.ok || !result.orderId || !result.orderNumber || !result.publicToken) throw new Error(result.error || "ไม่สามารถสร้างใบสั่งงานได้");
      setOrderId(result.orderId);
      setOrderNo(result.orderNumber);
      setPublicToken(result.publicToken);
      setCustomerTrackingUrl(new URL(`/track/${result.publicToken}`, window.location.origin).href);
      setPostOutstanding(outstanding);
      setPostPaymentAmount(outstanding);
      setSubmitted(true);
      setReviewOpen(false);
      window.setTimeout(() => document.getElementById("staff-order-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "ไม่สามารถสร้างใบสั่งงานได้");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadPaymentAfterOrder() {
    if (!orderId || !postPaymentFile || postPaymentAmount <= 0) {
      setPostPaymentMessage("กรอกยอดรับและเลือกภาพสลิปก่อนบันทึก");
      return;
    }
    setPostPaymentBusy(true);
    setPostPaymentMessage("");
    try {
      const body = new FormData();
      body.set("amount", String(postPaymentAmount));
      body.set("payment_slip", postPaymentFile);
      const response = await fetch(`/api/admin/orders/${orderId}/payment-slip`, { method: "POST", body });
      const result = await response.json() as { outstanding?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "บันทึกสลิปไม่สำเร็จ");
      setPostOutstanding(Number(result.outstanding || 0));
      setPostPaymentAmount(Number(result.outstanding || 0));
      setPostPaymentFile(null);
      setPostPaymentMessage(result.outstanding ? "บันทึกยอดรับแล้ว ยังมียอดค้าง" : "รับชำระครบแล้ว บันทึกรายรับเรียบร้อย");
    } catch (error) {
      setPostPaymentMessage(error instanceof Error ? error.message : "บันทึกสลิปไม่สำเร็จ");
    } finally {
      setPostPaymentBusy(false);
    }
  }

  return (
    <main className="staffOrderPage">
      <header className="staffOrderHeader">
        <a href="/admin" className="staffOrderBrand"><img src="/assets/k2studio/k2studio-logo-new.jpg" alt="K2STUDIO" /></a>
        <div className="staffOrderTitle"><strong>สร้างใบงาน</strong><span>เพิ่มสินค้าและยืนยันได้ในหน้าเดียว</span></div>
        <nav className="staffOrderNav" aria-label="เมนูใบงาน">
          <a href="/admin"><K2Icon name="grid" />ภาพรวม</a>
          <a href="/admin#orders"><K2Icon name="clipboard" />ใบงาน</a>
          {canManagePricing && <a href="/admin/pricing"><K2Icon name="gear" />ราคา</a>}
          {canManageUsers && <a href="/admin/users"><K2Icon name="users" />ทีม</a>}
        </nav>
        <div className="staffOrderProfile"><span>{staffName.slice(0, 1) || "K"}</span><small>{staffName || "ทีมงาน"}</small></div>
      </header>

      <form ref={formRef} className="staffOrderShell" onSubmit={submit}>
        <input type="hidden" name="file_delivery_method" value="upload" />
        <input type="hidden" name="requested_date" value={requestedDate} />

        <aside className="staffProductRail" aria-label="ประเภทสินค้า">
          <div><span className="railEyebrow">สินค้า</span><strong>เลือกประเภท</strong></div>
          <button type="button" className={productType === "acrylic_keychain" ? "active" : ""} onClick={() => { setProductType("acrylic_keychain"); setEditingIndex(null); }}>
            <img src="/assets/k2studio/k2-mascot-keychain.png" alt="พวงกุญแจอะคริลิก" /><span>พวงกุญแจ</span>
          </button>
          <button type="button" className={productType === "custom" ? "active" : ""} onClick={() => { setProductType("custom"); setEditingIndex(null); }}>
            <img src="/assets/k2studio/category-mobile-v1.webp" alt="งานสั่งทำ" /><span>งานสั่งทำ</span>
          </button>
          <div className="railHelp"><K2Icon name="smile" /><span>เลือกสินค้า แล้วกรอกเฉพาะข้อมูลที่จำเป็น</span></div>
        </aside>

        <section className="staffProductWorkspace" id="staff-product-config">
          <div className="staffWorkspaceHeading">
            <div><span className="sectionNumber">01</span><div><strong>ตั้งค่าสินค้า</strong><small>เพิ่มได้หลายรายการในใบงานเดียว</small></div></div>
            <span className="editingPill">{editingIndex === null ? "รายการใหม่" : `กำลังแก้รายการ ${editingIndex + 1}`}</span>
          </div>

          <div className="staffProductConfigurator">
            <div className="staffProductVisual">
              <img src={artworkPreview || (productType === "acrylic_keychain" ? "/assets/k2studio/k2-mascot-keychain.png" : "/assets/k2studio/category-mobile-v1.webp")} alt="ตัวอย่างสินค้า" />
              <label className="staffArtworkButton"><K2Icon name="plus" /><span>{artworkName || "แนบไฟล์อาร์ตเวิร์ก"}</span><input name="artwork" type="file" accept=".png,.jpg,.jpeg,.pdf,.ai,.psd,.zip" onChange={chooseArtwork} /></label>
              <small>{artworkError || "ไฟล์ภาพจะแสดงเป็นตัวอย่างในใบงาน"}</small>
            </div>

            {productType === "acrylic_keychain" ? <div className="staffConfigFields">
              <div className="staffFieldRow three">
                <label>กว้าง (ซม.)<input type="number" min="1" max="30" step="0.5" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label>
                <label>สูง (ซม.)<input type="number" min="1" max="30" step="0.5" value={height} onChange={(e) => setHeight(Number(e.target.value))} /></label>
                <label>ความหนา<select value={thickness} onChange={(e) => setThickness(e.target.value as Thickness)}><option value="2.5">2.5 มม.</option><option value="3">3 มม.</option></select></label>
              </div>
              <div className="staffFieldRow two">
                <label>จำนวน<div className="quantityStepper"><button type="button" onClick={() => setQuantity(Math.max(1, quantity - 10))}><K2Icon name="minus" /></button><input type="number" min="1" max="1000000" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} /><button type="button" onClick={() => setQuantity(quantity + 10)}><K2Icon name="plus" /></button></div></label>
                <label>พิมพ์<select value={sides} onChange={(e) => setSides(Number(e.target.value) === 2 ? 2 : 1)}><option value="1">ด้านเดียว</option><option value="2">สองด้าน</option></select></label>
              </div>
              <div className="staffOptionLabel"><strong>1. เลือกชนิดอะไหล่</strong><span>รหัส {hardware} · {selectedHardware.name} · {hardwarePrices[hardware] ?? selectedHardware.price ? `+฿${money(hardwarePrices[hardware] ?? selectedHardware.price)}/ชิ้น` : "รวมในราคา"}</span></div>
              <div className="staffHardwareGroups" role="group" aria-label="กลุ่มชนิดอะไหล่">
                {HARDWARE_GROUPS.map((group) => <button type="button" key={group.id} aria-pressed={hardwareGroup === group.id} onClick={() => setHardwareGroup(group.id)}>{group.name}</button>)}
              </div>
              <small className="staffHardwareCount">{HARDWARE.filter((entry) => hardwareGroup === "all" || entry.group === hardwareGroup).length} แบบ · เลื่อนในช่องอะไหล่เพื่อดูรายการต่อ</small>
              <div className="staffHardwareStrip">
                {HARDWARE.filter((entry) => hardwareGroup === "all" || entry.group === hardwareGroup).map((entry) => <button type="button" key={entry.code} className={hardware === entry.code ? "active" : ""} aria-pressed={hardware === entry.code} onClick={() => { setHardware(entry.code); setHardwareColor(HARDWARE_VARIANTS[entry.code]?.[0] || ""); }} title={entry.name}><img src={hardwareImagePath(entry.code)} alt="" /><span>{entry.code}</span><small>{entry.name}</small></button>)}
              </div>
              <div className="staffColorHeading"><strong>2. เลือกสี / แบบย่อย</strong><span>ภาพด้านบนแสดงรูปทรงอ้างอิง สีที่บันทึกให้ยึดจากตัวเลือกนี้</span></div>
              <div className="staffColorChoices" role="group" aria-label="สีหรือแบบย่อยของอะไหล่">
                {(HARDWARE_VARIANTS[hardware] || []).map((color) => <button key={color} type="button" aria-pressed={hardwareColor === color} onClick={() => setHardwareColor(color)}><i style={{ backgroundColor: hardwareColorSwatch(color) }} aria-hidden="true" /><span>{color}</span></button>)}
              </div>
              <div className="staffFieldRow"><label>บรรจุภัณฑ์<select value={packaging} onChange={(e) => setPackaging(e.target.value)}><option value="standard">ถุง OPP มาตรฐาน</option><option value="backing">การ์ดรอง (รอยืนยันราคา)</option><option value="custom">แพ็กเกจสั่งทำ</option></select></label></div>
            </div> : <div className="staffConfigFields custom">
              <label>ชื่อสินค้า<input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="เช่น เสื้อ DTG สีขาว" /></label>
              <label>รายละเอียดสำหรับผลิต<textarea value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} placeholder="วัสดุ สี ขนาด ตำแหน่งพิมพ์ และข้อมูลสำคัญ" rows={4} /></label>
              <div className="staffFieldRow two"><label>จำนวน<input type="number" min="1" value={customQuantity} onChange={(e) => setCustomQuantity(Number(e.target.value))} /></label><label>ราคาต่อหน่วย<input type="number" min="0" step="0.01" value={customUnitPrice} onChange={(e) => setCustomUnitPrice(Number(e.target.value))} /></label></div>
            </div>}
          </div>

          <div className="staffItemActionBar">
            <div><span>ราคารายการ</span><strong>฿{money(currentItem.lineTotal)}</strong><small>{currentItem.quantity.toLocaleString("th-TH")} ชิ้น × ฿{money(currentItem.unitPrice)}</small></div>
            <button type="button" onClick={addOrUpdateItem}><K2Icon name={editingIndex === null ? "plus" : "check"} />{editingIndex === null ? "เพิ่มรายการลงใบงาน" : "บันทึกการแก้ไข"}</button>
          </div>
          {itemError && <p className="staffInlineError">{itemError}</p>}

          <div className="staffItemsPanel">
            <div className="staffWorkspaceHeading compact"><div><span className="sectionNumber">02</span><div><strong>รายการสินค้า</strong><small>{items.length} รายการในใบงานนี้</small></div></div></div>
            {items.length ? <div className="staffItemList">{items.map((item, index) => <article key={`${item.itemName}-${index}`}>
              <div className="staffItemThumb"><img src={item.productType === "acrylic_keychain" ? hardwareImagePath(item.hardwareCode) : "/assets/k2studio/category-mobile-v1.webp"} alt="" />{artworkPreview && <img className="artworkPair" src={artworkPreview} alt="อาร์ตเวิร์กที่แนบ" />}</div>
              <div className="staffItemMain"><span>รายการ {String(index + 1).padStart(2, "0")}</span><strong>{item.itemName}</strong><small>{item.productType === "acrylic_keychain" ? `${item.quantity} ชิ้น • ${item.sides} ด้าน • อะไหล่ ${item.hardwareCode} · ${item.hardwareColor}` : `${item.quantity} ชิ้น • ${item.description}`}</small></div>
              <div className="staffItemPrice"><small>รวม</small><strong>฿{money(item.lineTotal)}</strong></div>
              <div className="staffItemTools"><button type="button" onClick={() => editItem(index)}>แก้ไข</button><button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>ลบ</button></div>
            </article>)}</div> : <div className="staffEmptyItems"><K2Icon name="cart" /><strong>ยังไม่มีสินค้าในใบงาน</strong><span>ตั้งค่าสินค้าด้านบน แล้วกด “เพิ่มรายการลงใบงาน”</span></div>}
          </div>
        </section>

        <aside className="staffCheckout">
          {submitted ? <div className="staffOrderSuccess" id="staff-order-result">
            <span className="successIcon"><K2Icon name="check" /></span>
            <small>สร้างใบงานสำเร็จ</small><h2>{orderNo}</h2>
            <div className={postOutstanding > 0 ? "paymentBadge waiting" : "paymentBadge paid"}>{postOutstanding > 0 ? `รอชำระ ฿${money(postOutstanding)}` : "ชำระครบแล้ว"}</div>
            <p>ใบงานถูกส่งเข้าสู่ระบบแล้ว และทีมงานสามารถเริ่มดำเนินงานได้ทันที</p>
            <CustomerShareMessage orderNumber={orderNo} trackingUrl={customerTrackingUrl}/>
            <div className="successLinks"><a href={`/admin/orders/${orderId}`}>เปิดใบงานหลังบ้าน</a><a href={`/track/${publicToken}`} target="_blank" rel="noreferrer">ดูลิงก์ลูกค้า</a></div>
            {postOutstanding > 0 && <div className="postPaymentBox"><strong>เพิ่มสลิปภายหลัง</strong><small>ยอดที่บันทึกจะเข้ารายรับของวันที่แนบสลิป</small><label>ยอดรับครั้งนี้<input type="number" min="0.01" max={postOutstanding} step="0.01" value={postPaymentAmount} onChange={(e) => setPostPaymentAmount(Number(e.target.value))} /></label><label className="postSlipPicker"><K2Icon name="plus" /><span>{postPaymentFile?.name || "เลือกภาพสลิป"}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setPostPaymentFile(e.target.files?.[0] || null)} /></label><button type="button" disabled={postPaymentBusy} onClick={uploadPaymentAfterOrder}>{postPaymentBusy ? "กำลังบันทึก..." : "บันทึกรับชำระ"}</button>{postPaymentMessage && <p>{postPaymentMessage}</p>}</div>}
            <a className="createAnother" href="/admin/orders/new">สร้างใบงานใหม่</a>
          </div> : <>
            <div className="staffCheckoutHeading"><div><span className="sectionNumber">03</span><div><strong>สรุปและชำระเงิน</strong><small>ตรวจข้อมูลก่อนยืนยัน</small></div></div><span className="cartCount">{items.length}</span></div>
            <div className="staffCustomerFields">
              <div className="checkoutSubheading"><strong>ข้อมูลลูกค้า</strong><span>จำเป็น</span></div>
              <label>ชื่อผู้ติดต่อ<input required name="name" placeholder="ชื่อลูกค้าหรือบริษัท" /></label>
              <div className="staffFieldRow two"><label>เบอร์โทร<input required name="phone" inputMode="tel" placeholder="08x-xxx-xxxx" /></label><label>LINE / ผู้ติดต่อ<input name="line" placeholder="LINE ID" /></label></div>
              <div className="staffFieldRow two"><label>ช่องทางขาย<select required name="contact_channel" defaultValue=""><option value="" disabled>เลือกช่องทาง</option>{salesChannels.map((channel) => <option key={channel.code} value={channel.code}>{channel.name}</option>)}</select></label><label>เซลล์ผู้รับผิดชอบ<select required name="sales_owner_id" defaultValue={String(staffId)}>{salesUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label></div>
              <label>ชื่อบัญชีลูกค้า<input name="social_contact_name" placeholder="ชื่อ Facebook / ร้านค้า" /></label>
              <details className="staffMoreCustomer"><summary>เพิ่มที่อยู่และข้อมูลติดต่อ</summary><label>อีเมล<input name="email" type="email" /></label><label>ที่อยู่<textarea name="address" rows={2} /></label><label>จังหวัด<input name="province" /></label></details>
            </div>

            <div className="staffDeliveryBox">
              <div className="checkoutSubheading"><strong>กำหนดส่ง</strong><span>{rushMode === "urgent" ? "งานด่วน" : "คิวปกติ"}</span></div>
              <label>วันที่ลูกค้าต้องการรับ<input required type="date" min={inputDate(0)} value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} /></label>
              <div className="rushToggle"><button type="button" className={rushMode === "normal" ? "active" : ""} onClick={() => { setRushMode("normal"); setRushFee(0); }}>ปกติ</button><button type="button" className={rushMode === "urgent" ? "active urgent" : ""} onClick={() => setRushMode("urgent")}>เร่งด่วน</button></div>
              {rushMode === "urgent" && <label>ค่าบริการเร่งคิว<input type="number" min="0" step="0.01" value={rushFee} onChange={(e) => setRushFee(Math.max(0, Number(e.target.value)))} /></label>}
            </div>

            <div className="staffTotals">
              <div><span>สินค้า ({items.length} รายการ)</span><strong>฿{money(subtotal)}</strong></div>
              <div><span>ค่าจัดส่ง</span><label className="inlineMoney">฿<input type="number" min="0" step="0.01" value={shippingFee} onChange={(e) => setShippingFee(Math.max(0, Number(e.target.value)))} /></label></div>
              <fieldset className="vatDocumentChoices"><legend>ใบกำกับภาษีเต็มรูป</legend>
                <label><input required type="radio" name="tax_invoice_choice" checked={invoiceRequested === true} onChange={() => setInvoiceRequested(true)}/><span>ขอใบกำกับภาษี — บวก VAT 7%</span></label>
                <label><input required type="radio" name="tax_invoice_choice" checked={invoiceRequested === false} onChange={() => setInvoiceRequested(false)}/><span>{vatPolicy?.mode === VAT_ALL_ORDERS ? "ไม่ขอใบกำกับเต็มรูป — ยังคงบวก VAT 7%" : "ไม่ขอใบกำกับเต็มรูป — ไม่บวก VAT เพิ่ม"}</span></label>
                <small>{vatPolicyError || (!vatPolicy ? "กำลังโหลดนโยบาย VAT…" : vatPolicy.mode === VAT_ALL_ORDERS ? "ผู้ดูแลเปิดการบวก VAT ทุกใบงานใหม่แล้ว" : "ช่วงเปลี่ยนผ่าน: รายการไม่บวกเพิ่มส่งให้บัญชีแยกภาษีเอง ไม่ใช่ยอดยกเว้นภาษี")}</small>
              </fieldset>
              <div><span>VAT ที่บวกเพิ่ม</span><strong>฿{money(vat)}</strong></div>
              {rushFee > 0 && <div><span>เร่งคิว</span><strong>฿{money(rushFee)}</strong></div>}
              <div className="grand"><span>ยอดสุทธิ</span><strong>฿{money(total)}</strong></div>
            </div>

            <div className="staffPaymentChoices">
              <div className="checkoutSubheading"><strong>วิธีการชำระเงิน</strong><span>เลือก 1 แบบ</span></div>
              <label className={paymentStatus === "paid_full" ? "active" : ""}><input required type="radio" name="payment_status_choice" checked={paymentStatus === "paid_full"} onChange={() => setPaymentStatus("paid_full")} /><K2Icon name="check" /><span><strong>ชำระเต็มจำนวน</strong><small>แนบสลิปก่อนยืนยัน</small></span></label>
              <label className={paymentStatus === "deposit" ? "active" : ""}><input required type="radio" name="payment_status_choice" checked={paymentStatus === "deposit"} onChange={() => setPaymentStatus("deposit")} /><K2Icon name="chart" /><span><strong>ชำระมัดจำ</strong><small>เก็บยอดส่วนที่เหลือภายหลัง</small></span></label>
              <label className={paymentStatus === "unpaid" ? "active" : ""}><input required type="radio" name="payment_status_choice" checked={paymentStatus === "unpaid"} onChange={() => setPaymentStatus("unpaid")} /><K2Icon name="clock" /><span><strong>ยังไม่ชำระเงิน</strong><small>สร้างใบงานได้ สถานะรอชำระ</small></span></label>
              {paymentStatus === "deposit" && <label className="checkoutInput">ยอดมัดจำ<input required type="number" min="0.01" max={Math.max(0.01, total - 0.01)} step="0.01" value={depositAmount || ""} onChange={(e) => setDepositAmount(Number(e.target.value))} /></label>}
              {paymentStatus && paymentStatus !== "unpaid" && <label className="checkoutSlip"><K2Icon name="plus" /><span><strong>{paymentSlipName || "แนบภาพสลิป"}</strong><small>PNG, JPG หรือ WEBP ไม่เกิน 8 MB</small></span><input required name="payment_slip" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setPaymentSlipName(e.target.files?.[0]?.name || "")} /></label>}
            </div>
            {submitError && <p className="staffInlineError checkout">{submitError}</p>}
            <button type="button" className="staffReviewButton" onClick={openReview}><span><K2Icon name="clipboard" />ตรวจสอบก่อนยืนยัน</span><K2Icon name="chevron" /></button>
            <p className="staffCheckoutHint"><K2Icon name="shield" />ระบบจะยังไม่สร้างใบงานจนกว่าจะกดยืนยันในขั้นตอนถัดไป</p>
          </>}
        </aside>

        {reviewOpen && <div className="staffReviewOverlay" role="dialog" aria-modal="true" aria-labelledby="staff-review-title">
          <section className="staffReviewModal">
            <button type="button" className="reviewClose" onClick={() => setReviewOpen(false)} aria-label="ปิด">×</button>
            <span className="reviewIcon"><K2Icon name="clipboard" /></span>
            <small>ตรวจสอบครั้งสุดท้าย</small><h2 id="staff-review-title">ยืนยันสร้างใบงาน</h2>
            <div className="reviewCustomer"><span>ลูกค้า</span><strong>{reviewCustomer}</strong></div>
            <div className="reviewStats"><div><span>รายการสินค้า</span><strong>{items.length}</strong></div><div><span>จำนวนรวม</span><strong>{items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString("th-TH")}</strong></div><div><span>กำหนดส่ง</span><strong>{new Date(`${requestedDate}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</strong></div></div>
            <div className="reviewTotal"><span>ยอดสุทธิ</span><strong>฿{money(total)}</strong></div>
            <p>{invoiceRequested ? "ขอใบกำกับภาษีเต็มรูป" : "ไม่ขอใบกำกับภาษีเต็มรูป"} · {includeVat ? `บวก VAT ฿${money(vat)}` : "ไม่บวกเพิ่ม — ฝ่ายบัญชีแยกภาษี"}</p>
            <div className={`reviewPayment ${paymentStatus === "unpaid" ? "waiting" : ""}`}><K2Icon name={paymentStatus === "unpaid" ? "clock" : "check"} /><span><strong>{paymentStatus === "paid_full" ? "ชำระเต็มจำนวน" : paymentStatus === "deposit" ? `รับมัดจำ ฿${money(depositAmount)}` : "รอการชำระเงิน"}</strong><small>{paymentStatus === "unpaid" ? "ใบงานจะถูกสร้างและติดป้ายรอชำระ" : `ยอดค้าง ฿${money(outstanding)}`}</small></span></div>
            <label className="reviewConfirm"><input type="checkbox" checked={reviewConfirmed} onChange={(e) => setReviewConfirmed(e.target.checked)} /><span>ตรวจสอบชื่อ รายการสินค้า ยอดเงิน และกำหนดส่งแล้ว</span></label>
            <button className="reviewSubmit" type="submit" disabled={!reviewConfirmed || submitting}>{submitting ? "กำลังสร้างใบงาน..." : "ยืนยันสร้างใบงาน"}<K2Icon name="chevron" /></button>
            <button className="reviewBack" type="button" onClick={() => setReviewOpen(false)}>กลับไปแก้ไข</button>
          </section>
        </div>}
      </form>
    </main>
  );
}
