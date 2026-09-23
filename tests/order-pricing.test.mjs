import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateOrderTotals } from "../app/order-pricing.mjs";

test("VAT base includes product hardware, extras and shipping after discount",()=>{
 const result=calculateOrderTotals([{quantity:10,unitPrice:99},{quantity:20,unitPrice:50}],[100],50,true,100);
 assert.deepEqual(result,{itemSubtotal:1990,adjustmentsTotal:100,grossSubtotal:2090,discount:50,subtotal:2040,vatAmount:149.8,total:2189.8});
 assert.equal(result.vatAmount,(1990+100-50+100)*0.07);
});

test("VAT includes shipping while shipping is added to payable total separately",()=>{
 const result=calculateOrderTotals([{quantity:200,unitPrice:38},{quantity:200,unitPrice:49}],[],0,true,100);
 assert.equal(result.subtotal,17400);
 assert.equal(result.vatAmount,1225);
 assert.equal(result.total+100,18725);
});

test("price editing requires staff login and is audited",async()=>{
 const route=await readFile(new URL("../app/api/admin/orders/[id]/pricing/route.ts",import.meta.url),"utf8");
 assert.match(route,/if\(!user\).*401/);
 assert.doesNotMatch(route,/user\.role!=="admin"/);
 assert.match(route,/order_adjustments/);
 assert.match(route,/แก้ไขราคาใบงาน/);
});

test("customer order uses saved item prices for single and multi-item orders",async()=>{
 const page=await readFile(new URL("../app/order/[token]/page.tsx",import.meta.url),"utf8");
 assert.match(page,/productPriceRows[\s\S]*items\.length>0/);
});

test("staff can edit order details and order-specific pricing",async()=>{
 const details=await readFile(new URL("../app/api/admin/orders/[id]/details/route.ts",import.meta.url),"utf8");
 const numberRoute=await readFile(new URL("../app/api/admin/orders/[id]/number/route.ts",import.meta.url),"utf8");
 const editForm=await readFile(new URL("../app/admin/OrderEditForm.tsx",import.meta.url),"utf8");
 const pricing=await readFile(new URL("../app/api/admin/orders/[id]/pricing/route.ts",import.meta.url),"utf8");
 assert.match(details,/แก้ไขข้อมูลใบงาน/);
 assert.match(details,/pricingSpecificationChanged/);
 assert.match(details,/calculatePrice/);
 assert.match(details,/unit_price=\?,line_total=\?/);
 assert.match(details,/repricedLines/);
 assert.match(details,/user\.role\s*===\s*"admin"\s*&&\s*typeof body\.vatApplied === "boolean"/);
 assert.match(details,/vatCollectionDecision\(order\.vat_policy_mode,\s*invoiceRequested\)/);
 assert.match(details,/canManageOrderNumber\(user\.role\)/);
 assert.match(details,/เฉพาะผู้ดูแลระบบและหัวหน้างานเท่านั้นที่แก้เลขใบงานได้/);
 assert.match(details,/เลขใบงานนี้ถูกใช้งานแล้ว/);
 assert.match(details,/แก้ไขเลขใบงาน/);
 assert.match(numberRoute,/canManageOrderNumber\(user\.role\)/);
 assert.match(numberRoute,/UPDATE orders SET order_number=\?/);
 assert.match(numberRoute,/เลขใบงานนี้ถูกใช้งานแล้ว/);
 assert.match(numberRoute,/audit\(user, orderId, "แก้ไขเลขใบงาน"/);
 assert.match(editForm,/บันทึกเลขใบงาน/);
 assert.match(editForm,/\/api\/admin\/orders\/\$\{orderId\}\/number/);
 const pricingEditor=await readFile(new URL("../app/admin/PricingEditor.tsx",import.meta.url),"utf8");
 assert.match(pricingEditor,/items\.map/);
 assert.match(pricingEditor,/แก้ราคาได้แยกทุกบรรทัด/);
 assert.match(pricingEditor,/ราคาต่อชิ้นรายการ/);
 assert.match(pricingEditor,/รวมรายการ/);
 assert.match(pricingEditor,/ยอดสุทธิ/);
 assert.match(pricingEditor,/รวมสินค้าและอะไหล่/);
 assert.match(pricingEditor,/ฐานภาษี \(รวมค่าส่ง\)/);
 assert.match(pricingEditor,/totals\.total \+ shippingFee/);
 assert.doesNotMatch(pricing,/user\.role!=="admin"/);
});
