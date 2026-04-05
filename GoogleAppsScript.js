function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetOrders = ss.getSheetByName("Orders");
    var sheetProducts = ss.getSheets()[0]; // Getting the first sheet as Product List

    // Initialize Orders sheet if not exists
    if (!sheetOrders) {
      sheetOrders = ss.insertSheet("Orders");
      sheetOrders.appendRow(["วันที่-เวลา", "ชื่อลูกค้า", "เบอร์โทร", "ที่อยู่", "ลิงก์แผนที่", "รายการสินค้า", "ยอดรวม", "ลิงก์สลิป", "สถานะ"]);
      sheetOrders.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#d1e7dd");
    }

    var contents = JSON.parse(e.postData.contents);
    var action = contents.action || "log";

    // --- CASE 1: Log new order ---
    if (action === "log") {
      sheetOrders.appendRow([
        new Date(),
        contents.name,
        contents.phone,
        contents.address,
        contents.mapUrl,
        contents.items,
        contents.total,
        contents.slipUrl,
        "รอดำเนินการ"
      ]);
      return ContentService.createTextOutput(JSON.stringify({"result": "success"}))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    
    // --- CASE 2: Update existing order status ---
    if (action === "updateStatus") {
      var data = sheetOrders.getDataRange().getValues();
      var name = contents.name;
      var slipUrl = contents.slipUrl;
      
      for (var i = 1; i < data.length; i++) {
        if (data[i][1] == name && data[i][7] == slipUrl) {
          sheetOrders.getRange(i + 1, 9).setValue(contents.status);
          return ContentService.createTextOutput(JSON.stringify({"result": "success"}))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"result": "not found"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- CASE 3: Add new product ---
    if (action === "addProduct") {
      // Append raw product data: name, size, price, note, image, tags, status
      sheetProducts.appendRow([
        contents.name,
        contents.size,
        contents.price,
        contents.note,
        contents.image,
        contents.tags,
        contents.status || "มีของ"
      ]);
      return ContentService.createTextOutput(JSON.stringify({"result": "success"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (f) {
    return ContentService.createTextOutput(JSON.stringify({"result": "error", "error": f.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
