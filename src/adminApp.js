import './style.css';
import Papa from 'papaparse';
import Chart from 'chart.js/auto';
import { ADMIN_PASSWORD, ORDERS_CSV_URL, SHEET_CSV_URL as PRODUCTS_CSV_URL, GAS_URL, SHOP_NAME, SHOP_VERSION, getImgbbUploadUrl } from './config.js';

let rawOrders = [];
let rawProducts = [];
let salesChart = null;
let isEditMode = false;
let currentPage = 1; // หน้าปัจจุบันของออเดอร์
const ITEMS_PER_PAGE = 10;
const MAX_PAGES = 5;
let originalVariants = [];
let oldProductName = "";

// --- CUSTOM UI: TOAST ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- CUSTOM UI: CONFIRM MODAL ---
function customConfirm(title, message, icon = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').innerText = title;
        document.getElementById('confirmMsg').innerText = message;
        document.getElementById('confirmIcon').innerText = icon;
        modal.classList.remove('hidden');

        const cleanup = (val) => {
            modal.classList.add('hidden');
            document.getElementById('confirmOk').removeEventListener('click', okHandler);
            document.getElementById('confirmCancel').removeEventListener('click', cancelHandler);
            resolve(val);
        };

        const okHandler = () => cleanup(true);
        const cancelHandler = () => cleanup(false);

        document.getElementById('confirmOk').addEventListener('click', okHandler);
        document.getElementById('confirmCancel').addEventListener('click', cancelHandler);
    });
}

// --- VARIANT MANAGEMENT ---
function addVariant(size="", price="", stock=0, sold=0) {
    const category = document.getElementById('pCategory').value;
    const isAccessory = ["Accessories", "Rolling", "Other"].includes(category);
    const unitLabel = isAccessory ? "ชิ้น" : "G";
    const cleanSize = size.toString().replace('G', '').replace('ชิ้น', '');
    
    const row = document.createElement('div');
    row.className = 'variant-row flex items-center gap-2 animate-in fade-in slide-in-from-top-1 bg-slate-50 p-3 rounded-2xl border border-slate-100';
    row.innerHTML = `
        <div class="w-20">
            <label class="text-[10px] text-slate-400 font-bold uppercase">${isAccessory ? "ประเภท/รุ่น" : "ขนาด"}</label>
            <div class="relative mt-1">
                <input type="${isAccessory ? 'text' : 'number'}" step="0.1" placeholder="${unitLabel}" value="${cleanSize}" class="v-size w-full border rounded-lg pl-2 pr-7 py-1.5 text-xs focus:ring-1 focus:ring-emerald-500 outline-none">
                <span class="absolute right-1.5 top-1.5 text-slate-400 text-[10px] font-bold">${unitLabel}</span>
            </div>
        </div>
        <div class="w-16">
            <label class="text-[10px] text-slate-400 font-bold uppercase">ราคา</label>
            <input type="number" placeholder="฿" value="${price}" class="v-price w-full border rounded-lg px-2 py-1.5 mt-1 text-xs focus:ring-1 focus:ring-emerald-500 outline-none">
        </div>
        <div class="w-16">
            <label class="text-[10px] text-slate-400 font-bold uppercase">คลัง</label>
            <input type="number" placeholder="ชิ้น" value="${stock}" class="v-stock w-full border rounded-lg px-2 py-1.5 mt-1 text-xs focus:ring-1 focus:ring-emerald-500 outline-none">
        </div>
        <div class="w-16">
            <label class="text-[10px] text-slate-400 font-bold uppercase">ขายแล้ว</label>
            <input type="number" placeholder="ชิ้น" value="${sold}" class="v-sold w-full border rounded-lg px-2 py-1.5 mt-1 text-xs focus:ring-1 focus:ring-emerald-500 outline-none">
        </div>
        <button type="button" onclick="removeVariant(this)" class="mt-4 p-1 text-red-300 hover:text-red-500">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
        </button>`;
    document.getElementById('variantContainer').appendChild(row);
}
function removeVariant(btn) {
    const rows = document.querySelectorAll('.variant-row');
    if (rows.length > 1) btn.closest('.variant-row').remove();
    else alert("ต้องมีอย่างน้อยหนึ่งตัวเลือกราคา");
}

// --- IMAGE COMPRESSION ---
function compressImage(file, maxWidth = 1000, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => { resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' })); }, 'image/webp', quality);
            };
        };
        reader.onerror = reject;
    });
}

// --- TAB SYSTEM ---
function switchTab(tabId) {
    document.querySelectorAll('main').forEach(m => m.classList.add('hidden'));
    const viewEl = document.getElementById('view-' + tabId);
    if (viewEl) viewEl.classList.remove('hidden');
    
    document.querySelectorAll('header button').forEach(b => b.classList.remove('bg-white', 'shadow-sm', 'text-emerald-600'));
    const activeBtn = document.getElementById('tab-' + tabId);
    if(activeBtn) activeBtn.classList.add('bg-white', 'shadow-sm', 'text-emerald-600');

    if (tabId === 'products') loadProducts();
    else loadData();
}

// --- AUTH ---
function checkPass() {
    if (document.getElementById('passInput').value === ADMIN_PASSWORD) {
        localStorage.setItem('adminAuth', 'true');
        showToast("เข้าสู่ระบบเรียบร้อย", "success");
        showDashboard();
    } else {
        document.getElementById('errorMsg').classList.remove('hidden');
        showToast("รหัสผ่านผิด!", "error");
    }
}
function showDashboard() {
    document.getElementById('loginOverlay').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    switchTab('overview');
}
function logout() { localStorage.removeItem('adminAuth'); location.reload(); }

document.addEventListener('DOMContentLoaded', () => {
    try {
        loadData();
        loadProducts();
        
        // ดักการเปลี่ยนหมวดหมู่เพื่อปรับหน่วย (G หรือ ชิ้น) - เพิ่มการเช็คเพื่อป้องกัน Error
        const categoryEl = document.getElementById('pCategory');
        if (categoryEl) {
            categoryEl.addEventListener('change', (e) => {
                const isAccessory = ["Accessories", "Rolling", "Other"].includes(e.target.value);
                const unitLabel = isAccessory ? "ชิ้น" : "G";
                const rows = document.querySelectorAll('.variant-row');
                rows.forEach(row => {
                    const label = row.querySelector('label');
                    const span = row.querySelector('span');
                    const input = row.querySelector('.v-size');
                    if (label) label.textContent = isAccessory ? "ประเภท/รุ่น" : "ขนาด";
                    if (span) span.textContent = unitLabel;
                    if (input) {
                        input.placeholder = unitLabel;
                        input.type = isAccessory ? "text" : "number";
                    }
                });
            });
        }

        if (localStorage.getItem('adminAuth') === 'true') showDashboard();
    } catch (err) {
        console.error("Initialization error:", err);
    }
});

// --- DASHBOARD DATA ---
function loadData() {
    if (!ORDERS_CSV_URL) return;
    // เพิ่มตัวล้าง Cache ด้วยเลขสุ่มที่เปลี่ยนทุกครั้งที่โหลด
    const cacheBuster = `&nocache=${Math.random()}&t=${Date.now()}`;
    Papa.parse(ORDERS_CSV_URL + cacheBuster, {
        download: true, header: true, skipEmptyLines: true,
        complete: (results) => { rawOrders = results.data; processSales(); }
    });
}

function processSales() {
    const now = new Date();
    const oneWeekAgo = new Date(); oneWeekAgo.setDate(now.getDate() - 7);
    const oneMonthAgo = new Date(); oneMonthAgo.setDate(now.getDate() - 30);

    let totalLife = 0, totalMonth = 0, totalWeek = 0, countMonth = 0, countWeek = 0;
    let pendingTotal = 0, pendingCount = 0;
    const productCounts = {}, dailyStats = {};

    // กรองข้อมูลที่ว่างออก (Cleanup empty rows)
    rawOrders = rawOrders.filter(o => {
        // กรองเอาเฉพาะแถวที่มีข้อมูลตัวตนลูกค้า (ชื่อ หรือ เบอร์โทร) เท่านั้น
        const vals = Object.values(o).map(v => (v || "").toString().trim());
        const hasIdentity = vals.some(v => v.length > 2); // มีข้อมูลที่ยาวกว่า 2 ตัวอักษร
        return hasIdentity;
    });

    rawOrders.forEach(order => {
        const keys = Object.keys(order);
        const getVal = (targets) => {
            // 1. หาตามชื่อ Key ตรงๆ
            for (let t of targets) { if (order[t] !== undefined) return order[t]; }
            // 2. หาตาม Partial Match
            const foundK = keys.find(k => targets.some(t => k.toLowerCase().includes(t.toLowerCase())));
            if (foundK) return order[foundK];
            // 3. Fallback ตามลำดับคอลัมน์ (Index)
            if (targets.includes("วันที่") || targets.includes("time")) return order[keys[0]];
            if (targets.includes("ชื่อ") || targets.includes("name")) return order[keys[1]];
            if (targets.includes("เบอร์") || targets.includes("phone")) return order[keys[2]];
            if (targets.includes("ยอด") || targets.includes("total")) return order[keys[6]]; // คอลัมน์ G
            return undefined;
        };

        const status = (getVal(["สถานะ", "status"]) || "").toString().trim();
        const total = parseFloat(getVal(["ยอดรวม", "total", "ราคา", "price"]) || 0);
        const dateRaw = getVal(["วันที่-เวลา", "Timestamp", "date"]);
        const orderDate = dateRaw ? new Date(dateRaw) : new Date();
        const items = getVal(["รายการสินค้า", "items", "รายการ"]);

        // นับสถิติ (เฉพาะที่ชำระเงินแล้ว)
        if (status === "ชำระเงินแล้ว") {
            totalLife += total;
            if (orderDate >= oneMonthAgo) { totalMonth += total; countMonth++; }
            if (orderDate >= oneWeekAgo) { totalWeek += total; countWeek++; }
            const dKey = orderDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            if (orderDate >= (new Date().setDate(now.getDate()-14))) dailyStats[dKey] = (dailyStats[dKey] || 0) + total;
            
            if (items) {
                items.split(',').forEach(it => {
                    const n = it.split('(')[0].trim();
                    productCounts[n] = (productCounts[n] || 0) + 1;
                });
            }
        } else if (status === "รอดำเนินการ" || status === "") {
            // นับยอดที่รอรับ (Pending)
            pendingTotal += total;
            pendingCount++;
        }
    });

    // แสดงผลยอดที่รอรับ (UI Feedback)
    const pendingLabel = document.getElementById('totalLifetime');
    if (pendingLabel) {
        pendingLabel.innerHTML = `รวมทั้งหมด ${totalLife.toLocaleString()} ฿ <span class="ml-2 text-amber-500">(รอรับยอด: ${pendingTotal.toLocaleString()} ฿)</span>`;
    }

    document.getElementById('monthlyTotal').textContent = totalMonth.toLocaleString() + " ฿";
    document.getElementById('monthlyCount').textContent = `${countMonth} รายการ`;
    document.getElementById('weeklyTotal').textContent = totalWeek.toLocaleString() + " ฿";
    document.getElementById('weeklyCount').textContent = `${countWeek} รายการ`;
    document.getElementById('avgOrder').textContent = (countMonth > 0 ? (totalMonth / countMonth).toFixed(2) : 0) + " ฿";
    document.getElementById('totalLifetime').textContent = `รวมทั้งหมด ${totalLife.toLocaleString()} ฿`;

    renderChart(dailyStats); renderTop(productCounts); renderOrdersTable();
}

function renderChart(dataMap) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    const labels = [], values = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const k = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        labels.push(k); values.push(dataMap[k] || 0);
    }
    if (salesChart) salesChart.destroy();
    salesChart = new Chart(ctx, {
        type: 'line', data: { labels, datasets: [{ data: values, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function renderTop(counts) {
    const list = document.getElementById('topProductsList'); list.innerHTML = "";
    Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([name, count]) => {
        list.innerHTML += `<div class="flex justify-between p-3 bg-slate-50 rounded-xl border"><span>${name}</span><span class="font-bold text-emerald-600">${count}</span></div>`;
    });
}

function renderOrdersTable() {
    const body = document.getElementById('orderTableBody'); body.innerHTML = "";
    
    // กรองและเรียงลำดับ
    const sortedOrders = [...rawOrders].reverse();
    
    // คำนวณขอบเขตการแสดงผลตามหน้า (Pagination)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedOrders = sortedOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    paginatedOrders.forEach(order => {
        const keys = Object.keys(order);
        const getVal = (targets) => {
            for (let t of targets) { if (order[t] !== undefined) return order[t]; }
            const foundK = keys.find(k => targets.some(t => k.toLowerCase().includes(t.toLowerCase())));
            if (foundK) return order[foundK];
            // Fallback ตามลำดับคอลัมน์ (Index)
            if (targets.includes("วันที่") || targets.includes("time")) return order[keys[0]];
            if (targets.includes("ชื่อ") || targets.includes("name")) return order[keys[1]];
            if (targets.includes("เบอร์") || targets.includes("phone")) return order[keys[2]];
            if (targets.includes("ยอด") || targets.includes("total")) return order[keys[6]];
            if (targets.includes("สลิป") || targets.includes("slip")) return order[keys[7]];
            if (targets.includes("แผนที่") || targets.includes("map")) return order[keys[4]];
            if (targets.includes("ที่อยู่") || targets.includes("address")) return order[keys[3]];
            return "";
        };

        const status = (getVal(["สถานะ", "status"]) || "รอดำเนินการ").toString().trim();
        const isConfirmed = status === "ชำระเงินแล้ว";
        const phone = getVal(["เบอร์โทร", "phone"]);
        const custName = getVal(["ชื่อลูกค้า", "name"]);
        const displayIdentity = (custName && custName !== "N/A") ? custName : (phone || "N/A");
        const mapLink = getVal(["ลิงก์แผนที่", "mapUrl", "map"]) || "";
        const addressText = getVal(["ที่อยู่", "address"]) || "";
        const dateRaw = getVal(["วันที่-เวลา", "Timestamp", "date"]);
        const dateStr = dateRaw ? dateRaw.toString().split('GMT')[0].trim() : "N/A";
        const total = parseFloat(getVal(["ยอดรวม", "ราคา", "total", "price"]) || 0);
        const slip = getVal(["ลิงก์สลิป", "slipUrl", "slip"]);
        
        body.innerHTML += `
            <tr class="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                <td class="px-6 py-4 w-[180px] text-[11px] font-mono text-slate-400 whitespace-nowrap">${dateStr}</td>
                <td class="px-6 py-4">
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-700 text-sm">${displayIdentity}</span>
                        <div class="flex items-center gap-1">
                            <span class="text-[10px] text-slate-400 truncate max-w-[200px]">${addressText}</span>
                            ${mapLink ? `<a href="${mapLink}" target="_blank" class="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 hover:bg-white transition flex items-center gap-0.5">แผนที่</a>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 w-[120px] font-bold text-slate-700 font-mono text-sm text-right">${total.toLocaleString()} ฿</td>
                <td class="px-6 py-4 w-[120px] text-center">
                    <span class="px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-tight ${isConfirmed?'bg-emerald-50 text-emerald-600 border border-emerald-100':'bg-amber-50 text-amber-600 border border-amber-100'}">
                        ${status}
                    </span>
                </td>
                <td class="px-6 py-4 w-[160px] text-right">
                    <div class="flex justify-end gap-2">
                        <a href="${slip}" target="_blank" 
                           class="flex items-center gap-1 px-2.5 py-1.5 bg-white text-slate-600 text-[10px] font-bold rounded-lg border border-slate-200 hover:bg-slate-50 transition active:scale-95 shadow-sm">
                            ดูสลิป
                        </a>
                        ${!isConfirmed ? `
                        <button onclick="window.updateConfirm(this, '${(custName || "").replace(/'/g, "\\'")}', '${slip}')" 
                                class="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition active:scale-95 shadow-md shadow-emerald-100">
                            รับยอด
                        </button>` : ''}
                    </div>
                </td>
            </tr>`;
    });

    renderPagination(sortedOrders.length);
}

function renderPagination(totalItems) {
    const container = document.getElementById('orderPagination');
    container.innerHTML = "";
    
    const totalPagesAvailable = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const finalPageCount = Math.min(totalPagesAvailable, MAX_PAGES);

    if (finalPageCount <= 1) return;

    for (let i = 1; i <= finalPageCount; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = `w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' : 'bg-white text-slate-500 border border-slate-200 hover:border-emerald-300'}`;
        btn.onclick = () => {
            currentPage = i;
            renderOrdersTable();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        container.appendChild(btn);
    }
}

async function updateConfirm(btn, name, slip) {
    if(!(await customConfirm("ยืนยันออเดอร์", `ต้องการยืนยันการรับเงินของคุณ ${name} ใช่หรือไม่?`, ""))) return;
    
    const parent = btn.parentElement;
    
    btn.disabled = true;
    btn.textContent = "กำลังอัปเดต...";
    
    await fetch(GAS_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: "updateStatus", name, slipUrl: slip, status: "ชำระเงินแล้ว" }) 
    });
    
    showToast("อัปเดตเรียบร้อย กรุณารอข้อมูลอัปเดตสักครู่", "success");
    
    // --- OPTIMISTIC UI: ซ่อนปุ่มรับยอด แต่ยังคงปุ่มดูสลิปไว้ ---
    parent.innerHTML = `
        <a href="${slip}" target="_blank" 
           class="flex items-center gap-1 px-2.5 py-1.5 bg-white text-slate-600 text-[10px] font-bold rounded-lg border border-slate-200 hover:bg-slate-50 transition active:scale-95 shadow-sm">
            ดูสลิป
        </a>
        <span class="text-[10px] text-emerald-600 font-bold ml-1">ยืนยันแล้ว</span>
    `;
    
    // หน่วงเวลาโหลดข้อมูลใหม่เพื่อให้ Google Sheets มีเวลาอัปเดต CSV
    setTimeout(loadData, 5000);
}

// --- PRODUCT MANAGEMENT ---
function loadProducts() {
    Papa.parse(PRODUCTS_CSV_URL + "&t=" + Date.now(), {
        download: true, header: true, skipEmptyLines: true,
        complete: (results) => { rawProducts = results.data; renderProductsTable(); }
    });
}

function renderProductsTable() {
    const body = document.getElementById('productTableBody'); body.innerHTML = "";
    const grouped = {};
    rawProducts.forEach(p => {
        if(!p.name) return;
        if(!grouped[p.name]) grouped[p.name] = { ...p, sizes: [], minPrice: Infinity, totalStock: 0, totalSold: 0 };
        grouped[p.name].sizes.push(p.size);
        grouped[p.name].minPrice = Math.min(grouped[p.name].minPrice, parseFloat(p.price) || 0);
        grouped[p.name].totalStock += (parseInt(p.stock) || 0);
        grouped[p.name].totalSold += (parseInt(p.sold_count) || 0);
    });

    Object.values(grouped).forEach(p => {
        const outOfStock = p.totalStock <= 0 || ['หมด','0','sold out'].includes(p.status?.toLowerCase());
        body.innerHTML += `<tr>
            <td class="px-6 py-3"><img src="${p.image}" class="w-10 h-10 object-cover rounded-lg bg-slate-100" onerror="this.outerHTML='<div class=\\'w-10 h-10 bg-slate-100 rounded-lg\\'></div>'"></td>
            <td class="px-6 py-3 font-bold">${p.name}</td>
            <td class="px-6 py-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">${p.category || 'N/A'}</span></td>
            <td class="px-6 py-3 text-slate-500 text-xs">${p.sizes.join(', ')}</td>
            <td class="px-6 py-3 font-bold text-emerald-600">${p.minPrice.toLocaleString()} ฿ +</td>
            <td class="px-6 py-3 font-bold ${p.totalStock < 5 ? 'text-red-500' : 'text-slate-600'}">${p.totalStock}</td>
            <td class="px-6 py-3 text-slate-400 font-bold">${p.totalSold}</td>
            <td class="px-6 py-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${outOfStock ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}">${outOfStock ? 'หมด' : 'มีของ'}</span></td>
            <td class="px-6 py-3 text-right">
                <button onclick="editProduct('${p.name.replace(/'/g, "\\'")}')" class="p-2 text-slate-400 hover:text-emerald-600 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                </button>
                <button onclick="deleteFullProduct('${p.name.replace(/'/g, "\\'")}')" class="p-2 text-slate-400 hover:text-red-500 transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        </tr>`;
    });
}

function toggleProductModal(show, mode = 'add', type = 'herb') { 
    const modal = document.getElementById('productModal');
    const title = document.getElementById('modalTitle');
    const btn = document.getElementById('saveProductBtn');
    const categorySelect = document.getElementById('pCategory');
    
    isEditMode = mode === 'edit';
    title.innerText = isEditMode ? "แก้ไขสินค้า" : (type === 'herb' ? "เพิ่มสมุนไพรใหม่" : "เพิ่มอุปกรณ์ใหม่");
    btn.innerText = isEditMode ? "บันทึกการแก้ไข" : "บันทึกและขึ้นขายทันที";
    
    if(!show) {
        document.getElementById('productForm').reset();
        document.getElementById('variantContainer').innerHTML = "";
        addVariant();
        modal.classList.add('hidden');
        return;
    }

    if (!isEditMode) {
        document.getElementById('productForm').reset();
        document.getElementById('variantContainer').innerHTML = "";
        // เซ็ตหมวดหมู่เริ่มต้นตามประเภทที่กด
        if (type === 'herb') categorySelect.value = "Hybrid";
        else categorySelect.value = "Accessories";
        
        addVariant(); // เรียก addVariant หลังจากเซ็ตหมวดหมู่แล้วเพื่อให้หน่วยเปลี่ยนตาม
    }
    
    modal.classList.remove('hidden'); 
}

function editProduct(name) {
    const variants = rawProducts.filter(p => p.name === name);
    if(variants.length === 0) return;
    const base = variants[0];
    oldProductName = name;
    originalVariants = variants.map(v => ({ size: v.size, price: v.price }));
    document.getElementById('pName').value = base.name;
    document.getElementById('pCategory').value = base.category || "Hybrid";
    document.getElementById('pNote').value = base.note || "";
    document.getElementById('pTags').value = base.tags || "";
    document.getElementById('productForm').dataset.existingImage = base.image || "";
    const container = document.getElementById('variantContainer'); container.innerHTML = "";
    variants.forEach(v => addVariant(v.size, v.price, v.stock, v.sold_count));
    toggleProductModal(true, 'edit');
}

async function deleteFullProduct(name) {
    if(!(await customConfirm("ลบสินค้า", `คุณแน่ใจใช่ไหมที่จะลบ "${name}" ออกจากระบบถาวร?`, ""))) return;
    showToast("กำลังลบข้อมูล...", "success");
    const variants = rawProducts.filter(p => p.name === name);
    for(let v of variants) {
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "deleteProduct", name: v.name.trim(), size: v.size.toString().trim() }) });
    }
    showToast("ลบสินค้าเรียบร้อยแล้ว", "success");
    loadProducts();
}

async function saveProduct() {
    const btn = document.getElementById('saveProductBtn');
    const fileInput = document.getElementById('pImage');
    const name = document.getElementById('pName').value;
    const category = document.getElementById('pCategory').value;
    const note = document.getElementById('pNote').value;
    const tags = document.getElementById('pTags').value;
    const variantRows = document.querySelectorAll('.variant-row');
    const isHerb = ["Indica", "Sativa", "Hybrid"].includes(category);
    const variants = Array.from(variantRows).map(row => {
        let sizeVal = row.querySelector('.v-size').value;
        if (!sizeVal && !isHerb) sizeVal = "Standard";
        if (sizeVal && !sizeVal.toString().endsWith('G') && isHerb) sizeVal += 'G';
        return { size: sizeVal, price: row.querySelector('.v-price').value, stock: row.querySelector('.v-stock').value || 0, sold: row.querySelector('.v-sold').value || 0 };
    }).filter(v => v.size && v.price && (isHerb ? v.size !== 'G' : true));

    if(!name || variants.length === 0) return alert("กรุณากรอกข้อมูลที่สำคัญให้ครบ");

    btn.disabled = true;
    btn.innerHTML = isEditMode ? "กำลังบันทึก..." : "กำลังอัปโหลดรูป...";

    let imageUrl = document.getElementById('productForm').dataset.existingImage || "";
    const imgbbUrl = getImgbbUploadUrl();
    if (fileInput.files.length > 0 && imgbbUrl) {
        try {
            btn.innerHTML = "กำลังบีบอัดรูปภาพ...";
            const optimizedImg = await compressImage(fileInput.files[0]);
            btn.innerHTML = "กำลังอัปโหลดรูปภาพ...";
            const formData = new FormData(); formData.append('image', optimizedImg);
            const imgRes = await fetch(imgbbUrl, { method: 'POST', body: formData });
            const imgData = await imgRes.json();
            if (imgData.success) imageUrl = imgData.data.url;
        } catch(e) { console.error("Img Upload Fail", e); showToast("อัปโหลดรูปภาพล้มเหลว", "error"); }
    }

    try {
        if(isEditMode) {
            const toUpdate = [], toAdd = [];
            variants.forEach((v, idx) => { if (idx < originalVariants.length) toUpdate.push({ variant: v, oldSize: originalVariants[idx].size }); else toAdd.push(v); });
            const toDelete = originalVariants.slice(variants.length);
            for (let item of toUpdate) { 
                await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "updateProduct", oldName: oldProductName.trim(), oldSize: item.oldSize.toString().trim(), name: name.trim(), category, note, tags, image: imageUrl, size: item.variant.size.toString().trim(), price: item.variant.price, stock: item.variant.stock, sold_count: item.variant.sold, status: parseInt(item.variant.stock) > 0 ? "มีของ" : "หมด" }) });
            }
            for (let v of toAdd) { 
                await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "addProduct", name: name.trim(), category, note, tags, image: imageUrl, size: v.size.toString().trim(), price: v.price, stock: v.stock, sold_count: v.sold, status: parseInt(v.stock) > 0 ? "มีของ" : "หมด" }) });
            }
            for (let oldV of toDelete) { 
                await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "deleteProduct", name: oldProductName.trim(), size: oldV.size.toString().trim() }) });
            }
        } else {
            for(let variant of variants) { 
                await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "addProduct", name: name.trim(), category, note, tags, image: imageUrl, size: variant.size.toString().trim(), price: variant.price, stock: variant.stock, sold_count: variant.sold, status: parseInt(variant.stock) > 0 ? "มีของ" : "หมด" }) });
            }
        }
        showToast(isEditMode ? "แก้ไขข้อมูลสำเร็จ!" : "เพิ่มสินค้าสำเร็จ!", "success");
        toggleProductModal(false); 
        setTimeout(loadProducts, 2000); // รอ 2 วินาทีเพื่อให้ CSV อัปเดตฝั่ง Google
    } catch (err) { 
        console.error("Save error:", err);        showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
    } finally { 
        btn.disabled = false; btn.innerHTML = isEditMode ? "บันทึกการแก้ไข" : "บันทึกและขึ้นขายทันที"; 
    }
}

// === EXPOSE GLOBALS ===
window.checkPass = checkPass;
window.logout = logout;
window.switchTab = switchTab;
window.loadData = loadData;
window.updateConfirm = updateConfirm;
window.toggleProductModal = toggleProductModal;
window.editProduct = editProduct;
window.deleteFullProduct = deleteFullProduct;
window.saveProduct = saveProduct;
window.addVariant = addVariant;
window.removeVariant = removeVariant;
