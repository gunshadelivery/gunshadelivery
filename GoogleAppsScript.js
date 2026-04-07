function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetOrders = ss.getSheetByName("Orders");
    var sheetProducts = ss.getSheets()[0]; // Product List

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

      // --- NEW: Update Stock and Sold Count ---
      if (contents.itemsArray && Array.isArray(contents.itemsArray)) {
        var productData = sheetProducts.getDataRange().getValues();
        contents.itemsArray.forEach(function(orderItem) {
          for (var i = 1; i < productData.length; i++) {
            // Match Name and Size
            if (productData[i][0] == orderItem.name && productData[i][1] == orderItem.size) {
              var currentStock = parseInt(productData[i][7]) || 0;
              var currentSold = parseInt(productData[i][8]) || 0;
              var newStock = Math.max(0, currentStock - orderItem.qty);
              var newSold = currentSold + orderItem.qty;
              
              // Update Stock (Col H) and Sold Count (Col I)
              sheetProducts.getRange(i + 1, 8).setValue(newStock);
              sheetProducts.getRange(i + 1, 9).setValue(newSold);

              // If stock is 0, update status to "หมด" (Col G)
              if (newStock <= 0) {
                sheetProducts.getRange(i + 1, 7).setValue("หมด");
              }
              break; 
            }
          }
        });
      }

      return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
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
          return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ "result": "not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- CASE 3: Add new product ---
    if (action === "addProduct") {
      sheetProducts.appendRow([
        contents.name,
        contents.size,
        contents.price,
        contents.note,
        contents.image,
        contents.tags,
        contents.status || "มีของ",
        contents.stock || 0,
        contents.sold_count || 0
      ]);
      return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- CASE 4: Update product ---
    if (action === "updateProduct") {
      var data = sheetProducts.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == contents.oldName && data[i][1] == contents.oldSize) {
          sheetProducts.getRange(i + 1, 1, 1, 9).setValues([[
            contents.name,
            contents.size,
            contents.price,
            contents.note,
            contents.image,
            contents.tags,
            contents.status,
            contents.stock,
            contents.sold_count
          ]]);
          return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ "result": "not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- CASE 5: Delete product ---
    if (action === "deleteProduct") {
      var data = sheetProducts.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == contents.name && data[i][1] == contents.size) {
          sheetProducts.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

  } catch (f) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": f.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

