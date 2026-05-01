import './style.css';
import Papa from 'papaparse';
import confetti from 'canvas-confetti';
import { SHEET_CSV_URL, GAS_URL, SHOP_NAME, SHOP_VERSION, buildLineUrl, getImgbbUploadUrl } from './config.js';

let products = []; // Keyed by Name
let cart = [];
let currentCategory = "All";
let currentLineUrl = "";

// --- AI: SMART STRAIN CLASSIFIER ---
const STRAIN_DB = {
    sativa: ["haze", "sour diesel", "durban", "jack herer", "green crack", "ghost train", "strawberry cough", "thai", "acapulco", "amnesia", "clem", "tangie"],
    indica: ["kush", "cake", "cookie", "northern lights", "purple", "berry", "grape", "afghan", "bubba", "granddaddy", "godfather", "white widow", "gorb", "runtz"],
    hybrid: ["gorilla", "glue", "wedding", "sherbert", "gelato", "z-", "lemon cherry", "skunk", "cheese", "blue dream", "mac", "ak-47", "girl scout"],
    accessories: ["bong", "grinder", "blender", "lighter", "บ้อง", "เครื่องบด", "เครื่องปั่น", "ไกเดอร์", "ไฟแช็ค", "หลุม"],
    rolling: ["paper", "roll", "raw", "ocb", "filter", "tips", "กระดาษ", "มวน", "ก้นกรอง", "พันลำ"]
};

function classifyStrain(name) {
    const n = name.toLowerCase();
    if (STRAIN_DB.sativa.some(s => n.includes(s))) return "Sativa";
    if (STRAIN_DB.indica.some(i => n.includes(i))) return "Indica";
    if (STRAIN_DB.hybrid.some(h => n.includes(h))) return "Hybrid";
    if (STRAIN_DB.accessories.some(a => n.includes(a))) return "Accessories";
    if (STRAIN_DB.rolling.some(r => n.includes(r))) return "Rolling";
    
    return "Other"; // Default for unknown strains
}

// --- CUSTOM UI: TOAST ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Secret Admin Access
let logoClickCount = 0;
let logoClickTimeout;
function handleLogoClick() {
    logoClickCount++;
    clearTimeout(logoClickTimeout);
    if (logoClickCount >= 5) { window.location.href = "admin.html"; logoClickCount = 0; }
    logoClickTimeout = setTimeout(() => { logoClickCount = 0; }, 2000);
}

function loadProductsFromSheet(callback) {
    Papa.parse(SHEET_CSV_URL, {
        download: true, header: true,
        complete: function(results) {
            const data = results.data;
            const grouped = {};
            
            data.forEach(item => {
                if(!item.name) return;
                if(!grouped[item.name]) {
                    let tags = [];
                    if (item.tags) tags = item.tags.split(',').map(t => t.trim()).filter(t => t !== '');
                    grouped[item.name] = {
                        name: item.name,
                        note: item.note || '',
                        image: item.image || '',
                        tags: tags,
                        status: (item.status || '').trim().toLowerCase(),
                        variants: [],
                        selectedVariantIdx: 0,
                        totalSold: 0,
                        aiType: item["หมวดหมู่"] || classifyStrain(item.name)
                    };
                }
                
                const stock = parseInt(item.stock) || 0;
                const sold = parseInt(item.sold_count) || 0;
                
                grouped[item.name].variants.push({
                    size: item.size || 'Standard',
                    price: parseFloat(item.price) || 0,
                    stock: stock,
                    sold: sold
                });
                grouped[item.name].totalSold += sold;
            });

            products = Object.values(grouped);
            if (callback) callback();
        }
    });
}

function renderProducts(filter = "") {
    const grid = document.getElementById("productList"); // Note ID change for accessories.html
    if (!grid) return;
    grid.innerHTML = "";
    let q = "";
    if (typeof filter === "string") q = filter.toLowerCase();
    
    // Apply Filters: Search + Category + Accessories Only
    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(q) || p.note.toLowerCase().includes(q);
        const matchesCategory = currentCategory === "All" || p.aiType === currentCategory;
        const isAccessory = ["Accessories", "Rolling"].includes(p.aiType);
        return matchesSearch && matchesCategory && isAccessory;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center text-slate-400 py-10">ไม่พบสินค้าในหมวดหมู่นี้</div>`;
        return;
    }

    filtered.forEach((p) => {
        const card = document.createElement("div");
        card.className = "bg-white rounded-3xl p-3 border border-slate-50 flex flex-col animate-in";
        const isOutOfStock = p.status === 'หมด' || p.status === 'sold out' || p.status === '0';
        const variant = p.variants[p.selectedVariantIdx];
        const isVariantOutOfStock = variant.stock <= 0;
        const pNameEscaped = p.name.replace(/'/g, "\\'");

        card.innerHTML = `
            <div class="aspect-square bg-slate-50 rounded-2xl mb-3 relative overflow-hidden">
                <img src="${p.image}" class="w-full h-full object-cover ${isOutOfStock || isVariantOutOfStock ? 'grayscale opacity-50' : ''}" onerror="this.outerHTML='<span class=\\'text-3xl flex items-center justify-center h-full\\'>🏺</span>';" />
                ${(isOutOfStock || isVariantOutOfStock) ? `<div class="absolute inset-0 flex items-center justify-center"><span class="bg-slate-900 text-white text-[10px] font-bold px-3 py-1 rounded-full">หมด</span></div>` : ''}
            </div>
            <div class="flex-1 flex flex-col">
                <h3 class="font-bold text-slate-800 text-sm line-clamp-1">${p.name}</h3>
                <p class="text-[10px] text-slate-400 mt-0.5 line-clamp-1">${p.note}</p>
                
                <!-- VARIANT SELECTOR -->
                <div class="mt-2 flex flex-wrap gap-1">
                    ${p.variants.length > 1 ? p.variants.map((v, vIdx) => `
                        <button onclick="window.selectVariant('${pNameEscaped}', ${vIdx})" class="px-2 py-0.5 text-[9px] border rounded-lg transition-all font-bold ${p.selectedVariantIdx === vIdx ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white text-slate-400 border-slate-100'}">
                            ${v.size}
                        </button>
                    `).join('') : ''}
                </div>

                <div class="mt-auto pt-3 flex items-center justify-between">
                    <p class="font-black text-slate-900 text-sm">${variant.price.toLocaleString()} ฿</p>
                    <button onclick="window.addToCart('${pNameEscaped}', ${p.selectedVariantIdx})" ${isOutOfStock || isVariantOutOfStock ? 'disabled' : ''} class="w-8 h-8 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 transition active:scale-90 disabled:opacity-20">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function selectVariant(pName, vIdx) {
    const product = products.find(p => p.name === pName);
    if (product) {
        product.selectedVariantIdx = vIdx;
        renderProducts();
    }
}

function switchCategory(cat) {
    currentCategory = cat;
    document.querySelectorAll('.category-tab').forEach(t => {
        t.classList.remove('category-tab-active');
        t.classList.add('category-tab-inactive');
    });
    const tabEl = document.getElementById('tab-' + cat);
    if(tabEl) {
        tabEl.classList.remove('category-tab-inactive');
        tabEl.classList.add('category-tab-active');
    }
    renderProducts();
}

// Reuse cart logic from main.js or slightly adapt
function addToCart(pName, vIdx) {
    const product = products.find(p => p.name === pName);
    if (!product) return;
    const variant = product.variants[vIdx];
    const existing = cart.find(item => item.name === product.name && item.size === variant.size);
    if (existing) existing.qty++;
    else cart.push({ name: product.name, size: variant.size, price: variant.price, qty: 1, image: product.image });
    updateCartUI();
    toggleCart(true);
}

function toggleCart(force = null) {
    const sidebar = document.getElementById("cartSidebar");
    const content = document.getElementById("cartContent");
    const isOpen = force !== null ? force : sidebar.classList.contains("hidden");
    if (isOpen) {
        sidebar.classList.remove("hidden");
        setTimeout(() => content.classList.remove("translate-y-full"), 10);
    } else {
        content.classList.add("translate-y-full");
        setTimeout(() => sidebar.classList.add("hidden"), 300);
    }
}

function updateCartUI() {
    const container = document.getElementById("cartItems");
    const badge = document.getElementById("cartCount");
    const totalEl = document.getElementById("cartTotal");
    const count = cart.reduce((sum, i) => sum + i.qty, 0);
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
    let total = 0;
    let cartHTML = '';

    if (cart.length === 0) {
        cartHTML = `<div class="text-center py-20 text-slate-400">รถเข็นว่างเปล่า</div>`;
    } else {
        cartHTML = cart.map((item, idx) => {
            total += item.price * item.qty;
            return `
                <div class="flex gap-4 items-center">
                    <img src="${item.image}" class="w-16 h-16 object-cover rounded-2xl bg-slate-50">
                    <div class="flex-1">
                        <h4 class="font-bold text-slate-800 text-sm">${item.name}</h4>
                        <p class="text-xs text-slate-900 font-black mt-1">${item.price.toLocaleString()} ฿</p>
                    </div>
                    <div class="flex items-center gap-3 bg-slate-50 p-2 rounded-xl">
                        <button onclick="window.updateQty(${idx}, -1)" class="w-6 h-6 flex items-center justify-center font-bold">-</button>
                        <span class="text-xs font-bold w-4 text-center">${item.qty}</span>
                        <button onclick="window.updateQty(${idx}, 1)" class="w-6 h-6 flex items-center justify-center font-bold">+</button>
                    </div>
                </div>`;
        }).join('');
    }

    container.innerHTML = cartHTML;
    totalEl.textContent = total.toLocaleString() + " ฿";
}

function updateQty(idx, change) {
    cart[idx].qty += change;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    updateCartUI();
}

function goToCheckout() { document.getElementById('checkoutModal').classList.remove('hidden'); }
function closeCheckout() { document.getElementById('checkoutModal').classList.add('hidden'); }

function previewSlip(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('slipPreview').src = e.target.result;
            document.getElementById('slipPreview').classList.remove('hidden');
            document.getElementById('slipPlaceholder').classList.add('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function getCurrentLocation() {
    if (!navigator.geolocation) return showToast("ไม่รองรับ GPS", "error");
    navigator.geolocation.getCurrentPosition((pos) => {
        const url = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
        document.getElementById('custMap').textContent = url;
        document.getElementById('custMap').classList.remove('hidden');
        showToast("ดึงพิกัดสำเร็จ!");
    }, (err) => {
        showToast("ไม่สามารถดึงพิกัดได้", "error");
    });
}

async function submitOrder() {
    const btn = document.getElementById('submitOrderBtn');
    const imgbbUrl = getImgbbUploadUrl();
    const phone = document.getElementById('custPhone').value;
    const map = document.getElementById('custMap').textContent;
    const slip = document.getElementById('custSlip').files[0];

    if(!phone || !map || !slip) return showToast("กรุณากรอกข้อมูลให้ครบ", "error");
    
    btn.disabled = true;
    btn.textContent = "กำลังดำเนินการ...";

    try {
        // 1. Upload Slip
        const formData = new FormData(); formData.append('image', slip);
        const imgRes = await fetch(imgbbUrl, { method: 'POST', body: formData });
        const imgData = await imgRes.json();
        if(!imgData.success) throw new Error("Upload Fail");

        // 2. Log to Sheet
        const orderItems = cart.map(i => `${i.name} [${i.size}] x${i.qty}`).join(', ');
        const itemsArray = cart.map(i => ({ name: i.name, size: i.size, qty: i.qty }));
        const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

        await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "log", name: "AccCust (" + phone + ")", phone, address: "Map: " + map,
                mapUrl: map, items: orderItems, itemsArray: itemsArray, total: subtotal, slipUrl: imgData.data.url, status: "รอดำเนินการ"
            })
        });

        // 3. Premium LINE Message
        const itemsDetail = cart.map(i => `- ${i.name.toUpperCase()} x${i.qty}`).join('\n');
        const lineMsg = `🏺 ออเดอร์อุปกรณ์! [${SHOP_NAME} v${SHOP_VERSION}]
📞 เบอร์: ${phone}
📍 พิกัดจัดส่ง: ${map}

🛒 รายการ:
${itemsDetail}
💰 ยอดรวม: ${subtotal.toLocaleString()} บาท

🖼️ สลิป: ${imgData.data.url}`;
        
        // Build direct OA URL
        currentLineUrl = buildLineUrl(lineMsg);

        document.getElementById('finalOrderTotal').textContent = subtotal.toLocaleString() + " ฿";
        document.getElementById('successModal').classList.remove('hidden');
        
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        
        // Auto redirect after 3s
        setTimeout(() => { if(currentLineUrl) window.location.href = currentLineUrl; }, 3000);
    } catch(e) { 
        showToast("เกิดข้อผิดพลาด", "error"); 
        btn.disabled = false; 
        btn.textContent = "สั่งซื้ออีกครั้ง"; 
    }
}

window.toggleCart = toggleCart;
window.switchCategory = switchCategory;
window.selectVariant = selectVariant;
window.addToCart = addToCart;
window.updateQty = updateQty;
window.goToCheckout = goToCheckout;
window.closeCheckout = closeCheckout;
window.previewSlip = previewSlip;
window.getCurrentLocation = getCurrentLocation;
window.submitOrder = submitOrder;
window.redirectToLine = () => { if(currentLineUrl) window.location.href = currentLineUrl; };

document.addEventListener('DOMContentLoaded', () => { loadProductsFromSheet(renderProducts); });
