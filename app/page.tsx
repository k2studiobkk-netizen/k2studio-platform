"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculatePrice,
  HARDWARE,
  HARDWARE_VARIANTS,
  hardwareColorSwatch,
  hardwareImagePath,
  type Thickness,
} from "./pricing-config";
import { calculateCustomLineTotal } from "./custom-order-item.mjs";
import CustomerShareMessage from "./CustomerShareMessage";
import PortfolioGallery from "./PortfolioGallery";
import K2Icon from "./K2Icon";
import StaffOrderBuilder from "./StaffOrderBuilder";

const catalogImages = ["01", "02", "03", "04", "05", "06", "07", "08"];
const studioCategories = [
  { title: "ของแจกและของที่ระลึก", image: "/assets/k2studio/category-keychains-v1.webp", href: "#quote" },
  { title: "อุปกรณ์เสริมมือถือ", image: "/assets/k2studio/category-mobile-v1.webp", href: "#quote" },
  { title: "เสื้อผ้าและหมวก", image: "/assets/k2studio/category-apparel-v1.webp", href: "#quote" },
  { title: "กระเป๋า", image: "/assets/k2studio/category-bags-v1.webp", href: "#quote" },
  { title: "แก้วและกระบอกน้ำ", image: "/assets/k2studio/category-drinkware-v1.webp", href: "#quote" },
  { title: "เครื่องเขียนและของใช้สำนักงาน", image: "/assets/k2studio/category-stationery-v1.webp", href: "#quote" },
];
const featuredHardwareCodes = ["A", "B", "J", "H", "Q"] as const;
const featuredProductImages = [
  "/assets/k2studio/k2-mascot-keychain.png",
  "/assets/k2studio/category-keychains-v1.webp",
  "/assets/keychain-flower.png",
  "/assets/keychain-k2.png",
];
const money = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: n % 1 ? 2 : 0,
  }).format(n);
const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const daysFromToday = (value: string) => {
  if (!value) return 0;
  const selected = new Date(`${value}T00:00:00`);
  if (Number.isNaN(selected.getTime())) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  selected.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((selected.getTime() - now.getTime()) / 86_400_000));
};
const orderSystemUrl =
  "https://order.k2group.site";
type OrderItem = {
  productType: "acrylic_keychain" | "custom";
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
const itemSignature = (item: OrderItem) =>
  [
    item.productType,
    item.itemName,
    item.description,
    item.thickness,
    item.width,
    item.height,
    item.pricingSize,
    item.quantity,
    item.sides,
    item.hardwareCode,
    item.hardwareColor,
    item.packaging,
    item.unitPrice,
    item.lineTotal,
  ].join("|");

type RushPackageId = "standard" | "fast_3_days" | "fast_1_day" | "custom";
type RushPackage = {
  id: RushPackageId;
  title: string;
  requestDays: number;
  mode: "normal" | "urgent";
  deliveryTier: string;
  fee: number;
  description: string;
};

const rushPackages: ReadonlyArray<RushPackage> = [
  {
    id: "standard",
    title: "ปกติ",
    requestDays: 0,
    mode: "normal",
    deliveryTier: "",
    fee: 0,
    description: "ใช้เวลาทำงานตามคิวปกติ",
  },
  {
    id: "fast_3_days",
    title: "ส่งด่วน 3 วัน",
    requestDays: 3,
    mode: "urgent",
    deliveryTier: "express_1",
    fee: 250,
    description: "เร่งคิวเพื่อรับงานเร็วขึ้น",
  },
  {
    id: "fast_1_day",
    title: "เร็วมาก 1 วัน",
    requestDays: 1,
    mode: "urgent",
    deliveryTier: "express_2",
    fee: 1200,
    description: "เร่งด่วนที่สุด ใช้ด่วนที่สุด",
  },
];

type HomeProps = {
  canCreateOrder?: boolean;
  staffName?: string;
  staffId?: number;
  salesUsers?: Array<{ id: number; name: string; username: string }>;
  salesChannels?: Array<{ code: string; name: string; prefix: string; platform: string }>;
  canManagePricing?: boolean;
  canManageUsers?: boolean;
};

type PaymentStatus = "" | "paid_full" | "deposit" | "unpaid";

export default function Home(props: HomeProps) {
  if (props.canCreateOrder) return <StaffOrderBuilder {...props} />;
  return <PublicHome {...props} />;
}

function PublicHome({
  canCreateOrder = false,
  staffName = "",
  staffId = 0,
  salesUsers = [],
  salesChannels = [],
  canManagePricing = false,
  canManageUsers = false,
}: HomeProps) {
  const [productType, setProductType] = useState<"acrylic_keychain" | "custom">("acrylic_keychain");
  const [thickness, setThickness] = useState<Thickness>("2.5");
  const [width, setWidth] = useState(5);
  const [height, setHeight] = useState(5);
  const [quantity, setQuantity] = useState(100);
  const [sides, setSides] = useState<1 | 2>(1);
  const [hardware, setHardware] = useState("A");
  const [hardwareColor, setHardwareColor] = useState("เงิน");
  const [packaging, setPackaging] = useState("standard");
  const [submitted, setSubmitted] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [publicToken, setPublicToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const [artworkPreview, setArtworkPreview] = useState("");
  const [artworkName, setArtworkName] = useState("");
  const [artworkError, setArtworkError] = useState("");
  const [includeVat, setIncludeVat] = useState(false);
  const [shippingFee, setShippingFee] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("");
  const [depositAmount, setDepositAmount] = useState(0);
  const [rushMode, setRushMode] = useState<"normal" | "urgent">("normal");
  const [requestedSpeedDays, setRequestedSpeedDays] = useState(0);
  const [rushPackage, setRushPackage] = useState<RushPackageId>("standard");
  const [deliveryTier, setDeliveryTier] = useState("");
  const [requestedDate, setRequestedDate] = useState(() => {
    const initial = new Date();
    initial.setHours(0, 0, 0, 0);
    initial.setDate(initial.getDate() + 3);
    return toInputDate(initial);
  });
  const [rushFee, setRushFee] = useState(0);
  const [rushNote, setRushNote] = useState("");
  const [paymentSlipName, setPaymentSlipName] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customUnitPrice, setCustomUnitPrice] = useState(0);
  const [itemError, setItemError] = useState("");
  const [quoteTouched, setQuoteTouched] = useState(false);
  const [hardwarePrices, setHardwarePrices] = useState<Record<string, number>>({});
  const [featuredSlide, setFeaturedSlide] = useState(0);
  const [featuredAdded, setFeaturedAdded] = useState(false);
  useEffect(() => {
    fetch("/api/pricing")
      .then((response) => response.json())
      .then((result) => setHardwarePrices((result as { hardwarePrices?: Record<string, number> }).hardwarePrices || {}))
      .catch(() => setHardwarePrices({}));
  }, []);
  const quote = useMemo(
    () =>
      calculatePrice({
        thickness,
        width,
        height,
        quantity,
        sides,
        hardwareCode: hardware,
        packaging,
        hardwarePrice: hardwarePrices[hardware],
      }),
    [thickness, width, height, quantity, sides, hardware, packaging, hardwarePrices],
  );
  const selected = HARDWARE.find((h) => h.code === hardware)!;
  const currentItem = useMemo<OrderItem>(() => productType === "custom" ? ({
    productType: "custom",
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
  }) : ({
    productType: "acrylic_keychain",
    itemName: `พวงกุญแจอะคริลิก ${width} × ${height} ซม.`,
    description: "",
    thickness,
    width,
    height,
    pricingSize: quote.size,
    quantity,
    sides,
    hardwareCode: hardware,
    hardwareName: selected.name,
    hardwareColor,
    packaging,
    unitPrice: quote.unit,
    lineTotal: quote.total,
  }), [productType, customName, customDescription, customQuantity, customUnitPrice, thickness, width, height, quote.size, quote.unit, quote.total, quantity, sides, hardware, selected.name, hardwareColor, packaging]);
  const currentItemValid = productType === "acrylic_keychain" ? quoteTouched : (
    customName.trim().length >= 2 &&
    customDescription.trim().length >= 2 &&
    Number.isInteger(customQuantity) && customQuantity > 0 &&
    Number.isFinite(customUnitPrice) && customUnitPrice >= 0
  );
  const hasPendingItem =
    currentItemValid && items.length > 0 &&
    itemSignature(items[items.length - 1]) !== itemSignature(currentItem);
  const effectiveItems = items.length
    ? hasPendingItem
      ? [...items, currentItem]
      : items
    : currentItemValid
      ? [currentItem]
      : [];
  const summaryItem = effectiveItems[effectiveItems.length - 1] || currentItem;
  const totalQuantity = effectiveItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const totalUnitLabel = effectiveItems.some(
    (item) => item.productType === "custom",
  )
    ? "หน่วยรวม"
    : "ชิ้น";
  const productSubtotal = effectiveItems.reduce(
    (sum, item) => sum + item.lineTotal,
    0,
  );
  const rushServiceFee = Math.max(0, Number.isFinite(rushFee) ? rushFee : 0);
  const vatAmount = includeVat ? Math.round((productSubtotal + shippingFee) * 7) / 100 : 0;
  const grandTotal = productSubtotal + vatAmount + rushServiceFee;
  const payableTotal = grandTotal + shippingFee;
  const selectedRushPackage = rushPackages.find((pack) => pack.id === rushPackage) || rushPackages[0];
  const requestedDateOffsetDays = daysFromToday(requestedDate);
  const todayInputMin = toInputDate(new Date());
  useEffect(() => {
    if (rushPackage === "custom") return;
    if (!requestedDate) return;
    const remaining = daysFromToday(requestedDate);
    if (remaining <= 1) {
      applyRushPackage("fast_1_day");
      return;
    }
    if (remaining <= 3) {
      applyRushPackage("fast_3_days");
      return;
    }
    applyRushPackage("standard");
  }, [requestedDate, rushPackage]);
  const receivedAmount = paymentStatus === "paid_full"
    ? payableTotal
    : paymentStatus === "deposit"
      ? depositAmount
      : 0;
  const outstanding = Math.max(0, payableTotal - receivedAmount);
  function applyRushPackage(selected: RushPackageId, syncDate = false) {
    const preset = rushPackages.find((pack) => pack.id === selected);
    if (!preset) return;
    setRushPackage(selected);
    setRushMode(preset.mode);
    setRequestedSpeedDays(preset.requestDays);
    if (syncDate) {
      const nextDate = new Date();
      nextDate.setHours(0, 0, 0, 0);
      nextDate.setDate(nextDate.getDate() + preset.requestDays);
      setRequestedDate(toInputDate(nextDate));
    }
    setDeliveryTier(preset.deliveryTier);
    setRushFee(preset.fee);
  }
  function setRushDaysManually(next: number) {
    setRushPackage("custom");
    const normalized = Math.max(0, Math.min(365, Math.floor(next)));
    setRequestedSpeedDays(normalized);
    const nextDate = new Date();
    nextDate.setHours(0, 0, 0, 0);
    nextDate.setDate(nextDate.getDate() + normalized);
    setRequestedDate(toInputDate(nextDate));
  }
  function setRushFeeManually(next: number) {
    setRushPackage("custom");
    setRushFee(Math.max(0, Number.isFinite(next) ? next : 0));
  }
  function setRushTierManually(next: string) {
    setRushPackage("custom");
    setDeliveryTier(next);
  }
  function setRushModeManually(nextMode: "normal" | "urgent") {
    setRushPackage("custom");
    setRushMode(nextMode);
  }
  function addCurrentItem() {
    setItemError("");
    if (!currentItemValid) {
      setItemError(productType === "acrylic_keychain" ? "กรุณาเลือกหรือแก้ไขสเปกพวงกุญแจก่อนเพิ่มรายการ" : "กรุณากรอกชื่อ รายละเอียด จำนวน และราคาของงานสั่งทำให้ครบ");
      return;
    }
    setItems((current) => {
      const last = current[current.length - 1];
      if (last && itemSignature(last) === itemSignature(currentItem))
        return current;
      return [
        ...current,
        { ...currentItem },
      ];
    });
    if (productType === "custom") {
      setCustomName("");
      setCustomDescription("");
      setCustomQuantity(1);
      setCustomUnitPrice(0);
    }
  }
  function addFeaturedItem() {
    setQuoteTouched(true);
    setItems((current) => {
      const last = current[current.length - 1];
      if (last && itemSignature(last) === itemSignature(currentItem)) return current;
      return [...current, { ...currentItem }];
    });
    setFeaturedAdded(true);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
  }
  function scrollQuote() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function chooseArtwork(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setArtworkError("");
    setArtworkPreview("");
    setArtworkName("");
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowed = ["png", "jpg", "jpeg", "pdf", "ai", "psd", "zip"];
    if (!allowed.includes(ext || "")) {
      setArtworkError("รองรับเฉพาะ PNG, JPG, PDF, AI, PSD และ ZIP");
      e.target.value = "";
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setArtworkError("ไฟล์ต้องมีขนาดไม่เกิน 15 MB");
      e.target.value = "";
      return;
    }
    setArtworkName(file.name);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setArtworkPreview(String(reader.result));
      reader.readAsDataURL(file);
    }
  }
  function selectHardware(code: string) {
    setQuoteTouched(true);
    setHardware(code);
    setHardwareColor(HARDWARE_VARIANTS[code]?.[0] || "");
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const data = new FormData(e.currentTarget);
      const orderItems = effectiveItems;
      if (!orderItems.length) {
        throw new Error("กรุณาเพิ่มรายการสินค้าก่อนสร้างใบงาน");
      }
      const primary = orderItems[0];
      data.set("items_json", JSON.stringify(orderItems));
      data.set("thickness_mm", primary.thickness);
      data.set("width_cm", String(primary.width));
      data.set("height_cm", String(primary.height));
      data.set("pricing_size_cm", String(primary.pricingSize));
      data.set(
        "quantity",
        String(orderItems.reduce((sum, item) => sum + item.quantity, 0)),
      );
      data.set("print_sides", String(primary.sides));
      data.set("hardware_code", primary.hardwareCode);
      data.set("hardware_name", primary.hardwareName);
      data.set("hardware_color", primary.hardwareColor);
      data.set("packaging_type", primary.packaging);
      data.set("estimated_unit_price", String(primary.unitPrice));
      data.set("estimated_subtotal", String(productSubtotal));
    data.set("vat_applied", includeVat ? "1" : "0");
    data.set("rush_mode", rushMode);
    data.set("requested_speed_days", String(Math.max(0, requestedSpeedDays || 0)));
    data.set("delivery_tier", deliveryTier);
    data.set("rush_fee", String(Math.max(0, Number.isFinite(rushFee) ? rushFee : 0).toFixed(2)));
    data.set("rush_note", rushNote.trim());
    data.set("vat_amount", String(vatAmount));
      data.set("estimated_total", String(grandTotal));
      data.set("shipping_fee", String(shippingFee));
      data.set("payment_status", paymentStatus);
      data.set("deposit_amount", String(receivedAmount));
      const response = await fetch("/api/orders", {
        method: "POST",
        body: data,
      });
      const result = (await response.json()) as {
        orderNumber?: string;
        publicToken?: string;
        error?: string;
      };
      if (!response.ok || !result.orderNumber || !result.publicToken)
        throw new Error(result.error || "ไม่สามารถสร้างใบสั่งงานได้");
      setOrderNo(result.orderNumber);
      setPublicToken(result.publicToken);
      setSubmitted(true);
      setTimeout(
        () =>
          document
            .getElementById("order-result")
            ?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "ไม่สามารถสร้างใบสั่งงานได้",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="k2studioSite">
      <div className="studioTopline">CUSTOM เริ่ม 1 ชิ้น</div>
      <nav className="studioNav">
        <a className="brand" href="#top">
          <img src="/assets/k2studio/k2studio-logo-new.jpg" alt="K2STUDIO" />
        </a>
        <div className="navlinks">
          {canCreateOrder ? (
            <>
              <a className="active" href="#quote">สร้างใบสั่งงาน</a>
              <a href="/admin#orders">รายการใบงาน</a>
              {canManagePricing && <a href="/admin/pricing">จัดการราคา</a>}
              {canManageUsers && <a href="/admin/users">ผู้ใช้งาน</a>}
            </>
          ) : (
            <>
              <a href="#products">สินค้า</a>
              <a href="/price-list">ตารางราคาพวงกุญแจ</a>
              <a href="/shop">สั่งสินค้า</a>
              <a href="#products">เลือกตามการใช้งาน</a>
              <a href="#portfolio">ผลงาน</a>
              <a href="#how">วิธีสั่งผลิต</a>
              <a href="#about">เกี่ยวกับเรา</a>
            </>
          )}
        </div>
        <div className="navActions">
          {canCreateOrder ? (
            <>
              <span className="staffNavName" aria-label={`ผู้ใช้งาน ${staffName || "ทีมงาน"}`}>
                {staffName || "ทีมงาน"}
              </span>
              <a className="staffAccess" href="/admin">
                กลับหน้าหลังบ้าน
              </a>
            </>
          ) : (
            <>
              <a
                className="staffAccess"
                href="/admin/login?returnTo=%2Fadmin%2Forders%2Fnew"
                aria-label="เข้าสู่ระบบหลังบ้านสำหรับทีมงาน"
              >
                Staff Login
              </a>
              <a className="lineBtn studioQuoteButton" href="https://line.me/R/ti/p/@k2sign">
                ส่งโจทย์ขอราคา
              </a>
            </>
          )}
        </div>
      </nav>

      <section className="k2CommerceHero" id="top" aria-labelledby="k2-commerce-title">
        <header className="k2CommerceHead">
          <img src="/assets/k2studio/k2studio-logo-new.jpg" alt="K2STUDIO" />
          <div>
            <a href="#products" aria-label="ค้นหาและดูสินค้า"><K2Icon name="search" /></a>
            <a href="#quote" className="k2CartButton" aria-label={`รายการที่เลือก ${items.length} รายการ`}><K2Icon name="cart" />{items.length > 0 && <i>{items.length}</i>}</a>
            <a href="#products" className="k2MenuButton" aria-label="เปิดเมนูสินค้า"><K2Icon name="menu" /></a>
          </div>
        </header>
        <div className="k2CommerceBody">
          <div className="k2CommerceCopy">
            <h1 id="k2-commerce-title">ไอเดียของคุณ_<br/>กลายเป็นของจริงได้</h1>
            <p>พวงกุญแจอะคริลิก สั่งทำได้ ไม่มีขั้นต่ำ<br/>ดีไซน์ได้ในแบบคุณ</p>
            <span>Make<br/>It Yours!</span>
          </div>
          <div className="k2CommerceProduct">
            <button type="button" aria-label="ดูแบบก่อนหน้า" onClick={() => setFeaturedSlide((featuredSlide + featuredProductImages.length - 1) % featuredProductImages.length)}><K2Icon name="chevron" /></button>
            <img src={featuredProductImages[featuredSlide]} alt="ตัวอย่างพวงกุญแจอะคริลิก K2STUDIO" />
            <button type="button" aria-label="ดูแบบถัดไป" onClick={() => setFeaturedSlide((featuredSlide + 1) % featuredProductImages.length)}><K2Icon name="chevron" /></button>
            <em>ชิ้นเดียว<br/>ก็พิเศษได้</em>
          </div>
          <div className="k2CommerceDots" aria-label={`แบบที่ ${featuredSlide + 1} จาก ${featuredProductImages.length}`}>{featuredProductImages.map((_, index) => <button type="button" key={index} className={featuredSlide === index ? "active" : ""} onClick={() => setFeaturedSlide(index)} aria-label={`ดูแบบที่ ${index + 1}`} />)}</div>
          <section className="k2CommerceConfig" aria-labelledby="featured-hardware-title">
            <div className="k2CommerceConfigTitle"><h2 id="featured-hardware-title">เลือกอะไหล่</h2><a href="#quote">ดูครบ 17 แบบและเลือกสี →</a></div>
            <div>{featuredHardwareCodes.map((code) => {
              const option = HARDWARE.find((entry) => entry.code === code)!;
              return <button type="button" key={code} className={hardware === code ? "active" : ""} onClick={() => { selectHardware(code); setFeaturedAdded(false); }}>
                <span><img src={hardwareImagePath(code)} alt="" />{hardware === code && <K2Icon name="check" />}</span>
                <small>{option.name.replace(/\s\d.+$/, "")}</small>
              </button>;
            })}</div>
          </section>
          <section className="k2CommerceOrder">
            <div><small>จำนวน</small><p><button type="button" aria-label="ลดจำนวน" onClick={() => { setQuantity(Math.max(1, quantity - 1)); setQuoteTouched(true); setFeaturedAdded(false); }}><K2Icon name="minus" /></button><strong>{quantity.toLocaleString("th-TH")}</strong><button type="button" className="plus" aria-label="เพิ่มจำนวน" onClick={() => { setQuantity(quantity + 1); setQuoteTouched(true); setFeaturedAdded(false); }}><K2Icon name="plus" /></button></p></div>
            <div><small>ราคาต่อชิ้น</small><p><strong>฿{money(quote.unit)}</strong>{quote.unit > 0 && quote.unit < 50 && <><del>฿50</del><span>-{Math.round((50 - quote.unit) / 50 * 100)}%</span></>}</p></div>
          </section>
          <button type="button" className={`k2CommerceCta ${featuredAdded ? "done" : ""}`} onClick={addFeaturedItem}><i><K2Icon name={featuredAdded ? "check" : "cart"} /></i><span>{featuredAdded ? `เพิ่มแล้ว · ฿${money(quote.total)}` : "เพิ่มลงรายการ"}</span><i><K2Icon name="chevron" /></i></button>
          <div className="k2CommerceTrust"><span><K2Icon name="shield"/>งานคุณภาพ</span><span><K2Icon name="truck"/>จัดส่งทั่วไทย</span><span><K2Icon name="smile"/>สร้างได้ทุกไอเดีย</span></div>
        </div>
      </section>

      <section className="trust studioTrust" id="about">
        <div>
          <strong>1+</strong>
          <span>Custom เริ่มได้ตั้งแต่ 1 ชิ้น</span>
        </div>
        <div>
          <strong>UV</strong>
          <span>สีสด คมชัด รองรับหลายวัสดุ</span>
        </div>
        <div>
          <strong>QC</strong>
          <span>ตรวจงานก่อนส่งทุกออเดอร์</span>
        </div>
        <div>
          <strong>ครบ</strong>
          <span>ช่วยเลือกสินค้า พิมพ์ และแพ็ก</span>
        </div>
      </section>

      <section className="products studioProducts" id="products">
        <div className="sectionHead">
          <span>PRODUCT COLLECTION</span>
          <h2>เลือกสินค้าที่ใช่<br />ให้แบรนด์ของคุณ</h2>
          <p>รวมสินค้าสั่งทำสำหรับของแจกองค์กร งานอีเวนต์ ร้านค้า และแบรนด์ที่ต้องการเริ่มจากจำนวนน้อย</p>
        </div>
        <div className="studioCategoryGrid">
          {studioCategories.map((category) => (
            <a className="studioCategoryCard" href={category.href} key={category.title}>
              <img src={category.image} alt={`ตัวอย่าง${category.title} K2STUDIO`} />
              <span>{category.title}</span>
            </a>
          ))}
        </div>
      </section>

      <PortfolioGallery />

      <section className="builder" id="quote" ref={formRef}>
        <div className="sectionHead">
          <span>INSTANT QUOTE</span>
          <h2>
            {canCreateOrder ? "เลือกสินค้าและสเปก" : "คำนวณราคาเบื้องต้น"}
            <br />
            {canCreateOrder ? "สร้างใบงานได้ในที่เดียว" : "ก่อนติดต่อทีม K2STUDIO"}
          </h2>
          <p>{canCreateOrder ? "พวงกุญแจคำนวณราคาอัตโนมัติ ส่วนงานสั่งทำอื่น ๆ ให้ทีมงานระบุรายละเอียดและราคาเอง" : "เลือกขนาด จำนวน รูปแบบการพิมพ์ และอะไหล่ เพื่อดูราคาประเมินได้ทันที"}</p>
          <a className="priceListShortcut" href="/price-list">ดูตารางราคาพวงกุญแจทุกขนาดและจำนวน →</a>
        </div>
        <div className="builderGrid">
          <div className="config">
            <div className="progress">
              <i></i>
              <span>01 สินค้า</span>
              <span>02 รายละเอียด</span>
              <span>03 สรุป</span>
            </div>
            {canCreateOrder && <div className="productTypePicker" role="group" aria-label="เลือกประเภทสินค้า">
              <button
                type="button"
                className={productType === "acrylic_keychain" ? "active" : ""}
                onClick={() => { setProductType("acrylic_keychain"); setQuoteTouched(false); setItemError(""); }}
              >
                <b>พวงกุญแจอะคริลิก</b>
                <span>เลือกสเปกและคำนวณราคาอัตโนมัติ</span>
              </button>
              <button
                type="button"
                className={productType === "custom" ? "active" : ""}
                onClick={() => { setProductType("custom"); setItemError(""); }}
              >
                <b>งานสั่งทำอื่น ๆ</b>
                <span>ทีมงานกรอกชื่อ รายละเอียด จำนวน และราคา</span>
              </button>
            </div>}
            {productType === "acrylic_keychain" ? <>
            <fieldset>
              <legend>
                <b>01</b> เลือกความหนา
              </legend>
              <div className="choice2">
                <label className={thickness === "2.5" ? "selected" : ""}>
                  <input
                    type="radio"
                    checked={thickness === "2.5"}
                    onChange={() => { setThickness("2.5"); setQuoteTouched(true); }}
                  />
                  2.5 มม.<small>รุ่นมาตรฐาน • เบา คล่องตัว</small>
                </label>
                <label className={thickness === "3" ? "selected" : ""}>
                  <input
                    type="radio"
                    checked={thickness === "3"}
                    onChange={() => { setThickness("3"); setQuoteTouched(true); }}
                  />
                  3 มม.<small>รุ่นพรีเมียม • หนา แข็งแรง</small>
                </label>
              </div>
            </fieldset>
            <fieldset>
              <legend>
                <b>02</b> ระบุขนาดและจำนวน
              </legend>
              <div className="inputs">
                <label>
                  กว้าง (ซม.)
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={width}
                    onChange={(e) => { setWidth(+e.target.value); setQuoteTouched(true); }}
                  />
                </label>
                <span>×</span>
                <label>
                  สูง (ซม.)
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={height}
                    onChange={(e) => { setHeight(+e.target.value); setQuoteTouched(true); }}
                  />
                </label>
                <label>
                  จำนวน (ชิ้น)
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => { setQuantity(Math.max(1, +e.target.value)); setQuoteTouched(true); }}
                  />
                </label>
              </div>
              <div className="sizeNote">
                ขนาดที่ใช้คิดราคา <strong>{quote.size} ซม.</strong>
                {quote.size > 10 && <span> • กรุณาติดต่อเจ้าหน้าที่</span>}
              </div>
            </fieldset>
            <fieldset>
              <legend>
                <b>03</b> จำนวนหน้าพิมพ์
              </legend>
              <div className="seg">
                <button
                  className={sides === 1 ? "active" : ""}
                  onClick={() => { setSides(1); setQuoteTouched(true); }}
                >
                  พิมพ์ 1 หน้า
                </button>
                <button
                  className={sides === 2 ? "active" : ""}
                  onClick={() => { setSides(2); setQuoteTouched(true); }}
                >
                  พิมพ์ 2 หน้า
                </button>
              </div>
            </fieldset>
            <fieldset>
              <legend>
                <b>04</b> เลือกอะไหล่
              </legend>
              <p className="fieldHint">
                ภาพใช้ดูรูปทรงอะไหล่เป็นตัวอย่าง สีจริงให้ยึดตามตัวเลือกใต้รหัส
              </p>
              <div className="hardwareChoices visualChoices">
                {HARDWARE.map((h) => (
                  <article
                    key={h.code}
                    className={hardware === h.code ? "active" : ""}
                  >
                    <button
                      type="button"
                      className="hardwarePick"
                      onClick={() => selectHardware(h.code)}
                    >
                      <div className="materialPhoto">
                        <img
                          src={hardwareImagePath(h.code)}
                          alt={`ภาพตัวอย่างรูปทรงอะไหล่รหัส ${h.code} ${h.name}`}
                        />
                        <i>{h.code}</i>
                      </div>
                      <div className="hardwareInfo">
                        <span>{h.name}</span>
                        <small>
                          {(hardwarePrices[h.code] ?? h.price) === null
                            ? "ประเมินราคา"
                            : (hardwarePrices[h.code] ?? h.price) === 0
                              ? "ฟรี"
                              : `+${hardwarePrices[h.code] ?? h.price} บาท`}
                        </small>
                      </div>
                    </button>
                    <div className="pdfVariants">
                      <span>เลือกสี / รูปแบบที่ต้องการ</span>
                      <div>
                        {(HARDWARE_VARIANTS[h.code] || []).map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={
                              hardware === h.code && hardwareColor === color
                                ? "active"
                                : ""
                            }
                            onClick={() => {
                              setQuoteTouched(true);
                              setHardware(h.code);
                              setHardwareColor(color);
                            }}
                          >
                            <i className="hardwareColorSwatch" style={{ backgroundColor: hardwareColorSwatch(color) }} aria-hidden="true" />{color}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="selectedHardwareRef">
                <img
                  src={hardwareImagePath(hardware)}
                  alt={`ภาพตัวอย่างรูปทรงอะไหล่รหัส ${hardware}`}
                />
                <div>
                  <span>รูปทรงตัวอย่าง · สีที่สั่งตามตัวเลือกด้านล่าง</span>
                  <b>
                    รหัส {hardware} — <i className="hardwareColorSwatch" style={{ backgroundColor: hardwareColorSwatch(hardwareColor) }} aria-hidden="true" /> {hardwareColor}
                  </b>
                  <p>{selected.name}</p>
                </div>
              </div>
            </fieldset>
            <fieldset>
              <legend>
                <b>05</b> เลือกแพ็กเกจ
              </legend>
              <select
                value={packaging}
                onChange={(e) => { setPackaging(e.target.value); setQuoteTouched(true); }}
              >
                <option value="standard">ซองใสมาตรฐาน — รวมในราคา</option>
                <option value="none">ไม่รับแพ็ก</option>
                <option value="backing">
                  การ์ดรองหลัง — เจ้าหน้าที่ประเมิน
                </option>
                <option value="custom">
                  แพ็กเกจสั่งทำพิเศษ — เจ้าหน้าที่ประเมิน
                </option>
              </select>
            </fieldset>
            </> : <>
              <fieldset className="customProductFields">
                <legend><b>01</b> ชื่อและรายละเอียดสินค้า</legend>
                <label>
                  ชื่อสินค้า *
                  <input
                    value={customName}
                    maxLength={100}
                    placeholder="เช่น ป้ายอะคริลิกตั้งโต๊ะ"
                    onChange={(e) => { setCustomName(e.target.value); setItemError(""); }}
                  />
                </label>
                <label>
                  รายละเอียดงาน *
                  <textarea
                    value={customDescription}
                    maxLength={1000}
                    rows={5}
                    placeholder="ระบุขนาด วัสดุ สี วิธีพิมพ์ การแพ็ก หรือข้อมูลสำคัญสำหรับฝ่ายผลิต"
                    onChange={(e) => { setCustomDescription(e.target.value); setItemError(""); }}
                  />
                </label>
              </fieldset>
              <fieldset className="customProductFields">
                <legend><b>02</b> จำนวนและราคาขาย</legend>
                <div className="inputs customPriceInputs">
                  <label>
                    จำนวน *
                    <input
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      value={customQuantity}
                      onChange={(e) => setCustomQuantity(Math.max(1, Math.floor(+e.target.value || 1)))}
                    />
                  </label>
                  <label>
                    ราคาต่อหน่วย (บาท) *
                    <input
                      type="number"
                      min="0"
                      max="10000000"
                      step="0.01"
                      value={customUnitPrice}
                      onChange={(e) => setCustomUnitPrice(Math.max(0, +e.target.value || 0))}
                    />
                  </label>
                  <div className="customLineTotal">
                    <span>รวมรายการนี้</span>
                    <b>฿{money(currentItem.lineTotal)}</b>
                  </div>
                </div>
                <p className="staffOnlyNote">สำหรับทีมงานที่เข้าสู่ระบบเท่านั้น ระบบจะบันทึกราคาตามที่กรอกโดยไม่ใช้ตารางราคาพวงกุญแจ</p>
              </fieldset>
            </>}
          </div>
          <aside className="summary">
            <span className="summaryTag">PRICE SUMMARY</span>
            <h3>สรุปราคาโดยประมาณ</h3>
            {!currentItemValid ? (
              <div className="quoteEmptyState">
                <i>01</i>
                <b>{productType === "acrylic_keychain" ? "เลือกสเปกเพื่อเริ่มคำนวณ" : "กรอกข้อมูลสินค้าให้ครบ"}</b>
                <p>ระบบจะแสดงราคาจริงจากข้อมูลที่คุณเลือก โดยไม่ใส่ยอดตัวอย่างล่วงหน้า</p>
              </div>
            ) : productType === "acrylic_keychain" && quote.manual ? (
              <div className="manual">
                <b>ต้องประเมินราคาเพิ่มเติม</b>
                <p>สเปกนี้มีรายการพิเศษ กรุณาส่งรายละเอียดให้เจ้าหน้าที่</p>
              </div>
            ) : (
              <>
                <dl>
                  {productType === "custom" ? <>
                    <div><dt>สินค้า</dt><dd>{customName.trim() || "ยังไม่ระบุ"}</dd></div>
                    <div><dt>จำนวน</dt><dd>{customQuantity.toLocaleString()} หน่วย</dd></div>
                    <div><dt>ราคาต่อหน่วย</dt><dd>{money(customUnitPrice)} บาท</dd></div>
                  </> : <>
                    <div><dt>ราคาฐาน</dt><dd>{money(quote.base)} บาท</dd></div>
                    <div><dt>พิมพ์เพิ่ม</dt><dd>{money(quote.print)} บาท</dd></div>
                    <div><dt>อะไหล่ {hardware}</dt><dd>{money(quote.hardware)} บาท</dd></div>
                    <div><dt>แพ็กเกจ</dt><dd>รวมแล้ว</dd></div>
                  </>}
                  {includeVat && (
                    <div>
                      <dt>VAT 7%</dt>
                      <dd>{money(vatAmount)} บาท</dd>
                    </div>
                  )}
                </dl>
                <div className="unit">
                  <span>{summaryItem.productType === "custom" ? "ราคาต่อหน่วย" : "ราคาต่อชิ้น"}</span>
                  <strong>฿{money(summaryItem.unitPrice)}</strong>
                </div>
                <div className="total">
                  <span>
                    {`${effectiveItems.length} รายการ • ${money(totalQuantity)} ${totalUnitLabel}`}
                  </span>
                  <strong>฿{money(grandTotal)}</strong>
                </div>
              </>
            )}
            {canCreateOrder ? <>
            <div className="multiItemBuilder">
              <button type="button" onClick={addCurrentItem}>
                + เพิ่มรายการนี้ในใบสั่งงาน
              </button>
              {itemError && <small className="itemBuilderError">{itemError}</small>}
              {items.length > 0 && (
                <div className="orderItemDrafts">
                  {items.map((item, index) => (
                    <div className="orderItemDraftCard" key={`${item.itemName}-${index}`}>
                      {item.productType === "acrylic_keychain" ? (
                        <img src={hardwareImagePath(item.hardwareCode)} alt={`อะไหล่ ${item.hardwareCode} ของรายการ ${index + 1}`} />
                      ) : (
                        <i className="customItemMark">CUSTOM</i>
                      )}
                      <span>
                        <b>{index + 1}</b>
                        {item.itemName} • {item.quantity.toLocaleString()} {item.productType === "custom" ? "หน่วย" : "ชิ้น"}
                        <small>
                          {item.productType === "custom"
                            ? item.description
                            : `${item.width} × ${item.height} ซม. • ${item.thickness} มม. • ${item.hardwareCode} ${item.hardwareColor}`}
                        </small>
                      </span>
                      <strong>฿{money(item.lineTotal)}</strong>
                      <button
                        type="button"
                        aria-label={`ลบรายการ ${index + 1}`}
                        onClick={() =>
                          setItems((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <small>
                {hasPendingItem
                  ? "สเปกที่กำลังกรอกจะถูกเพิ่มเป็นรายการถัดไปอัตโนมัติเมื่อส่งแบบฟอร์ม"
                  : items.length
                    ? "ปรับสเปกด้านซ้ายเพื่อใส่ไซซ์ถัดไป ระบบจะรวมรายการล่าสุดให้อัตโนมัติ"
                  : "ถ้ามีไซซ์เดียว ไม่ต้องกดเพิ่ม ระบบจะใช้สเปกปัจจุบันอัตโนมัติ"}
              </small>
            </div>
            <button
              onClick={() =>
                document
                  .getElementById("order")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              สร้างใบสั่งงาน <b>→</b>
            </button>
            <small>* เมื่อเลือก VAT ระบบคิด 7% จากค่าสินค้าและค่าจัดส่ง</small>
            </> : <div className="publicQuoteNotice">
              <b>ราคาประเมินเบื้องต้น</b>
              <span>ราคาสุดท้ายขึ้นอยู่กับไฟล์งานและรายละเอียดการผลิต</span>
              <a href="https://line.me/R/ti/p/@k2sign">สอบถามทีม K2STUDIO ผ่าน LINE →</a>
            </div>}
          </aside>
        </div>
      </section>

      <section className="ready">
        <div>
          <span>READY TO GO</span>
          <h2>
            รับสินค้าแล้ว
            <br />
            <em>พร้อมใช้ทันที</em>
          </h2>
          <p>
            เราประกอบ ตรวจ QC และแพ็กเรียบร้อย ลูกค้านำไปแจก ขาย
            หรือใช้งานได้ทันที
          </p>
        </div>
        <div className="readySteps">
          {[
            ["01", "พิมพ์ UV", "สีสดพร้อมหมึกขาว"],
            ["02", "ไดคัท", "ตามรูปทรงของคุณ"],
            ["03", "ประกอบ", "อะไหล่ที่เลือก"],
            ["04", "QC & PACK", "ตรวจและแพ็กทุกชิ้น"],
          ].map((x) => (
            <article key={x[0]}>
              <b>{x[0]}</b>
              <h3>{x[1]}</h3>
              <p>{x[2]}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="hardware" className="catalog">
        <div className="sectionHead">
          <span>REAL K2SIGN HARDWARE</span>
          <h2>เลือกอะไหล่จากภาพจริง</h2>
          <p>ภาพและรหัสจาก Master Catalog ของ K2SIGN โดยตรง</p>
        </div>
        <div className="catalogGrid">
          {catalogImages.map((x, i) => (
            <figure key={x}>
              <img
                src={`/assets/hardware-${x}.jpg`}
                alt={`แคตตาล็อกอะไหล่ K2SIGN หน้า ${i + 1}`}
              />
              <figcaption>
                ชุดอะไหล่ K2SIGN •{" "}
                {i === 0
                  ? "F–G"
                  : i === 1
                    ? "H"
                    : i === 2
                      ? "B–C"
                      : i === 3
                        ? "D–E"
                        : i === 4
                          ? "H–P"
                          : i === 5
                            ? "C–Q"
                            : i === 6
                              ? "M–N"
                              : "J–R"}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="how" className="how">
        <div className="sectionHead">
          <span>SIMPLE PROCESS</span>
          <h2>
            จากไฟล์ของคุณ
            <br />
            สู่งานพร้อมใช้
          </h2>
        </div>
        <div className="timeline">
          {[
            "เลือกสเปกและคำนวณราคา",
            "อัปโหลดไฟล์งาน",
            "เจ้าหน้าที่ตรวจไฟล์และยืนยัน",
            "ผลิต • QC • แพ็ก • จัดส่ง",
          ].map((x, i) => (
            <div key={x}>
              <b>0{i + 1}</b>
              <h3>{x}</h3>
            </div>
          ))}
        </div>
      </section>

      {canCreateOrder && <>
      <section id="order" className="order">
        <div className="sectionHead">
          <span>ORDER REQUEST</span>
          <h2>ส่งข้อมูลเพื่อเปิดงาน</h2>
          <p>
            กรอกข้อมูลและแนบสลิปได้ทันที
            ใบสั่งงานจะออกหลังทีมตรวจสอบการชำระเงินแล้ว
          </p>
        </div>
        <form onSubmit={submit}>
          <div className="formGrid">
            <label>
              ชื่อผู้ติดต่อ / บริษัท *
              <input required name="name" autoComplete="name" />
            </label>
            <label>
              เบอร์โทรศัพท์ *
              <input
                required
                type="tel"
                name="phone"
                inputMode="tel"
                pattern="[0-9+() -]{8,20}"
                title="กรอกเบอร์โทรศัพท์ 8–15 หลัก"
                autoComplete="tel"
              />
            </label>
            <label>
              LINE ID
              <input name="line" />
            </label>
            <label>
              อีเมล
              <input type="email" name="email" autoComplete="email" />
            </label>
            <label>
              เพจ / ช่องทางขาย *
              <select name="contact_channel" required>
                <option value="">เลือกเพจก่อนสร้างใบงาน</option>
                {salesChannels.map((channel)=><option key={channel.code} value={channel.code}>{channel.prefix} — {channel.name}</option>)}
              </select>
              <small className="inputHelp">ระบบจะสร้างเลขใบงานตามช่องทาง เช่น K2-1234</small>
            </label>
            <label>
              เซลล์ผู้รับผิดชอบ *
              <select name="sales_owner_id" required defaultValue={staffId ? String(staffId) : ""}>
                <option value="">เลือกเซลล์ผู้ดูแลใบงาน</option>
                {salesUsers.map((sales) => <option key={sales.id} value={sales.id}>{sales.name} (@{sales.username})</option>)}
              </select>
              <small className="inputHelp">ระบบเลือกผู้ที่กำลังล็อกอินให้ และสามารถแก้ไขย้อนหลังได้</small>
            </label>
            <label>
              ชื่อ Facebook / LINE ของลูกค้า
              <input
                name="social_contact_name"
                placeholder="เช่น Somchai Design หรือ @somchai"
              />
            </label>
            <label className="wide">
              ที่อยู่จัดส่ง
              <textarea name="address" rows={3} autoComplete="street-address" />
            </label>
            <label>
              จังหวัด
              <input name="province" autoComplete="address-level1" />
            </label>
              <section
                className="deliveryDateCard wide"
                aria-labelledby="delivery-date-title"
              >
              <div>
                <span>DELIVERY DATE</span>
                <h2 id="delivery-date-title">กำหนดส่งงาน</h2>
                <p>วันที่ทีมงานต้องจัดส่งหรือส่งมอบงานให้ลูกค้า</p>
              </div>
                  <label>
                    เลือกวันที่ส่งงาน *
                  <input
                    required
                    type="date"
                    name="requested_date"
                    min={todayInputMin}
                    value={requestedDate}
                    onChange={(event) => setRequestedDate(event.target.value)}
                  />
                  <small className="inputHelp">ระบบจะคำนวณค่าบริการเร่งตามวันที่ที่เลือก (กดแพ็กเกจหรือตั้งเองได้)</small>
                </label>
              </section>
              <section
                className="frontFinancial wide"
                aria-labelledby="rush-option-title"
              >
                <div>
                  <span>RUSH QUEUE</span>
                  <h2 id="rush-option-title">ตัวเลือกเร่งคิว</h2>
                  <p>ทีมงานจะเห็นข้อมูลนี้ตอนจัดคิวและหน้าจอฝ่ายผลิต</p>
                </div>
                <div className="frontFinancialInputs">
                  <label className="wide">
                    เลือกวันส่งเร็ว + ราคา
                    <p className="inputHelp">กดแพ็กเกจด้านล่างได้ทันที หรือกำหนดเอง</p>
                    <div className="rushPackageGrid">
                      {rushPackages.map((pack) => (
                        <button
                          key={pack.id}
                          type="button"
                          className={`rushPackageButton ${selectedRushPackage.id === pack.id ? "selected" : ""}`}
                          onClick={() => applyRushPackage(pack.id, true)}
                        >
                          <strong>{pack.title}</strong>
                          <span>{pack.requestDays ? `เร่ง ${pack.requestDays} วัน` : "รับตามคิวปกติ"}</span>
                          <b>{money(pack.fee)} บาท</b>
                          <small>{pack.description}</small>
                        </button>
                      ))}
                    </div>
                  </label>
                  <label>
                    โหมดเร่งคิว
                    <select
                      value={rushMode}
                      onChange={(e) =>
                        setRushModeManually(e.target.value as "normal" | "urgent")
                      }
                    >
                      <option value="normal">ปกติ</option>
                      <option value="urgent">เร่งด่วน</option>
                    </select>
                  </label>
                <label>
                    ลดเวลา (วัน)
                    <input
                      type="number"
                      min="0"
                      max="365"
                      step="1"
                      value={requestedSpeedDays}
                      onChange={(e) =>
                        setRushDaysManually(Number(e.target.value) || 0)
                      }
                    />
                  </label>
                  <label>
                    วันอีกกี่วันจากวันนี้
                    <input type="text" value={requestedDateOffsetDays} readOnly />
                  </label>
                  <label>
                    แพ็กเกจเร่ง
                    <select
                      value={deliveryTier}
                      onChange={(e) => setRushTierManually(e.target.value)}
                    >
                      <option value="">ไม่ระบุ</option>
                      <option value="express_1">เร่งด่วน</option>
                      <option value="express_3">ด่วนมาก</option>
                      <option value="express_2">ด่วนพิเศษ</option>
                    </select>
                  </label>
                  <label>
                    ค่าบริการเร่งคิว (บาท)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rushFee}
                      onChange={(e) => setRushFeeManually(Number(e.target.value) || 0)}
                    />
                  </label>
                  <label className="wide">
                    หมายเหตุการเร่ง
                    <textarea
                      value={rushNote}
                      onChange={(e) => setRushNote(e.target.value)}
                      rows={2}
                      maxLength={400}
                    />
                  </label>
                </div>
              </section>
              <section
                className="frontFinancial wide"
                aria-labelledby="front-financial-title"
              >
              <div>
                <span>PAYMENT DETAIL</span>
                <h2 id="front-financial-title">ค่าส่งและการชำระเงิน</h2>
                <p>เลือกสถานะการชำระให้ตรงกับเงินจริง ระบบจะแสดงยอดค้างในใบงานอัตโนมัติ</p>
              </div>
              <div className="frontFinancialInputs">
                <label>
                  ค่าจัดส่ง (บาท)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingFee}
                    onChange={(e) =>
                      setShippingFee(Math.max(0, +e.target.value || 0))
                    }
                  />
                </label>
                {paymentStatus === "deposit" && <label>
                  ยอดมัดจำที่รับแล้ว (บาท) *
                  <input
                    required
                    type="number"
                    min="0.01"
                    max={Math.max(0, payableTotal - 0.01)}
                    step="0.01"
                    value={depositAmount || ""}
                    onChange={(e) =>
                      setDepositAmount(
                        Math.min(
                          Math.max(0, payableTotal - 0.01),
                          Math.max(0, +e.target.value || 0),
                        ),
                      )
                    }
                    placeholder="กรอกยอดที่รับจริง"
                  />
                </label>}
              </div>
              <fieldset className="paymentStatusSelector">
                <legend>สถานะการชำระเงิน *</legend>
                <label className={paymentStatus === "paid_full" ? "selected" : ""}>
                  <input required type="radio" name="payment_status_choice" value="paid_full" checked={paymentStatus === "paid_full"} onChange={() => setPaymentStatus("paid_full")} />
                  <span><b>ชำระเต็มจำนวน</b><small>รับครบ ฿{money(payableTotal)}</small></span>
                </label>
                <label className={paymentStatus === "deposit" ? "selected" : ""}>
                  <input required type="radio" name="payment_status_choice" value="deposit" checked={paymentStatus === "deposit"} onChange={() => setPaymentStatus("deposit")} />
                  <span><b>ชำระมัดจำ</b><small>กรอกยอดที่รับจริงและแสดงยอดค้าง</small></span>
                </label>
                <label className={paymentStatus === "unpaid" ? "selected" : ""}>
                  <input required type="radio" name="payment_status_choice" value="unpaid" checked={paymentStatus === "unpaid"} onChange={() => setPaymentStatus("unpaid")} />
                  <span><b>ยังไม่ชำระ</b><small>ยอดค้าง ฿{money(payableTotal)}</small></span>
                </label>
              </fieldset>
              {paymentStatus !== "unpaid" && paymentStatus !== "" && <label className="upload paymentSlipUpload frontPaymentSlip">
                <span>{paymentStatus === "deposit" ? "แนบสลิปยอดมัดจำ *" : "แนบสลิปชำระเต็มจำนวน *"}</span>
                <input
                  required
                  type="file"
                  name="payment_slip"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setPaymentSlipName(event.target.files?.[0]?.name || "")}
                />
                <small>อยู่ในส่วนการชำระเงินโดยตรง • PNG, JPG หรือ WEBP • ไม่เกิน 8 MB</small>
                {paymentSlipName && <div className="fileReady"><b>✓</b><span>เลือกแล้ว: {paymentSlipName}</span></div>}
              </label>}
              <dl>
                <div>
                  <dt>ฐานภาษี (รวมอะไหล่และค่าส่ง)</dt>
                  <dd>฿{money(productSubtotal + shippingFee)}</dd>
                </div>
                <div>
                  <dt>ค่าบริการเร่ง</dt>
                  <dd>฿{money(rushServiceFee)}</dd>
                </div>
                <div>
                  <dt>{includeVat ? "ยอดสุทธิรวม VAT" : "ยอดสุทธิ (ไม่คิด VAT)"}</dt>
                  <dd>฿{money(payableTotal)}</dd>
                </div>
                <div>
                  <dt>รับชำระแล้ว</dt>
                  <dd>฿{money(receivedAmount)}</dd>
                </div>
                <div>
                  <dt>ยอดค้างชำระ</dt>
                  <dd>฿{money(outstanding)}</dd>
                </div>
              </dl>
            </section>
            <label className="wide vatOption">
              <input
                type="checkbox"
                checked={includeVat}
                onChange={(e) => setIncludeVat(e.target.checked)}
              />
              <span>
                <b>คิด VAT 7%</b>
                <small>
                  ฐาน VAT (สินค้า + ค่าส่ง) ฿{money(productSubtotal + shippingFee)} • VAT ฿{money(vatAmount)} •
                  รวม ฿{money(payableTotal)}
                </small>
              </span>
            </label>
            <label>
              ช่องทางส่งไฟล์งาน
              <select name="file_delivery_method">
                <option value="upload">อัปโหลดในเว็บไซต์</option>
                <option value="google_drive">แนบลิงก์ Google Drive</option>
                <option value="email">ส่งไฟล์ทางอีเมล</option>
              </select>
            </label>
            <label>
              ลิงก์ Google Drive
              <input
                type="url"
                name="external_file_url"
                placeholder="https://drive.google.com/..."
              />
            </label>
            <label className="wide">
              อีเมลที่ใช้ส่งไฟล์ / หมายเหตุ
              <textarea
                name="file_delivery_note"
                rows={2}
                placeholder="เช่น ส่งจาก design@example.com หัวข้อ K2SIGN หรือแจ้งตำแหน่งไฟล์ใน Drive"
              />
            </label>
            <label className="wide upload artworkUpload">
              <span>อัปโหลดภาพตัวอย่างงาน</span>
              <input
                type="file"
                name="artwork"
                accept=".png,.jpg,.jpeg,.pdf,.ai,.psd,.zip"
                onChange={chooseArtwork}
              />
              <small>PNG, JPG, PDF, AI, PSD หรือ ZIP • ไม่เกิน 15 MB</small>
              {artworkError && <em>{artworkError}</em>}
              {artworkName && (
                <div className="fileReady">
                  <b>✓</b>
                  <span>{artworkName}</span>
                </div>
              )}
              {artworkPreview && (
                <div className="artworkPreview">
                  <img src={artworkPreview} alt="ภาพตัวอย่างงานที่อัปโหลด" />
                  <p>ภาพนี้จะแสดงในใบสั่งงานและส่งให้ทีม K2SIGN</p>
                </div>
              )}
            </label>
            <label className="wide check">
              <input required type="checkbox" /> ยอมรับว่าราคานี้เป็นราคาประเมิน
              และต้องรอเจ้าหน้าที่ตรวจไฟล์ก่อนยืนยันผลิต
            </label>
          </div>
          {submitError && (
            <div className="submitError" role="alert">
              {submitError}
            </div>
          )}
          <button
            className="submit"
            disabled={submitting || Boolean(artworkError)}
          >
            {submitting ? "กำลังบันทึกคำขอ…" : "ส่งข้อมูลเพื่อเปิดงาน"}{" "}
            {!submitting && <b>→</b>}
          </button>
        </form>
      </section>

      {submitted && (
        <section id="order-result" className="result">
          <div className="status">สถานะ 1 • รับงาน</div>
          <img
            className="resultLogo"
            src="/assets/k2sign-logo.png"
            alt="K2SIGN"
          />
          <span>เลขที่คำสั่งงาน</span>
          <h2>{orderNo}</h2>
          <p className="resultNotice">
            รับข้อมูลและสร้างใบงานแล้ว ส่งข้อความด้านล่างให้ลูกค้าเก็บลิงก์นี้ไว้
            เพื่อติดตามสถานะและอนุมัติแบบในลิงก์เดิมตลอดงาน
          </p>
          {publicToken && <CustomerShareMessage
            orderNumber={orderNo}
            trackingUrl={`${orderSystemUrl}/track/${publicToken}`}
          />}
          {artworkPreview && (
            <div className="resultArtwork">
              <span>ภาพตัวอย่างงาน</span>
              <img src={artworkPreview} alt="ภาพตัวอย่างงานในใบสั่งงาน" />
              <small>{artworkName}</small>
            </div>
          )}
          {!artworkPreview && artworkName && (
            <div className="resultFile">
              <b>ไฟล์งาน</b>
              <span>{artworkName}</span>
            </div>
          )}
          {effectiveItems.length === 1 && effectiveItems[0].productType === "acrylic_keychain" && <div className="productionHardware">
            <img
              src={hardwareImagePath(effectiveItems[0].hardwareCode)}
              alt={`ภาพจำลองอ้างอิงอะไหล่รหัส ${effectiveItems[0].hardwareCode}`}
            />
            <div>
              <span>อะไหล่สำหรับผลิต</span>
              <h3>
                รหัส {effectiveItems[0].hardwareCode} • {effectiveItems[0].hardwareColor}
              </h3>
              <p>{effectiveItems[0].hardwareName}</p>
              <small>ฝ่ายผลิตโปรดตรวจรหัส สี และภาพอ้างอิงก่อนประกอบ</small>
            </div>
          </div>}
          <div className="resultGrid">
            <p><b>รายการสินค้า</b>{effectiveItems.map((item, index) => <span key={`${itemSignature(item)}-${index}`}>{index + 1}. {item.itemName} • {money(item.quantity)} {item.productType === "custom" ? "หน่วย" : "ชิ้น"}</span>)}</p>
            <p>
              <b>จำนวนรวม</b>
              {money(totalQuantity)} {totalUnitLabel}
            </p>
            <p>
              <b>รายละเอียด</b>
              {effectiveItems.length === 1 ? (effectiveItems[0].description || (effectiveItems[0].productType === "acrylic_keychain" ? `${effectiveItems[0].thickness} มม. • ${effectiveItems[0].width} × ${effectiveItems[0].height} ซม. • พิมพ์ ${effectiveItems[0].sides} หน้า` : "ตามรายละเอียดใบงาน")) : `${effectiveItems.length} รายการ แสดงรายละเอียดครบในใบสั่งงาน`}
            </p>
            <p>
              <b>ยอดประมาณ</b>
              {quote.manual
                ? "เจ้าหน้าที่ประเมิน"
                : `฿${money(payableTotal)}${includeVat ? " (รวม VAT 7%)" : " (ไม่คิด VAT)"}`}
            </p>
          </div>
          <div className="resultActions">
            {publicToken && (
              <>
                <a
                  className="primaryResultAction"
                  href={`${orderSystemUrl}/order/${publicToken}`}
                >
                  ตรวจสอบการออกใบสั่งงาน
                </a>
                <a href={`${orderSystemUrl}/track/${publicToken}`}>
                  ติดตามสถานะด้วย QR
                </a>
              </>
            )}
            <a href="https://line.me/R/ti/p/@k2sign">ส่งรายละเอียดผ่าน LINE</a>
            <button
              onClick={() => {
                setSubmitted(false);
                setPublicToken("");
                scrollQuote();
              }}
            >
              เริ่มคำสั่งงานใหม่
            </button>
          </div>
        </section>
      )}
      </>}

      <section id="faq" className="faq">
        <div className="sectionHead">
          <span>FAQ</span>
          <h2>คำถามที่พบบ่อย</h2>
        </div>
        {[
          ["มีขั้นต่ำไหม?", "ไม่มีขั้นต่ำ เริ่มผลิตได้ตั้งแต่ 1 ชิ้น"],
          [
            "2.5 กับ 3 มม. ต่างกันอย่างไร?",
            "2.5 มม. เบาและคุ้มค่า ส่วน 3 มม. ให้สัมผัสหนาและพรีเมียมกว่า",
          ],
          [
            "ราคาในเว็บเป็นราคาสุดท้ายหรือไม่?",
            "เป็นราคาประเมินเบื้องต้น ราคาสุดท้ายยืนยันหลังเจ้าหน้าที่ตรวจไฟล์",
          ],
          [
            "ขนาดเกิน 10 ซม. ได้ไหม?",
            "ได้ กรุณาติดต่อเจ้าหน้าที่เพื่อประเมินราคาและการผลิต",
          ],
          ["รับไฟล์อะไรบ้าง?", "PNG, JPG/JPEG, PDF, AI, PSD และ ZIP"],
        ].map((x) => (
          <details key={x[0]}>
            <summary>
              {x[0]}
              <b>+</b>
            </summary>
            <p>{x[1]}</p>
          </details>
        ))}
      </section>

      <footer>
        <div className="footerBrand">
          <img src="/assets/k2studio/k2studio-logo-new.jpg" alt="K2STUDIO" />
          <p>
            PRINT • CUT • CREATE
            <br />
            สินค้าสั่งทำที่พูดแทนแบรนด์ของคุณ
          </p>
        </div>
        <div>
          <b>ติดต่อเรา</b>
          <a href="https://line.me/R/ti/p/@k2sign">LINE @k2sign</a>
          <a href="tel:0659895887">065-989-5887</a>
        </div>
        <div>
          <b>สำนักงาน</b>
          <p>
            K2STUDIO by K2SIGN MEDIA CO., LTD.
            <br />
            สำนักงานใหญ่ พระราม 9 กรุงเทพฯ
          </p>
        </div>
      </footer>
      <div className="mobileBar">
        <div>
          <small>ราคาโดยประมาณ</small>
          <b>{!currentItemValid ? "ยังไม่ได้คำนวณ" : quote.manual ? "รอประเมิน" : `฿${money(quote.total)}`}</b>
        </div>
        <button onClick={scrollQuote}>คำนวณราคา</button>
      </div>
      <a
        className="floatLine"
        href="https://line.me/R/ti/p/@k2sign"
        aria-label="ติดต่อ LINE"
      >
        LINE
      </a>
    </main>
  );
}
