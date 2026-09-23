// Only existing public brand assets. Never expose customer artworks or certificates here.
export const salesKitProducts = Object.freeze([
  { id: "keychain", name: "พวงกุญแจอะคริลิก", image: "/assets/k2studio/category-keychains-v1.png", destination: "/#quote", facts: "เลือกขนาดและอะไหล่ พร้อมส่งแบบให้ทีมงานประเมิน" },
  { id: "mobile", name: "อุปกรณ์เสริมมือถือ", image: "/assets/k2studio/category-mobile-v1.png", destination: "/#products", facts: "ดูตัวอย่างสินค้าและสอบถามรายละเอียดงานสั่งทำ" },
  { id: "apparel", name: "เสื้อและหมวก", image: "/assets/k2studio/category-apparel-v1.png", destination: "/#products", facts: "ส่งไอเดียหรือภาพอ้างอิงเพื่อสอบถามงานสำหรับแบรนด์ของคุณ" },
  { id: "bags", name: "กระเป๋า", image: "/assets/k2studio/category-bags-v1.png", destination: "/#products", facts: "ดูไอเดียของใช้สำหรับแบรนด์และงานอีเวนต์" },
  { id: "drinkware", name: "แก้วและภาชนะ", image: "/assets/k2studio/category-drinkware-v1.png", destination: "/#products", facts: "สอบถามรูปแบบและรายละเอียดก่อนสั่งผลิต" },
  { id: "stationery", name: "เครื่องเขียน", image: "/assets/k2studio/category-stationery-v1.png", destination: "/#products", facts: "ส่งไอเดียสำหรับของแจกและของใช้ในองค์กร" },
]);
export function makeSalesCaption(productId, tone, url) {
  const product = salesKitProducts.find(p => p.id === productId);
  if (!product) throw new Error("ไม่พบสินค้า");
  const link = new URL(url);
  if (!["https:", "http:"].includes(link.protocol)) throw new Error("ลิงก์ไม่ถูกต้อง");
  const openings = { friendly: `อยากทำ${product.name}ในแบบของตัวเอง? เริ่มจากไอเดียที่คุณมีได้เลย`,
    business: `${product.name}สำหรับแบรนด์ องค์กร และกิจกรรมของคุณ`,
    concise: `${product.name} ในแบบที่เป็นคุณ — K2STUDIO` };
  if (!(tone in openings)) throw new Error("รูปแบบข้อความไม่ถูกต้อง");
  return `${openings[tone]}\n\n${product.facts}\nราคาและกำหนดผลิตขึ้นอยู่กับรายละเอียดงาน กรุณาตรวจสอบก่อนยืนยันสั่ง\n\nดูรายละเอียด / สอบถาม: ${link.href}\n\n#K2STUDIO #สินค้าสั่งทำ`;
}
export function safeSalesOrigin(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Invalid public site origin");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("HTTPS required");
  return url.origin;
}
export function salesRuntimeOrigin(configured, requestUrl) {
  const request = new URL(requestUrl);
  return request.protocol === "http:" && ["localhost", "127.0.0.1"].includes(request.hostname)
    ? safeSalesOrigin(request.origin) : safeSalesOrigin(configured);
}
