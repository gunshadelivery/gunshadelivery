function doGet(e) {
  if (!e || !e.parameter) {
    return ContentService.createTextOutput(JSON.stringify({ "error": "No parameters" })).setMimeType(ContentService.MimeType.JSON);
  }
  var action = e.parameter.action;
  var sheetOrders = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Orders");
  var sheetProducts = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Product List");

  if (action === "getOrders") {
    var data = sheetOrders.getDataRange().getValues();
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "getProducts") {
    var data = sheetProducts.getDataRange().getValues();
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ "error": "Invalid action" })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetOrders = ss.getSheetByName("Orders");
    var sheetProducts = ss.getSheetByName("Product List");
    var contents = JSON.parse(e.postData.contents);
    var action = contents.action;
    // --- CASE 1: Log new order ---
    if (action === "log") {
      // แทรกแถวใหม่ที่แถวที่ 2 (บนสุดต่อจาก Header)
      sheetOrders.insertRowBefore(2);
      var newRow = [
        new Date(), // Timestamp
        contents.name,
        contents.phone,
        contents.address,
        contents.mapUrl,
        contents.items,
        contents.total,
        contents.slipUrl,
        contents.status || "รอดำเนินการ"
      ];
      sheetOrders.getRange(2, 1, 1, newRow.length).setValues([newRow]);

      // ตัดสต็อกสินค้า
      if (contents.itemsArray) {
        var products = sheetProducts.getDataRange().getValues();
        contents.itemsArray.forEach(function (item) {
          for (var i = 1; i < products.length; i++) {
            if (products[i][0] == item.name && products[i][1] == item.size) {
              var currentStock = parseInt(products[i][7]) || 0;
              var currentSold = parseInt(products[i][8]) || 0;
              var newStock = currentStock - item.qty;
              var newSold = currentSold + item.qty;
              sheetProducts.getRange(i + 1, 8).setValue(newStock);
              sheetProducts.getRange(i + 1, 9).setValue(newSold);
              
              // อัปเดตข้อมูลในหน่วยความจำเพื่อป้องกันปัญหาถ้ามีสินค้าซ้ำกันใน itemsArray
              products[i][7] = newStock;
              products[i][8] = newSold;

              // ปรับสถานะอัตโนมัติถ้าของหมด
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

    // --- CASE 2: Update status ---
    if (action === "updateStatus") {
      var data = sheetOrders.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        // ตรวจสอบชื่อลูกค้าและลิงก์สลิปเพื่อให้แม่นยำ
        if (data[i][1] == contents.name && data[i][7] == contents.slipUrl) {
          sheetOrders.getRange(i + 1, 9).setValue(contents.status);
          return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Order not found" }))
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
        contents.status,
        contents.stock || 0,
        contents.sold_count || 0,
        contents.category || ""
      ]);
      return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- CASE 4: Update product ---
    if (action === "updateProduct") {
      var data = sheetProducts.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        var sheetName = (data[i][0] || "").toString().trim();
        var sheetSize = (data[i][1] || "").toString().trim();
        var targetName = (contents.oldName || "").toString().trim();
        var targetSize = (contents.oldSize || "").toString().trim();

        if (sheetName == targetName && sheetSize == targetSize) {
          sheetProducts.getRange(i + 1, 1, 1, 10).setValues([[
            contents.name,
            contents.size,
            contents.price,
            contents.note,
            contents.image,
            contents.tags,
            contents.status,
            contents.stock,
            contents.sold_count,
            contents.category
          ]]);
          return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Product not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- CASE 5: Delete product ---
    if (action === "deleteProduct") {
      var data = sheetProducts.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        var sheetName = (data[i][0] || "").toString().trim();
        var sheetSize = (data[i][1] || "").toString().trim();
        var targetName = (contents.name || "").toString().trim();
        var targetSize = (contents.size || "").toString().trim();

        if (sheetName == targetName && sheetSize == targetSize) {
          sheetProducts.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Product not found to delete" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ "result": "action not found" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
