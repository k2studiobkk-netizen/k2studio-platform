# K2SIGN Google backup webhook

ไฟล์ `Code.gs` ใช้กับ Google Apps Script ในบัญชีของผู้ติดตั้ง และทำงานร่วมกับ Cloudflare Worker

โครงสร้างที่สร้างใน Google Drive:

- `K2SIGN Order Backups/`
  - `Daily JSON/` — ภาพรวมข้อมูลทั้งหมดหนึ่งไฟล์ต่อวัน
  - `YYYY-MM/` — แยกตามเดือนที่สร้างใบงาน
    - `K2SIGN Orders YYYY-MM` — Google Sheet รายเดือน
    - `<เลขใบงาน>/`
      - JSON ข้อมูลเต็ม
      - `ไฟล์แนบ/` ภาพแบบ สลิป ภาพผลิต และไฟล์ลูกค้า
      - `PDF ใบงาน/` PDF เวอร์ชันล่าสุดทุกครั้งที่ข้อมูลเปลี่ยน

ต้องตั้ง Script Property ชื่อ `INTEGRATION_SECRET` ให้ตรงกับ Secret ชื่อเดียวกันใน Cloudflare Worker แล้ว Deploy เป็น Web app ที่รันในชื่อเจ้าของสคริปต์
