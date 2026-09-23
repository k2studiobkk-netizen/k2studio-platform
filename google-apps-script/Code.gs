/**
 * K2SIGN Cloud backup + Calendar webhook.
 * Deploy as a Web app owned by your own Google account.
 * Required Script Property: INTEGRATION_SECRET (same value as the Cloudflare Worker secret).
 */

var ROOT_FOLDER_NAME = "K2SIGN Order Backups";

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    verifySecret_(payload.secret);
    if (payload.action === "daily_backup_v1") return json_(backupAll_(payload));
    return json_(createCalendarEvent_(payload));
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function verifySecret_(provided) {
  var expected = PropertiesService.getScriptProperties().getProperty("INTEGRATION_SECRET") || "";
  if (!expected || String(provided || "") !== expected) throw new Error("Unauthorized");
}

function backupAll_(payload) {
  if (!payload.backupDate || !Array.isArray(payload.orders)) throw new Error("Invalid backup payload");
  var root = getOrCreateRoot_();
  saveDailyJson_(root, payload.backupDate, payload);
  var groups = groupOrdersByMonth_(payload.orders);
  var sheetUrls = [];
  Object.keys(groups).sort().forEach(function(month) {
    var monthFolder = getOrCreateFolder_(root, month);
    var spreadsheet = writeMonthlySpreadsheet_(monthFolder, month, groups[month]);
    sheetUrls.push(spreadsheet.getUrl());
    groups[month].forEach(function(order) {
      var orderFolder = getOrCreateFolder_(monthFolder, safeName_(order.order_number || ("order-" + order.id)));
      var savedFiles = saveOrderFiles_(orderFolder, order.files || [], payload.secret);
      createOrderPdfIfChanged_(orderFolder, order, savedFiles);
      saveOrderJson_(orderFolder, order);
    });
  });
  PropertiesService.getScriptProperties().setProperty("LAST_BACKUP_DATE", payload.backupDate);
  return {
    ok: true,
    driveUrl: root.getUrl(),
    sheetUrl: sheetUrls.length ? sheetUrls[sheetUrls.length - 1] : "",
    monthCount: Object.keys(groups).length,
    orderCount: payload.orders.length,
    fileCount: payload.summary ? payload.summary.files : 0
  };
}

function getOrCreateRoot_() {
  var properties = PropertiesService.getScriptProperties();
  var id = properties.getProperty("BACKUP_ROOT_FOLDER_ID");
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (ignored) {}
  }
  var matches = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  var folder = matches.hasNext() ? matches.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
  properties.setProperty("BACKUP_ROOT_FOLDER_ID", folder.getId());
  return folder;
}

function getOrCreateFolder_(parent, name) {
  var folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function findFile_(folder, name) {
  var files = folder.getFilesByName(name);
  return files.hasNext() ? files.next() : null;
}

function saveDailyJson_(root, backupDate, payload) {
  var folder = getOrCreateFolder_(root, "Daily JSON");
  var name = "k2sign-orders-" + backupDate + ".json";
  var content = JSON.stringify(payload, null, 2);
  var existing = findFile_(folder, name);
  if (existing) existing.setContent(content);
  else folder.createFile(name, content, MimeType.PLAIN_TEXT);
}

function saveOrderJson_(folder, order) {
  var name = safeName_(order.order_number || ("order-" + order.id)) + ".json";
  var content = JSON.stringify(order, null, 2);
  var existing = findFile_(folder, name);
  if (existing) existing.setContent(content);
  else folder.createFile(name, content, MimeType.PLAIN_TEXT);
}

function groupOrdersByMonth_(orders) {
  return orders.reduce(function(result, order) {
    var month = String(order.created_at || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) month = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM");
    if (!result[month]) result[month] = [];
    result[month].push(order);
    return result;
  }, {});
}

function getOrCreateSpreadsheet_(folder, name) {
  var matches = folder.getFilesByName(name);
  if (matches.hasNext()) return SpreadsheetApp.openById(matches.next().getId());
  var spreadsheet = SpreadsheetApp.create(name);
  var file = DriveApp.getFileById(spreadsheet.getId());
  file.moveTo(folder);
  return spreadsheet;
}

function writeMonthlySpreadsheet_(folder, month, orders) {
  var spreadsheet = getOrCreateSpreadsheet_(folder, "K2SIGN Orders " + month);
  var orderColumns = ["id","order_number","created_at","contact_name","phone","line_id","email","contact_channel","social_contact_name","address","province","requested_date","quantity","estimated_subtotal","discount_amount","shipping_fee","vat_applied","vat_amount","estimated_total","deposit_amount","payment_confirmed_at","payment_confirmed_by","price_status","order_status","production_file_url","production_file_note"];
  writeSheet_(spreadsheet, "ใบงาน", orderColumns, orders.map(function(order) { return pick_(order, orderColumns); }));
  writeSheet_(spreadsheet, "รายการสินค้า", ["order_number","line_no","product_type","item_name","item_description","thickness_mm","width_cm","height_cm","pricing_size_cm","quantity","print_sides","hardware_code","hardware_name","hardware_color","packaging_type","unit_price","line_total"], flatten_(orders, "items"));
  writeSheet_(spreadsheet, "รายการเสริม", ["order_number","label","amount","created_by","created_at"], flatten_(orders, "adjustments"));
  writeSheet_(spreadsheet, "แบบงาน", ["order_number","version_no","status","note","created_by","created_at","customer_note","responded_by","responded_at"], flatten_(orders, "designs"));
  writeSheet_(spreadsheet, "สถานะ", ["order_number","status","note","created_at"], flatten_(orders, "statusHistory"));
  writeSheet_(spreadsheet, "ประวัติแก้ไข", ["order_number","username","display_name","action","details","created_at"], flatten_(orders, "auditLogs"));
  writeSheet_(spreadsheet, "ไฟล์แนบ", ["order_number","category","fileName","fileType","key","downloadUrl"], flatten_(orders, "files"));
  var first = spreadsheet.getSheets()[0];
  if (first.getName() === "Sheet1" && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(first);
  SpreadsheetApp.flush();
  return spreadsheet;
}

function flatten_(orders, property) {
  var result = [];
  orders.forEach(function(order) {
    (order[property] || []).forEach(function(row) {
      var copy = Object.assign({}, row);
      copy.order_number = order.order_number;
      result.push(copy);
    });
  });
  return result;
}

function pick_(source, columns) {
  var result = {};
  columns.forEach(function(column) { result[column] = source[column] == null ? "" : source[column]; });
  return result;
}

function writeSheet_(spreadsheet, name, columns, rows) {
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  sheet.clearContents();
  var values = [columns].concat(rows.map(function(row) {
    return columns.map(function(column) {
      var value = row[column];
      return value && typeof value === "object" ? JSON.stringify(value) : (value == null ? "" : value);
    });
  }));
  sheet.getRange(1, 1, values.length, columns.length).setValues(values);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columns.length).setBackground("#0e3a67").setFontColor("#ffffff").setFontWeight("bold");
  sheet.autoResizeColumns(1, columns.length);
  sheet.getDataRange().setVerticalAlignment("top");
}

function saveOrderFiles_(orderFolder, files, secret) {
  var filesFolder = getOrCreateFolder_(orderFolder, "ไฟล์แนบ");
  var result = [];
  files.forEach(function(item, index) {
    var name = safeName_((item.category || "file") + "-" + (index + 1) + "-" + (item.fileName || "file"));
    var existing = findFile_(filesFolder, name);
    if (existing) { result.push({ item: item, file: existing }); return; }
    try {
      var response = UrlFetchApp.fetch(item.downloadUrl, {
        method: "get",
        headers: { "x-integration-secret": secret },
        muteHttpExceptions: true,
        followRedirects: true
      });
      if (response.getResponseCode() !== 200) throw new Error("HTTP " + response.getResponseCode());
      var blob = response.getBlob().setName(name);
      if (item.fileType) blob.setContentType(item.fileType);
      result.push({ item: item, file: filesFolder.createFile(blob) });
    } catch (error) {
      console.error("File backup failed " + item.key + ": " + error);
    }
  });
  return result;
}

function createOrderPdfIfChanged_(folder, order, savedFiles) {
  var fingerprint = digest_(JSON.stringify(order));
  var propertyKey = "PDF_" + order.id;
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(propertyKey) === fingerprint) return;
  var doc = DocumentApp.create("TEMP " + order.order_number);
  var body = doc.getBody();
  body.setMarginTop(28).setMarginBottom(28).setMarginLeft(32).setMarginRight(32);
  body.appendParagraph("K2SIGN / K2STUDIO").setHeading(DocumentApp.ParagraphHeading.HEADING2).setForegroundColor("#0e3a67");
  body.appendParagraph("ใบสั่งงาน " + order.order_number).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph("สถานะ: " + statusLabel_(order.order_status) + "   |   วันที่ส่ง: " + (order.requested_date || "-") + "   |   สร้างเมื่อ: " + (order.created_at || "-"));
  appendKeyValues_(body, [
    ["ลูกค้า", order.contact_name], ["โทรศัพท์", order.phone], ["ช่องทาง", order.contact_channel],
    ["ชื่อ Facebook / LINE", order.social_contact_name || order.line_id], ["อีเมล", order.email],
    ["ที่อยู่", order.address], ["จังหวัด", order.province]
  ]);
  body.appendParagraph("รายการสินค้า").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  var items = order.items || [];
  var itemRows = [["รายการ","รายละเอียด","จำนวน","ราคา/หน่วย","รวม"]];
  items.forEach(function(item) {
    var detail = item.product_type === "custom" ? (item.item_description || "งานสั่งทำอื่น ๆ") : [item.thickness_mm + " มม.", item.pricing_size_cm + " ซม.", "อะไหล่ " + item.hardware_code + " " + item.hardware_color].join(" • ");
    itemRows.push([item.item_name || ("รายการ " + item.line_no), detail, number_(item.quantity), money_(item.unit_price), money_(item.line_total)]);
  });
  body.appendTable(itemRows);
  if ((order.adjustments || []).length) {
    body.appendParagraph("รายการเสริม").setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendTable([["รายการ","ราคา"]].concat(order.adjustments.map(function(item) { return [item.label, money_(item.amount)]; })));
  }
  body.appendParagraph("สรุปยอด").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  var total = Number(order.estimated_total || 0) + Number(order.shipping_fee || 0);
  var balance = Math.max(0, total - Number(order.deposit_amount || 0));
  appendKeyValues_(body, [
    ["ยอดสินค้า/บริการก่อน VAT", money_(order.estimated_subtotal)], ["ส่วนลด", money_(order.discount_amount)],
    ["ค่าจัดส่ง", money_(order.shipping_fee)], ["VAT 7%", Number(order.vat_applied) ? money_(order.vat_amount) : "ไม่คิด VAT"],
    ["ยอดสุทธิ", money_(total)], ["รับมัดจำ", money_(order.deposit_amount)], ["ค้างชำระ", money_(balance)]
  ]);
  var images = savedFiles.filter(function(saved) { return String(saved.item.fileType || "").indexOf("image/") === 0 && ["artwork","design"].indexOf(saved.item.category) >= 0; }).slice(0, 6);
  if (images.length) {
    body.appendParagraph("ภาพแบบและภาพประกอบที่บันทึกไว้").setHeading(DocumentApp.ParagraphHeading.HEADING2);
    images.forEach(function(saved) {
      try {
        body.appendParagraph(saved.item.fileName || saved.item.category);
        var image = body.appendImage(saved.file.getBlob());
        var width = image.getWidth();
        if (width > 500) { var ratio = 500 / width; image.setWidth(500).setHeight(Math.round(image.getHeight() * ratio)); }
      } catch (error) { console.error("PDF image skipped: " + error); }
    });
  }
  body.appendParagraph("ลิงก์ไฟล์ผลิต: " + (order.production_file_url || "-")).setLinkUrl(order.production_file_url || null);
  body.appendParagraph("หมายเหตุไฟล์ผลิต: " + (order.production_file_note || "-"));
  body.appendParagraph("\nผู้จัดทำ __________________________   วันที่ ____________\n\nลูกค้ารับทราบและอนุมัติ __________________________   วันที่ ____________");
  doc.saveAndClose();
  var docFile = DriveApp.getFileById(doc.getId());
  var pdfFolder = getOrCreateFolder_(folder, "PDF ใบงาน");
  var pdfName = safeName_(order.order_number) + "-" + fingerprint.slice(0, 10) + ".pdf";
  pdfFolder.createFile(docFile.getAs(MimeType.PDF).setName(pdfName));
  docFile.setTrashed(true);
  properties.setProperty(propertyKey, fingerprint);
}

function appendKeyValues_(body, pairs) {
  body.appendTable(pairs.map(function(pair) { return [String(pair[0]), String(pair[1] == null || pair[1] === "" ? "-" : pair[1])]; }));
}

function digest_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8).map(function(byte) {
    var value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
}

function safeName_(value) {
  return String(value || "file").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 180);
}

function money_(value) { return Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " บาท"; }
function number_(value) { return Number(value || 0).toLocaleString("th-TH"); }

function statusLabel_(status) {
  return ({
    waiting_for_artwork_review: "รอตรวจไฟล์", quotation_pending: "รอยืนยันราคา", artwork_approval_pending: "รออนุมัติแบบ",
    artwork_changes_requested: "ขอแก้ไขแบบ", artwork_approved: "อนุมัติแบบแล้ว", confirmed: "ยืนยันแล้ว",
    in_production: "กำลังผลิต", completed: "เสร็จแล้ว", cancelled: "ยกเลิก"
  })[status] || status || "-";
}

function createCalendarEvent_(order) {
  if (!order.orderNumber || !order.requestedDate) throw new Error("Calendar payload is incomplete");
  var propertyKey = "CALENDAR_ORDER_" + order.id;
  var properties = PropertiesService.getScriptProperties();
  var existingId = properties.getProperty(propertyKey);
  if (existingId) {
    try { return { ok: true, eventId: CalendarApp.getEventById(existingId).getId(), duplicate: true }; } catch (ignored) {}
  }
  var date = new Date(order.requestedDate + "T12:00:00+07:00");
  var title = "ส่งงาน " + order.orderNumber + " • " + order.contactName;
  var description = ["ลูกค้า: " + order.contactName, "โทร: " + order.phone, "จำนวน: " + order.quantity, "ยอด: " + order.estimatedTotal, "หลังบ้าน: " + order.adminUrl].join("\n");
  var event = CalendarApp.getDefaultCalendar().createAllDayEvent(title, date, { description: description });
  event.addPopupReminder(24 * 60);
  event.addPopupReminder(3 * 24 * 60);
  properties.setProperty(propertyKey, event.getId());
  return { ok: true, eventId: event.getId() };
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
