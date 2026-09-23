-- Four legacy orders had no creator audit, so their old production assignee
-- must not be presented as the salesperson or receive commission credit.
INSERT INTO `order_sales_assignment_history` (
  `order_id`,`old_sales_owner_id`,`old_sales_owner_name`,
  `new_sales_owner_id`,`new_sales_owner_name`,`changed_by_id`,`changed_by_name`
)
SELECT `id`,`sales_owner_id`,`sales_owner_name`,NULL,'',0,'ระบบล้างข้อมูลเซลล์เก่าที่ไม่ยืนยัน'
FROM `orders`
WHERE `id` IN (22,24,26,27)
  AND `sales_owner_id` IS NOT NULL;

INSERT INTO `audit_logs` (`order_id`,`user_id`,`username`,`display_name`,`action`,`details`)
SELECT `id`,0,'system','ระบบ','ล้างเซลล์ย้อนหลังที่ไม่มีหลักฐาน',
  'ย้ายไปยังไม่ระบุเซลล์ เพราะไม่มีประวัติผู้สร้างใบงาน'
FROM `orders`
WHERE `id` IN (22,24,26,27)
  AND `sales_owner_id` IS NOT NULL;

UPDATE `orders`
SET `sales_owner_id`=NULL,`sales_owner_name`=''
WHERE `id` IN (22,24,26,27);
