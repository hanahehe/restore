// ══════════════════════════════════════════════════
//  Restore — app.js
//  Auth, db.json loading, Store, Canteen, Vendor
// ══════════════════════════════════════════════════

// ── State ──────────────────────────────────────────
let DB = { users: [], products: [], menu: [], orders: [] };
let currentUser = null;
let vendorCleanup = null;
let vendorViewMode = null;
const SESS = 'ce_session';
const ORDERS_KEY = 'ce_orders';

// ── Helpers ────────────────────────────────────────
const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const icons = () => lucide.createIcons();
function icon(el) { lucide.createIcons({ nodes: [el] }); }

function toast(msg, type = 'info') {
    const wrap = $('toasts'), el = document.createElement('div');
    const c = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-primary' };
    const ic = { success: 'check-circle', error: 'alert-circle', info: 'info' };
    el.className = `flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-xl pointer-events-auto animate-slide-up ${c[type]}`;
    el.innerHTML = `<i data-lucide="${ic[type]}" class="w-4 h-4 shrink-0"></i><span>${msg}</span>`;
    wrap.appendChild(el); icon(el);
    setTimeout(() => { el.style.cssText = 'opacity:0;transform:translateY(8px);transition:all .3s'; setTimeout(() => el.remove(), 320); }, 3000);
}

function showErr(id, msg) {
    const el = $(id); el.classList.remove('hidden');
    el.querySelector('span').textContent = msg;
}
function hideErr(id) { $(id).classList.add('hidden'); }

function loader(show) { $('loader').classList.toggle('hidden', !show); }

// ── Load db.json ────────────────────────────────────
async function loadDB() {
    loader(true);
    try {
        const res = await fetch('db.json');
        if (!res.ok) throw new Error();
        const data = await res.json();
        DB.users = data.users || [];
        DB.products = data.products || [];
        DB.menu = data.menu || [];
        // Merge any local overrides (so vendor changes persist across page loads)
        const saved = {};
        if (localStorage.getItem('ce_products')) saved.products = JSON.parse(localStorage.getItem('ce_products'));
        if (localStorage.getItem('ce_menu')) saved.menu = JSON.parse(localStorage.getItem('ce_menu'));
        if (localStorage.getItem(ORDERS_KEY)) DB.orders = JSON.parse(localStorage.getItem(ORDERS_KEY));
        if (saved.products) DB.products = saved.products;
        if (saved.menu) DB.menu = saved.menu;
    } catch (e) {
        toast('Could not load db.json — using local cache or defaults', 'error');
        // fallback to localStorage or empty
        if (localStorage.getItem('ce_products')) DB.products = JSON.parse(localStorage.getItem('ce_products'));
        if (localStorage.getItem('ce_menu')) DB.menu = JSON.parse(localStorage.getItem('ce_menu'));
        if (localStorage.getItem(ORDERS_KEY)) DB.orders = JSON.parse(localStorage.getItem(ORDERS_KEY));
    }
    // Merge db.json users with locally registered users
    const localUsers = JSON.parse(localStorage.getItem('ce_users') || '[]');
    localUsers.forEach(lu => { if (!DB.users.find(u => u.email === lu.email)) DB.users.push(lu); });
    loader(false);
}

function persist() {
    localStorage.setItem('ce_products', JSON.stringify(DB.products));
    localStorage.setItem('ce_menu', JSON.stringify(DB.menu));
    localStorage.setItem(ORDERS_KEY, JSON.stringify(DB.orders));
}

// ── Auth ────────────────────────────────────────────
function initAuth() {
    const loginForm = $('login-form'), signupForm = $('signup-form');
    const tabLogin = $('tab-login'), tabSignup = $('tab-signup');

    // tab switching
    tabLogin.addEventListener('click', () => {
        loginForm.classList.remove('hidden'); signupForm.classList.add('hidden');
        tabLogin.classList.add('bg-white/10', 'text-white'); tabLogin.classList.remove('text-slate-400');
        tabSignup.classList.remove('bg-white/10', 'text-white'); tabSignup.classList.add('text-slate-400');
        hideErr('login-err'); hideErr('signup-err');
    });
    tabSignup.addEventListener('click', () => {
        signupForm.classList.remove('hidden'); loginForm.classList.add('hidden');
        tabSignup.classList.add('bg-white/10', 'text-white'); tabSignup.classList.remove('text-slate-400');
        tabLogin.classList.remove('bg-white/10', 'text-white'); tabLogin.classList.add('text-slate-400');
        hideErr('login-err'); hideErr('signup-err');
    });

    // password toggles
    function togglePw(eyeId, inputId) {
        $(eyeId).addEventListener('click', () => {
            const inp = $(inputId);
            const isText = inp.type === 'text';
            inp.type = isText ? 'password' : 'text';
            $(eyeId).innerHTML = `<i data-lucide="${isText ? 'eye' : 'eye-off'}" class="w-4 h-4"></i>`;
            icon($(eyeId));
        });
    }
    togglePw('l-eye', 'l-pass'); togglePw('s-eye', 's-pass');

    // Login
    loginForm.addEventListener('submit', e => {
        e.preventDefault(); hideErr('login-err');
        const email = $('l-email').value.trim().toLowerCase();
        const pass = $('l-pass').value;
        const user = DB.users.find(u => u.email.toLowerCase() === email && u.password === pass);
        if (!user) { showErr('login-err', 'Invalid email or password'); return; }
        loginSuccess(user);
    });

    // Signup
    signupForm.addEventListener('submit', e => {
        e.preventDefault(); hideErr('signup-err');
        const name = $('s-name').value.trim();
        const email = $('s-email').value.trim().toLowerCase();
        const pass = $('s-pass').value;
        const role = $('s-role').value;
        if (!name) { showErr('signup-err', 'Please enter your name'); return; }
        if (!email.includes('@')) { showErr('signup-err', 'Enter a valid email'); return; }
        if (pass.length < 6) { showErr('signup-err', 'Password must be at least 6 characters'); return; }
        if (DB.users.find(u => u.email.toLowerCase() === email)) { showErr('signup-err', 'Email already registered'); return; }
        const newUser = {
            id: 'u' + Date.now(), name, email, password: pass, role,
            avatar: name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        };
        DB.users.push(newUser);
        // Persist new user locally
        const localUsers = JSON.parse(localStorage.getItem('ce_users') || '[]');
        localUsers.push(newUser);
        localStorage.setItem('ce_users', JSON.stringify(localUsers));
        toast('Account created! Logging you in…', 'success');
        loginSuccess(newUser);
    });
}

function loginSuccess(user) {
    currentUser = user;
    localStorage.setItem(SESS, JSON.stringify(user));
    $('auth-screen').classList.add('hidden');
    $('main-app').classList.remove('hidden');
    updateUserUI();
    navigate('store');
}

function updateUserUI() {
    if (!currentUser) return;
    $('user-avatar').textContent = currentUser.avatar;
    $('user-name').textContent = currentUser.name;
    let bText = '🎓 Student';
    if (currentUser.role === 'store_vendor') bText = '🏬 Store Owner';
    if (currentUser.role === 'canteen_vendor') bText = '🍔 Canteen Owner';
    $('user-role-badge').textContent = bText;

    $('user-badge').classList.remove('hidden');
    $('mob-avatar').textContent = currentUser.avatar;
    $('mob-name').textContent = currentUser.name;

    let mRole = 'Student';
    if (currentUser.role === 'store_vendor') mRole = 'Store Owner';
    if (currentUser.role === 'canteen_vendor') mRole = 'Canteen Owner';
    $('mob-role').textContent = mRole;

    // Show/hide vendor tab based on role
    const vendorVisible = currentUser.role.includes('vendor');
    $('vendor-nav-btn').style.display = vendorVisible ? '' : 'none';
    $('mob-vendor-btn').style.display = vendorVisible ? '' : 'none';
}

function logout() {
    currentUser = null;
    localStorage.removeItem(SESS);
    if (vendorCleanup) { vendorCleanup(); vendorCleanup = null; }
    $('main-app').classList.add('hidden');
    $('auth-screen').classList.remove('hidden');
    // reset auth form
    $('login-form').reset(); $('signup-form').reset();
    hideErr('login-err'); hideErr('signup-err');
    icons();
}

// ── Router ──────────────────────────────────────────
function navigate(view) {
    if (vendorCleanup) { vendorCleanup(); vendorCleanup = null; }
    document.querySelectorAll('[data-nav]').forEach(b => {
        b.classList.toggle('active', b.dataset.nav === view);
        b.classList.toggle('text-slate-400', b.dataset.nav !== view);
    });
    $('mob-nav').classList.add('hidden');
    const app = $('app'); app.innerHTML = '';
    if (view === 'store') renderStore(app);
    else if (view === 'canteen') renderCanteen(app);
    else renderVendor(app);
    icons();
}

function setupNav() {
    document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', e => navigate(e.currentTarget.dataset.nav)));
    $('mob-menu-btn').addEventListener('click', () => $('mob-nav').classList.toggle('hidden'));
    $('logout-btn').addEventListener('click', logout);
    $('mob-logout').addEventListener('click', logout);
}

// ── STORE VIEW ──────────────────────────────────────
function renderStore(app) {
    app.innerHTML = `
  <div class="animate-slide-up">
    <div class="mb-8"><h1 class="text-3xl font-extrabold mb-1">Stationery &amp; Merch Store</h1><p class="text-slate-400">Everything you need for college life.</p></div>
    <div class="glass rounded-2xl p-4 mb-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      <div class="relative flex-grow text-slate-400 focus-within:text-slate-200 transition-colors">
        <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"></i>
        <input id="st-search" class="inp pl-10" placeholder="Search products…"/>
      </div>
      <div class="flex gap-2 overflow-x-auto hs pb-0.5">
        ${['All', 'Stationery', 'Merch', 'Electronics'].map(c => `<button class="cat-btn whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-all border border-white/[.08] hover:border-primary/50 hover:text-white text-slate-400 ${c === 'All' ? '!border-primary !text-white bg-primary/20' : ''}" data-cat="${c}">${c}</button>`).join('')}
      </div>
    </div>
    <div id="store-grid" class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"></div>
  </div>`;
    icons();
    let q = '', cat = 'All';
    const grid = $('store-grid');

    function render() {
        const list = DB.products.filter(p => {
            const mq = p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
            const mc = cat === 'All' || p.category === cat;
            return mq && mc;
        });
        if (!list.length) { grid.innerHTML = `<div class="col-span-full py-20 text-center text-slate-500 flex flex-col items-center gap-3"><i data-lucide="search-x" class="w-12 h-12 opacity-30"></i><p>No products found.</p></div>`; icons(); return; }
        grid.innerHTML = list.map((p, i) => `
    <div class="card flex flex-col animate-slide-up" style="animation-delay:${i * 40}ms">
      <div class="relative h-44 overflow-hidden group">
        <img src="${p.img}" alt="${p.name}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" onerror="this.src='https://placehold.co/300x300/1e293b/6366f1?text=${encodeURIComponent(p.name)}'">
        <div class="absolute inset-0 bg-gradient-to-t from-bg/80 to-transparent"></div>
        <span class="absolute top-3 right-3 badge ${p.stock > 0 ? 'bs' : 'bd'}">${p.stock > 0 ? `<i data-lucide="check" class="w-3 h-3"></i> ${p.stock} left` : '<i data-lucide="alert-circle" class="w-3 h-3"></i> Out of Stock'}</span>
        <span class="absolute bottom-3 left-3 badge bi">${p.category}</span>
      </div>
      <div class="p-4 flex flex-col flex-grow">
        <h3 class="font-bold text-base mb-1 flex-grow">${p.name}</h3>
        <p class="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary mb-4">₹${p.price}</p>
        ${p.stock > 0
                ? `<button class="btn-o w-full justify-center text-sm opacity-60 cursor-default"><i data-lucide="store" class="w-4 h-4"></i> Available In-Store</button>`
                : `<button class="btn-p w-full justify-center text-sm restock-btn" data-id="${p.id}"><i data-lucide="bell-ring" class="w-4 h-4"></i> Request Restock${p.requests > 0 ? ` (${p.requests})` : ''}</button>`}
      </div>
    </div>`).join('');
        icons();
        grid.querySelectorAll('.restock-btn').forEach(btn => btn.addEventListener('click', e => {
            const p = DB.products.find(x => x.id === e.currentTarget.dataset.id);
            p.requests++; persist();
            toast(`Restock requested for "${p.name}" 🔔`, 'success');
            e.currentTarget.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Requested (${p.requests})`;
            e.currentTarget.disabled = true; icon(e.currentTarget);
        }));
    }

    $('st-search').addEventListener('input', e => { q = e.target.value.toLowerCase(); render(); });
    app.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', e => {
        cat = e.currentTarget.dataset.cat;
        app.querySelectorAll('.cat-btn').forEach(x => { x.classList.remove('!border-primary', '!text-white', 'bg-primary/20'); x.classList.add('text-slate-400', 'border-white/[.08]'); });
        e.currentTarget.classList.add('!border-primary', '!text-white', 'bg-primary/20');
        e.currentTarget.classList.remove('text-slate-400', 'border-white/[.08]');
        render();
    }));
    render();
}

// ── CANTEEN VIEW ─────────────────────────────────────
function renderCanteen(app) {
    let cart = [];
    app.innerHTML = `
  <div class="animate-slide-up">
    <div class="mb-8"><h1 class="text-3xl font-extrabold mb-1">Canteen Pre-ordering</h1><p class="text-slate-400">Order ahead, skip the queue. 🍔</p></div>
    <div class="flex flex-col lg:flex-row gap-8">
      <div class="flex-grow min-w-0">
        <div class="flex gap-2 overflow-x-auto hs pb-2 mb-6">
          ${['All', 'Snacks', 'Meals', 'Beverages'].map(c => `<button class="can-cat whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium border border-white/[.08] transition-all hover:border-primary/50 hover:text-white text-slate-400 ${c === 'All' ? '!border-primary !text-white bg-primary/20' : ''}" data-ccat="${c}">${c}</button>`).join('')}
        </div>
        <div id="menu-grid" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"></div>
      </div>
      <div class="w-full lg:w-80 shrink-0">
        <div class="glass rounded-2xl p-6 sticky top-24">
          <h3 class="text-lg font-bold mb-4 pb-4 border-b border-white/[.08] flex items-center gap-2"><i data-lucide="shopping-cart" class="w-5 h-5 text-secondary"></i> Your Cart</h3>
          <div id="cart-list" class="min-h-[110px] max-h-72 overflow-y-auto space-y-2 mb-4 hs"></div>
          <div class="border-t border-white/[.08] pt-4 space-y-4">
            <div class="flex justify-between items-center"><span class="text-slate-400 text-sm">Total</span><span id="cart-total" class="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">₹0</span></div>
            <div>
              <label class="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-widest">Pickup Time Slot</label>
              <select id="pickup-time" class="inp appearance-none cursor-pointer text-sm"></select>
            </div>
            <button id="checkout-btn" class="btn-p w-full justify-center text-base py-3 font-bold" disabled><i data-lucide="zap" class="w-5 h-5"></i> Checkout &amp; Get QR</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
    icons();
    // Time slots
    const sel = $('pickup-time'); const now = new Date();
    for (let i = 1; i <= 8; i++) { const t = new Date(now.getTime() + i * 15 * 60000); sel.innerHTML += `<option>${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</option>`; }
    let mf = 'All';
    const menuGrid = $('menu-grid'), cartList = $('cart-list'), cartTot = $('cart-total'), chkBtn = $('checkout-btn');

    function rMenu() {
        const items = DB.menu.filter(m => mf === 'All' || m.category === mf);
        menuGrid.innerHTML = items.map((it, i) => `
    <div class="card flex flex-col ${!it.available ? 'opacity-50 grayscale' : ''} animate-slide-up" style="animation-delay:${i * 35}ms">
      <div class="relative h-36 overflow-hidden group">
        <img src="${it.img}" alt="${it.name}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" onerror="this.src='https://placehold.co/300x300/1e293b/6366f1?text=${encodeURIComponent(it.name)}'">
        <div class="absolute inset-0 bg-gradient-to-t from-bg/70 to-transparent"></div>
        <span class="absolute top-2 right-2 badge ${it.available ? 'bs' : 'bd'}">${it.available ? 'Available' : 'Unavailable'}</span>
      </div>
      <div class="p-4 flex flex-col flex-grow">
        <h4 class="font-bold text-sm flex-grow">${it.name}</h4><p class="text-xs text-slate-500 mb-3">${it.category}</p>
        <div class="flex justify-between items-center">
          <span class="font-extrabold text-green-400">₹${it.price}</span>
          <button class="add-btn w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 text-primary hover:bg-primary hover:text-white transition-all flex items-center justify-center" data-mid="${it.id}" ${!it.available ? 'disabled' : ''}><i data-lucide="plus" class="w-4 h-4 pointer-events-none"></i></button>
        </div>
      </div>
    </div>`).join('');
        icons();
        menuGrid.querySelectorAll('.add-btn').forEach(b => b.addEventListener('click', e => {
            const id = e.currentTarget.dataset.mid;
            const it = DB.menu.find(m => m.id === id);
            const ex = cart.find(c => c.id === id);
            if (ex) ex.qty++; else cart.push({ ...it, qty: 1 });
            rCart(); toast(`${it.name} added to cart`, 'success');
        }));
    }

    function rCart() {
        if (!cart.length) {
            cartList.innerHTML = `<div class="text-center py-8 text-slate-600 flex flex-col items-center gap-2"><i data-lucide="shopping-cart" class="w-10 h-10 opacity-25"></i><p class="text-sm">Cart is empty</p></div>`;
            cartTot.textContent = '₹0'; chkBtn.disabled = true; icon(cartList); return;
        }
        const tot = cart.reduce((s, c) => s + c.price * c.qty, 0);
        cartList.innerHTML = cart.map((it, i) => `
    <div class="flex items-center gap-2 p-2 rounded-xl bg-white/[.04] border border-white/[.06] animate-fade-in" style="animation-delay:${i * 25}ms">
      <span class="text-sm font-medium truncate flex-grow">${it.name}</span>
      <span class="text-xs text-green-400 font-bold shrink-0">₹${it.price * it.qty}</span>
      <div class="flex items-center gap-1 bg-black/20 rounded-lg p-0.5 shrink-0">
        <button class="cdec w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center transition" data-cid="${it.id}"><i data-lucide="minus" class="w-3 h-3 pointer-events-none"></i></button>
        <span class="text-xs font-bold w-4 text-center">${it.qty}</span>
        <button class="cinc w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center transition" data-cid="${it.id}"><i data-lucide="plus" class="w-3 h-3 pointer-events-none"></i></button>
      </div>
    </div>`).join('');
        cartTot.textContent = `₹${tot}`; chkBtn.disabled = false; icon(cartList);
        cartList.querySelectorAll('.cdec').forEach(b => b.addEventListener('click', e => {
            const id = e.currentTarget.dataset.cid, it = cart.find(c => c.id === id);
            if (it.qty > 1) it.qty--; else cart = cart.filter(c => c.id !== id); rCart();
        }));
        cartList.querySelectorAll('.cinc').forEach(b => b.addEventListener('click', e => { cart.find(c => c.id === e.currentTarget.dataset.cid).qty++; rCart(); }));
    }

    chkBtn.addEventListener('click', () => {
        if (!cart.length) return;
        const orderId = 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
        const pickup = sel.value;
        const order = { id: orderId, userId: currentUser.id, userName: currentUser.name, items: cart.map(c => ({ name: c.name, qty: c.qty, price: c.price })), total, pickup, status: 'Pending', ts: Date.now() };
        DB.orders.push(order); persist();
        $('m-id').textContent = orderId; $('m-pick').textContent = pickup; $('m-total').textContent = `₹${total}`;
        const qt = $('qrcode-target'); qt.innerHTML = '';
        new QRCode(qt, { text: JSON.stringify({ orderId, verify: true }), width: 180, height: 180, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.H });
        $('qr-modal').classList.remove('hidden'); icon($('qr-modal'));
        cart = []; rCart(); toast('Order placed! Show QR at counter.', 'success');
    });
    $('qr-close').addEventListener('click', () => $('qr-modal').classList.add('hidden'));

    app.querySelectorAll('.can-cat').forEach(b => b.addEventListener('click', e => {
        mf = e.currentTarget.dataset.ccat;
        app.querySelectorAll('.can-cat').forEach(x => { x.classList.remove('!border-primary', '!text-white', 'bg-primary/20'); x.classList.add('text-slate-400', 'border-white/[.08]'); });
        e.currentTarget.classList.add('!border-primary', '!text-white', 'bg-primary/20');
        e.currentTarget.classList.remove('text-slate-400', 'border-white/[.08]');
        rMenu();
    }));
    rMenu(); rCart();
}

// ── VENDOR VIEW ──────────────────────────────────────
function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function statusBadge(status) {
    const map = {
        'Pending': { cls: 'bw', icon: 'clock', label: '⏳ Pending' },
        'Preparing': { cls: 'bi', icon: 'chef-hat', label: '👨‍🍳 Preparing' },
        'Ready': { cls: 'bs', icon: 'package-check', label: '✅ Ready for Pickup' },
        'Picked Up': { cls: 'bs', icon: 'check-circle', label: '🎉 Picked Up' },
    };
    const s = map[status] || map['Pending'];
    return `<span class="badge ${s.cls}">${s.label}</span>`;
}

function renderVendor(app) {
    if (!currentUser?.role.includes('vendor')) {
        app.innerHTML = `<div class="py-20 text-center text-slate-500"><i data-lucide="shield-off" class="w-16 h-16 mx-auto mb-4 opacity-30"></i><p class="text-lg">Vendor access only.</p></div>`;
        icons(); return;
    }

    // Default view mode to their role if not set
    if (!vendorViewMode) {
        vendorViewMode = currentUser.role === 'store_vendor' ? 'store' : 'canteen';
    }

    const isCanteen = vendorViewMode === 'canteen';
    const isStore = vendorViewMode === 'store';

    const pendingCount = DB.orders.filter(o => o.status === 'Pending').length;
    const preparingCount = DB.orders.filter(o => o.status === 'Preparing').length;
    const readyCount = DB.orders.filter(o => o.status === 'Ready').length;
    const pickedCount = DB.orders.filter(o => o.status === 'Picked Up').length;

    let html = `
    <div class="animate-slide-up">
      <div class="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold mb-1 text-transparent bg-clip-text bg-gradient-to-r from-secondary to-primary">${isCanteen ? 'Canteen Dashboard' : 'Store Dashboard'}</h1>
          <p class="text-slate-400">Manage ${isCanteen ? 'orders & menu items' : 'inventory & restock requests'}.</p>
        </div>
        <div class="flex gap-1 bg-black/20 p-1 rounded-xl border border-white/[.06] shrink-0">
          <button id="vdash-canteen" class="px-4 py-2 text-sm font-bold rounded-lg ${isCanteen ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:text-white'} transition-all"><i data-lucide="utensils" class="w-4 h-4 inline mr-1"></i>Canteen</button>
          <button id="vdash-store" class="px-4 py-2 text-sm font-bold rounded-lg ${isStore ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:text-white'} transition-all"><i data-lucide="shopping-bag" class="w-4 h-4 inline mr-1"></i>Store</button>
        </div>
      </div>`;

    if (isCanteen) {
        // Canteen Stats
        html += `
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div class="glass rounded-2xl p-4 text-center"><p class="text-2xl font-black text-yellow-400">${pendingCount}</p><p class="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Pending</p></div>
        <div class="glass rounded-2xl p-4 text-center"><p class="text-2xl font-black text-primary">${preparingCount}</p><p class="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Preparing</p></div>
        <div class="glass rounded-2xl p-4 text-center"><p class="text-2xl font-black text-green-400">${readyCount}</p><p class="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Ready</p></div>
        <div class="glass rounded-2xl p-4 text-center"><p class="text-2xl font-black text-yellow-500">${DB.menu.filter(m => !m.available).length}</p><p class="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Unavailable Items</p></div>
      </div>
      
      <!-- Canteen Orders Top -->
      <div class="glass rounded-2xl p-6 mb-8">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 class="text-lg font-bold flex items-center gap-2"><i data-lucide="clipboard-list" class="w-5 h-5 text-secondary"></i> Order Management</h3>
          <div class="flex gap-1 bg-black/20 p-1 rounded-xl border border-white/[.06] overflow-x-auto hs">
            <button class="ord-tab px-3 py-1.5 text-xs font-bold rounded-lg bg-yellow-500/20 text-yellow-400 transition-all" data-otab="Pending">⏳ Pending <span class="ml-1 px-1.5 py-0.5 bg-yellow-500/30 rounded-full text-[10px]">${pendingCount}</span></button>
            <button class="ord-tab px-3 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition-all" data-otab="Preparing">👨‍🍳 Preparing <span class="ml-1 px-1.5 py-0.5 bg-white/10 rounded-full text-[10px]">${preparingCount}</span></button>
            <button class="ord-tab px-3 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition-all" data-otab="Ready">✅ Ready <span class="ml-1 px-1.5 py-0.5 bg-white/10 rounded-full text-[10px]">${readyCount}</span></button>
            <button class="ord-tab px-3 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition-all" data-otab="Picked Up">🎉 Completed <span class="ml-1 px-1.5 py-0.5 bg-white/10 rounded-full text-[10px]">${pickedCount}</span></button>
          </div>
        </div>
        <div id="orders-list" class="space-y-3 max-h-[500px] overflow-y-auto hs"></div>
      </div>
      
      <!-- Bottom row: Menu + QR -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-8">
          <div class="glass rounded-2xl p-6">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-lg font-bold flex items-center gap-2"><i data-lucide="settings-2" class="w-5 h-5 text-primary"></i> Menu Availability</h3>
            </div>
            <div id="inv-list" class="space-y-3 max-h-96 overflow-y-auto hs"></div>
          </div>
        </div>
        <div>
          <div class="glass rounded-2xl p-6 sticky top-24">
            <h3 class="text-lg font-bold mb-4 pb-4 border-b border-white/[.08] flex items-center gap-2"><i data-lucide="scan-line" class="w-5 h-5 text-primary"></i> Scan Student QR</h3>
            <div id="qr-reader" class="mb-4 rounded-2xl overflow-hidden min-h-[220px]"></div>
            <div id="scan-result" class="hidden space-y-3 animate-fade-in">
              <div class="glass rounded-xl p-4 text-sm space-y-2">
                <div class="flex justify-between"><span class="text-slate-400">Order ID</span><span id="sr-id" class="font-mono font-bold"></span></div>
                <div class="flex justify-between"><span class="text-slate-400">Customer</span><span id="sr-user" class="font-semibold"></span></div>
                <div class="flex justify-between"><span class="text-slate-400">Pickup</span><span id="sr-pick"></span></div>
                <div class="flex justify-between"><span class="text-slate-400">Status</span><span id="sr-status"></span></div>
                <div class="flex justify-between"><span class="text-slate-400">Total</span><span id="sr-total" class="font-bold text-green-400"></span></div>
              </div>
              <button id="btn-pickup" class="btn-p w-full justify-center hidden"><i data-lucide="package-check" class="w-4 h-4"></i> Mark as Picked Up</button>
              <button id="btn-again"  class="btn-o w-full justify-center text-sm"><i data-lucide="camera" class="w-4 h-4"></i> Scan Another</button>
            </div>
          </div>
        </div>
      </div>`;
    }

    if (isStore) {
        // Store Stats
        html += `
      <div class="grid grid-cols-2 gap-3 mb-8">
        <div class="glass rounded-2xl p-4 text-center"><p class="text-2xl font-black text-secondary">${DB.products.filter(p => p.requests > 0).length}</p><p class="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Restocks Pending</p></div>
        <div class="glass rounded-2xl p-4 text-center"><p class="text-2xl font-black text-primary">${DB.products.filter(p => p.stock > 0).length}</p><p class="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">In Stock</p></div>
      </div>
      
      <!-- Bottom row: Restocks + Inventory -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div class="glass rounded-2xl p-6">
          <h3 class="text-lg font-bold mb-5 flex items-center gap-2"><i data-lucide="flame" class="w-5 h-5 text-secondary"></i> High-Demand Restock Requests</h3>
          <div id="restock-list" class="space-y-3 max-h-96 overflow-y-auto hs"></div>
        </div>
        <div class="glass rounded-2xl p-6">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold flex items-center gap-2"><i data-lucide="settings-2" class="w-5 h-5 text-primary"></i> Store Inventory</h3>
          </div>
          <div id="inv-list" class="space-y-3 max-h-96 overflow-y-auto hs"></div>
        </div>
      </div>`;
    }

    html += `</div>`;
    app.innerHTML = html;
    icons();

    // ── CANTEEN LOGIC ──
    if (isCanteen) {
        let orderTab = 'Pending';
        const tabColors = {
            'Pending': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
            'Preparing': { bg: 'bg-primary/20', text: 'text-primary' },
            'Ready': { bg: 'bg-green-500/20', text: 'text-green-400' },
            'Picked Up': { bg: 'bg-slate-500/20', text: 'text-slate-300' },
        };
        const nextStatus = { 'Pending': 'Preparing', 'Preparing': 'Ready', 'Ready': 'Picked Up' };
        const nextAction = {
            'Pending': { icon: 'chef-hat', label: 'Start Preparing' },
            'Preparing': { icon: 'package-check', label: 'Mark Ready' },
            'Ready': { icon: 'check-circle', label: 'Mark Picked Up' },
        };

        function renderOrders() {
            const orders = DB.orders.filter(o => o.status === orderTab).sort((a, b) => b.ts - a.ts);
            const ol = $('orders-list');
            if (!orders.length) {
                ol.innerHTML = `<div class="text-center py-12 text-slate-500 flex flex-col items-center gap-3"><i data-lucide="${orderTab === 'Picked Up' ? 'party-popper' : 'inbox'}" class="w-12 h-12 opacity-30"></i><p class="text-sm">${orderTab === 'Picked Up' ? 'No completed orders yet.' : 'No ' + orderTab.toLowerCase() + ' orders right now. 🎉'}</p></div>`;
                icons(); return;
            }
            ol.innerHTML = orders.map((o, i) => {
                const itemsList = o.items.map(it => `${it.qty}× ${it.name}`).join(', ');
                const ago = timeAgo(o.ts);
                const action = nextAction[o.status];
                return `<div class="bg-white/[.04] rounded-xl border border-white/[.06] hover:border-white/[.12] transition-all animate-slide-up p-4" style="animation-delay:${i * 40}ms">
            <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/30 to-secondary/30 flex items-center justify-center text-xs font-black text-white shrink-0">${(o.userName || 'U')[0]}</div>
                <div><p class="font-bold text-sm">${o.userName || 'Unknown'}</p><p class="text-xs text-slate-500 font-mono">${o.id}</p></div>
              </div>
              <div class="flex items-center gap-2 flex-wrap">${statusBadge(o.status)}<span class="text-[10px] text-slate-500">${ago}</span></div>
            </div>
            <div class="bg-black/20 rounded-lg p-3 mb-3"><p class="text-xs text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">Items</p><p class="text-sm text-slate-200">${itemsList}</p></div>
            <div class="flex flex-wrap gap-4 items-center mb-3">
              <div class="flex items-center gap-1.5 text-sm"><i data-lucide="clock" class="w-3.5 h-3.5 text-primary"></i><span class="text-slate-400 text-xs">Pickup:</span><span class="font-bold text-primary text-sm">${o.pickup}</span></div>
              <div class="flex items-center gap-1.5 text-sm"><i data-lucide="indian-rupee" class="w-3.5 h-3.5 text-green-400"></i><span class="text-slate-400 text-xs">Total:</span><span class="font-bold text-green-400 text-sm">₹${o.total}</span></div>
            </div>
            ${action ? `<button class="advance-btn btn-p w-full justify-center text-sm" data-oid="${o.id}" data-next="${nextStatus[o.status]}"><i data-lucide="${action.icon}" class="w-4 h-4"></i> ${action.label}</button>` : ''}
          </div>`;
            }).join('');
            icons();
            ol.querySelectorAll('.advance-btn').forEach(btn => btn.addEventListener('click', e => {
                const oid = e.currentTarget.dataset.oid, next = e.currentTarget.dataset.next, order = DB.orders.find(o => o.id === oid);
                if (order) { order.status = next; persist(); toast(`Order ${oid} → ${next}`, 'success'); renderVendor(app); }
            }));
        }

        app.querySelectorAll('.ord-tab').forEach(btn => btn.addEventListener('click', e => {
            orderTab = e.currentTarget.dataset.otab; const tc = tabColors[orderTab];
            app.querySelectorAll('.ord-tab').forEach(b => b.className = `ord-tab px-3 py-1.5 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition-all`);
            e.currentTarget.className = `ord-tab px-3 py-1.5 text-xs font-bold rounded-lg ${tc.bg} ${tc.text} transition-all`;
            renderOrders();
        }));
        renderOrders();

        // Canteen Menu Inventory
        const cInv = $('inv-list');
        cInv.innerHTML = DB.menu.map((m, i) => `
      <div class="flex items-center justify-between p-3 bg-white/[.04] rounded-xl border border-white/[.06] hover:border-white/[.12] transition-colors animate-slide-up" style="animation-delay:${i * 25}ms">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-2 h-2 rounded-full shrink-0 pulse-d ${m.available ? 'bg-green-500' : 'bg-red-500'}"></span>
          <div class="min-w-0"><p class="text-sm font-semibold truncate">${m.name}</p><p class="text-xs text-slate-500">${m.category} · ₹${m.price}</p></div>
        </div>
        <label class="toggle-sw shrink-0"><input type="checkbox" ${m.available ? 'checked' : ''} data-mtog="${m.id}"><span class="toggle-sl"></span></label>
      </div>`).join('');
        cInv.querySelectorAll('[data-mtog]').forEach(t => t.addEventListener('change', e => {
            const m = DB.menu.find(x => x.id === e.target.dataset.mtog);
            m.available = e.target.checked; persist();
            toast(`${m.name} ${e.target.checked ? 'Available' : 'Unavailable'}`, e.target.checked ? 'success' : 'error');
            renderVendor(app);
        }));

        // QR Scanner
        let scanner = null, curOrder = null;
        const scanResult = $('scan-result'), btnPickup = $('btn-pickup'), btnAgain = $('btn-again');
        function startScanner() {
            $('qr-reader').classList.remove('hidden'); scanResult.classList.add('hidden');
            scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 }, false);
            scanner.render(onScan, () => { });
        }
        function onScan(txt) {
            try {
                const d = JSON.parse(txt);
                if (!d.orderId || !d.verify) { toast('Invalid QR format', 'error'); return; }
                scanner.pause(true); $('qr-reader').classList.add('hidden'); scanResult.classList.remove('hidden');
                const o = DB.orders.find(x => x.id === d.orderId);
                curOrder = d.orderId; $('sr-id').textContent = d.orderId;
                if (!o) {
                    $('sr-user').textContent = '—'; $('sr-pick').textContent = '—'; $('sr-total').textContent = '—';
                    $('sr-status').innerHTML = '<span class="badge bd">Not Found</span>';
                    btnPickup.classList.add('hidden'); toast('Order not found', 'error');
                } else {
                    $('sr-user').textContent = o.userName || 'Unknown';
                    $('sr-pick').textContent = o.pickup; $('sr-total').textContent = `₹${o.total}`;

                    if (o.status === 'Picked Up') {
                        $('sr-status').innerHTML = statusBadge(o.status);
                        btnPickup.classList.add('hidden');
                    } else {
                        // Auto-advance to Picked Up
                        o.status = 'Picked Up';
                        persist();
                        $('sr-status').innerHTML = statusBadge('Picked Up');
                        btnPickup.classList.add('hidden');
                        toast('Scan Successful! Order auto-marked as Picked Up! 🎉', 'success');
                        setTimeout(() => renderVendor(app), 1500); // Re-render after a delay to show the success message
                    }
                }
                icon(scanResult);
            } catch (e) { toast('Could not parse QR', 'error'); }
        }
        btnPickup.addEventListener('click', () => {
            const o = DB.orders.find(x => x.id === curOrder);
            if (o) { o.status = 'Picked Up'; persist(); }
            $('sr-status').innerHTML = statusBadge('Picked Up'); btnPickup.classList.add('hidden');
            toast('Order Picked Up! 🎉', 'success'); renderVendor(app);
        });
        btnAgain.addEventListener('click', () => { if (scanner) scanner.resume(); $('qr-reader').classList.remove('hidden'); scanResult.classList.add('hidden'); curOrder = null; });
        setTimeout(startScanner, 250);
        vendorCleanup = () => { if (scanner) { scanner.clear().catch(() => { }); scanner = null; } };
    }

    // ── STORE LOGIC ──
    if (isStore) {
        // Restock List
        const items = DB.products.filter(p => p.requests > 0).sort((a, b) => b.requests - a.requests);
        const cReq = $('restock-list');
        if (!items.length) { cReq.innerHTML = '<p class="text-slate-500 italic text-sm text-center py-4">No active restock requests.</p>'; }
        else {
            cReq.innerHTML = items.map((p, i) => {
                const isHigh = p.requests >= 10;
                return `
            <div class="flex items-center gap-3 p-3 bg-white/[.04] rounded-xl border ${isHigh ? 'border-secondary/50 shadow-[0_0_10px_rgba(236,72,153,0.15)]' : 'border-white/[.06]'} hover:border-secondary/30 transition-all animate-slide-up" style="animation-delay:${i * 35}ms">
              <img src="${p.img}" class="w-10 h-10 rounded-lg object-cover shrink-0" loading="lazy" onerror="this.src='https://placehold.co/40/1e293b/6366f1?text=?'">
              <div class="flex-grow min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  <h5 class="text-sm font-semibold truncate">${p.name}</h5>
                  ${isHigh ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-secondary/20 text-secondary border border-secondary/30 uppercase tracking-wider">High Prio</span>' : '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">Med Prio</span>'}
                </div>
                <p class="text-xs text-slate-400 flex items-center gap-1"><i data-lucide="users" class="w-3 h-3 text-secondary"></i> <span class="text-secondary font-bold">${p.requests}</span> student requests</p>
              </div>
              <div class="hidden sm:block w-14 h-1.5 bg-surface rounded-full overflow-hidden mr-2"><div class="h-full bg-gradient-to-r from-primary to-secondary rounded-full" style="width:${Math.min(p.requests / 20 * 100, 100)}%"></div></div>
              <button class="do-restock btn-p !py-1.5 !px-3 text-xs shrink-0" data-pid="${p.id}">Restock</button>
            </div>`;
            }).join('');
            icon(cReq);
            cReq.querySelectorAll('.do-restock').forEach(b => b.addEventListener('click', e => {
                const p = DB.products.find(x => x.id === e.currentTarget.dataset.pid);
                p.stock += 20; p.requests = 0; persist();
                toast(`${p.name} restocked (+20)`, 'success'); renderVendor(app);
            }));
        }

        // Store Inventory
        const cInv = $('inv-list');
        cInv.innerHTML = DB.products.map((p, i) => `
      <div class="flex items-center justify-between p-3 bg-white/[.04] rounded-xl border border-white/[.06] hover:border-white/[.12] transition-colors animate-slide-up" style="animation-delay:${i * 25}ms">
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-2 h-2 rounded-full shrink-0 pulse-d ${p.stock > 0 ? 'bg-green-500' : 'bg-red-500'}"></span>
          <div class="min-w-0"><p class="text-sm font-semibold truncate">${p.name}</p><p class="text-xs text-slate-500">Stock: ${p.stock}</p></div>
        </div>
        <label class="toggle-sw shrink-0"><input type="checkbox" ${p.stock > 0 ? 'checked' : ''} data-stog="${p.id}"><span class="toggle-sl"></span></label>
      </div>`).join('');
        cInv.querySelectorAll('[data-stog]').forEach(t => t.addEventListener('change', e => {
            const p = DB.products.find(x => x.id === e.target.dataset.stog);
            p.stock = e.target.checked ? 20 : 0; if (e.target.checked) p.requests = 0; persist();
            toast(`${p.name} ${e.target.checked ? 'In Stock' : 'Out of Stock'}`, e.target.checked ? 'success' : 'error'); renderVendor(app);
        }));
    }

    // Toggle Dashboard Handlers
    $('vdash-canteen')?.addEventListener('click', () => {
        if (vendorViewMode !== 'canteen') {
            vendorViewMode = 'canteen';
            renderVendor(app);
        }
    });
    $('vdash-store')?.addEventListener('click', () => {
        if (vendorViewMode !== 'store') {
            vendorViewMode = 'store';
            renderVendor(app);
        }
    });
}

// ── BOOT ────────────────────────────────────────────
(async () => {
    await loadDB();
    initAuth();
    setupNav();
    icons();
    // Auto-restore session
    const saved = localStorage.getItem(SESS);
    if (saved) {
        try {
            const user = JSON.parse(saved);
            const fresh = DB.users.find(u => u.email === user.email && u.password === user.password);
            if (fresh) loginSuccess(fresh);
        } catch (e) { }
    }
})();
