// ============================================================
// GUNSHA DELIVERY - Central Configuration
// ============================================================
// แก้ไขค่าต่างๆ ในไฟล์นี้เพียงไฟล์เดียว เพื่อเชื่อมต่อกับระบบภายนอก
// ============================================================

// --- ข้อมูลร้าน (Shop Branding) ---
export const SHOP_NAME = "GUNSHA Delivery";
export const SHOP_VERSION = "2.0.0";
export const SHOP_TAGLINE = "สดใหม่ ส่งไว ถึงมือ 🌿";

// --- Google Sheets CSV URL ---
export const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1rczsaPil58aAm_kw1FdhopdJA0U6v6x2ELROaupP09g/gviz/tq?tqx=out:csv";

// --- Google Sheets Orders CSV URL ---
export const ORDERS_CSV_URL = "https://docs.google.com/spreadsheets/d/1rczsaPil58aAm_kw1FdhopdJA0U6v6x2ELROaupP09g/export?format=csv&gid=1214202779";

// --- Google Apps Script (GAS) Web App URL ---
export const GAS_URL = "https://script.google.com/macros/s/AKfycbzZHV5tAWeWmPGq9cI84I3RwpnrtdimMbdpMjXo0yQ-eemH4vZiz6hKoIyhk-1nuFc4ZA/exec";

// --- LINE OA ID ---
export const LINE_OA_ID = "@059rkyoa";

// --- ImgBB API Key ---
export const IMGBB_API_KEY = "467157500c7b535f4c9839accf416565";

// --- Admin Password ---
export const ADMIN_PASSWORD = "gunsha888";

// ============================================================
// ฟังก์ชันช่วยเหลือ (Helper Functions)
// ============================================================

/**
 * สร้าง LINE OA Message URL
 * @param {string} message - ข้อความที่จะส่ง
 * @returns {string} LINE URL scheme
 */
export function buildLineUrl(message) {
    if (LINE_OA_ID) {
        // ใช้รูปแบบ oaMessage เพื่อให้ทักแชทร้านได้โดยตรง และ encode @ เป็น %40
        const encodedId = encodeURIComponent(LINE_OA_ID);
        return `https://line.me/R/oaMessage/${encodedId}/?${encodeURIComponent(message)}`;
    }
    // Fallback
    return `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;
}

/**
 * สร้าง ImgBB Upload URL
 * @returns {string} ImgBB API endpoint with key
 */
export function getImgbbUploadUrl() {
    return `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;
}
