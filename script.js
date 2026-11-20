const APP_VERSION = '8';
/* =====================================================================
 * MULTI-PROFILE DATA ARCHITECTURE & PERSISTENCE
 * ===================================================================== */
const STORAGE_KEY = 'myfinance_custom_pwa_v2';

function defaultCategories() {
    return [
        // Expense categories
        { id: 'cat-food', type: 'Expense', emoji: '🍜', name: 'Food', cap: 4000 },
        { id: 'cat-petrol', type: 'Expense', emoji: '⛽', name: 'Petrol & Transport', cap: 4500 },
        { id: 'cat-wifi', type: 'Expense', emoji: '📶', name: 'Wifi & Mobile Data', cap: 2300 },
        { id: 'cat-bike', type: 'Expense', emoji: '🏍️', name: 'Bike Maintenance', cap: 3500 },
        { id: 'cat-edu', type: 'Expense', emoji: '📙', name: 'Education & Loan', cap: 6500 },
        { id: 'cat-social', type: 'Expense', emoji: '🎉', name: 'Social Life', cap: 4500 },
        { id: 'cat-bankfee', type: 'Expense', emoji: '🏦', name: 'Bank Fees', cap: 1000, isBankFee: true },
        { id: 'cat-other', type: 'Expense', emoji: '📦', name: 'Other', cap: 2500 },
        // Income categories
        { id: 'cat-salary', type: 'Income', emoji: '💰', name: 'Salary', isPassive: false },
        { id: 'cat-side', type: 'Income', emoji: '🚕', name: 'PickMe / Side Gig', isPassive: false },
        { id: 'cat-interest', type: 'Income', emoji: '📈', name: 'Interest & Dividends', isPassive: true },
        { id: 'cat-rent', type: 'Income', emoji: '🏠', name: 'Rent & Assets', isPassive: true },
        { id: 'cat-online', type: 'Income', emoji: '🌐', name: 'Online Passive', isPassive: true },
        { id: 'cat-gift', type: 'Income', emoji: '🎁', name: 'Family / Gifts', isPassive: false }
    ];
}

function createSampleProfile(id = 'prof-default', name = 'My Profile', currency = 'LKR') {
    // Clean starter profile: your accounts, zero balances, NO demo transactions.
    return {
        id,
        name,
        displayName: name,
        currency,
        accounts: [
            { id: 'acc-seylan', name: 'Seylan Bank', subtitle: 'Main Salary', last4: '0000', theme: 'lime', openingBalance: 0 },
            { id: 'acc-cash', name: 'Cash Wallet', subtitle: 'Daily Spend', last4: '0000', theme: 'lavender', openingBalance: 0 },
            { id: 'acc-nsb', name: 'NSB Savings', subtitle: 'Savings Goal', last4: '0000', theme: 'emerald', openingBalance: 0 }
        ],
        categories: defaultCategories(),
        targets: {
            monthlyIncome: 38366,
            monthlyBudgetCap: 28800,
            monthlySavingsGoal: 9566,
            monthlyPassiveGoal: 10000,
            customGoalName: 'Emergency Fund',
            customGoalAmount: 100000,
            customGoalAccountId: 'acc-nsb'
        },
        transactions: []
    };
}

function createBlankProfile(id, name, currency = 'LKR') {
    return {
        id,
        name,
        displayName: name,
        currency,
        accounts: [
            { id: 'acc-main', name: 'Main Bank', subtitle: 'Primary', last4: '1001', theme: 'lime', openingBalance: 0 },
            { id: 'acc-cash', name: 'Cash Wallet', subtitle: 'Daily', last4: '2002', theme: 'lavender', openingBalance: 0 }
        ],
        categories: defaultCategories(),
        targets: {
            monthlyIncome: 50000,
            monthlyBudgetCap: 35000,
            monthlySavingsGoal: 15000,
            monthlyPassiveGoal: 10000,
            customGoalName: 'Emergency Fund',
            customGoalAmount: 100000,
            customGoalAccountId: 'acc-main'
        },
        transactions: []
    };
}

let rootState = loadRootState();
let activeScreen = 'home';
let homeTxFilter = 'All';
let analyticsFilter = 'All';
let selectedMonthIndex = 6; // rightmost month (current month) in 7-month window
let drawerType = 'Expense';
let editingTxId = null;
let homeLimit = 12, histLimit = 40;
let customizeCatTab = 'Expense';
let selectedAccountTheme = 'lime';

function loadRootState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
                if (!parsed.profiles.some(p => p.id === parsed.activeProfileId)) {
                    parsed.activeProfileId = parsed.profiles[0].id;
                }
                removeDemoData(parsed);
                if (normalizeAllDates(parsed)) {
                    parsed.updatedAt = Date.now();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                }
                return parsed;
            }
        }
    } catch (err) {
        console.error('Failed to parse storage:', err);
    }
    const initial = {
        activeProfileId: 'prof-default',
        profiles: [createSampleProfile('prof-default', 'My Profile', 'LKR')]
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
}

/* =====================================================================
 * DATE NORMALISATION — every transaction date becomes YYYY-MM-DDTHH:MM
 * (CSV imports used to keep raw text like "18/11/2026", which the charts
 *  and monthly totals could not match to a month.)
 * ===================================================================== */
function normalizeDate(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    const s = String(raw).trim();
    const pad = n => String(n).padStart(2, '0');
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
    let y, mo, d, h = 12, mi = 0, m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T\s,]+(\d{1,2}):(\d{2}))?/))) {
        y = +m[1]; mo = +m[2]; d = +m[3];
        if (m[4] !== undefined) { h = +m[4]; mi = +m[5]; }
    } else if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})(?:[T\s,]+(\d{1,2}):(\d{2}))?/))) {
        d = +m[1]; mo = +m[2]; y = +m[3];             // Sri Lanka style: DD/MM/YYYY
        if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; }   // it was MM/DD/YYYY
        if (m[4] !== undefined) { h = +m[4]; mi = +m[5]; }
    } else {
        const dt = new Date(s);
        if (isNaN(dt.getTime())) return null;
        y = dt.getFullYear(); mo = dt.getMonth() + 1; d = dt.getDate(); h = dt.getHours(); mi = dt.getMinutes();
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
    return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}`;
}

function normalizeAllDates(root) {
    let changed = false;
    (root.profiles || []).forEach(p => (p.transactions || []).forEach(t => {
        const n = normalizeDate(t.date) || normalizeDate(new Date().toISOString().slice(0, 16));
        if (n !== t.date) { t.date = n; changed = true; }
    }));
    return changed;
}

async function forceUpdateApp() {
    try {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        }
        if (window.caches) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
    } catch (e) { console.error(e); }
    location.replace(location.pathname + '?v=' + Date.now());
}

/* Removes ONLY the built-in demo transactions (ids tx-s1..s11, tx-p1..p6).
   Your own entries are never touched. */
function removeDemoData(root) {
    const demoIds = new Set([...Array.from({ length: 11 }, (_, i) => `tx-s${i + 1}`), ...Array.from({ length: 6 }, (_, i) => `tx-p${i + 1}`)]);
    const demoBalances = { 'acc-seylan': 10500, 'acc-cash': 4500, 'acc-nsb': 8500, 'acc-sep': 12000 };
    root.profiles.forEach(p => {
        const hadDemo = p.transactions.some(t => demoIds.has(t.id));
        if (!hadDemo) return;
        p.transactions = p.transactions.filter(t => !demoIds.has(t.id));
        p.accounts.forEach(a => {
            if (demoBalances[a.id] !== undefined && a.openingBalance === demoBalances[a.id]) a.openingBalance = 0;
        });
        if (p.displayName === 'Alex') p.displayName = p.name;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
}

function saveRootState() {
    rootState.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rootState));
    if (typeof scheduleSync === 'function') scheduleSync();
}

function getActiveProfile() {
    return rootState.profiles.find(p => p.id === rootState.activeProfileId) || rootState.profiles[0];
}

function ensureBankFeeCategory(profile) {
    let feeCat = profile.categories.find(c => c.type === 'Expense' && (c.isBankFee || c.name.toLowerCase().includes('bank fee')));
    if (!feeCat) {
        feeCat = { id: 'cat-bankfee', type: 'Expense', emoji: '🏦', name: 'Bank Fees', cap: 1000, isBankFee: true };
        profile.categories.push(feeCat);
    }
    return feeCat;
}

/* =====================================================================
 * CALCULATIONS & FORMATTERS
 * ===================================================================== */
function getCurrency() {
    return (getActiveProfile().currency || 'LKR').toUpperCase();
}

function formatSplitMoney(val, dimClass = 'text-zinc-500 font-medium') {
    const cur = getCurrency();
    const num = Number(val) || 0;
    const neg = num < 0 ? '-' : '';
    const [whole, dec] = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
    return `${neg}${cur} ${whole}<span class="${dimClass}">.${dec}</span>`;
}

function formatMoney(val, decimals = 0) {
    const cur = getCurrency();
    const num = Number(val) || 0;
    const neg = num < 0 ? '-' : '';
    return `${neg}${cur} ${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function formatShortDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCurrentMonthPrefix() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getAccountBalance(profile, accountId) {
    const acc = profile.accounts.find(a => a.id === accountId);
    let bal = acc ? (Number(acc.openingBalance) || 0) : 0;
    profile.transactions.forEach(tx => {
        if (tx.accountId === accountId) {
            const amt = Number(tx.amount) || 0;
            if (tx.type === 'Income' || tx.type === 'Transfer-In') bal += amt;
            else if (tx.type === 'Expense' || tx.type === 'Transfer-Out') bal -= amt;
        }
    });
    return bal;
}

function getTotalBalance(profile) {
    return profile.accounts.reduce((sum, acc) => sum + getAccountBalance(profile, acc.id), 0);
}

function getCategoryById(profile, catId, fallbackName = 'Other') {
    if (catId === 'transfer') return { id: 'transfer', emoji: '🔁', name: 'Account Transfer', type: 'Transfer' };
    const found = profile.categories.find(c => c.id === catId);
    if (found) return found;
    return { id: catId || 'other', emoji: '📦', name: fallbackName, type: 'Expense' };
}

function getAccountNameById(profile, accId, fallback = 'Account') {
    const acc = profile.accounts.find(a => a.id === accId);
    return acc ? acc.name : fallback;
}

function getMonthStats(profile, monthPrefix) {
    let income = 0, outcome = 0, passive = 0, bankFees = 0;
    const byCategory = {};

    profile.transactions.forEach(tx => {
        if ((tx.date || '').startsWith(monthPrefix)) {
            const amt = Number(tx.amount) || 0;
            const cat = getCategoryById(profile, tx.categoryId);
            if (tx.type === 'Income') {
                income += amt;
                if (cat.isPassive) passive += amt;
            } else if (tx.type === 'Expense') {
                outcome += amt;
                byCategory[tx.categoryId] = (byCategory[tx.categoryId] || 0) + amt;
                if (cat.isBankFee || cat.name.toLowerCase().includes('bank fee')) {
                    bankFees += amt;
                }
            }
        }
    });
    return { income, outcome, passive, bankFees, net: income - outcome, byCategory };
}

function getLast7MonthsSeries(profile) {
    const now = new Date();
    const series = [];
    for (let offset = 6; offset >= 0; offset--) {
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { month: 'short' });
        const stats = getMonthStats(profile, prefix);
        series.push({ prefix, label, year: d.getFullYear(), ...stats });
    }
    return series;
}

function updateGreeting() {
    const hr = new Date().getHours();
    document.getElementById('greeting-text').textContent =
        hr < 12 ? 'Good Morning,' : (hr < 17 ? 'Good Afternoon,' : 'Good Evening,');
}

/* =====================================================================
 * NAVIGATION & MASTER RENDER
 * ===================================================================== */
function switchScreen(name) {
    activeScreen = name;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${name}`).classList.add('active');
    document.getElementById('main-scroll').scrollTop = 0;

    const nav = document.getElementById('bottom-nav');
    if (name === 'home') {
        nav.className = 'absolute bottom-0 left-0 right-0 h-[76px] px-4 flex items-center justify-between z-30 transition-colors duration-200 bg-white border-t border-gray-200 text-gray-400';
    } else {
        nav.className = 'absolute bottom-0 left-0 right-0 h-[76px] px-4 flex items-center justify-between z-30 transition-colors duration-200 bg-[#141418]/95 backdrop-blur-md border-t border-borderDark text-zinc-500';
    }

    ['home', 'analytics', 'targets', 'customize'].forEach(id => {
        const btn = document.getElementById(`nav-btn-${id}`);
        btn.classList.remove('text-canvas', 'text-limeAccent', 'font-bold');
        if (id === name) {
            btn.classList.add(name === 'home' ? 'text-canvas' : 'text-limeAccent', 'font-bold');
        }
    });

    renderAll();
}

/* =====================================================================
 * TRANSACTION HISTORY — calendar view
 * ===================================================================== */
let historyYM = null;        // { y, m } currently shown month
let historyDay = null;       // 'YYYY-MM-DD' selected day (or null = whole month)
let historyFilter = 'All';
let historySearch = '';

function escHtml(v) {
    return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function shortAmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return String(Math.round(n));
}
function pad2(n) { return String(n).padStart(2, '0'); }

function openHistory() {
    const now = new Date();
    if (!historyYM) historyYM = { y: now.getFullYear(), m: now.getMonth() };
    switchScreen('history');
}
function historyShift(delta) {
    const d = new Date(historyYM.y, historyYM.m + delta, 1);
    historyYM = { y: d.getFullYear(), m: d.getMonth() };
    historyDay = null;
    renderHistory(getActiveProfile());
}
function historyGoToday() {
    const now = new Date();
    historyYM = { y: now.getFullYear(), m: now.getMonth() };
    historyDay = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    renderHistory(getActiveProfile());
}
function historySelectDay(ds) {
    historyDay = historyDay === ds ? null : ds;
    renderHistory(getActiveProfile());
}
function setHistoryFilter(f) { historyFilter = f; renderHistory(getActiveProfile()); }
function setHistorySearch(v) { historySearch = (v || '').trim().toLowerCase(); renderHistory(getActiveProfile()); }
function historyAddOnDay() {
    if (!historyDay) return;
    openAddDrawer('Expense');
    document.getElementById('tx-date').value = `${historyDay}T12:00`;
}

function renderHistory(profile) {
    if (!document.getElementById('screen-history')) return;
    if (!historyYM) { const n = new Date(); historyYM = { y: n.getFullYear(), m: n.getMonth() }; }
    const { y, m } = historyYM;
    const prefix = `${y}-${pad2(m + 1)}`;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

    document.getElementById('history-month-label').textContent =
        new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Per-day totals
    const days = {};
    profile.transactions.forEach(t => {
        if (!(t.date || '').startsWith(prefix)) return;
        const key = t.date.slice(0, 10);
        const d = days[key] || (days[key] = { inc: 0, exp: 0, n: 0 });
        const amt = Number(t.amount) || 0;
        d.n++;
        if (t.type === 'Income') d.inc += amt;
        else if (t.type === 'Expense') d.exp += amt;
    });

    // Month summary
    const st = getMonthStats(profile, prefix);
    const count = Object.values(days).reduce((a, d) => a + d.n, 0);
    document.getElementById('history-summary').innerHTML = `
        <div class="bg-surface rounded-2xl border border-borderDark p-3"><p class="text-[10px] text-mutedText">Income</p><p class="text-xs font-extrabold text-limeAccent mt-0.5">${formatMoney(st.income, 0)}</p></div>
        <div class="bg-surface rounded-2xl border border-borderDark p-3"><p class="text-[10px] text-mutedText">Outcome</p><p class="text-xs font-extrabold text-dangerRed mt-0.5">${formatMoney(st.outcome, 0)}</p></div>
        <div class="bg-surface rounded-2xl border border-borderDark p-3"><p class="text-[10px] text-mutedText">${count} records</p><p class="text-xs font-extrabold text-white mt-0.5">${formatMoney(st.net, 0)}</p></div>`;

    // Calendar grid (weeks start on Sunday)
    const firstDow = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<div></div>';
    for (let d = 1; d <= dim; d++) {
        const ds = `${prefix}-${pad2(d)}`;
        const info = days[ds];
        const sel = historyDay === ds;
        let cls = 'h-[54px] rounded-xl flex flex-col items-center justify-center gap-px transition active:scale-95 border ';
        if (sel) cls += 'bg-limeAccent text-canvas border-limeAccent';
        else if (ds === todayStr) cls += 'border-limeAccent/70 text-white bg-canvas';
        else cls += (info ? 'bg-canvas ' : '') + 'border-transparent text-zinc-300';
        const exp = info && info.exp > 0 ? `<span class="text-[8px] leading-none font-bold ${sel ? 'text-canvas' : 'text-dangerRed'}">-${shortAmt(info.exp)}</span>` : '';
        const inc = info && info.inc > 0 ? `<span class="text-[8px] leading-none font-bold ${sel ? 'text-canvas' : 'text-limeAccent'}">+${shortAmt(info.inc)}</span>` : '';
        const other = info && !exp && !inc ? `<span class="w-1 h-1 rounded-full ${sel ? 'bg-canvas' : 'bg-lavenderAccent'}"></span>` : '';
        cells += `<button onclick="historySelectDay('${ds}')" class="${cls}"><span class="text-xs font-bold leading-none mb-0.5">${d}</span>${exp}${inc}${other}</button>`;
    }
    document.getElementById('history-cal').innerHTML = cells;

    // Type chips
    document.getElementById('history-chips').innerHTML = ['All', 'Expense', 'Income', 'Transfer'].map(f => {
        const on = f === historyFilter;
        return `<button onclick="setHistoryFilter('${f}')" class="px-3.5 py-2 rounded-full text-xs whitespace-nowrap transition ${on ? 'bg-limeAccent text-canvas font-extrabold' : 'bg-surface border border-borderDark text-mutedText font-semibold'}">${f}</button>`;
    }).join('');

    // List
    let list = profile.transactions.filter(t => (t.date || '').startsWith(historyDay || prefix));
    if (historyFilter === 'Expense') list = list.filter(t => t.type === 'Expense');
    else if (historyFilter === 'Income') list = list.filter(t => t.type === 'Income');
    else if (historyFilter === 'Transfer') list = list.filter(t => t.type.startsWith('Transfer'));
    if (historySearch) {
        list = list.filter(t => {
            const hay = `${t.note || ''} ${getCategoryById(profile, t.categoryId).name} ${getAccountNameById(profile, t.accountId)}`.toLowerCase();
            return hay.includes(historySearch);
        });
    }
    list.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const title = document.getElementById('history-list-title');
    if (historyDay) {
        const [yy, mm, dd] = historyDay.split('-').map(Number);
        title.textContent = new Date(yy, mm - 1, dd).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ` • ${list.length}`;
    } else {
        title.textContent = `Whole month • ${list.length} records`;
    }
    document.getElementById('history-add-btn').classList.toggle('hidden', !historyDay);

    const listEl = document.getElementById('history-list');
    if (list.length === 0) {
        listEl.innerHTML = '<div class="bg-surface rounded-2xl p-6 border border-borderDark text-center text-xs text-mutedText">No transactions for this period.</div>';
        return;
    }
    listEl.innerHTML = list.map(tx => {
        const cat = getCategoryById(profile, tx.categoryId);
        const accName = getAccountNameById(profile, tx.accountId);
        const isPos = tx.type === 'Income' || tx.type === 'Transfer-In';
        const amtColor = isPos ? 'text-limeAccent' : (cat.isBankFee ? 'text-dangerRed' : 'text-white');
        const when = historyDay ? (tx.date || '').slice(11, 16) : formatShortDate(tx.date);
        return `
            <div class="bg-surface rounded-2xl p-3.5 border border-borderDark flex items-center justify-between gap-2">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl bg-canvas border border-borderDark flex items-center justify-center text-base shrink-0">${escHtml(cat.emoji || '📦')}</div>
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-white truncate">${escHtml(cat.name)}</p>
                        <p class="text-[11px] text-mutedText truncate">${escHtml(accName)} • ${escHtml(when)}${tx.note ? ' • ' + escHtml(tx.note) : ''}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="text-xs font-extrabold ${amtColor}">${isPos ? '+' : '-'} ${formatMoney(tx.amount, 0)}</span>
                    <button onclick="editTx('${escHtml(tx.id)}')" aria-label="Edit" class="w-7 h-7 rounded-lg bg-canvas text-mutedText hover:text-lavenderAccent flex items-center justify-center transition"><i class="fa-solid fa-pencil text-[11px]"></i></button>
                    <button onclick="confirmDeleteTx('${escHtml(tx.id)}')" aria-label="Delete" class="w-7 h-7 rounded-lg bg-canvas text-mutedText hover:text-dangerRed flex items-center justify-center transition"><i class="fa-regular fa-trash-can text-[11px]"></i></button>
                </div>
            </div>`;
    }).join('');
}

function renderAll() {
    updateGreeting();
    const profile = getActiveProfile();
    const failures = [];
    const steps = [
        ['home', () => { ensureBankFeeCategory(profile); renderHome(profile); }],
        ['analytics', () => renderAnalytics(profile)],
        ['history', () => renderHistory(profile)],
        ['targets', () => renderTargets(profile)],
        ['customize', () => renderCustomize(profile)]
    ];
    steps.forEach(([name, fn]) => {
        try { fn(); } catch (err) { console.error(name, err); failures.push(`${name}: ${err.message}`); }
    });
    showRenderErrors(failures);
}

/* If one screen fails to draw, the others still work, and the reason is shown on screen */
function showRenderErrors(list) {
    let el = document.getElementById('mf-render-error');
    if (!list.length) { if (el) el.remove(); return; }
    if (!el) {
        el = document.createElement('div');
        el.id = 'mf-render-error';
        el.style.cssText = 'position:fixed;left:8px;right:8px;bottom:84px;z-index:9998;background:#FF5A5F;color:#fff;font:600 11px sans-serif;padding:8px 10px;border-radius:12px';
        document.body.appendChild(el);
    }
    el.textContent = 'Error (please send a screenshot): ' + list.join(' | ');
}

/* =====================================================================
 * SCREEN 1: HOME RENDER
 * ===================================================================== */
function setHomeTxFilter(filter) {
    homeTxFilter = filter; homeLimit = 12;
    renderHome(getActiveProfile());
}

function renderHome(profile) {
    document.getElementById('home-display-name').textContent = profile.displayName || profile.name;
    document.getElementById('header-profile-name').textContent = profile.name;

    const totalBal = getTotalBalance(profile);
    document.getElementById('home-total-balance').innerHTML = formatSplitMoney(totalBal, 'text-zinc-500 font-medium');

    // Notification dot color
    const mStats = getMonthStats(profile, getCurrentMonthPrefix());
    const cap = Number(profile.targets.monthlyBudgetCap) || 1;
    const dot = document.getElementById('notif-dot');
    dot.className = mStats.outcome > cap * 0.8
        ? 'absolute top-2 right-2 w-2 h-2 rounded-full bg-dangerRed ring-2 ring-surface'
        : 'absolute top-2 right-2 w-2 h-2 rounded-full bg-limeAccent ring-2 ring-surface';

    // Account Cards Deck
    const cardsEl = document.getElementById('home-cards-container');
    const cardsHtml = profile.accounts.map(acc => {
        const bal = getAccountBalance(profile, acc.id);
        const isLightText = acc.theme === 'dark' || acc.theme === 'coral';
        const mutedClass = isLightText ? 'text-white/70' : 'text-[#0F0F11]/65';
        const decClass = isLightText ? 'text-white/55 font-medium' : 'text-[#0F0F11]/55 font-medium';
        const chipBg = isLightText ? 'bg-limeAccent' : 'bg-[#0F0F11]';

        return `
            <div onclick="openAccountModal('${acc.id}')" class="theme-${acc.theme || 'dark'} min-w-[255px] h-[152px] rounded-[24px] p-5 flex flex-col justify-between snap-start shrink-0 shadow-lg cursor-pointer active:scale-[0.98] transition relative">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-7 h-3.5 rounded-sm ${chipBg} inline-block shrink-0"></span>
                        <span class="text-xs font-extrabold truncate">${acc.name}</span>
                    </div>
                    <span class="text-[10px] font-bold ${mutedClass} shrink-0">${acc.subtitle || ''}</span>
                </div>

                <div class="text-xs font-bold tracking-[0.2em] opacity-85">
                    •••• •••• •••• ${acc.last4 || '0000'}
                </div>

                <div class="flex items-end justify-between">
                    <div>
                        <p class="text-[10px] font-semibold ${mutedClass}">Balance</p>
                        <p class="text-lg font-extrabold tracking-tight">${formatSplitMoney(bal, decClass)}</p>
                    </div>
                    <span class="text-[10px] font-bold ${mutedClass} flex items-center gap-1">
                        <i class="fa-solid fa-pen text-[8px]"></i> Edit
                    </span>
                </div>
            </div>
        `;
    }).join('');

    const addCardTile = `
        <button onclick="openAccountModal()" class="min-w-[125px] h-[152px] rounded-[24px] border-2 border-dashed border-borderDark hover:border-limeAccent/60 bg-surface/50 flex flex-col items-center justify-center gap-2 snap-start shrink-0 text-mutedText hover:text-limeAccent transition">
            <span class="w-10 h-10 rounded-full bg-surface border border-borderDark flex items-center justify-center">
                <i class="fa-solid fa-plus text-sm"></i>
            </span>
            <span class="text-[11px] font-bold">Add Card</span>
        </button>
    `;
    cardsEl.innerHTML = cardsHtml + addCardTile;

    // Home Filter Chips
    const filters = ['All', 'Expense', 'Income', 'Bank Fees', 'Transfer'];
    document.getElementById('home-filter-chips').innerHTML = filters.map(f => {
        const active = f === homeTxFilter;
        return `
            <button onclick="setHomeTxFilter('${f}')" class="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${active ? 'bg-[#111827] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}">
                ${f}
            </button>
        `;
    }).join('');

    // Latest Transactions List (White Sheet)
    let list = [...profile.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (homeTxFilter === 'Expense') list = list.filter(t => t.type === 'Expense');
    else if (homeTxFilter === 'Income') list = list.filter(t => t.type === 'Income');
    else if (homeTxFilter === 'Transfer') list = list.filter(t => t.type.startsWith('Transfer'));
    else if (homeTxFilter === 'Bank Fees') {
        list = list.filter(t => {
            const c = getCategoryById(profile, t.categoryId);
            return c.isBankFee || c.name.toLowerCase().includes('bank fee');
        });
    }

    const recentEl = document.getElementById('home-recent-list');
    const shown = list.slice(0, homeLimit);
    if (shown.length === 0) {
        recentEl.innerHTML = `<div class="text-center py-10 text-gray-400 text-xs">No transactions in this view. Tap the lime + button to add one.</div>`;
        return;
    }

    recentEl.innerHTML = shown.map(tx => {
        const cat = getCategoryById(profile, tx.categoryId);
        const accName = getAccountNameById(profile, tx.accountId);
        const isPos = tx.type === 'Income' || tx.type === 'Transfer-In';
        const sign = isPos ? '+' : '-';
        const amtColor = isPos ? 'text-emerald-600' : (cat.isBankFee ? 'text-rose-600' : 'text-[#111827]');

        return `
            <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-2">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-base shrink-0">
                        ${cat.emoji || '📦'}
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                            <p class="text-xs font-extrabold text-[#111827] truncate">${cat.name}</p>
                            ${cat.isPassive ? '<span class="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold">Passive</span>' : ''}
                            ${cat.isBankFee ? '<span class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">Fee</span>' : ''}
                        </div>
                        <p class="text-[11px] text-gray-500 truncate">${accName} • ${formatShortDate(tx.date)}${tx.note ? ' • ' + tx.note : ''}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="text-xs font-extrabold ${amtColor}">${sign} ${formatMoney(tx.amount, 2)}</span>
                    <button onclick="editTx('${tx.id}')" aria-label="Edit" class="w-6 h-6 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 flex items-center justify-center transition">
                        <i class="fa-solid fa-pencil text-[11px]"></i>
                    </button>
                    <button onclick="confirmDeleteTx('${tx.id}')" aria-label="Delete" class="w-6 h-6 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition">
                        <i class="fa-regular fa-trash-can text-[11px]"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('') + (list.length > shown.length
        ? `<button onclick="homeLimit += 20; renderAll();" class="w-full mt-2 py-2.5 rounded-xl bg-gray-100 text-[#111827] text-xs font-extrabold active:scale-[0.98] transition">Show more (${list.length - shown.length} left)</button>`
        : '');
}

/* =====================================================================
 * SCREEN 2: ANALYTICS RENDER (Wave Chart + KPIs + Bank Fees)
 * ===================================================================== */
function setAnalyticsFilter(filter) {
    analyticsFilter = filter; histLimit = 40;
    renderAnalytics(getActiveProfile());
}

function selectChartMonth(idx) {
    if (idx === selectedMonthIndex) return;
    selectedMonthIndex = idx;
    renderWaveChart(getLast7MonthsSeries(getActiveProfile()));
}

/* Tap / drag on the chart to scrub between months (mouse + touch) */
function initChartScrub() {
    const svg = document.getElementById('wave-chart-svg');
    if (!svg || svg.dataset.scrub) return;
    svg.dataset.scrub = '1';
    const pick = ev => {
        const r = svg.getBoundingClientRect();
        const x = ((ev.clientX - r.left) / r.width) * 360;
        const idx = Math.round(((x - 16) / (360 - 32)) * 6);
        selectChartMonth(Math.max(0, Math.min(6, idx)));
    };
    let down = false;
    svg.addEventListener('pointerdown', ev => { down = true; pick(ev); });
    svg.addEventListener('pointermove', ev => { if (down || ev.pointerType === 'mouse') pick(ev); });
    window.addEventListener('pointerup', () => { down = false; });
}

function renderAnalytics(profile) {
    const pills = ['All', 'Income', 'Outcome', 'Passive', 'Bank Fees'];
    pills.forEach(p => {
        const btn = document.getElementById(`afill-${p}`);
        btn.textContent = p;
        btn.className = p === analyticsFilter
            ? 'px-3.5 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition bg-limeAccent text-canvas shadow-[0_4px_14px_rgba(198,244,50,0.3)]'
            : 'px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition bg-surface border border-borderDark text-mutedText hover:text-white';
    });

    const mStats = getMonthStats(profile, getCurrentMonthPrefix());
    const totalBal = getTotalBalance(profile);
    const series = getLast7MonthsSeries(profile);

    // Headline metric
    const hLabel = document.getElementById('analytics-headline-label');
    const hVal = document.getElementById('analytics-headline-value');
    if (analyticsFilter === 'All') {
        hLabel.textContent = 'Total Balance';
        hVal.innerHTML = formatSplitMoney(totalBal);
    } else if (analyticsFilter === 'Income') {
        hLabel.textContent = 'This Month Income';
        hVal.innerHTML = formatSplitMoney(mStats.income);
    } else if (analyticsFilter === 'Outcome') {
        hLabel.textContent = 'This Month Outcome';
        hVal.innerHTML = formatSplitMoney(mStats.outcome);
    } else if (analyticsFilter === 'Passive') {
        hLabel.textContent = 'This Month Passive Income';
        hVal.innerHTML = formatSplitMoney(mStats.passive);
    } else {
        hLabel.textContent = 'This Month Bank Fees';
        hVal.innerHTML = formatSplitMoney(mStats.bankFees);
    }

    // KPI Cards
    document.getElementById('kpi-income').textContent = formatMoney(mStats.income, 0);
    document.getElementById('kpi-outcome').textContent = formatMoney(mStats.outcome, 0);
    document.getElementById('kpi-savings').textContent = formatMoney(mStats.net, 0);
    document.getElementById('kpi-bank-fees').textContent = formatMoney(mStats.bankFees, 0);

    // Insight Banner
    const cap = Math.max(Number(profile.targets.monthlyBudgetCap) || 1, 1);
    const pct = Math.round((mStats.outcome / cap) * 100);
    document.getElementById('insight-title').textContent = `${pct}% of Monthly Budget Used`;
    document.getElementById('insight-sub').textContent = mStats.outcome > cap
        ? `Over budget by ${formatMoney(mStats.outcome - cap, 0)} • Tap to adjust`
        : `${formatMoney(Math.max(cap - mStats.outcome, 0), 0)} remaining • Bank fees: ${formatMoney(mStats.bankFees, 0)}`;

    // Draw SVG Wave Chart
    const y0 = series[0].year, y1 = series[series.length - 1].year;
    document.getElementById('chart-year-label').textContent = y0 === y1 ? String(y1) : `${y0}–${y1}`;
    renderWaveChart(series);

    // Filtered History List
    let list = [...profile.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (analyticsFilter === 'Income') list = list.filter(t => t.type === 'Income');
    else if (analyticsFilter === 'Outcome') list = list.filter(t => t.type === 'Expense');
    else if (analyticsFilter === 'Passive') {
        list = list.filter(t => t.type === 'Income' && getCategoryById(profile, t.categoryId).isPassive);
    } else if (analyticsFilter === 'Bank Fees') {
        list = list.filter(t => {
            const c = getCategoryById(profile, t.categoryId);
            return c.isBankFee || c.name.toLowerCase().includes('bank fee');
        });
    }

    document.getElementById('analytics-history-count').textContent = `${list.length} records`;
    const listEl = document.getElementById('analytics-history-list');
    if (list.length === 0) {
        listEl.innerHTML = `<div class="bg-surface rounded-2xl p-6 border border-borderDark text-center text-xs text-mutedText">No records match this filter.</div>`;
        return;
    }

    listEl.innerHTML = list.slice(0, histLimit).map(tx => {
        const cat = getCategoryById(profile, tx.categoryId);
        const accName = getAccountNameById(profile, tx.accountId);
        const isPos = tx.type === 'Income' || tx.type === 'Transfer-In';
        const sign = isPos ? '+' : '-';
        const amtColor = isPos ? 'text-limeAccent' : (cat.isBankFee ? 'text-dangerRed' : 'text-white');

        return `
            <div class="bg-surface rounded-2xl p-3.5 border border-borderDark flex items-center justify-between gap-2">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-10 h-10 rounded-xl bg-canvas border border-borderDark flex items-center justify-center text-base shrink-0">
                        ${cat.emoji || '📦'}
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                            <p class="text-xs font-bold text-white truncate">${cat.name}</p>
                            ${cat.isPassive ? '<span class="px-1.5 py-0.5 rounded bg-lavenderAccent/20 text-lavenderAccent text-[9px] font-bold">Passive</span>' : ''}
                            ${cat.isBankFee ? '<span class="px-1.5 py-0.5 rounded bg-dangerRed/20 text-dangerRed text-[9px] font-bold">Bank Fee</span>' : ''}
                        </div>
                        <p class="text-[11px] text-mutedText truncate">${accName} • ${formatShortDate(tx.date)}${tx.note ? ' • ' + tx.note : ''}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="text-xs font-extrabold ${amtColor}">${sign} ${formatMoney(tx.amount, 0)}</span>
                    <button onclick="editTx('${tx.id}')" aria-label="Edit" class="w-6 h-6 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 flex items-center justify-center transition">
                        <i class="fa-solid fa-pencil text-[11px]"></i>
                    </button>
                    <button onclick="confirmDeleteTx('${tx.id}')" aria-label="Delete" class="w-7 h-7 rounded-lg bg-canvas text-mutedText hover:text-dangerRed flex items-center justify-center transition">
                        <i class="fa-regular fa-trash-can text-[11px]"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('') + (list.length > histLimit
        ? `<button onclick="histLimit += 40; renderAll();" class="w-full mt-1 py-3 rounded-2xl bg-surface border border-borderDark text-limeAccent text-xs font-extrabold active:scale-[0.98] transition">Show more (${list.length - histLimit} left)</button>`
        : '');
}

function smoothPath(pts) {
    if (!pts.length) return '';
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i], p1 = pts[i + 1];
        const cx = (p0.x + p1.x) / 2;
        d += ` C ${cx.toFixed(1)} ${p0.y.toFixed(1)}, ${cx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
}

function renderWaveChart(series) {
    const W = 360, H = 140, padX = 16, padTop = 26, padBot = 10;
    const usableW = W - padX * 2;
    const usableH = H - padTop - padBot;

    const maxVal = Math.max(...series.map(m => Math.max(m.income, m.outcome, m.passive, m.bankFees)), 5000) * 1.15;
    const toPts = key => series.map((m, i) => ({
        x: padX + (usableW * i) / (series.length - 1),
        y: padTop + usableH - ((m[key] || 0) / maxVal) * usableH
    }));

    const incPts = toPts('income');
    const outPts = toPts('outcome');
    const pasPts = toPts('passive');
    const feePts = toPts('bankFees');

    const idx = Math.max(0, Math.min(selectedMonthIndex, series.length - 1));
    const cur = series[idx];

    let focal = incPts[idx];
    let tipText = `${cur.label}: ${formatMoney(cur.income, 0)}`;
    let showInc = true, showOut = true, showPas = false, showFee = false;

    if (analyticsFilter === 'Outcome') {
        focal = outPts[idx];
        tipText = `${cur.label}: ${formatMoney(cur.outcome, 0)}`;
        showInc = false; showOut = true;
    } else if (analyticsFilter === 'Income') {
        showInc = true; showOut = false;
    } else if (analyticsFilter === 'Passive') {
        focal = pasPts[idx];
        tipText = `${cur.label}: ${formatMoney(cur.passive, 0)}`;
        showInc = false; showOut = false; showPas = true;
    } else if (analyticsFilter === 'Bank Fees') {
        focal = feePts[idx];
        tipText = `${cur.label}: ${formatMoney(cur.bankFees, 0)}`;
        showInc = false; showOut = false; showFee = true;
    }

    const incLine = smoothPath(incPts);
    const outLine = smoothPath(outPts);
    const pasLine = smoothPath(pasPts);
    const feeLine = smoothPath(feePts);

    document.getElementById('chart-layers').innerHTML = `
        <line x1="0" y1="40" x2="360" y2="40" stroke="rgba(255,255,255,0.05)" stroke-dasharray="3 4"/>
        <line x1="0" y1="88" x2="360" y2="88" stroke="rgba(255,255,255,0.05)" stroke-dasharray="3 4"/>
        <line x1="0" y1="136" x2="360" y2="136" stroke="rgba(255,255,255,0.06)"/>

        <rect x="${focal.x - 14}" y="${focal.y}" width="28" height="${H - focal.y}" fill="url(#beamGrad)" rx="4"/>

        ${showOut ? `
            <path d="${outLine} L ${outPts[outPts.length-1].x} ${H} L ${outPts[0].x} ${H} Z" fill="url(#lavGrad)"/>
            <path d="${outLine}" fill="none" stroke="#B8B8FF" stroke-width="2.4" stroke-linecap="round"/>
        ` : ''}
        ${showInc ? `
            <path d="${incLine} L ${incPts[incPts.length-1].x} ${H} L ${incPts[0].x} ${H} Z" fill="url(#limeGrad)"/>
            <path d="${incLine}" fill="none" stroke="#C6F432" stroke-width="2.6" stroke-linecap="round"/>
        ` : ''}
        ${showPas ? `<path d="${pasLine}" fill="none" stroke="#B8B8FF" stroke-width="2.6" stroke-linecap="round"/>` : ''}
        ${showFee ? `<path d="${feeLine}" fill="none" stroke="#FF5A5F" stroke-width="2.6" stroke-linecap="round"/>` : ''}

        <circle cx="${focal.x}" cy="${focal.y}" r="8" fill="#C6F432" opacity="0.22"/>
        <circle cx="${focal.x}" cy="${focal.y}" r="4.5" fill="#C6F432" stroke="#0F0F11" stroke-width="2" class="chart-pulse"/>

        ${series.map((m, i) => `
            <rect x="${incPts[i].x - 22}" y="0" width="44" height="150" fill="transparent" class="cursor-pointer" style="pointer-events:all"/>
        `).join('')}
    `;

    initChartScrub();
    const tip = document.getElementById('chart-tooltip');
    tip.textContent = tipText;
    const leftPct = Math.max(18, Math.min(82, (focal.x / W) * 100));
    tip.style.left = `${leftPct}%`;

    document.getElementById('chart-month-bar').innerHTML = series.map((m, i) => `
        <button onclick="selectChartMonth(${i})" class="text-[11px] py-1 rounded-lg transition ${i === idx ? 'bg-limeAccent/15 text-limeAccent font-extrabold' : 'text-mutedText hover:text-white'}">
            ${m.label}
        </button>
    `).join('');
}

/* =====================================================================
 * SCREEN 3: TARGETS & PASSIVE INCOME RENDER
 * ===================================================================== */
function renderTargets(profile) {
    const mStats = getMonthStats(profile, getCurrentMonthPrefix());
    const t = profile.targets;

    // Passive Freedom Index
    const passiveGoal = Math.max(Number(t.monthlyPassiveGoal) || 1, 1);
    const coveragePct = mStats.outcome > 0 ? (mStats.passive / mStats.outcome) * 100 : (mStats.passive > 0 ? 100 : 0);
    const passiveGoalPct = Math.min((mStats.passive / passiveGoal) * 100, 100);

    document.getElementById('targets-passive-total').innerHTML = formatSplitMoney(mStats.passive);
    document.getElementById('targets-passive-goal').textContent = `Goal: ${formatMoney(passiveGoal, 0)}`;
    document.getElementById('targets-passive-bar').style.width = `${passiveGoalPct}%`;
    document.getElementById('targets-passive-coverage').textContent = `${coveragePct.toFixed(1)}% of expenses covered`;
    document.getElementById('targets-passive-goal-pct').textContent = `${Math.round(passiveGoalPct)}% of goal`;

    // Monthly Expense Budget
    const budgetCap = Math.max(Number(t.monthlyBudgetCap) || 1, 1);
    const budgetPct = Math.min((mStats.outcome / budgetCap) * 100, 100);
    document.getElementById('targets-income-display').textContent = formatMoney(t.monthlyIncome, 0);
    document.getElementById('targets-spent-display').textContent = formatMoney(mStats.outcome, 0);
    document.getElementById('targets-cap-display').textContent = `Cap: ${formatMoney(budgetCap, 0)}`;
    const bBar = document.getElementById('targets-budget-bar');
    bBar.style.width = `${budgetPct}%`;
    bBar.className = `h-full rounded-full transition-all duration-500 ${mStats.outcome >= budgetCap ? 'bg-dangerRed' : (mStats.outcome >= budgetCap * 0.75 ? 'bg-amber-400' : 'bg-limeAccent')}`;

    // Savings Goal
    const savGoal = Math.max(Number(t.monthlySavingsGoal) || 1, 1);
    const savPct = Math.max(0, Math.min((mStats.net / savGoal) * 100, 100));
    document.getElementById('targets-savings-pct').textContent = `${Math.round(savPct)}%`;
    document.getElementById('targets-savings-bar').style.width = `${savPct}%`;
    document.getElementById('targets-savings-actual').textContent = formatMoney(mStats.net, 0);
    document.getElementById('targets-savings-goal').textContent = formatMoney(savGoal, 0);

    // Custom Goal Card
    const goalTarget = Math.max(Number(t.customGoalAmount) || 1, 1);
    const goalBal = t.customGoalAccountId ? getAccountBalance(profile, t.customGoalAccountId) : 0;
    const goalPct = Math.max(0, Math.min((goalBal / goalTarget) * 100, 100));
    document.getElementById('targets-custom-name').textContent = t.customGoalName || 'Custom Goal';
    document.getElementById('targets-custom-bar').style.width = `${goalPct}%`;
    document.getElementById('targets-custom-current').textContent = formatMoney(goalBal, 0);
    document.getElementById('targets-custom-amount').textContent = formatMoney(goalTarget, 0);

    // Per-Category Spending Caps
    const expCats = profile.categories.filter(c => c.type === 'Expense');
    document.getElementById('targets-categories-list').innerHTML = expCats.map(cat => {
        const cap = Math.max(Number(cat.cap) || 0, 0);
        const spent = mStats.byCategory[cat.id] || 0;
        const pct = cap > 0 ? Math.min((spent / cap) * 100, 100) : (spent > 0 ? 100 : 0);
        const isOver = cap > 0 && spent > cap;
        const barCol = isOver ? '#FF5A5F' : (pct >= 80 ? '#FBBF24' : (cat.isBankFee ? '#B8B8FF' : '#C6F432'));

        return `
            <div>
                <div class="flex items-center justify-between text-xs mb-1.5">
                    <span class="font-bold text-zinc-200 flex items-center gap-2">
                        <span>${cat.emoji}</span> ${cat.name}
                    </span>
                    <span class="font-bold ${isOver ? 'text-dangerRed' : 'text-zinc-300'}">
                        ${formatMoney(spent, 0)} <span class="text-mutedText font-normal">/ ${formatMoney(cap, 0)}</span>
                    </span>
                </div>
                <div class="w-full h-2 rounded-full bg-canvas overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-500" style="width:${pct}%; background-color:${barCol}"></div>
                </div>
            </div>
        `;
    }).join('');
}

/* =====================================================================
 * SCREEN 4: CUSTOMIZE RENDER (Profiles, Accounts, Categories)
 * ===================================================================== */
function setCustomizeCatTab(tab) {
    customizeCatTab = tab;
    renderCustomize(getActiveProfile());
}

function renderCustomize(profile) {
    document.getElementById('cust-display-name').value = profile.displayName || profile.name;
    document.getElementById('cust-currency').value = profile.currency || 'LKR';

    // Profiles List
    document.getElementById('customize-profiles-list').innerHTML = rootState.profiles.map(p => {
        const isAct = p.id === rootState.activeProfileId;
        return `
            <div class="flex items-center justify-between p-3 rounded-2xl bg-canvas border ${isAct ? 'border-limeAccent' : 'border-borderDark'}">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-8 h-8 rounded-full ${isAct ? 'bg-limeAccent text-canvas' : 'bg-surface text-zinc-300'} flex items-center justify-center text-xs font-extrabold shrink-0">
                        ${(p.name || 'P').charAt(0).toUpperCase()}
                    </span>
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-white truncate">${p.name} ${isAct ? '<span class="text-limeAccent text-[10px]">(Active)</span>' : ''}</p>
                        <p class="text-[10px] text-mutedText">${p.currency} • ${p.transactions.length} txns</p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    ${!isAct ? `<button onclick="switchProfile('${p.id}')" class="px-2.5 py-1 rounded-lg bg-limeAccent text-canvas text-[10px] font-extrabold">Switch</button>` : ''}
                    ${rootState.profiles.length > 1 ? `<button onclick="confirmDeleteProfile('${p.id}')" class="w-7 h-7 rounded-lg bg-surface text-mutedText hover:text-dangerRed flex items-center justify-center"><i class="fa-regular fa-trash-can text-[11px]"></i></button>` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Accounts List
    document.getElementById('customize-accounts-list').innerHTML = profile.accounts.map(acc => {
        const bal = getAccountBalance(profile, acc.id);
        return `
            <div class="flex items-center justify-between p-3 rounded-2xl bg-canvas border border-borderDark">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="w-8 h-6 rounded-md theme-${acc.theme || 'dark'} shrink-0"></span>
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-white truncate">${acc.name} <span class="text-mutedText font-normal">••${acc.last4 || '0000'}</span></p>
                        <p class="text-[10px] text-mutedText">Bal: ${formatMoney(bal, 0)}</p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="openAccountModal('${acc.id}')" class="w-7 h-7 rounded-lg bg-surface text-zinc-300 hover:text-limeAccent flex items-center justify-center"><i class="fa-solid fa-pen text-[10px]"></i></button>
                    <button onclick="confirmDeleteAccount('${acc.id}')" class="w-7 h-7 rounded-lg bg-surface text-mutedText hover:text-dangerRed flex items-center justify-center"><i class="fa-regular fa-trash-can text-[11px]"></i></button>
                </div>
            </div>
        `;
    }).join('');

    // Category Tabs
    ['Expense', 'Income'].forEach(t => {
        const btn = document.getElementById(`cust-cat-tab-${t}`);
        btn.textContent = `${t} Categories`;
        btn.className = t === customizeCatTab
            ? 'py-1.5 rounded-lg text-xs font-extrabold transition bg-limeAccent text-canvas'
            : 'py-1.5 rounded-lg text-xs font-semibold transition text-mutedText hover:text-white';
    });

    // Categories List
    const cats = profile.categories.filter(c => c.type === customizeCatTab);
    document.getElementById('customize-categories-list').innerHTML = cats.map(c => `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-canvas border border-borderDark">
            <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-base">${c.emoji}</span>
                <div class="min-w-0">
                    <p class="text-xs font-bold text-white truncate">${c.name}</p>
                    <p class="text-[10px] text-mutedText">
                        ${c.type === 'Expense' ? `Cap: ${formatMoney(c.cap || 0, 0)}` : (c.isPassive ? 'Passive Income Stream' : 'Active Income')}
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
                <button onclick="openCategoryModal('${c.id}')" class="w-7 h-7 rounded-lg bg-surface text-zinc-300 hover:text-limeAccent flex items-center justify-center"><i class="fa-solid fa-pen text-[10px]"></i></button>
                <button onclick="confirmDeleteCategory('${c.id}')" class="w-7 h-7 rounded-lg bg-surface text-mutedText hover:text-dangerRed flex items-center justify-center"><i class="fa-regular fa-trash-can text-[11px]"></i></button>
            </div>
        </div>
    `).join('');
}

function quickSetCurrency(code) {
    document.getElementById('cust-currency').value = code;
}

function saveProfileBasics() {
    const p = getActiveProfile();
    const dName = document.getElementById('cust-display-name').value.trim();
    const cur = document.getElementById('cust-currency').value.trim().toUpperCase();
    if (dName) p.displayName = dName;
    if (cur) p.currency = cur;
    saveRootState();
    renderAll();
    showToast('Profile & currency updated!');
}

/* =====================================================================
 * QUICK ADD DRAWER & BANK TRANSFER FEE LOGIC
 * ===================================================================== */
function openAddDrawer(initialType = 'Expense') {
    editingTxId = null;
    const dt = document.getElementById('drawer-title'); if (dt) dt.textContent = 'Add Transaction';
    const sb = document.getElementById('tx-submit-btn'); if (sb) sb.textContent = 'Save Transaction';
    const profile = getActiveProfile();
    if (profile.accounts.length === 0) {
        showToast('Please add an account first.');
        return;
    }
    const cur = getCurrency();
    document.getElementById('tx-amount-label').textContent = `Amount (${cur})`;
    document.getElementById('tx-fee-label').textContent = `Bank / Transfer Fee (${cur}, Optional)`;

    const accOptions = profile.accounts.map(a => `<option value="${a.id}">${a.name} (${formatMoney(getAccountBalance(profile, a.id), 0)})</option>`).join('');
    document.getElementById('tx-account').innerHTML = accOptions;
    document.getElementById('tx-to-account').innerHTML = accOptions;
    if (profile.accounts.length > 1) {
        document.getElementById('tx-to-account').selectedIndex = 1;
    }

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('tx-date').value = now.toISOString().slice(0, 16);
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-fee').value = '0';
    document.getElementById('tx-note').value = '';

    setDrawerType(initialType);

    const drawer = document.getElementById('add-drawer');
    const panel = document.getElementById('add-drawer-panel');
    drawer.classList.remove('hidden');
    requestAnimationFrame(() => panel.classList.remove('translate-y-full'));
}

function editTx(txId) {
    const p = getActiveProfile();
    const tx = p.transactions.find(t => t.id === txId);
    if (!tx) return;
    if (tx.type === 'Transfer-Out' || tx.type === 'Transfer-In') {
        showToast('Transfers cannot be edited. Delete and add it again.');
        return;
    }
    openAddDrawer(tx.type);
    editingTxId = txId;
    document.getElementById('drawer-title').textContent = 'Edit Transaction';
    const sb = document.getElementById('tx-submit-btn'); if (sb) sb.textContent = 'Update Transaction';
    document.getElementById('tx-account').value = tx.accountId;
    document.getElementById('tx-category').value = tx.categoryId;
    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-date').value = normalizeDate(tx.date) || tx.date;
    document.getElementById('tx-note').value = tx.note || '';
}

function closeAddDrawer() {
    editingTxId = null;
    const drawer = document.getElementById('add-drawer');
    const panel = document.getElementById('add-drawer-panel');
    panel.classList.add('translate-y-full');
    setTimeout(() => drawer.classList.add('hidden'), 260);
}

function setDrawerType(type) {
    drawerType = type;
    ['Expense', 'Income', 'Transfer'].forEach(t => {
        const btn = document.getElementById(`dtype-${t}`);
        btn.className = t === type
            ? 'py-2 rounded-xl text-xs font-extrabold transition bg-limeAccent text-canvas'
            : 'py-2 rounded-xl text-xs font-semibold transition text-mutedText hover:text-white';
    });

    const profile = getActiveProfile();
    const transferSec = document.getElementById('tx-transfer-section');
    const catWrap = document.getElementById('tx-category-wrap');
    const accLabel = document.getElementById('tx-account-label');

    if (type === 'Transfer') {
        transferSec.classList.remove('hidden');
        catWrap.classList.add('hidden');
        accLabel.textContent = 'From Account';
        updateTransferPreview();
    } else {
        transferSec.classList.add('hidden');
        catWrap.classList.remove('hidden');
        accLabel.textContent = 'Account';
        const cats = profile.categories.filter(c => c.type === type);
        document.getElementById('tx-category').innerHTML = cats.map(c =>
            `<option value="${c.id}">${c.emoji} ${c.name}${c.isPassive ? ' (Passive)' : ''}</option>`
        ).join('');
    }
}

function setTransferFee(val, isReset) {
    const feeInput = document.getElementById('tx-fee');
    const current = parseFloat(feeInput.value) || 0;
    feeInput.value = isReset ? '0' : (current + val);
    updateTransferPreview();
}

function updateTransferPreview() {
    if (drawerType !== 'Transfer') return;
    const profile = getActiveProfile();
    const fromId = document.getElementById('tx-account').value;
    const toId = document.getElementById('tx-to-account').value;
    const amount = Math.max(0, parseFloat(document.getElementById('tx-amount').value) || 0);
    const fee = Math.max(0, parseFloat(document.getElementById('tx-fee').value) || 0);

    document.getElementById('prev-from').textContent = getAccountNameById(profile, fromId);
    document.getElementById('prev-to').textContent = getAccountNameById(profile, toId);
    document.getElementById('prev-deducted').textContent = formatMoney(amount + fee, 2);
    document.getElementById('prev-received').textContent = formatMoney(amount, 2);

    const feeNote = document.getElementById('prev-fee-note');
    if (fee > 0) feeNote.classList.remove('hidden');
    else feeNote.classList.add('hidden');
}

function handleSaveTransaction(e) {
    e.preventDefault();
    const profile = getActiveProfile();
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const accountId = document.getElementById('tx-account').value;
    const date = document.getElementById('tx-date').value;
    const note = document.getElementById('tx-note').value.trim();

    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount.');
        return;
    }

    if (drawerType === 'Transfer' && editingTxId) {
        showToast('An edited transaction cannot be changed into a Transfer.');
        return;
    }
    if (drawerType === 'Transfer') {
        const toAccountId = document.getElementById('tx-to-account').value;
        if (accountId === toAccountId) {
            showToast('From and To accounts must be different.');
            return;
        }
        const fee = Math.max(0, parseFloat(document.getElementById('tx-fee').value) || 0);
        const fromName = getAccountNameById(profile, accountId);
        const toName = getAccountNameById(profile, toAccountId);
        const ts = Date.now();

        profile.transactions.push(
            { id: `tx-${ts}-out`, date, type: 'Transfer-Out', accountId, categoryId: 'transfer', amount, note: `To ${toName}${note ? ' • ' + note : ''}` },
            { id: `tx-${ts}-in`, date, type: 'Transfer-In', accountId: toAccountId, categoryId: 'transfer', amount, note: `From ${fromName}${note ? ' • ' + note : ''}` }
        );

        if (fee > 0) {
            const feeCat = ensureBankFeeCategory(profile);
            profile.transactions.push({
                id: `tx-${ts}-fee`,
                date,
                type: 'Expense',
                accountId,
                categoryId: feeCat.id,
                amount: fee,
                note: `Transfer fee: ${fromName} → ${toName}`
            });
        }

        saveRootState();
        closeAddDrawer();
        renderAll();
        showToast(fee > 0 ? `Transfer saved + ${formatMoney(fee, 0)} Bank Fee logged!` : 'Transfer completed!');
        return;
    }

    const categoryId = document.getElementById('tx-category').value;
    if (editingTxId) {
        const existing = profile.transactions.find(t => t.id === editingTxId);
        if (existing) {
            Object.assign(existing, { date, type: drawerType, accountId, categoryId, amount, note });
            saveRootState();
            closeAddDrawer();
            renderAll();
            showToast('Transaction updated!');
            return;
        }
    }
    profile.transactions.push({
        id: `tx-${Date.now()}`,
        date,
        type: drawerType,
        accountId,
        categoryId,
        amount,
        note
    });

    saveRootState();
    closeAddDrawer();
    renderAll();
    showToast(`${drawerType} saved!`);
}

function confirmDeleteTx(txId) {
    openModal('Delete Transaction?', 'This will permanently remove the entry and recalculate account balances.', [
        { label: 'Cancel', style: 'bg-canvas border border-borderDark text-zinc-200', onClick: closeModal },
        {
            label: 'Delete',
            style: 'bg-dangerRed text-white',
            onClick: () => {
                const p = getActiveProfile();
                rootState.deletedTxIds = [...(rootState.deletedTxIds || []), txId];
                p.transactions = p.transactions.filter(t => t.id !== txId);
                saveRootState();
                closeModal();
                renderAll();
                showToast('Transaction deleted.');
            }
        }
    ]);
}

/* =====================================================================
 * TARGETS DRAWER LOGIC
 * ===================================================================== */
function openTargetsDrawer() {
    const p = getActiveProfile();
    const t = p.targets;
    document.getElementById('t-income').value = t.monthlyIncome || 0;
    document.getElementById('t-budget').value = t.monthlyBudgetCap || 1;
    document.getElementById('t-savings').value = t.monthlySavingsGoal || 0;
    document.getElementById('t-passive').value = t.monthlyPassiveGoal || 1;
    document.getElementById('t-goal-name').value = t.customGoalName || 'Custom Goal';
    document.getElementById('t-goal-amount').value = t.customGoalAmount || 10000;

    const accSel = document.getElementById('t-goal-account');
    accSel.innerHTML = p.accounts.map(a => `<option value="${a.id}" ${a.id === t.customGoalAccountId ? 'selected' : ''}>${a.name}</option>`).join('');

    const expCats = p.categories.filter(c => c.type === 'Expense');
    document.getElementById('t-category-caps-grid').innerHTML = expCats.map(c => `
        <div>
            <label class="block text-[10px] text-mutedText mb-1 truncate">${c.emoji} ${c.name}</label>
            <input type="number" min="0" step="1" data-cat-id="${c.id}" oninput="updateTargetsCapSum()" value="${c.cap || 0}" class="t-cat-cap w-full bg-surface border border-borderDark rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-limeAccent">
        </div>
    `).join('');
    updateTargetsCapSum();

    const drawer = document.getElementById('targets-drawer');
    const panel = document.getElementById('targets-drawer-panel');
    drawer.classList.remove('hidden');
    requestAnimationFrame(() => panel.classList.remove('translate-y-full'));
}

function closeTargetsDrawer() {
    const drawer = document.getElementById('targets-drawer');
    const panel = document.getElementById('targets-drawer-panel');
    panel.classList.add('translate-y-full');
    setTimeout(() => drawer.classList.add('hidden'), 260);
}

function updateTargetsCapSum() {
    let sum = 0;
    document.querySelectorAll('.t-cat-cap').forEach(inp => sum += Number(inp.value) || 0);
    document.getElementById('t-caps-sum').textContent = `Total: ${formatMoney(sum, 0)}`;
}

function saveTargets(e) {
    e.preventDefault();
    const p = getActiveProfile();
    p.targets = {
        monthlyIncome: Math.max(0, Number(document.getElementById('t-income').value) || 0),
        monthlyBudgetCap: Math.max(1, Number(document.getElementById('t-budget').value) || 1),
        monthlySavingsGoal: Math.max(0, Number(document.getElementById('t-savings').value) || 0),
        monthlyPassiveGoal: Math.max(1, Number(document.getElementById('t-passive').value) || 1),
        customGoalName: document.getElementById('t-goal-name').value.trim() || 'Custom Goal',
        customGoalAmount: Math.max(1, Number(document.getElementById('t-goal-amount').value) || 1),
        customGoalAccountId: document.getElementById('t-goal-account').value
    };

    document.querySelectorAll('.t-cat-cap').forEach(inp => {
        const cat = p.categories.find(c => c.id === inp.dataset.catId);
        if (cat) cat.cap = Math.max(0, Number(inp.value) || 0);
    });

    saveRootState();
    closeTargetsDrawer();
    renderAll();
    showToast('Targets updated!');
}

/* =====================================================================
 * ACCOUNT CRUD MODAL
 * ===================================================================== */
function selectAccTheme(theme) {
    selectedAccountTheme = theme;
    document.querySelectorAll('.acc-theme-btn').forEach(btn => {
        btn.classList.toggle('border-white', btn.dataset.theme === theme);
        btn.classList.toggle('scale-105', btn.dataset.theme === theme);
        btn.classList.toggle('border-transparent', btn.dataset.theme !== theme);
    });
}

function openAccountModal(editId = null) {
    const p = getActiveProfile();
    const existing = editId ? p.accounts.find(a => a.id === editId) : null;
    document.getElementById('acc-modal-title').textContent = existing ? 'Edit Account' : 'Add Account';
    document.getElementById('acc-edit-id').value = existing ? existing.id : '';
    document.getElementById('acc-name').value = existing ? existing.name : '';
    document.getElementById('acc-subtitle').value = existing ? (existing.subtitle || '') : '';
    document.getElementById('acc-last4').value = existing ? (existing.last4 || '') : String(Math.floor(1000 + Math.random() * 9000));
    document.getElementById('acc-opening').value = existing ? (existing.openingBalance || 0) : 0;
    selectAccTheme(existing ? (existing.theme || 'dark') : 'lime');
    document.getElementById('account-modal').classList.remove('hidden');
}

function closeAccountModal() {
    document.getElementById('account-modal').classList.add('hidden');
}

function saveAccountForm(e) {
    e.preventDefault();
    const p = getActiveProfile();
    const editId = document.getElementById('acc-edit-id').value;
    const payload = {
        id: editId || `acc-${Date.now()}`,
        name: document.getElementById('acc-name').value.trim(),
        subtitle: document.getElementById('acc-subtitle').value.trim(),
        last4: document.getElementById('acc-last4').value.trim() || '0000',
        openingBalance: parseFloat(document.getElementById('acc-opening').value) || 0,
        theme: selectedAccountTheme
    };

    if (editId) {
        const idx = p.accounts.findIndex(a => a.id === editId);
        if (idx !== -1) p.accounts[idx] = payload;
    } else {
        p.accounts.push(payload);
    }

    saveRootState();
    closeAccountModal();
    renderAll();
    showToast(editId ? 'Account updated!' : 'Account added!');
}

function confirmDeleteAccount(accId) {
    const p = getActiveProfile();
    if (p.accounts.length <= 1) {
        showToast('You must keep at least one account.');
        return;
    }
    const acc = p.accounts.find(a => a.id === accId);
    openModal('Delete Account?', `Remove "${acc ? acc.name : 'this account'}"? Past transactions will remain in history.`, [
        { label: 'Cancel', style: 'bg-canvas border border-borderDark text-zinc-200', onClick: closeModal },
        {
            label: 'Delete',
            style: 'bg-dangerRed text-white',
            onClick: () => {
                p.accounts = p.accounts.filter(a => a.id !== accId);
                saveRootState();
                closeModal();
                renderAll();
                showToast('Account deleted.');
            }
        }
    ]);
}

/* =====================================================================
 * CATEGORY CRUD MODAL
 * ===================================================================== */
function toggleCategoryModalFields() {
    const type = document.getElementById('cat-type').value;
    document.getElementById('cat-cap-wrap').classList.toggle('hidden', type !== 'Expense');
    document.getElementById('cat-passive-wrap').classList.toggle('hidden', type !== 'Income');
}

function openCategoryModal(editId = null) {
    const p = getActiveProfile();
    const existing = editId ? p.categories.find(c => c.id === editId) : null;
    document.getElementById('cat-modal-title').textContent = existing ? 'Edit Category' : 'Add Category';
    document.getElementById('cat-edit-id').value = existing ? existing.id : '';
    document.getElementById('cat-type').value = existing ? existing.type : customizeCatTab;
    document.getElementById('cat-emoji').value = existing ? existing.emoji : '✨';
    document.getElementById('cat-name').value = existing ? existing.name : '';
    document.getElementById('cat-cap').value = existing ? (existing.cap || 0) : 3000;
    document.getElementById('cat-is-passive').checked = existing ? !!existing.isPassive : false;
    toggleCategoryModalFields();
    document.getElementById('category-modal').classList.remove('hidden');
}

function closeCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
}

function saveCategoryForm(e) {
    e.preventDefault();
    const p = getActiveProfile();
    const editId = document.getElementById('cat-edit-id').value;
    const type = document.getElementById('cat-type').value;
    const existing = editId ? p.categories.find(c => c.id === editId) : null;

    const payload = {
        id: editId || `cat-${Date.now()}`,
        type,
        emoji: document.getElementById('cat-emoji').value.trim() || '📦',
        name: document.getElementById('cat-name').value.trim(),
        cap: type === 'Expense' ? Math.max(0, Number(document.getElementById('cat-cap').value) || 0) : 0,
        isPassive: type === 'Income' ? document.getElementById('cat-is-passive').checked : false,
        isBankFee: existing ? !!existing.isBankFee : false
    };

    if (editId) {
        const idx = p.categories.findIndex(c => c.id === editId);
        if (idx !== -1) p.categories[idx] = payload;
    } else {
        p.categories.push(payload);
    }

    saveRootState();
    closeCategoryModal();
    renderAll();
    showToast(editId ? 'Category updated!' : 'Category added!');
}

function confirmDeleteCategory(catId) {
    const p = getActiveProfile();
    const cat = p.categories.find(c => c.id === catId);
    if (cat && cat.isBankFee) {
        showToast('Bank Fees category is required for transfer fees.');
        return;
    }
    openModal('Delete Category?', `Delete "${cat ? cat.name : 'category'}"?`, [
        { label: 'Cancel', style: 'bg-canvas border border-borderDark text-zinc-200', onClick: closeModal },
        {
            label: 'Delete',
            style: 'bg-dangerRed text-white',
            onClick: () => {
                p.categories = p.categories.filter(c => c.id !== catId);
                saveRootState();
                closeModal();
                renderAll();
                showToast('Category deleted.');
            }
        }
    ]);
}

/* =====================================================================
 * MULTI-PROFILE SWITCHER & CREATION
 * ===================================================================== */
function openProfileModal() {
    document.getElementById('modal-profiles-list').innerHTML = rootState.profiles.map(p => {
        const isAct = p.id === rootState.activeProfileId;
        return `
            <button onclick="switchProfile('${p.id}'); closeProfileModal();" class="w-full flex items-center justify-between p-3 rounded-2xl bg-canvas border ${isAct ? 'border-limeAccent' : 'border-borderDark hover:border-white/20'} transition text-left">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-8 h-8 rounded-full ${isAct ? 'bg-limeAccent text-canvas' : 'bg-surface text-white'} flex items-center justify-center text-xs font-extrabold shrink-0">
                        ${(p.name || 'P').charAt(0).toUpperCase()}
                    </span>
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-white truncate">${p.name}</p>
                        <p class="text-[10px] text-mutedText">${p.currency} • ${p.accounts.length} cards • ${p.transactions.length} txns</p>
                    </div>
                </div>
                ${isAct ? '<span class="text-[10px] font-extrabold text-limeAccent">Active</span>' : '<i class="fa-solid fa-chevron-right text-[10px] text-mutedText"></i>'}
            </button>
        `;
    }).join('');
    document.getElementById('profile-modal').classList.remove('hidden');
}

function closeProfileModal() {
    document.getElementById('profile-modal').classList.add('hidden');
}

function openCreateProfileModal() {
    document.getElementById('new-prof-name').value = '';
    document.getElementById('new-prof-currency').value = 'LKR';
    document.getElementById('new-prof-template').value = 'blank';
    document.getElementById('create-profile-modal').classList.remove('hidden');
}

function closeCreateProfileModal() {
    document.getElementById('create-profile-modal').classList.add('hidden');
}

function handleCreateProfile(e) {
    e.preventDefault();
    const name = document.getElementById('new-prof-name').value.trim();
    const currency = document.getElementById('new-prof-currency').value.trim().toUpperCase() || 'LKR';
    const template = document.getElementById('new-prof-template').value;
    const id = `prof-${Date.now()}`;

    const newProf = template === 'sample'
        ? createSampleProfile(id, name, currency)
        : createBlankProfile(id, name, currency);

    rootState.profiles.push(newProf);
    rootState.activeProfileId = id;
    saveRootState();
    closeCreateProfileModal();
    renderAll();
    showToast(`Switched to "${name}"!`);
}

function switchProfile(profileId) {
    rootState.activeProfileId = profileId;
    saveRootState();
    renderAll();
    showToast(`Active profile: ${getActiveProfile().name}`);
}

function confirmDeleteProfile(profileId) {
    if (rootState.profiles.length <= 1) return;
    const target = rootState.profiles.find(p => p.id === profileId);
    openModal('Delete Profile?', `Permanently delete "${target ? target.name : 'profile'}" and all its data?`, [
        { label: 'Cancel', style: 'bg-canvas border border-borderDark text-zinc-200', onClick: closeModal },
        {
            label: 'Delete',
            style: 'bg-dangerRed text-white',
            onClick: () => {
                rootState.profiles = rootState.profiles.filter(p => p.id !== profileId);
                if (rootState.activeProfileId === profileId) {
                    rootState.activeProfileId = rootState.profiles[0].id;
                }
                saveRootState();
                closeModal();
                renderAll();
                showToast('Profile deleted.');
            }
        }
    ]);
}

/* =====================================================================
 * DATA TOOLS: CSV EXPORT / IMPORT & FULL JSON BACKUP / RESTORE
 * ===================================================================== */
function exportCSV() {
    const p = getActiveProfile();
    if (p.transactions.length === 0) {
        showToast('No transactions to export.');
        return;
    }
    let csv = `Period,Account,Category,Note,${p.currency},Type\n`;
    p.transactions.forEach(tx => {
        const acc = getAccountNameById(p, tx.accountId);
        const cat = getCategoryById(p, tx.categoryId).name;
        const safeNote = (tx.note || '').replace(/"/g, '""');
        csv += `"${tx.date}","${acc}","${cat}","${safeNote}","${tx.amount}","${tx.type}"\n`;
    });
    downloadFile(csv, `MyFinance_${p.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
    showToast('Excel CSV downloaded!');
}

function handleCSVImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const p = getActiveProfile();
            const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) throw new Error('CSV file is empty.');
            const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
            const idxDate = headers.findIndex(h => h.includes('period') || h.includes('date'));
            const idxAcc = headers.findIndex(h => h.includes('account'));
            const idxCat = headers.findIndex(h => h.includes('category'));
            const idxNote = headers.findIndex(h => h.includes('note') || h.includes('desc'));
            const idxAmt = headers.findIndex(h => h === 'lkr' || h === p.currency.toLowerCase() || h.includes('amount'));
            const idxType = headers.findIndex(h => h.includes('type') || h.includes('income/expense'));

            if (idxAmt === -1) throw new Error('Amount / Currency column not found.');

            let count = 0;
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
                const amt = parseFloat((cols[idxAmt] || '').replace(/,/g, ''));
                if (!amt || amt <= 0) continue;

                const rawType = idxType !== -1 ? (cols[idxType] || '').toLowerCase() : 'expense';
                let type = 'Expense';
                if (rawType.includes('income')) type = 'Income';
                else if (rawType.includes('transfer-in')) type = 'Transfer-In';
                else if (rawType.includes('transfer')) type = 'Transfer-Out';

                const accName = idxAcc !== -1 ? (cols[idxAcc] || '') : '';
                const matchedAcc = p.accounts.find(a => a.name.toLowerCase().includes(accName.toLowerCase())) || p.accounts[0];

                const catName = idxCat !== -1 ? (cols[idxCat] || '') : 'Other';
                let matchedCat = p.categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
                if (!matchedCat && type !== 'Transfer-In' && type !== 'Transfer-Out') {
                    matchedCat = { id: `cat-imp-${Date.now()}-${i}`, type: type === 'Income' ? 'Income' : 'Expense', emoji: '📦', name: catName, cap: 0, isPassive: false };
                    p.categories.push(matchedCat);
                }

                const dateVal = idxDate !== -1 && cols[idxDate] ? cols[idxDate] : new Date().toISOString().slice(0, 16);
                p.transactions.push({
                    id: `csv-${Date.now()}-${i}`,
                    date: normalizeDate(dateVal) || new Date().toISOString().slice(0, 16),
                    type,
                    accountId: matchedAcc ? matchedAcc.id : p.accounts[0].id,
                    categoryId: matchedCat ? matchedCat.id : 'transfer',
                    amount: amt,
                    note: idxNote !== -1 ? (cols[idxNote] || '') : ''
                });
                count++;
            }
            saveRootState();
            renderAll();
            showToast(`Imported ${count} rows into ${p.name}!`);
        } catch (err) {
            openModal('Import Error', err.message, [{ label: 'OK', style: 'bg-limeAccent text-canvas', onClick: closeModal }]);
        } finally {
            e.target.value = '';
        }
    };
    reader.readAsText(file);
}

function backupJSON() {
    downloadFile(JSON.stringify(rootState, null, 2), `MyFinance_FullBackup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    showToast('Full JSON backup saved!');
}

function handleJSONRestore(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const parsed = JSON.parse(ev.target.result);
            if (!parsed.profiles || !Array.isArray(parsed.profiles)) {
                throw new Error('Invalid MyFinance backup file.');
            }
            normalizeAllDates(parsed);
            rootState = parsed;
            saveRootState();
            renderAll();
            showToast('All profiles restored!');
        } catch (err) {
            openModal('Restore Error', err.message, [{ label: 'OK', style: 'bg-limeAccent text-canvas', onClick: closeModal }]);
        } finally {
            e.target.value = '';
        }
    };
    reader.readAsText(file);
}

function confirmResetCurrentProfile() {
    const p = getActiveProfile();
    openModal(`Reset "${p.name}"?`, 'Clear all transactions in this profile and reset opening balances to 0?', [
        { label: 'Cancel', style: 'bg-canvas border border-borderDark text-zinc-200', onClick: closeModal },
        {
            label: 'Reset Profile',
            style: 'bg-dangerRed text-white',
            onClick: () => {
                rootState.deletedTxIds = [...(rootState.deletedTxIds || []), ...p.transactions.map(t => t.id)];
                p.transactions = [];
                p.accounts.forEach(a => a.openingBalance = 0);
                saveRootState();
                closeModal();
                renderAll();
                showToast(`"${p.name}" has been reset.`);
            }
        }
    ]);
}

function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* =====================================================================
 * MODALS, BUDGET ALERT & TOASTS
 * ===================================================================== */
/* Monthly report -> WhatsApp (uses the month selected on the Analytics chart) */
function shareMonthlyReport() {
    const p = getActiveProfile();
    const series = getLast7MonthsSeries(p);
    const m = series[selectedMonthIndex] || series[series.length - 1];
    const st = getMonthStats(p, m.prefix);
    const cap = Math.max(Number(p.targets.monthlyBudgetCap) || 1, 1);
    const pct = Math.round((st.outcome / cap) * 100);
    const top = Object.entries(st.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, amt], i) => {
        const c = getCategoryById(p, id);
        return `${i + 1}. ${c.emoji || ''} ${c.name}: ${formatMoney(amt, 0)}`;
    });
    const lines = [
        `📊 *MyFinance Report* — ${m.label} ${m.year}`,
        `👤 ${p.name}`,
        '',
        `💰 Income: ${formatMoney(st.income, 0)}`,
        `💸 Outcome: ${formatMoney(st.outcome, 0)}`,
        `✅ Net Savings: ${formatMoney(st.net, 0)}`,
        `🏦 Bank Fees: ${formatMoney(st.bankFees, 0)}`,
        `🎯 Budget used: ${pct}% of ${formatMoney(cap, 0)}`,
        ''
    ];
    if (top.length) { lines.push('*Top spending*'); lines.push(...top); }
    window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank');
}

function openBudgetAlertModal() {
    const p = getActiveProfile();
    const mStats = getMonthStats(p, getCurrentMonthPrefix());
    const cap = Math.max(Number(p.targets.monthlyBudgetCap) || 1, 1);
    const pct = Math.round((mStats.outcome / cap) * 100);
    const msg = `Profile "${p.name}": You have spent ${formatMoney(mStats.outcome, 0)} (${pct}%) of your ${formatMoney(cap, 0)} monthly cap. Total Bank Fees this month: ${formatMoney(mStats.bankFees, 0)}. Passive income earned: ${formatMoney(mStats.passive, 0)}.`;
    openModal('Monthly Financial Pulse', msg, [
        { label: 'View Targets', style: 'bg-canvas border border-borderDark text-white', onClick: () => { closeModal(); switchScreen('targets'); } },
        { label: 'Got it', style: 'bg-limeAccent text-canvas', onClick: closeModal }
    ]);
}

function openModal(title, body, buttons) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').textContent = body;
    const box = document.getElementById('modal-buttons');
    box.innerHTML = '';
    buttons.forEach(b => {
        const el = document.createElement('button');
        el.className = `px-4 py-2.5 rounded-xl text-xs font-extrabold active:scale-95 transition ${b.style}`;
        el.textContent = b.label;
        el.onclick = b.onClick;
        box.appendChild(el);
    });
    document.getElementById('app-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('app-modal').classList.add('hidden');
}

function showToast(msg) {
    const box = document.getElementById('toast-box');
    const el = document.createElement('div');
    el.className = 'toast-item px-4 py-2.5 rounded-full bg-surface border border-limeAccent/40 text-white text-xs font-bold shadow-xl';
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transition = 'opacity 0.25s ease';
        setTimeout(() => el.remove(), 250);
    }, 2600);
}

/* =====================================================================
 * GOOGLE SHEET TWO-WAY SYNC (Apps Script Web App)
 * Every device pulls the latest data from the Sheet, merges it with its own
 * data, then pushes the merged result back. All devices end up identical.
 *  - Transactions are merged by ID (nothing is lost).
 *  - Deleted transactions are remembered (tombstones) so they stay deleted.
 *  - Accounts / categories / targets: the most recently edited device wins.
 * ===================================================================== */
const SYNC_URL_KEY = 'myfinance_sync_url';
const SYNC_LINKED_KEY = 'myfinance_sync_linked';
let syncBusy = false, syncQueued = false, syncTimer = null;

function getSyncUrl() { return localStorage.getItem(SYNC_URL_KEY) || ''; }
function setSyncStatus(msg) {
    const el = document.getElementById('sync-status');
    if (el) el.textContent = msg;
}
function stateSig(st) { const c = { ...st }; delete c.activeProfileId; return JSON.stringify(c); }

function saveSyncUrl() {
    const val = document.getElementById('sync-url-input').value.trim();
    if (val && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(val)) {
        showToast('The URL must look like https://script.google.com/.../exec');
        return;
    }
    if (val !== getSyncUrl()) localStorage.removeItem(SYNC_LINKED_KEY);
    if (val) localStorage.setItem(SYNC_URL_KEY, val); else localStorage.removeItem(SYNC_URL_KEY);
    showToast(val ? 'Sheet URL saved!' : 'Sync URL removed.');
    setSyncStatus(val ? 'Saved. Syncing...' : 'Sync disabled.');
    if (val) syncNow(true);
}

function scheduleSync() {
    if (!getSyncUrl()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncNow(false), 1500);
}

function buildSheetRows(st) {
    const rows = [];
    st.profiles.forEach(p => {
        p.transactions.forEach(t => {
            const acc = (p.accounts.find(a => a.id === t.accountId) || {}).name || '';
            const cat = t.type.startsWith('Transfer') ? 'Transfer' : ((p.categories.find(c => c.id === t.categoryId) || {}).name || '');
            rows.push([t.id, t.date, acc, t.type, cat, t.note || '', t.amount, p.name]);
        });
    });
    rows.sort((x, y) => String(y[1]).localeCompare(String(x[1])));
    return rows;
}

function mergeStates(local, remote) {
    const localNewer = (local.updatedAt || 0) >= (remote.updatedAt || 0);
    const base = JSON.parse(JSON.stringify(localNewer ? local : remote));
    const other = localNewer ? remote : local;
    const tomb = new Set([...(local.deletedTxIds || []), ...(remote.deletedTxIds || [])]);
    base.deletedTxIds = [...tomb];
    base.activeProfileId = local.activeProfileId;
    base.profiles.forEach(p => {
        const op = other.profiles.find(x => x.id === p.id);
        const map = new Map();
        (op ? op.transactions : []).forEach(t => map.set(t.id, t));
        p.transactions.forEach(t => map.set(t.id, t));
        const accIds = new Set(p.accounts.map(a => a.id));
        p.transactions = [...map.values()]
            .filter(t => !tomb.has(t.id) && accIds.has(t.accountId))
            .sort((x, y) => String(x.id).localeCompare(String(y.id)));
    });
    if (!base.profiles.some(p => p.id === base.activeProfileId)) base.activeProfileId = base.profiles[0].id;
    base.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
    return base;
}

async function pushRemote(url, st) {
    const body = JSON.stringify({ action: 'save', state: JSON.stringify(st), rows: buildSheetRows(st) });
    const opts = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body };
    try {
        const res = await fetch(url, opts);
        const j = await res.json();
        return j && j.status === 'success';
    } catch (e) {
        // Response unreadable (CORS): resend blind; the server overwrites, so this is safe.
        await fetch(url, { ...opts, mode: 'no-cors' });
        return true;
    }
}

async function syncNow(manual) {
    const url = getSyncUrl();
    if (!url) { if (manual) showToast('Save the Sheet URL first.'); return; }
    if (syncBusy) { syncQueued = true; return; }
    if (!navigator.onLine) {
        setSyncStatus('Offline: will sync when you are back online.');
        if (manual) showToast('Offline. Try again later.');
        return;
    }
    syncBusy = true;
    setSyncStatus('Syncing...');
    try {
        const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=pull&t=' + Date.now());
        const resp = await res.json();
        if (!resp || resp.status !== 'success') throw new Error('Bad response');
        const remote = resp.state ? JSON.parse(resp.state) : null;
        const remoteSig = remote ? stateSig(remote) : null;
        if (remote) normalizeAllDates(remote);
        const linked = localStorage.getItem(SYNC_LINKED_KEY) === '1';
        const localHasData = rootState.profiles.some(p => p.transactions.length > 0);

        let result;
        if (!remote) {
            result = rootState;
        } else if (!linked && !localHasData) {
            result = remote;                                   // fresh device: adopt the Sheet's data
            result.activeProfileId = result.profiles.some(p => p.id === rootState.activeProfileId) ? rootState.activeProfileId : result.profiles[0].id;
        } else if (!linked && localHasData) {
            if (!confirm('Both the Sheet and this device already have data.\n\nOK = merge both\nCancel = stop syncing')) {
                setSyncStatus('Sync cancelled.');
                return;
            }
            result = mergeStates(rootState, remote);
        } else {
            result = mergeStates(rootState, remote);
        }

        if (JSON.stringify(result) !== JSON.stringify(rootState)) {
            rootState = result;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(rootState));
            renderAll();
        }
        if (!remote || stateSig(result) !== remoteSig) {
            const ok = await pushRemote(url, result);
            if (!ok) throw new Error('Push failed');
        }
        localStorage.setItem(SYNC_LINKED_KEY, '1');
        setSyncStatus(`Synced ✔ • ${new Date().toLocaleTimeString()}`);
        if (manual) showToast('Synced with Google Sheet.');
    } catch (err) {
        console.error(err);
        setSyncStatus('Sync failed. Check the URL and your internet connection.');
        if (manual) showToast('Sync failed.');
    } finally {
        syncBusy = false;
        if (syncQueued) { syncQueued = false; scheduleSync(); }
    }
}

window.addEventListener('online', () => syncNow(false));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(false); });
setInterval(() => { if (document.visibilityState === 'visible') syncNow(false); }, 60000);

/* PWA: register service worker (works on https / GitHub Pages) */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// Boot App
window.onload = () => {
    renderAll();
    const u = document.getElementById('sync-url-input');
    if (u) u.value = getSyncUrl();
};
