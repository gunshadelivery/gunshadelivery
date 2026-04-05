function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
    
    // Create sheet if not exists
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Orders");
      sheet.appendRow(["วันที่-เวลา", "ชื่อลูกค้า", "เบอร์โทร", "ที่อยู่", "ลิงก์แผนที่", "รายการสินค้า", "ยอดรวม", "ลิงก์สลิป", "สถานะ"]);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#d1e7dd");
    }

    var contents = JSON.parse(e.postData.contents);
    var action = contents.action || "log";

    if (action === "log") {
      sheet.appendRow([
        new Date(),
        contents.name,
        contents.phone,
        contents.address,
        contents.mapUrl,
        contents.items,
        contents.total,
        contents.total, // Just logging total twice if needed or items, but columns are fixed
        "รอดำเนินการ"
      ]);
      // Fixed appendRow based on the column headers:
      // Timestamp, Name, Phone, Address, Map, Items, Total, Slip, Status
      sheet.getRange(sheet.getLastRow(), 1, 1, 9).setValues([[
        new Date(),
        contents.name,
        contents.phone,
        contents.address,
        contents.mapUrl,
        contents.items,
        contents.total,
        contents.slipUrl,
        "รอดำเนินการ"
      ]]);
      
      return ContentService.createTextOutput(JSON.stringify({"result": "success"}))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    
    if (action === "updateStatus") {
      var data = sheet.getDataRange().getValues();
      var name = contents.name;
      var slipUrl = contents.slipUrl;
      
      for (var i = 1; i < data.length; i++) {
        // Find row by Name and SlipUrl (unique enough)
        if (data[i][1] == name && data[i][7] == slipUrl) {
          sheet.getRange(i + 1, 9).setValue(contents.status);
          return ContentService.createTextOutput(JSON.stringify({"result": "success"}))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"result": "not found"}))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (f) {
    return ContentService.createTextOutput(JSON.stringify({"result": "error", "error": f.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
