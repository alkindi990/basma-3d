/* =========================================================
   متجر بصمة ثلاثية الأبعاد — منطق التطبيق
   ========================================================= */

/* ====== الإعدادات (عدّلها حسب حاجتك) ====== */
const CONFIG = {
  whatsappNumber: "96877280090",      // رقم واتساب البائع (بصيغة دولية بدون + أو 00)
  currency: "ر.ع",                     // العملة (الريال العماني)
  priceDecimals: 3,                    // عدد المنازل العشرية للسعر
  adminPassword: "admin",              // كلمة مرور دخول وضع الإدارة (غيّرها)
  storeName: "متجر بصمة ثلاثية الأبعاد",
  // مستودع GitHub لزر «نشر التعديلات» (يحفظ products.json / settings.json مباشرة)
  github: { owner: "alkindi990", repo: "basma-3d", branch: "main" },
};

/* ====== قائمة افتراضية احتياطية ======
   تُستخدم فقط إذا تعذّر تحميل products.json (مثلاً عند فتح الملف مباشرةً عبر file://).
   على GitHub Pages سيُحمَّل products.json تلقائيًا. */
const DEFAULT_PRODUCTS = [
  { id: "p1", code: "BK-001", name: "مجسم برج خليفة", description: "مجسم ثلاثي الأبعاد مفصّل لبرج خليفة بدقة عالية، مناسب للديكور والهدايا.", price: 12.5, images: [], emoji: "🏙️" },
  { id: "p2", code: "CR-002", name: "مجسم سيارة كلاسيكية", description: "مجسم سيارة كلاسيكية بتفاصيل دقيقة وألوان قابلة للتخصيص.", price: 9, images: [], emoji: "🚗" },
  { id: "p3", code: "VL-003", name: "مجسم فيلا معمارية", description: "مجسم معماري لفيلا حديثة، مثالي لعرض المشاريع العقارية.", price: 18, images: [], emoji: "🏛️" },
  { id: "p4", code: "CH-004", name: "مجسم شخصية كرتونية", description: "مجسم لشخصية كرتونية محبوبة، تصميم مرح ومناسب للأطفال.", price: 7.5, images: [], emoji: "🦸" },
  { id: "p5", code: "PL-005", name: "مجسم طائرة", description: "مجسم طائرة بتفاصيل واقعية، قطعة مميزة لعشاق الطيران.", price: 11, images: [], emoji: "✈️" },
  { id: "p6", code: "LG-006", name: "لوجو ثلاثي الأبعاد مخصص", description: "اطبع شعار شركتك أو اسمك بتصميم ثلاثي الأبعاد أنيق وحسب الطلب.", price: 15, images: [], emoji: "🔷" },
];

/* ====== إعدادات الموقع الافتراضية (الاسم والشعار) ====== */
const DEFAULT_SETTINGS = {
  storeName: "متجر بصمة ثلاثية الأبعاد",
  tagline: "تصاميم ثلاثية الأبعاد",
  logo: "🧊", // إيموجي أو رابط/صورة (data URL)
};

const STORAGE_KEYS = { products: "d3_products", cart: "d3_cart", settings: "d3_settings", ghToken: "d3_gh_token" };

/* ====== الحالة ====== */
let products = [];          // قائمة المنتجات
let cart = {};              // خريطة: id -> الكمية
let settings = { ...DEFAULT_SETTINGS };
let isAdmin = false;
let lastFocused = null;     // العنصر الذي كان مُركّزًا قبل فتح النافذة (لاستعادة التركيز)
let formImages = [];        // صور المنتج الحالية في النموذج (data URL من الرفع أو روابط)
let settingsLogo = "";      // شعار الموقع الحالي في نافذة الإعدادات

/* ====== أدوات مساعدة ====== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function formatPrice(value) {
  const num = Number(value) || 0;
  // تنسيق بمنازل عشرية ثم إزالة الأصفار الزائدة (مع الإبقاء على عدد صحيح نظيف)
  let s = num.toFixed(CONFIG.priceDecimals);
  if (s.includes(".")) s = s.replace(/\.?0+$/, "") || "0"; // أبقِ على الرقم 0 عند سعر صفر
  return `${s} ${CONFIG.currency}`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 2600);
}

function makeId() {
  return "p" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

/* ====== التحميل والحفظ ====== */
async function loadProducts() {
  // 1) محاولة استخدام النسخة المحلية (تعديلات الإدارة)
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.products);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) { /* تجاهل */ }

  // 2) محاولة تحميل products.json
  try {
    const res = await fetch("products.json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch (e) { /* قد يفشل عند فتح الملف عبر file:// */ }

  // 3) القائمة الاحتياطية
  return DEFAULT_PRODUCTS.slice();
}

function persistProducts() {
  try { localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products)); }
  catch (e) { showToast("تعذّر الحفظ في المتصفح"); }
}

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.cart) || "{}");
    if (saved && typeof saved === "object") cart = saved;
  } catch (e) { cart = {}; }
}

function persistCart() {
  try { localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart)); }
  catch (e) { /* تجاهل */ }
}

/* ====== إعدادات الموقع (الاسم/الشعار) ====== */
function isImageSrc(value) {
  return /^(data:image\/|https?:\/\/)/i.test(value || "");
}

async function loadSettings() {
  // 1) النسخة المحلية (تعديلات الإدارة)
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.settings);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) { /* تجاهل */ }

  // 2) ملف settings.json
  try {
    const res = await fetch("settings.json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") return { ...DEFAULT_SETTINGS, ...data };
    }
  } catch (e) { /* قد يفشل عبر file:// */ }

  // 3) الافتراضي
  return { ...DEFAULT_SETTINGS };
}

function persistSettings() {
  try { localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings)); }
  catch (e) { showToast("تعذّر حفظ الإعدادات في المتصفح"); }
}

function applySettings() {
  const name = settings.storeName || DEFAULT_SETTINGS.storeName;
  $("#brandTitle").textContent = name;
  $("#brandTagline").textContent = settings.tagline || "";
  $("#footerStore").textContent = name;
  document.title = settings.tagline ? `${name} — ${settings.tagline}` : name;

  // الشعار: صورة أو إيموجي
  const logoEl = $("#brandLogo");
  logoEl.textContent = "";
  if (isImageSrc(settings.logo)) {
    const img = document.createElement("img");
    img.src = settings.logo;
    img.alt = name;
    logoEl.appendChild(img);
  } else {
    logoEl.textContent = settings.logo || "🧊";
  }
}

/* ====== عرض المنتجات ====== */
// يعيد قائمة صور المنتج (يدعم images[] الجديدة و image القديمة للتوافق)
function getImages(product) {
  if (Array.isArray(product.images)) return product.images.filter(Boolean);
  if (product.image) return [product.image];
  return [];
}

const mediaIndex = {}; // productId -> فهرس الصورة المعروضة (يثبت بين عمليات إعادة الرسم)

function buildMedia(product) {
  const media = document.createElement("div");
  media.className = "card-media";
  const images = getImages(product);

  if (images.length === 0) {
    media.textContent = product.emoji || "🧊";
    return media;
  }

  let idx = mediaIndex[product.id] || 0;
  if (idx < 0 || idx >= images.length) idx = 0;
  mediaIndex[product.id] = idx;

  const img = document.createElement("img");
  img.src = images[idx];
  img.alt = product.name || "صورة المنتج";
  img.loading = "lazy";
  img.addEventListener("error", () => { media.textContent = product.emoji || "🧊"; });
  media.appendChild(img);

  if (images.length > 1) {
    const dots = document.createElement("div");
    dots.className = "media-dots";

    const show = (i) => {
      const n = images.length;
      idx = (i + n) % n;
      mediaIndex[product.id] = idx;
      img.src = images[idx];
      dots.querySelectorAll(".media-dot").forEach((d, di) => d.classList.toggle("active", di === idx));
    };

    images.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "media-dot" + (i === idx ? " active" : "");
      dot.setAttribute("aria-label", `صورة ${i + 1}`);
      dot.addEventListener("click", () => show(i));
      dots.appendChild(dot);
    });

    const prev = document.createElement("button");
    prev.type = "button";
    prev.className = "media-nav media-prev";
    prev.textContent = "‹";
    prev.setAttribute("aria-label", "الصورة السابقة");
    prev.addEventListener("click", () => show(idx - 1));

    const next = document.createElement("button");
    next.type = "button";
    next.className = "media-nav media-next";
    next.textContent = "›";
    next.setAttribute("aria-label", "الصورة التالية");
    next.addEventListener("click", () => show(idx + 1));

    media.append(prev, next, dots);
  }

  return media;
}

function renderProducts() {
  const grid = $("#productsGrid");
  grid.textContent = "";

  $("#emptyState").hidden = products.length > 0;

  products.forEach((product) => {
    const qty = cart[product.id] || 0;

    const card = document.createElement("article");
    card.className = "card" + (qty > 0 ? " is-selected" : "");

    card.appendChild(buildMedia(product));

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = product.name || "بدون اسم";
    body.appendChild(title);

    const desc = document.createElement("p");
    desc.className = "card-desc";
    desc.textContent = product.description || "";
    body.appendChild(desc);

    const foot = document.createElement("div");
    foot.className = "card-foot";

    const price = document.createElement("span");
    price.className = "card-price";
    price.textContent = formatPrice(product.price);
    foot.appendChild(price);

    if (product.code) {
      const code = document.createElement("span");
      code.className = "card-code";
      code.textContent = `كود: ${product.code}`;
      foot.appendChild(code);
    }
    body.appendChild(foot);

    card.appendChild(body);

    // إجراءات الشراء: زر إضافة أو متحكم الكمية
    const actions = document.createElement("div");
    actions.className = "card-actions";
    if (qty > 0) {
      actions.appendChild(buildQtyControl(product.id, qty));
    } else {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-primary";
      addBtn.textContent = "أضف إلى السلة";
      addBtn.addEventListener("click", () => { changeQty(product.id, 1); });
      actions.appendChild(addBtn);
    }
    card.appendChild(actions);

    // أدوات الإدارة (تظهر فقط في وضع الإدارة عبر CSS)
    const adminTools = document.createElement("div");
    adminTools.className = "admin-tools";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-edit btn-sm";
    editBtn.textContent = "✎ تعديل";
    editBtn.addEventListener("click", () => openProductModal(product.id));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-delete btn-sm";
    delBtn.textContent = "🗑 حذف";
    delBtn.addEventListener("click", () => deleteProduct(product.id));

    adminTools.append(editBtn, delBtn);
    card.appendChild(adminTools);

    grid.appendChild(card);
  });
}

function buildQtyControl(productId, qty) {
  const wrap = document.createElement("div");
  wrap.className = "qty-control";

  const minus = document.createElement("button");
  minus.type = "button";
  minus.textContent = "−";
  minus.setAttribute("aria-label", "إنقاص");
  minus.addEventListener("click", () => changeQty(productId, -1));

  const count = document.createElement("span");
  count.textContent = String(qty);

  const plus = document.createElement("button");
  plus.type = "button";
  plus.textContent = "+";
  plus.setAttribute("aria-label", "زيادة");
  plus.addEventListener("click", () => changeQty(productId, 1));

  wrap.append(minus, count, plus);
  return wrap;
}

/* ====== منطق السلة ====== */
function changeQty(productId, delta) {
  const current = cart[productId] || 0;
  const next = current + delta;
  if (next <= 0) delete cart[productId];
  else cart[productId] = next;
  persistCart();
  renderProducts();
  renderCart();
}

function removeFromCart(productId) {
  delete cart[productId];
  persistCart();
  renderProducts();
  renderCart();
}

function cartEntries() {
  // يعيد المنتجات الموجودة فعليًا (يتجاهل أي id محذوف)
  return Object.keys(cart)
    .map((id) => ({ product: products.find((p) => p.id === id), qty: cart[id] }))
    .filter((e) => e.product && e.qty > 0);
}

function cartCount() {
  return cartEntries().reduce((sum, e) => sum + e.qty, 0);
}

function cartTotal() {
  return cartEntries().reduce((sum, e) => sum + (Number(e.product.price) || 0) * e.qty, 0);
}

function renderCart() {
  const entries = cartEntries();
  const count = cartCount();

  // الشارة
  const badge = $("#cartBadge");
  badge.textContent = String(count);
  badge.hidden = count === 0;

  // العناصر
  const list = $("#cartItems");
  list.textContent = "";
  $("#cartEmpty").hidden = entries.length > 0;

  entries.forEach(({ product, qty }) => {
    const item = document.createElement("div");
    item.className = "cart-item";

    const thumb = document.createElement("div");
    thumb.className = "cart-item-thumb";
    const thumbImages = getImages(product);
    if (thumbImages.length) {
      const img = document.createElement("img");
      img.src = thumbImages[0];
      img.alt = product.name || "";
      img.addEventListener("error", () => { thumb.textContent = product.emoji || "🧊"; });
      thumb.appendChild(img);
    } else {
      thumb.textContent = product.emoji || "🧊";
    }

    const info = document.createElement("div");
    info.className = "cart-item-info";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = product.name || "بدون اسم";
    const priceLine = document.createElement("div");
    priceLine.className = "price";
    priceLine.textContent = `${formatPrice(product.price)} × ${qty}`;
    info.append(name, priceLine);
    if (product.code) {
      const codeLine = document.createElement("div");
      codeLine.className = "code";
      codeLine.textContent = `كود: ${product.code}`;
      info.append(codeLine);
    }

    const qtyCtrl = buildQtyControl(product.id, qty);

    const remove = document.createElement("button");
    remove.className = "cart-item-remove";
    remove.type = "button";
    remove.setAttribute("aria-label", "إزالة");
    remove.textContent = "🗑";
    remove.addEventListener("click", () => removeFromCart(product.id));

    item.append(thumb, info, qtyCtrl, remove);
    list.appendChild(item);
  });

  // الإجمالي والزر
  $("#cartTotal").textContent = formatPrice(cartTotal());
  $("#sendOrderBtn").disabled = entries.length === 0;
}

/* ====== إرسال الطلب عبر واتساب ====== */
function buildOrderMessage() {
  const entries = cartEntries();
  const lines = [];
  lines.push(`مرحبًا 👋، أرغب بطلب المجسمات التالية من ${settings.storeName || CONFIG.storeName}:`);
  lines.push("");
  entries.forEach((e, i) => {
    const lineTotal = (Number(e.product.price) || 0) * e.qty;
    const codeStr = e.product.code ? ` (كود: ${e.product.code})` : "";
    lines.push(`${i + 1}. ${e.product.name}${codeStr} — ${e.qty} × ${formatPrice(e.product.price)} = ${formatPrice(lineTotal)}`);
  });
  lines.push("");
  lines.push(`الإجمالي: ${formatPrice(cartTotal())}`);
  return lines.join("\n");
}

function sendOrder() {
  if (cartEntries().length === 0) return;
  const message = buildOrderMessage();
  const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener");
}

/* ====== الإدارة: إضافة/تعديل/حذف ====== */
function openProductModal(productId) {
  const modal = $("#productModal");
  const form = $("#productForm");
  lastFocused = document.activeElement;
  form.reset();
  $("#formError").hidden = true;

  // إعادة ضبط حقول الصور
  $("#fieldImageFile").value = "";
  if ($("#fieldImageUrl")) $("#fieldImageUrl").value = "";
  formImages = [];

  if (productId) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    $("#modalTitle").textContent = "تعديل المنتج";
    $("#fieldId").value = p.id;
    $("#fieldName").value = p.name || "";
    $("#fieldCode").value = p.code || "";
    $("#fieldDescription").value = p.description || "";
    $("#fieldPrice").value = p.price ?? "";
    $("#fieldEmoji").value = p.emoji || "";
    formImages = getImages(p).slice();
  } else {
    $("#modalTitle").textContent = "إضافة منتج";
    $("#fieldId").value = "";
  }
  renderFormImages();

  $("#modalOverlay").hidden = false;
  modal.hidden = false;
  updateScrollLock();
  $("#fieldName").focus();
}

function closeProductModal() {
  $("#productModal").hidden = true;
  $("#modalOverlay").hidden = true;
  updateScrollLock();
  if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  lastFocused = null;
}

function handleProductSubmit(event) {
  event.preventDefault();
  const id = $("#fieldId").value;
  const name = $("#fieldName").value.trim();
  const priceRaw = $("#fieldPrice").value;
  const price = parseFloat(priceRaw);

  const errEl = $("#formError");
  if (!name) { errEl.textContent = "الرجاء إدخال اسم المنتج."; errEl.hidden = false; return; }
  if (!isFinite(price) || price < 0) { errEl.textContent = "الرجاء إدخال سعر صحيح."; errEl.hidden = false; return; }

  const data = {
    name,
    code: $("#fieldCode").value.trim(),
    description: $("#fieldDescription").value.trim(),
    price,
    emoji: $("#fieldEmoji").value.trim(),
    images: formImages.slice(),
  };

  if (id) {
    const idx = products.findIndex((p) => p.id === id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...data };
      delete products[idx].image; // أزل الحقل القديم المفرد بعد التحويل إلى images[]
    }
    showToast("تم تحديث المنتج");
  } else {
    products.push({ id: makeId(), ...data });
    showToast("تمت إضافة المنتج");
  }

  persistProducts();
  closeProductModal();
  renderProducts();
  renderCart();
}

function deleteProduct(productId) {
  const p = products.find((x) => x.id === productId);
  if (!p) return;
  if (!confirm(`هل تريد حذف "${p.name}"؟`)) return;
  products = products.filter((x) => x.id !== productId);
  delete cart[productId];
  persistProducts();
  persistCart();
  renderProducts();
  renderCart();
  showToast("تم حذف المنتج");
}

/* ====== تصدير / استرجاع ====== */
function exportProducts() {
  const json = JSON.stringify(products, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("تم تنزيل products.json — ارفعه على GitHub لحفظ التعديلات للجميع");
}

async function resetProducts() {
  if (!confirm("سيتم إلغاء التعديلات المحلية والرجوع إلى ملف products.json. متابعة؟")) return;
  try { localStorage.removeItem(STORAGE_KEYS.products); } catch (e) {}
  products = await loadProducts();
  renderProducts();
  renderCart();
  showToast("تمت إعادة التحميل من products.json");
}

/* ====== وضع الإدارة ====== */
function toggleAdmin() {
  if (isAdmin) { exitAdmin(); return; }
  const pass = prompt("أدخل كلمة مرور الإدارة:");
  if (pass === null) return;
  if (pass !== CONFIG.adminPassword) { showToast("كلمة المرور غير صحيحة"); return; }
  isAdmin = true;
  document.body.classList.add("admin-mode");
  $("#adminBar").hidden = false;
  showToast("تم تفعيل وضع الإدارة");
}

function exitAdmin() {
  isAdmin = false;
  document.body.classList.remove("admin-mode");
  $("#adminBar").hidden = true;
}

/* ====== لوحة السلة (فتح/إغلاق) ====== */
function openCart() { $("#cartOverlay").hidden = false; $("#cartPanel").hidden = false; updateScrollLock(); }
function closeCart() { $("#cartOverlay").hidden = true; $("#cartPanel").hidden = true; updateScrollLock(); }

/* قفل تمرير الصفحة عند فتح السلة أو النافذة */
function updateScrollLock() {
  const anyOpen = !$("#productModal").hidden || !$("#cartPanel").hidden || !$("#settingsModal").hidden;
  document.body.style.overflow = anyOpen ? "hidden" : "";
}

/* حصر التركيز (Tab) داخل النافذة المفتوحة لتحسين الوصول */
function trapTab(event, container) {
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const focusables = Array.from(container.querySelectorAll(selector)).filter((el) => el.offsetParent !== null);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

/* ====== رفع صور المنتج (متعددة) ====== */
// يرسم معاينات الصور الحالية مع زر إزالة لكل صورة
function renderFormImages() {
  const wrap = $("#imagesPreview");
  wrap.textContent = "";
  wrap.hidden = formImages.length === 0;
  formImages.forEach((src, i) => {
    const cell = document.createElement("div");
    cell.className = "thumb";
    const img = document.createElement("img");
    img.src = src;
    img.alt = `صورة ${i + 1}`;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "thumb-remove";
    rm.textContent = "✕";
    rm.setAttribute("aria-label", "إزالة الصورة");
    rm.addEventListener("click", () => { formImages.splice(i, 1); renderFormImages(); });
    cell.append(img, rm);
    wrap.appendChild(cell);
  });
}

function addImageUrl() {
  const input = $("#fieldImageUrl");
  const value = input.value.trim();
  if (!value) return;
  formImages.push(value);
  input.value = "";
  renderFormImages();
}

// يقرأ صورة من الجهاز ويصغّرها (لتقليل الحجم) ثم يعيدها كـ data URL
function readImageFile(file, maxDim) {
  maxDim = maxDim || 900;
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error("الملف المختار ليس صورة")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذّر قراءة الملف"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("تعذّر فتح الصورة"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        // PNG يحافظ على الشفافية، وغيره يُحوّل إلى JPEG لتصغير الحجم
        const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
        try { resolve(canvas.toDataURL(mime, 0.85)); }
        catch (e) { reject(new Error("تعذّر معالجة الصورة")); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleImageFile(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  let added = 0;
  for (const file of files) {
    try {
      const dataUrl = await readImageFile(file, 900);
      formImages.push(dataUrl);
      added++;
    } catch (err) {
      showToast(err.message || "تعذّر رفع إحدى الصور");
    }
  }
  event.target.value = ""; // اسمح بإعادة اختيار نفس الملفات لاحقًا
  renderFormImages();
  if (added) showToast(added > 1 ? `تم تحميل ${added} صور ✅` : "تم تحميل الصورة ✅");
}

/* ====== نافذة إعدادات الموقع ====== */
function setLogoPreview(src) {
  const wrap = $("#logoPreviewWrap");
  const img = $("#logoPreview");
  if (src) { img.src = src; wrap.hidden = false; }
  else { img.removeAttribute("src"); wrap.hidden = true; }
}

function openSettingsModal() {
  lastFocused = document.activeElement;
  $("#settingsError").hidden = true;
  $("#fieldStoreName").value = settings.storeName || "";
  $("#fieldTagline").value = settings.tagline || "";
  $("#fieldGhToken").value = localStorage.getItem(STORAGE_KEYS.ghToken) || "";
  $("#fieldLogoFile").value = "";
  settingsLogo = settings.logo || "🧊";
  if (isImageSrc(settingsLogo)) {
    $("#fieldLogoEmoji").value = "";
    setLogoPreview(settingsLogo);
  } else {
    $("#fieldLogoEmoji").value = settingsLogo;
    setLogoPreview("");
  }
  $("#settingsOverlay").hidden = false;
  $("#settingsModal").hidden = false;
  updateScrollLock();
  $("#fieldStoreName").focus();
}

function closeSettingsModal() {
  $("#settingsModal").hidden = true;
  $("#settingsOverlay").hidden = true;
  updateScrollLock();
  if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  lastFocused = null;
}

async function handleLogoFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const dataUrl = await readImageFile(file, 256); // الشعار صغير
    settingsLogo = dataUrl;
    $("#fieldLogoEmoji").value = "";
    setLogoPreview(dataUrl);
    showToast("تم تحميل الشعار ✅");
  } catch (err) {
    showToast(err.message || "تعذّر رفع الشعار");
    event.target.value = "";
  }
}

function clearLogo() {
  settingsLogo = "🧊";
  $("#fieldLogoFile").value = "";
  $("#fieldLogoEmoji").value = "🧊";
  setLogoPreview("");
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  const storeName = $("#fieldStoreName").value.trim();
  const errEl = $("#settingsError");
  if (!storeName) { errEl.textContent = "الرجاء إدخال اسم الموقع."; errEl.hidden = false; return; }

  // إذا كتب المستخدم إيموجي ولم يرفع صورة، استخدم الإيموجي
  const emoji = $("#fieldLogoEmoji").value.trim();
  let logo = settingsLogo;
  if (!isImageSrc(settingsLogo) && emoji) logo = emoji;
  if (!logo) logo = "🧊";

  settings = { storeName, tagline: $("#fieldTagline").value.trim(), logo };
  persistSettings();
  applySettings();

  // رمز النشر يُخزَّن منفصلًا في هذا الجهاز فقط (لا يدخل ضمن settings.json المنشور)
  const token = $("#fieldGhToken").value.trim();
  try {
    if (token) localStorage.setItem(STORAGE_KEYS.ghToken, token);
    else localStorage.removeItem(STORAGE_KEYS.ghToken);
  } catch (e) { /* تجاهل */ }

  closeSettingsModal();
  showToast("تم حفظ إعدادات الموقع");
}

function exportSettings() {
  const json = JSON.stringify(settings, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "settings.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("تم تنزيل settings.json — ارفعه على GitHub لتثبيت الاسم والشعار للجميع");
}

/* ====== النشر إلى GitHub (حفظ مباشر للملفات) ====== */
// ترميز نص UTF-8 (يدعم العربية) إلى Base64 لرفعه عبر GitHub API
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

async function putFileToGitHub(token, path, contentStr, message) {
  const { owner, repo, branch } = CONFIG.github;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // احصل على sha الحالي للملف (إن وُجد) للتحديث فوقه
  let sha;
  const getRes = await fetch(`${apiUrl}?ref=${branch}`, { headers, cache: "no-store" });
  if (getRes.ok) {
    const info = await getRes.json();
    sha = info.sha;
  } else if (getRes.status === 401) {
    throw new Error("الرمز غير صالح أو منتهي الصلاحية");
  } else if (getRes.status !== 404) {
    throw new Error(`تعذّر قراءة ${path} (${getRes.status})`);
  }

  const body = { message, content: utf8ToBase64(contentStr), branch };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiUrl, { method: "PUT", headers, body: JSON.stringify(body) });
  if (!putRes.ok) {
    if (putRes.status === 401) throw new Error("الرمز غير صالح أو منتهي الصلاحية");
    if (putRes.status === 403 || putRes.status === 404) throw new Error("الرمز لا يملك صلاحية الكتابة على المستودع");
    let detail = "";
    try { detail = (await putRes.json()).message || ""; } catch (e) {}
    throw new Error(`تعذّر نشر ${path} (${putRes.status}) ${detail}`);
  }
}

async function publishToGitHub() {
  const token = (localStorage.getItem(STORAGE_KEYS.ghToken) || "").trim();
  if (!token) {
    showToast("أضِف رمز النشر من «⚙️ إعدادات الموقع» أولًا");
    openSettingsModal();
    setTimeout(() => $("#fieldGhToken").focus(), 50);
    return;
  }

  const btn = $("#publishBtn");
  btn.classList.add("is-busy");
  btn.textContent = "⏳ جارٍ النشر...";
  showToast("جارٍ النشر إلى GitHub...");

  try {
    await putFileToGitHub(token, "products.json", JSON.stringify(products, null, 2), "تحديث المنتجات عبر لوحة الإدارة");
    await putFileToGitHub(token, "settings.json", JSON.stringify(settings, null, 2), "تحديث إعدادات الموقع عبر لوحة الإدارة");
    showToast("تم النشر ✅ ستظهر التعديلات لكل الأجهزة خلال ~دقيقة");
  } catch (err) {
    showToast("فشل النشر: " + (err.message || "خطأ غير معروف"));
  } finally {
    btn.classList.remove("is-busy");
    btn.textContent = "⬆️ نشر التعديلات";
  }
}

/* ====== رابط الإدارة الخاص (#admin) ====== */
function maybeRevealAdmin() {
  const hash = (location.hash || "").replace("#", "").toLowerCase();
  const hasQueryFlag = new URLSearchParams(location.search).has("admin");
  if (hash === "admin" || hasQueryFlag) {
    $("#adminToggleBtn").hidden = false;
  }
}

/* ====== ربط الأحداث والتهيئة ====== */
function bindEvents() {
  $("#adminToggleBtn").addEventListener("click", toggleAdmin);
  $("#adminExitBtn").addEventListener("click", exitAdmin);
  $("#publishBtn").addEventListener("click", publishToGitHub);
  $("#addProductBtn").addEventListener("click", () => openProductModal(null));
  $("#exportBtn").addEventListener("click", exportProducts);
  $("#resetBtn").addEventListener("click", resetProducts);

  $("#cartToggleBtn").addEventListener("click", openCart);
  $("#cartCloseBtn").addEventListener("click", closeCart);
  $("#cartOverlay").addEventListener("click", closeCart);
  $("#sendOrderBtn").addEventListener("click", sendOrder);

  $("#productForm").addEventListener("submit", handleProductSubmit);
  $("#modalCloseBtn").addEventListener("click", closeProductModal);
  $("#modalCancelBtn").addEventListener("click", closeProductModal);
  $("#modalOverlay").addEventListener("click", closeProductModal);

  // رفع صور المنتجات (متعددة) + إضافة برابط
  $("#fieldImageFile").addEventListener("change", handleImageFile);
  $("#addImageUrlBtn").addEventListener("click", addImageUrl);
  $("#fieldImageUrl").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addImageUrl(); } // لا تُرسِل النموذج
  });

  // إعدادات الموقع (الاسم/الشعار)
  $("#siteSettingsBtn").addEventListener("click", openSettingsModal);
  $("#settingsForm").addEventListener("submit", handleSettingsSubmit);
  $("#settingsCloseBtn").addEventListener("click", closeSettingsModal);
  $("#settingsCancelBtn").addEventListener("click", closeSettingsModal);
  $("#settingsOverlay").addEventListener("click", closeSettingsModal);
  $("#exportSettingsBtn").addEventListener("click", exportSettings);
  $("#fieldLogoFile").addEventListener("change", handleLogoFile);
  $("#removeLogoBtn").addEventListener("click", clearLogo);
  $("#fieldLogoEmoji").addEventListener("input", (e) => {
    settingsLogo = e.target.value.trim();
    setLogoPreview("");
  });

  // إظهار زر الإدارة عند الدخول عبر رابط الإدارة
  window.addEventListener("hashchange", maybeRevealAdmin);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeProductModal(); closeCart(); closeSettingsModal(); }
    if (e.key === "Tab" && !$("#productModal").hidden) trapTab(e, $("#productModal"));
    if (e.key === "Tab" && !$("#settingsModal").hidden) trapTab(e, $("#settingsModal"));
    if (e.key === "Tab" && !$("#cartPanel").hidden) trapTab(e, $("#cartPanel"));
  });
}

async function init() {
  $("#year").textContent = new Date().getFullYear();
  bindEvents();
  maybeRevealAdmin();
  loadCart();
  settings = await loadSettings();
  applySettings();
  products = await loadProducts();
  renderProducts();
  renderCart();
}

document.addEventListener("DOMContentLoaded", init);
