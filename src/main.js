import './style.css';
import Papa from 'papaparse';

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1rczsaPil58aAm_kw1FdhopdJA0U6v6x2ELROaupP09g/gviz/tq?tqx=out:csv";
const GAS_URL = "https://script.google.com/macros/s/AKfycbzZHV5tAWeWmPGq9cI84I3RwpnrtdimMbdpMjXo0yQ-eemH4vZiz6hKoIyhk-1nuFc4ZA/exec";

let products = []; // Keyed by Name
let cart = [];
let currentCategory = "All";

// --- AI: SMART STRAIN CLASSIFIER ---
const STRAIN_DB = {
    sativa: ["haze", "sour diesel", "durban", "jack herer", "green crack", "ghost train", "strawberry cough", "thai", "acapulco", "amnesia", "clem", "tangie"],
    indica: ["kush", "cake", "cookie", "northern lights", "purple", "berry", "grape", "afghan", "bubba", "granddaddy", "godfather", "white widow", "gorb", "runtz"],
    hybrid: ["gorilla", "glue", "wedding", "sherbert", "gelato", "z-", "lemon cherry", "skunk", "cheese", "blue dream", "mac", "ak-47", "girl scout"]
};

function classifyStrain(name) {
    const n = name.toLowerCase();
    if (STRAIN_DB.sativa.some(s => n.includes(s))) return "Sativa";
    if (STRAIN_DB.indica.some(i => n.includes(i))) return "Indica";
    if (STRAIN_DB.hybrid.some(h => n.includes(h))) return "Hybrid";
    
    // Logic for accessories or other items
    const others = ["paper", "bong", "grinder", "lighter", "ถ่าน", "บ้อง", "กระดาษ", "ไฟแช็ค"];
    if (others.some(o => n.includes(o))) return "Other";
    
    return "Hybrid"; // Default for unknown strains
}

// --- CUSTOM UI: TOAST ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
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

// --- CUSTOM UI: PULL TO REFRESH ---
let touchStart = 0;
let isRefreshing = false;
document.addEventListener('touchstart', e => { touchStart = e.touches[0].pageY; }, { passive: true });
document.addEventListener('touchmove', e => {
    const touchMove = e.touches[0].pageY;
    if (window.scrollY === 0 && touchMove > touchStart + 80 && !isRefreshing) {
        isRefreshing = true;
        document.body.classList.add('ptr-loading');
        if (window.navigator.vibrate) window.navigator.vibrate(10); // Subtle Haptic
        loadProductsFromSheet(() => {
            renderProducts();
            setTimeout(() => {
                document.body.classList.remove('ptr-loading');
                isRefreshing = false;
                showToast("อัปเดตข้อมูลเรียบร้อย!");
            }, 500);
        });
    }
}, { passive: true });

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
                        aiType: classifyStrain(item.name) // Auto-classify using AI logic
                    };
                }
                
                const stock = parseInt(item.stock) || 0;
                const sold = parseInt(item.sold_count) || 0;
                
                grouped[item.name].variants.push({
                    size: item.size || '1G',
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
    const grid = document.getElementById("productGrid");
    if (!grid) return; // safeguard
    grid.innerHTML = "";
    // If filter is an object (due to event listener binding instead of direct call), handle it.
    let q = "";
    if (typeof filter === "string") q = filter.toLowerCase();
    
    // Apply Filters: Search + Category
    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(q) || p.note.toLowerCase().includes(q);
        const matchesCategory = currentCategory === "All" || p.aiType === currentCategory;
        return matchesSearch && matchesCategory;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-2 text-center text-slate-400 py-10">ไม่พบสินค้า</div>`;
        return;
    }

    filtered.forEach((p, pIdx) => {
        const card = document.createElement("div");
        card.className = "bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col";
        const isOutOfStock = p.status === 'หมด' || p.status === 'sold out' || p.status === '0';
        
        // Select Current Variant
        const variant = p.variants[p.selectedVariantIdx];
        const isVariantOutOfStock = variant.stock <= 0;

        // Priority loading for top items
        const priorityAttr = pIdx < 4 ? 'fetchpriority="high"' : 'loading="lazy"';

        card.innerHTML = `
            <div class="h-32 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                <img src="${p.image}" 
                     ${priorityAttr} 
                     class="w-full h-full object-cover img-fade-in ${isOutOfStock || isVariantOutOfStock ? 'grayscale opacity-75' : ''}" 
                     onload="this.classList.add('img-loaded')"
                     onerror="this.outerHTML='<span class=\\'text-3xl\\'>🌿</span>';" />
                <div class="absolute top-2 left-2 flex flex-col gap-1">
                    ${p.tags.length ? `<span class="bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm w-fit">${p.tags[0]}</span>` : ''}
                    ${p.totalSold > 0 ? `<span class="bg-orange-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm w-fit">ขายแล้ว ${p.totalSold}+</span>` : ''}
                </div>
                ${(isOutOfStock || isVariantOutOfStock) ? `<div class="absolute inset-0 bg-slate-900/40 flex items-center justify-center transition-all opacity-100"><span class="bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">หมดชั่วคราว</span></div>` : ''}
            </div>
            <div class="p-3 flex-1 flex flex-col">
                <div class="flex-1">
                    <h3 class="font-bold text-slate-800 leading-tight text-sm">${p.name}</h3>
                    <p class="text-[10px] text-slate-400 mt-1 line-clamp-1">${p.note}</p>
                </div>
                
                <!-- VARIANT SELECTOR -->
                <div class="mt-3 flex flex-wrap gap-1">
                    ${p.variants.map((v, vIdx) => `
                        <button onclick="window.selectVariant(${pIdx}, ${vIdx})" class="px-2 py-1 text-[10px] border rounded-lg transition-all font-bold ${p.selectedVariantIdx === vIdx ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 text-slate-500 border-slate-100'} ${v.stock <= 0 ? 'opacity-40' : ''}">
                            ${v.size}
                        </button>
                    `).join('')}
                </div>

                ${variant.stock > 0 && variant.stock <= 5 ? `<p class="text-[9px] text-red-500 font-bold mt-2">🔥 เหลือเพียง ${variant.stock} ชิ้น!</p>` : ''}

                <div class="mt-3 flex items-center justify-between">
                    <p class="font-bold text-emerald-600 text-sm">${variant.price.toLocaleString()} ฿</p>
                    <button onclick="window.addToCart(${pIdx}, ${p.selectedVariantIdx})" ${isOutOfStock || isVariantOutOfStock ? 'disabled' : ''} class="bg-emerald-100 text-emerald-700 p-2 rounded-lg hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-30">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function switchCategory(cat) {
    currentCategory = cat;
    // Update UI
    document.querySelectorAll('.category-tab').forEach(t => {
        t.classList.replace('category-tab-active', 'category-tab-inactive');
    });
    const tabEl = document.getElementById('tab-' + cat);
    if(tabEl) tabEl.classList.replace('category-tab-inactive', 'category-tab-active');
    
    // Check if search input exists
    const searchInput = document.getElementById('searchInput');
    renderProducts(searchInput ? searchInput.value : "");
}

function selectVariant(pIdx, vIdx) {
    products[pIdx].selectedVariantIdx = vIdx;
    const searchInput = document.getElementById('searchInput');
    renderProducts(searchInput ? searchInput.value : "");
}

// --- CART LOGIC ---
function addToCart(pIdx, vIdx) {
    const product = products[pIdx];
    const variant = product.variants[vIdx];
    
    const existing = cart.find(item => item.name === product.name && item.size === variant.size);
    if (existing) existing.qty++;
    else cart.push({ name: product.name, size: variant.size, price: variant.price, qty: 1, image: product.image });

    updateCartUI();
    toggleCart(true);
    showToast(`เพิ่ม ${product.name} ลงในตะกร้าแล้ว!`);
}

function toggleCart(force = null) {
    const sidebar = document.getElementById("cartSidebar");
    const overlay = document.getElementById("cartOverlay");
    const isOpen = force !== null ? force : sidebar.classList.contains("translate-x-full");
    sidebar.classList.toggle("translate-x-full", !isOpen);
    overlay.classList.toggle("hidden", !isOpen);
}

function updateCartUI() {
    const container = document.getElementById("cartItemsContainer");
    const badge = document.getElementById("cartCountBadge");
    const subtotalEl = document.getElementById("cartSubtotal");
    const checkoutBtn = document.getElementById("checkoutBtn");

    const count = cart.reduce((sum, i) => sum + i.qty, 0);
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
    document.getElementById("cartTotalCount").textContent = `(${count})`;

    let subtotal = 0;
    container.innerHTML = cart.length === 0 ? `<div class="text-center py-20 text-slate-400">ยังไม่มีสินค้าในตะกร้า</div>` : '';
    
    cart.forEach((item, idx) => {
        subtotal += item.price * item.qty;
        container.innerHTML += `
            <div class="flex gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <img src="${item.image}" class="w-16 h-16 object-cover rounded-xl bg-white shadow-sm" onerror="this.outerHTML='🌿';">
                <div class="flex-1">
                    <h4 class="font-bold text-slate-800 text-sm">${item.name}</h4>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${item.size}</p>
                    <div class="flex justify-between items-center mt-2">
                        <p class="text-emerald-600 font-bold text-sm">${(item.price * item.qty).toLocaleString()} ฿</p>
                        <div class="flex items-center gap-3">
                            <button onclick="window.updateQty(${idx}, -1)" class="w-6 h-6 border flex items-center justify-center p-1 rounded-full">-</button>
                            <span class="text-sm font-bold">${item.qty}</span>
                            <button onclick="window.updateQty(${idx}, 1)" class="w-6 h-6 border flex items-center justify-center p-1 rounded-full">+</button>
                        </div>
                    </div>
                </div>
            </div>`;
    });

    subtotalEl.textContent = subtotal.toLocaleString() + " ฿";
    checkoutBtn.disabled = cart.length === 0;
}

function updateQty(idx, change) {
    cart[idx].qty += change;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    updateCartUI();
}

// --- CHECKOUT ---
function goToCheckout() { document.getElementById('checkoutModal').classList.remove('hidden'); }
function closeCheckout() { document.getElementById('checkoutModal').classList.add('hidden'); }

function previewSlip(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('slipPreview').innerHTML = `<img src="${e.target.result}" class="h-32 w-auto mx-auto rounded-xl shadow-md"><p class="mt-2 text-xs text-emerald-600 font-bold">✓ เลือกสลิปแล้ว</p>`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// --- NEW: Geolocation Helper ---
function getCurrentLocation(event) {
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

    if (!navigator.geolocation) {
        showToast("เบราว์เซอร์ของคุณไม่รองรับการระบุพิกัด", "error");
        btn.disabled = false;
        btn.innerHTML = originalText;
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
            document.getElementById('custMap').value = mapUrl;
            btn.disabled = false;
            btn.innerHTML = "✅ สำเร็จ!";
            showToast("ดึงพิกัดปัจจุบันเรียบร้อย!");
            setTimeout(() => { btn.innerHTML = originalText; }, 2000);
        },
        (err) => {
            showToast("ไม่สามารถดึงพิกัดได้ กรุณากดอนุญาตการเข้าถึงตำแหน่ง", "error");
            btn.disabled = false;
            btn.innerHTML = originalText;
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}

async function submitOrder() {
    const btn = document.getElementById('confirmBtn');
    const data = {
        name: "Customer (" + document.getElementById('custPhone').value + ")", // Use Phone as placeholder name
        phone: document.getElementById('custPhone').value,
        address: "Google Maps Pin: " + document.getElementById('custMap').value, // Use Pin as address
        map: document.getElementById('custMap').value,
        slip: document.getElementById('slipInput').files[0]
    };

    if(!data.phone || !data.map || !data.slip) return showToast("กรุณากรอกข้อมูลและแนบสลิปให้ครบถ้วน", "error");

    btn.disabled = true;
    btn.innerHTML = "กำลังบันทึกออเดอร์...";

    try {
        // 1. Upload Slip
        const formData = new FormData(); formData.append('image', data.slip);
        const imgRes = await fetch(`https://api.imgbb.com/1/upload?key=467157500c7b535f4c9839accf416565`, { method: 'POST', body: formData });
        const imgData = await imgRes.json();
        if(!imgData.success) throw new Error("Upload Fail");

        // 2. Log to Sheet
        let orderItems = cart.map(i => `${i.name} [${i.size}] x${i.qty}`).join(', ');
        let itemsArray = cart.map(i => ({ name: i.name, size: i.size, qty: i.qty }));
        let subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

        await fetch(GAS_URL, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({
                action: "log", name: data.name, phone: data.phone, address: data.address,
                mapUrl: data.map, items: orderItems, itemsArray: itemsArray, total: subtotal, slipUrl: imgData.data.url, status: "รอดำเนินการ"
            })
        });

        // 3. To LINE & Celebration
        const lineMsg = `🌿 ออเดอร์ใหม่! [GUNSHA v1.2.0]\n📞 เบอร์: ${data.phone}\n📍 พิกัดจัดส่ง: ${data.map}\n\n🛒 รายการ:\n${orderItems}\n💰 ยอดรวม: ${subtotal} บาท\n\n🖼️ สลิป: ${imgData.data.url}`;
        
        // --- CELEBRATION ---
        document.getElementById('finalOrderTotal').textContent = subtotal.toLocaleString() + " ฿";
        document.getElementById('successModal').classList.remove('hidden');
        
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#ffffff', '#fbbf24', '#ef4444']
        });

        // Wait 3 seconds before auto redirect or let user click
        setTimeout(() => {
            window.location.href = `https://line.me/R/oaMessage/@640tybpp/?${encodeURIComponent(lineMsg)}`;
        }, 3000);
    } catch(e) {
        showToast("เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง", "error");
        btn.disabled = false;
        btn.innerHTML = "ยืนยันและสั่งซื้อ";
    }
}

// === EXPOSE TO GLOBAL FOR INLINE HTML HANDLERS ===
window.handleLogoClick = handleLogoClick;
window.toggleCart = toggleCart;
window.renderProducts = renderProducts;
window.switchCategory = switchCategory;
window.selectVariant = selectVariant;
window.addToCart = addToCart;
window.updateQty = updateQty;
window.goToCheckout = goToCheckout;
window.closeCheckout = closeCheckout;
window.previewSlip = previewSlip;
window.getCurrentLocation = getCurrentLocation;
window.submitOrder = submitOrder;

// Setup input listeners to avoid parameter passing issues
document.addEventListener('DOMContentLoaded', () => {
    loadProductsFromSheet(renderProducts);
});
