"use client";

import { useState } from "react";

type OrderValue = {
  orderNumber: string;
  contactName: string;
  phone: string;
  lineId: string;
  email: string;
  contactChannel: string;
  socialContactName: string;
  salesOwnerId: number;
  fileDeliveryMethod: string;
  externalFileUrl: string;
  fileDeliveryNote: string;
  address: string;
  province: string;
  requestedDate: string;
  vatApplied: boolean;
  vatPolicyMode?: string;
  taxInvoiceRequested?: boolean;
  rushMode: string;
  requestedSpeedDays: number;
  deliveryTier: string;
  rushFee: string;
  rushNote: string;
};

type ItemValue = {
  id: number;
  lineNo: number;
  productType: string;
  itemName: string;
  description: string;
  thickness: string;
  width: number;
  height: number;
  quantity: number;
  sides: number;
  hardwareCode: string;
  hardwareName: string;
  hardwareColor: string;
  packaging: string;
};

type SalesUser = { id: number; name: string; username: string };
type SalesChannel = { code: string; name: string; prefix: string; active: number };

export default function OrderEditForm({
  orderId,
  order,
  items,
  salesUsers,
  salesChannels,
  canEditPrice,
  canEditOrderNumber,
}: {
  orderId: number;
  order: OrderValue;
  items: ItemValue[];
  salesUsers: SalesUser[];
  salesChannels: SalesChannel[];
  canEditPrice: boolean;
  canEditOrderNumber: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [numberSaving, setNumberSaving] = useState(false);
  const [numberMessage, setNumberMessage] = useState("");

  async function saveOrderNumber() {
    const field = document.querySelector<HTMLInputElement>(`#order-number-${orderId}`);
    const orderNumber = String(field?.value || "").trim().toUpperCase();
    setNumberMessage("");

    if (!/^[A-Z0-9]{2,6}-\d{4,}$/.test(orderNumber)) {
      setNumberMessage("ใช้อักษรนำหน้าช่องทาง 2–6 ตัว ตามด้วยเลขอย่างน้อย 4 หลัก");
      field?.focus();
      return;
    }

    setNumberSaving(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/number`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderNumber }),
      });
      const result = await response.json() as { error?: string };
      if (response.ok) {
        setNumberMessage("บันทึกเลขใบงานแล้ว");
        location.reload();
      } else {
        setNumberMessage(result.error || "บันทึกเลขใบงานไม่สำเร็จ");
      }
    } catch {
      setNumberMessage("เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setNumberSaving(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) || "").trim();
    const number = (name: string) => Number(data.get(name));

    const payload = {
      contactName: value("contactName"),
      phone: value("phone"),
      lineId: value("lineId"),
      email: value("email"),
      contactChannel: value("contactChannel"),
      socialContactName: value("socialContactName"),
      salesOwnerId: number("salesOwnerId"),
      fileDeliveryMethod: value("fileDeliveryMethod"),
      externalFileUrl: value("externalFileUrl"),
      fileDeliveryNote: value("fileDeliveryNote"),
      address: value("address"),
      province: value("province"),
      requestedDate: value("requestedDate"),
      vatApplied: canEditPrice ? data.get("vatApplied") === "on" : order.vatApplied,
      ...(order.vatPolicyMode ? { taxInvoiceRequested: canEditPrice ? data.get("taxInvoiceRequested") === "on" : order.taxInvoiceRequested } : {}),
      rushMode: value("rushMode"),
      requestedSpeedDays: number("requestedSpeedDays"),
      deliveryTier: value("deliveryTier"),
      rushFee: value("rushFee"),
      rushNote: value("rushNote"),
      items: items.map((item) => ({
        id: item.id,
        productType: item.productType,
        itemName: value(`item-${item.id}-name`),
        description: value(`item-${item.id}-description`),
        thickness: item.productType === "custom" ? "" : value(`item-${item.id}-thickness`),
        width: item.productType === "custom" ? 0 : number(`item-${item.id}-width`),
        height: item.productType === "custom" ? 0 : number(`item-${item.id}-height`),
        quantity: number(`item-${item.id}-quantity`),
        sides: item.productType === "custom" ? 0 : number(`item-${item.id}-sides`),
        hardwareCode: item.productType === "custom" ? "-" : value(`item-${item.id}-hardware-code`).toUpperCase(),
        hardwareName: item.productType === "custom" ? "ไม่ใช้" : value(`item-${item.id}-hardware-name`),
        hardwareColor: item.productType === "custom" ? "" : value(`item-${item.id}-hardware-color`),
        packaging: item.productType === "custom" ? "custom_order" : value(`item-${item.id}-packaging`),
      })),
    };

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/details`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (response.ok) {
        setMessage("บันทึกข้อมูลใบงานแล้ว");
        location.reload();
      } else {
        setMessage(result.error || "บันทึกไม่สำเร็จ");
      }
    } catch {
      setMessage("เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="orderEditPanel" id="order-edit">
      <summary>แก้ไขเลขและข้อมูลใบงาน</summary>
      {canEditOrderNumber && (
        <section className="orderNumberEditor">
          <h3>เลขใบงาน</h3>
          <div className="orderNumberEditorRow">
            <label>
              เลขใบงาน
              <input
                id={`order-number-${orderId}`}
                defaultValue={order.orderNumber}
                placeholder="K2-1233"
                autoCapitalize="characters"
                required
              />
              <small>ใช้อักษรนำหน้าตามช่องทางขาย ตามด้วยเลขลำดับที่ไม่ซ้ำ</small>
            </label>
            <button type="button" onClick={saveOrderNumber} disabled={numberSaving}>
              {numberSaving ? "กำลังบันทึก…" : "บันทึกเลขใบงาน"}
            </button>
          </div>
          {numberMessage && (
            <small
              className={`orderEditMessage ${numberMessage.includes("แล้ว") ? "success" : "error"}`}
            >
              {numberMessage}
            </small>
          )}
        </section>
      )}

      <form onSubmit={submit}>
        <section>
          <h3>ข้อมูลลูกค้าและการจัดส่ง</h3>
          <div className="orderEditGrid">
            <label>
              ชื่อลูกค้า / บริษัท
              <input name="contactName" defaultValue={order.contactName} required />
            </label>
            <label>
              โทรศัพท์
              <input name="phone" defaultValue={order.phone} required />
            </label>
            <label>
              LINE ID
              <input name="lineId" defaultValue={order.lineId} />
            </label>
            <label>
              อีเมล
              <input name="email" type="email" defaultValue={order.email} />
            </label>
            <label>
              เพจ / ช่องทางขาย
              <select name="contactChannel" defaultValue={order.contactChannel}>
                {salesChannels.map((channel) => (
                  <option key={channel.code} value={channel.code}>
                    {channel.prefix} — {channel.name}
                    {channel.active ? "" : " (ปิดใช้งาน)"}
                  </option>
                ))}
                <option value="line">LINE @k2sign (ข้อมูลเดิม)</option>
                <option value="other">อื่น ๆ (ข้อมูลเดิม)</option>
              </select>
            </label>
            <label>
              เซลล์ผู้รับผิดชอบ
              <select name="salesOwnerId" defaultValue={order.salesOwnerId || ""} required>
                <option value="">เลือกเซลล์</option>
                {salesUsers.map((sales) => (
                  <option key={sales.id} value={sales.id}>
                    {sales.name} (@{sales.username})
                  </option>
                ))}
              </select>
            </label>
            <label>
              ชื่อ Facebook / LINE
              <input name="socialContactName" defaultValue={order.socialContactName} />
            </label>
            <label>
              ช่องทางส่งไฟล์
              <select name="fileDeliveryMethod" defaultValue={order.fileDeliveryMethod}>
                <option value="upload">อัปโหลดในเว็บไซต์</option>
                <option value="google_drive">Google Drive</option>
                <option value="email">ส่งทางอีเมล</option>
              </select>
            </label>
            <label>
              ลิงก์ Google Drive
              <input name="externalFileUrl" type="url" defaultValue={order.externalFileUrl} />
            </label>
            <label className="wide">
              อีเมล/หมายเหตุไฟล์
              <textarea name="fileDeliveryNote" rows={2} defaultValue={order.fileDeliveryNote} />
            </label>
            <label className="wide">
              ที่อยู่จัดส่ง
              <textarea name="address" rows={3} defaultValue={order.address} />
            </label>
            <label>
              จังหวัด
              <input name="province" defaultValue={order.province} />
            </label>
            <label className="orderDueDateField">
              กำหนดส่งงาน
              <input name="requestedDate" type="date" defaultValue={order.requestedDate} required />
              <small>วันที่ต้องส่งหรือส่งมอบงานให้ลูกค้า</small>
            </label>
            <label className="orderEditFieldWide">
              โหมดเร่งคิว
              <select name="rushMode" defaultValue={order.rushMode || "normal"}>
                <option value="normal">ปกติ</option>
                <option value="urgent">เร่งด่วน</option>
              </select>
            </label>
            <label>
              จำนวนวันที่ลูกค้าต้องการลดเวลา
              <input
                name="requestedSpeedDays"
                type="number"
                min="0"
                max="365"
                step="1"
                defaultValue={order.requestedSpeedDays}
                required
              />
            </label>
            <label>
              แพ็กเกจเร่งคิว
              <select name="deliveryTier" defaultValue={order.deliveryTier || ""}>
                <option value="">ไม่ระบุแพ็กเกจ</option>
                <option value="express_1">เร่งด่วน</option>
                <option value="express_2">ด่วนมาก</option>
                <option value="express_3">ด่วนพิเศษ</option>
              </select>
            </label>
            <label>
              ค่าบริการเร่งคิว
              <input
                name="rushFee"
                type="number"
                min="0"
                step="0.01"
                defaultValue={Number(order.rushFee || "0").toString()}
                required
              />
            </label>
            <label className="wide">
              หมายเหตุการเร่ง
              <textarea
                name="rushNote"
                rows={3}
                maxLength={400}
                defaultValue={order.rushNote}
                placeholder="เช่น ลูกค้าเร่งงานก่อนวันปกติ, เงื่อนไขพิเศษ"
              />
            </label>
            {canEditPrice && (
              <label className="orderEditCheck">
                <input name={order.vatPolicyMode ? "taxInvoiceRequested" : "vatApplied"} type="checkbox" defaultChecked={order.vatPolicyMode ? order.taxInvoiceRequested : order.vatApplied} />
                {order.vatPolicyMode ? `ขอใบกำกับภาษีเต็มรูป${order.vatPolicyMode === "all_orders" ? " (ใบงานนี้บวก VAT ทุกกรณี)" : " (บวก VAT / ไม่เลือกให้บัญชีแยกเอง)"}` : "คิด VAT 7%"}
              </label>
            )}
          </div>
        </section>

        <section>
          <h3>รายการสินค้า</h3>
          {items.map((item) => (
            <fieldset key={item.id}>
              <legend>
                รายการ {item.lineNo} • {item.productType === "custom" ? "งานสั่งทำอื่น ๆ" : "พวงกุญแจอะคริลิก"}
              </legend>
              <div className="orderEditGrid">
                <label className="wide">
                  ชื่อรายการ
                  <input name={`item-${item.id}-name`} defaultValue={item.itemName} required />
                </label>
                {item.productType === "custom" ? (
                  <>
                    <label className="wide">
                      รายละเอียดงาน
                      <textarea
                        name={`item-${item.id}-description`}
                        rows={4}
                        defaultValue={item.description}
                        required
                      />
                    </label>
                    <label>
                      จำนวน (หน่วย)
                      <input
                        name={`item-${item.id}-quantity`}
                        type="number"
                        min="1"
                        max="1000000"
                        step="1"
                        defaultValue={item.quantity}
                        required
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      ความหนา
                      <select name={`item-${item.id}-thickness`} defaultValue={item.thickness}>
                        <option value="2.5">2.5 มม.</option>
                        <option value="3">3 มม.</option>
                      </select>
                    </label>
                    <label>
                      พิมพ์
                      <select name={`item-${item.id}-sides`} defaultValue={item.sides}>
                        <option value="1">1 ด้าน</option>
                        <option value="2">2 ด้าน</option>
                      </select>
                    </label>
                    <label>
                      กว้าง (ซม.)
                      <input
                        name={`item-${item.id}-width`}
                        type="number"
                        min="0.1"
                        max="100"
                        step="0.1"
                        defaultValue={item.width}
                        required
                      />
                    </label>
                    <label>
                      สูง (ซม.)
                      <input
                        name={`item-${item.id}-height`}
                        type="number"
                        min="0.1"
                        max="100"
                        step="0.1"
                        defaultValue={item.height}
                        required
                      />
                    </label>
                    <label>
                      จำนวน (ชิ้น)
                      <input
                        name={`item-${item.id}-quantity`}
                        type="number"
                        min="1"
                        max="1000000"
                        step="1"
                        defaultValue={item.quantity}
                        required
                      />
                    </label>
                    <label>
                      รหัสอะไหล่
                      <input
                        name={`item-${item.id}-hardware-code`}
                        defaultValue={item.hardwareCode}
                        required
                      />
                    </label>
                    <label className="wide">
                      ชื่ออะไหล่
                      <input
                        name={`item-${item.id}-hardware-name`}
                        defaultValue={item.hardwareName}
                        required
                      />
                    </label>
                    <label>
                      สีอะไหล่
                      <input
                        name={`item-${item.id}-hardware-color`}
                        defaultValue={item.hardwareColor}
                      />
                    </label>
                    <label>
                      บรรจุภัณฑ์
                      <input
                        name={`item-${item.id}-packaging`}
                        defaultValue={item.packaging}
                        required
                      />
                    </label>
                  </>
                )}
              </div>
            </fieldset>
          ))}
        </section>

        <button className="orderEditSave" disabled={saving}>
          {saving ? "กำลังบันทึก…" : "บันทึกข้อมูลใบงาน"}
        </button>
        {message && <small className="orderEditMessage">{message}</small>}
      </form>
    </details>
  );
}
