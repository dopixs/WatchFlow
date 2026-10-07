'use strict';
/* ═══════════════════════════════════════════════════════════════
   WatchFlow — données, calculs, synchronisation Supabase
   Principe : tout est calculé depuis le « ledger » (mouvements d'argent).
   L'appli est « local d'abord » : chaque action est appliquée tout de suite
   puis envoyée à Supabase en arrière-plan (file d'attente, reprise hors ligne).
   ═══════════════════════════════════════════════════════════════ */
const CFG = window.WATCHFLOW_CONFIG || {};
const LOCAL = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
let sb = null;            // client Supabase
let USER = null;          // { id, email }
let onChange = () => {};  // branché par app.js
let onToast = () => {};

const S = { watches: [], repairs: [], movements: [], events: [], tasks: [], settings: { starting_capital: null } };
const TABLES = ['watches', 'repairs', 'movements', 'events', 'tasks'];
const COLS = {
  watches: ['id','brand','model','reference','period','movement','case_info','condition','accessories','source','bought_at','expected_at','status','asking_price','buy_price','buy_fees','buy_ship','notes','listings','listed_at','sale_price','sale_platform','sale_fees','sale_ship','sold_at','paid_at','photo_path','thumb','created_at'],
  repairs: ['id','watch_id','label','cost','done_at','created_at'],
  movements: ['id','watch_id','kind','label','amount','date','pending','created_at'],
  events: ['id','watch_id','label','amount','at','created_at'],
  tasks: ['id','watch_id','label','done','created_at'],
};

/* ── utilitaires ── */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const daysFrom = n => daysAgo(-n);
const pd = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const diffDays = (a, b) => Math.round((pd(b) - pd(a)) / 86400000);
const MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
const MONTHS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS_L = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const fdate = s => { if (!s) return ''; const d = pd(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const num = v => { const x = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return isNaN(x) ? 0 : x; };
const r2 = x => Math.round(x * 100) / 100;
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function eur(v, sign) {
  v = r2(num(v)); const a = Math.abs(v);
  const s = (Number.isInteger(a) ? nf0 : nf2).format(a).replace(/ /g, ' ');
  return (v < 0 ? '−' : (sign && v > 0 ? '+' : '')) + s + ' €';
}
const pct = (v, sign) => (sign && v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)) + ' %';
const sum = (a, f) => a.reduce((t, x) => t + num(f(x)), 0);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let seq = 0;
const stamp = () => new Date(Date.now() + (seq++)).toISOString();
const pick = (o, ks) => { const r = {}; ks.forEach(k => { if (o[k] !== undefined) r[k] = o[k]; }); return r; };

/* ── statuts du pipeline (14 étapes + cas particuliers) ── */
const STATUSES = [
  { k: 'repere', l: 'Repérée', g: 'radar' },
  { k: 'offre', l: 'Offre envoyée', g: 'radar' },
  { k: 'achetee', l: 'Achetée', g: 'transit' },
  { k: 'payee_achat', l: 'Payée au vendeur', g: 'transit' },
  { k: 'expediee_vendeur', l: 'En transit', g: 'transit' },
  { k: 'recue', l: 'Reçue', g: 'atelier' },
  { k: 'a_inspecter', l: 'À inspecter', g: 'atelier' },
  { k: 'inspectee', l: 'Inspectée', g: 'atelier' },
  { k: 'travaux', l: 'Travaux en cours', g: 'atelier' },
  { k: 'prete', l: 'Prête à vendre', g: 'vente' },
  { k: 'en_vente', l: 'En vente', g: 'vente' },
  { k: 'vendue', l: 'Vendue', g: 'vendue' },
  { k: 'expediee_acheteur', l: 'Expédiée à l’acheteur', g: 'vendue' },
  { k: 'cloturee', l: 'Payée · clôturée', g: 'fin' },
];
const SPECIAL = [
  { k: 'conservee', l: 'Gardée (collection)', g: 'garde' },
  { k: 'litige', l: 'En litige', g: 'litige' },
  { k: 'retournee', l: 'Retournée au vendeur', g: 'fin' },
  { k: 'perdue', l: 'Perdue / invendable', g: 'fin' },
];
const ST = {}; [...STATUSES, ...SPECIAL].forEach(s => ST[s.k] = s);
const HELD_G = ['transit', 'atelier', 'vente', 'garde', 'litige'];
const SOURCES = ['Vinted', 'Leboncoin', 'eBay', 'Chrono24', 'Catawiki', 'Vide-grenier', 'Autre'];

/* ── cache local + file d'attente ── */
let Q = [];
const ck = () => 'wf:' + (USER ? USER.id : 'local');
function saveCache() { try { localStorage.setItem(ck() + ':data', JSON.stringify(S)); } catch (e) { onToast('Stockage local plein : supprime des photos'); } }
function saveQ() { try { localStorage.setItem(ck() + ':q', JSON.stringify(Q)); } catch (e) {} }
function loadCache() {
  try { const d = JSON.parse(localStorage.getItem(ck() + ':data') || 'null'); if (d) Object.assign(S, { watches: [], repairs: [], movements: [], events: [], tasks: [], settings: { starting_capital: null } }, d); } catch (e) {}
  try { Q = JSON.parse(localStorage.getItem(ck() + ':q') || '[]'); } catch (e) { Q = []; }
}
function resetState() { TABLES.forEach(t => S[t] = []); S.settings = { starting_capital: null }; Q = []; }
function changed() { saveCache(); onChange(); }

let flushTimer = null, flushing = false;
function enqueue(t, op, row) {
  if (LOCAL) return;
  if (op === 'up') {
    row = { ...row };
    if (t !== 'settings' && USER) row.user_id = USER.id;
    const k = Q.findIndex(x => x.t === t && x.op === 'up' && (t === 'settings' || x.row.id === row.id));
    if (k >= 0) Q[k].row = row; else Q.push({ t, op, row });
  } else {
    Q = Q.filter(x => !(x.t === t && x.row && x.row.id === row.id));
    if (t === 'watches') Q = Q.filter(x => !(x.row && x.row.watch_id === row.id));
    Q.push({ t, op, id: row.id });
  }
  saveQ(); clearTimeout(flushTimer); flushTimer = setTimeout(flush, 350);
}
const isNet = e => /fetch|network|load failed|timeout|offline/i.test((e && (e.message || e)) + '');
async function flush() {
  if (LOCAL || !sb || !USER || flushing || !navigator.onLine) return;
  flushing = true;
  try {
    while (Q.length) {
      const o = Q[0]; let res;
      try {
        if (o.op === 'up') res = o.t === 'settings' ? await sb.from('settings').upsert(o.row, { onConflict: 'user_id' }) : await sb.from(o.t).upsert(o.row);
        else res = await sb.from(o.t).delete().eq('id', o.id);
      } catch (e) { res = { error: e }; }
      if (res.error) {
        if (isNet(res.error)) break;
        onToast('Synchro : ' + (res.error.message || 'erreur')); console.error(res.error);
      }
      Q.shift(); saveQ();
    }
  } finally { flushing = false; onChange(); }
}
async function pull() {
  if (LOCAL || !sb || !USER) return;
  await flush();
  if (Q.length) { onChange(); return; }
  try {
    const rs = await Promise.all(TABLES.map(t => sb.from(t).select('*').order('created_at', { ascending: true })));
    const st = await sb.from('settings').select('*').maybeSingle();
    const bad = rs.find(r => r.error) || st.error;
    if (bad) { if (!isNet(bad)) onToast('Lecture : ' + bad.message); return; }
    TABLES.forEach((t, i) => S[t] = rs[i].data || []);
    S.watches.forEach(w => { if (!Array.isArray(w.listings)) w.listings = []; });
    S.settings = { starting_capital: st.data ? st.data.starting_capital : null };
    changed();
  } catch (e) { /* hors ligne : on garde le cache */ }
}

/* ── écriture locale + envoi ── */
function put(t, row) {
  row = pick(row, COLS[t]);
  if (t !== 'watches' && !row.created_at) row.created_at = stamp();
  if (t === 'watches' && !row.created_at) row.created_at = stamp();
  const arr = S[t], i = arr.findIndex(x => x.id === row.id);
  if (i >= 0) arr[i] = row; else arr.push(row);
  enqueue(t, 'up', row);
  return row;
}
function del(t, id) { const i = S[t].findIndex(x => x.id === id); if (i >= 0) S[t].splice(i, 1); enqueue(t, 'del', { id }); }
function upd(t, id, patch) { const r = S[t].find(x => x.id === id); if (!r) return null; return put(t, { ...r, ...patch }); }
const getW = id => S.watches.find(w => w.id === id);
const wname = w => (w.brand + ' ' + w.model).trim();

/* ── calculs ── */
const grp = w => (ST[w.status] || {}).g;
const isHeld = w => HELD_G.includes(grp(w));
const heldList = () => S.watches.filter(isHeld);
const repairsOf = id => S.repairs.filter(r => r.watch_id === id);
const acq = w => num(w.buy_price) + num(w.buy_fees) + num(w.buy_ship);
const costOf = w => acq(w) + sum(repairsOf(w.id), r => r.cost);
const asking = w => num(w.asking_price);
const potential = w => (asking(w) > 0 ? asking(w) - costOf(w) : 0);
const isSold = w => w.sale_price != null && w.sold_at;
const saleNet = w => num(w.sale_price) - num(w.sale_fees);
const profitOf = w => num(w.sale_price) - num(w.sale_fees) - num(w.sale_ship) - costOf(w);
const daysHeld = w => Math.max(0, diffDays(w.bought_at || today(), isSold(w) ? w.sold_at : today()));
const capital0 = () => num(S.settings.starting_capital);
const cashNow = () => r2(capital0() + sum(S.movements.filter(m => !m.pending), m => m.amount));
const pendingIn = () => r2(sum(S.movements.filter(m => m.pending && num(m.amount) > 0), m => m.amount));
const immo = () => r2(sum(heldList(), costOf));
const valeur = () => r2(sum(heldList(), w => (asking(w) > 0 ? asking(w) : costOf(w))));
const paidSales = () => S.watches.filter(w => isSold(w) && w.status === 'cloturee');
function perf() {
  const L = paidSales(), n = L.length;
  const ca = sum(L, w => w.sale_price), profit = sum(L, profitOf);
  return {
    n, ca, profit,
    marge: n ? L.reduce((t, w) => t + (num(w.sale_price) ? profitOf(w) / num(w.sale_price) * 100 : 0), 0) / n : 0,
    roi: n ? L.reduce((t, w) => t + (costOf(w) ? profitOf(w) / costOf(w) * 100 : 0), 0) / n : 0,
    det: n ? L.reduce((t, w) => t + daysHeld(w), 0) / n : 0,
  };
}
function monthProfit() { const m = today().slice(0, 7); return sum(paidSales().filter(w => (w.paid_at || w.sold_at || '').slice(0, 7) === m), profitOf); }
function byBrand() {
  const map = {};
  paidSales().forEach(w => { const b = (w.brand || '—').trim(); const o = map[b] || (map[b] = { brand: b, n: 0, profit: 0, cost: 0 }); o.n++; o.profit += profitOf(w); o.cost += costOf(w); });
  return Object.values(map).sort((a, b) => b.profit - a.profit);
}
function alerts() {
  const out = [], hs = heldList(), im = immo();
  hs.filter(w => w.status === 'en_vente').forEach(w => {
    const d = diffDays(w.listed_at || w.bought_at || today(), today());
    if (d >= 21) out.push({ t: `En vente depuis ${d} jours`, d: `${wname(w)} — aucun acheteur au prix actuel. Revoir le prix ?`, w: w.id });
  });
  S.watches.filter(w => isSold(w) && (w.status === 'vendue' || w.status === 'expediee_acheteur')).forEach(w => {
    out.push({ t: 'Encaissement en attente', d: `Vente ${w.sale_platform || ''} de ${eur(w.sale_price)} (${wname(w)}) : paiement toujours non encaissé.`.replace('Vente  de', 'Vente de'), w: w.id });
  });
  hs.filter(w => grp(w) === 'transit' && w.expected_at && w.expected_at < today()).forEach(w => {
    out.push({ t: 'Livraison en retard', d: `${wname(w)} était attendue le ${fdate(w.expected_at)}.`, w: w.id });
  });
  if (im > 0 && hs.length > 1) hs.forEach(w => { const p = costOf(w) / im * 100; if (p >= 40) out.push({ t: 'Stock concentré', d: `${wname(w)} représente ${Math.round(p)} % du capital immobilisé.`, w: w.id }); });
  return out;
}
const openTasks = () => S.tasks.filter(t => !t.done).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

/* ── actions métier ── */
function log(wid, label, amount, at, extra) { return put('events', { id: uid(), watch_id: wid || null, label, amount: amount == null ? null : r2(amount), at: at || today(), ...(extra || {}) }); }
function mv(wid, kind, label, amount, o) { o = o || {}; return put('movements', { id: uid(), watch_id: wid || null, kind, label, amount: r2(amount), date: o.date || today(), pending: !!o.pending }); }
function addTask(label, wid) { return put('tasks', { id: uid(), watch_id: wid || null, label, done: false }); }
function doneTasks(wid, re) { S.tasks.filter(t => t.watch_id === wid && !t.done && re.test(t.label)).forEach(t => upd('tasks', t.id, { done: true })); }
function toggleTask(id) { const t = S.tasks.find(x => x.id === id); if (t) upd('tasks', id, { done: !t.done }); changed(); }
function delTask(id) { del('tasks', id); changed(); }

function addWatch(f) {
  const w = {
    id: uid(), brand: f.brand.trim(), model: f.model.trim(), reference: f.reference || '', period: f.period || '', movement: f.movement || '',
    case_info: '', condition: '', accessories: '', source: f.source || '', bought_at: today(),
    expected_at: f.received ? null : daysFrom(5), status: f.received ? 'recue' : 'expediee_vendeur',
    asking_price: null, buy_price: num(f.price), buy_fees: num(f.fees), buy_ship: num(f.ship), notes: '', listings: [], thumb: f.thumb || null,
  };
  put('watches', w);
  const n = wname(w), paid = r2(w.buy_price + w.buy_fees);
  mv(w.id, 'purchase', `Achat ${n}${w.buy_fees > 0 ? ' (+ frais)' : ''}`, -paid);
  if (w.buy_ship > 0) mv(w.id, 'shipping', `Transport — ${n}`, -w.buy_ship);
  log(w.id, `Achetée — ${eur(paid)}${w.source ? ' · ' + w.source : ''}`, -(paid + w.buy_ship));
  addTask(f.received ? `Inspecter ${n}` : `Réceptionner ${n}${w.expected_at ? ' (' + fdate(w.expected_at) + ')' : ''}`, w.id);
  changed(); return w.id;
}
function syncAcquisition(id) {
  const w = getW(id); if (!w) return; const n = wname(w);
  const paid = r2(num(w.buy_price) + num(w.buy_fees));
  const p = S.movements.find(m => m.watch_id === id && m.kind === 'purchase');
  if (p) upd('movements', p.id, { amount: -paid, label: `Achat ${n}${num(w.buy_fees) > 0 ? ' (+ frais)' : ''}` }); else if (paid > 0) mv(id, 'purchase', `Achat ${n}${num(w.buy_fees) > 0 ? ' (+ frais)' : ''}`, -paid, { date: w.bought_at });
  const s = S.movements.find(m => m.watch_id === id && m.kind === 'shipping');
  if (s) { if (num(w.buy_ship) > 0) upd('movements', s.id, { amount: -num(w.buy_ship) }); else del('movements', s.id); } else if (num(w.buy_ship) > 0) mv(id, 'shipping', `Transport — ${n}`, -num(w.buy_ship), { date: w.bought_at });
}
const NUMF = ['asking_price', 'buy_price', 'buy_fees', 'buy_ship'];
function setField(id, f, v) {
  const w = getW(id); if (!w) return;
  const val = NUMF.includes(f) ? (String(v).trim() === '' ? null : num(v)) : (v === '' ? (f === 'expected_at' || f === 'bought_at' ? null : '') : v);
  upd('watches', id, { [f]: val });
  if (['buy_price', 'buy_fees', 'buy_ship', 'brand', 'model'].includes(f)) syncAcquisition(id);
  changed();
}
function changeStatus(id, k) {
  const w = getW(id); if (!w || w.status === k) return;
  const n = wname(w), patch = { status: k };
  if (k === 'en_vente' && !w.listed_at) patch.listed_at = today();
  if (k === 'recue') patch.expected_at = null;
  upd('watches', id, patch);
  const lab = (ST[k] || {}).l || k;
  if (k === 'expediee_acheteur') { log(id, 'Expédiée à l’acheteur'); doneTasks(id, /exp[ée]dier/i); }
  else log(id, lab);
  if (k === 'recue') { doneTasks(id, /r[ée]ceptionner/i); addTask(`Inspecter ${n}`, id); }
  if (k === 'prete') addTask(`Mettre ${n} en vente`, id);
  if (k === 'en_vente') doneTasks(id, /mettre .* en vente/i);
  if (['retournee', 'perdue'].includes(k)) onToast('Pense à ajouter le remboursement dans Finances (+ Mouvement).');
  changed();
}
function recordSale(id, f) {
  const w = getW(id); if (!w) return; const n = wname(w);
  const price = num(f.price), fees = num(f.fees), ship = num(f.ship);
  upd('watches', id, { sale_price: price, sale_platform: f.platform || '', sale_fees: fees, sale_ship: ship, sold_at: today(), status: f.paid ? 'cloturee' : 'vendue', paid_at: f.paid ? today() : null });
  const net = r2(price - fees);
  mv(id, 'sale', `Vente ${n}${f.platform ? ' · ' + f.platform : ''}`, net, { pending: !f.paid });
  if (ship > 0) mv(id, 'sale_ship', `Expédition — ${n}`, -ship);
  log(id, `Vendue — ${eur(price)}${f.platform ? ' · ' + f.platform : ''}`);
  doneTasks(id, /mettre .* en vente|revoir le prix/i);
  if (f.paid) log(id, `Paiement reçu — ${eur(net)}${f.platform ? ' · ' + f.platform : ''}`, net);
  else addTask(`Vérifier le paiement ${f.platform || ''} — ${w.brand}`.replace('paiement  —', 'paiement —'), id);
  addTask(`Expédier ${n}`, id);
  changed();
}
function confirmPayment(id) {
  const w = getW(id); if (!w || !isSold(w)) return;
  const m = S.movements.find(x => x.watch_id === id && x.kind === 'sale');
  if (m) upd('movements', m.id, { pending: false, date: today() });
  upd('watches', id, { status: 'cloturee', paid_at: today() });
  log(id, `Paiement reçu — ${eur(saleNet(w))}${w.sale_platform ? ' · ' + w.sale_platform : ''}`, saleNet(w));
  doneTasks(id, /paiement/i);
  changed();
}
function addRepair(id, label, cost) {
  const w = getW(id); if (!w || !label.trim()) return; cost = num(cost);
  const r = put('repairs', { id: uid(), watch_id: id, label: label.trim(), cost, done_at: today() });
  mv(id, 'repair', `${r.label} — ${wname(w)}`, -cost);
  log(id, `${r.label} — ${eur(cost)}`, -cost);
  changed();
}
function delRepair(rid) {
  const r = S.repairs.find(x => x.id === rid); if (!r) return;
  const m = S.movements.find(x => x.watch_id === r.watch_id && x.kind === 'repair' && num(x.amount) === -num(r.cost) && x.label.startsWith(r.label));
  if (m) del('movements', m.id);
  del('repairs', rid); changed();
}
function recalcAsking(w) { const ls = w.listings || []; return ls.length ? Math.min(...ls.map(l => num(l.price))) : w.asking_price; }
function addListing(id, platform, price) {
  const w = getW(id); if (!w || !num(price)) return;
  const ls = [...(w.listings || []), { id: uid(), platform: platform || 'Autre', price: num(price), date: today() }];
  const patch = { listings: ls }; patch.asking_price = Math.min(...ls.map(l => l.price));
  if (!w.listed_at) patch.listed_at = today();
  if (['atelier', 'vente'].includes(grp(w)) && w.status !== 'en_vente') { patch.status = 'en_vente'; doneTasks(id, /mettre .* en vente/i); }
  upd('watches', id, patch);
  log(id, `Mise en vente — ${platform || 'Autre'} ${eur(price)}`);
  changed();
}
function repriceListing(id, lid, delta) {
  const w = getW(id); if (!w) return;
  const ls = (w.listings || []).map(l => l.id === lid ? { ...l, price: Math.max(0, num(l.price) + delta) } : l);
  const l = ls.find(x => x.id === lid);
  upd('watches', id, { listings: ls, asking_price: Math.min(...ls.map(x => x.price)) });
  if (l) log(id, `Prix ${l.platform} : ${eur(l.price)}`);
  doneTasks(id, /revoir le prix/i);
  changed();
}
function delListing(id, lid) {
  const w = getW(id); if (!w) return;
  const ls = (w.listings || []).filter(l => l.id !== lid);
  upd('watches', id, { listings: ls, asking_price: ls.length ? Math.min(...ls.map(x => x.price)) : w.asking_price });
  changed();
}
function addMovement(label, amount, sign) {
  const a = Math.abs(num(amount)) * (sign < 0 ? -1 : 1);
  if (!label.trim() || !a) return false;
  mv(null, 'manual', label.trim(), a); log(null, label.trim(), a); changed(); return true;
}
function setCapital(v) { S.settings.starting_capital = num(v); enqueue('settings', 'up', { user_id: USER && USER.id, starting_capital: S.settings.starting_capital }); changed(); }
function deleteWatch(id) {
  ['repairs', 'movements', 'events', 'tasks'].forEach(t => S[t].filter(x => x.watch_id === id).forEach(x => { const i = S[t].indexOf(x); S[t].splice(i, 1); }));
  del('watches', id); changed();
}
function wipeAll() {
  if (!LOCAL && sb && USER) { TABLES.slice().reverse().forEach(t => S[t].forEach(r => enqueue(t, 'del', { id: r.id }))); }
  TABLES.forEach(t => S[t] = []); changed();
}
function exportJSON() { return JSON.stringify({ exported_at: new Date().toISOString(), ...S }, null, 2); }

/* ── photos ── */
const photoCache = {};
function loadImg(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; }); }
async function processImage(file, max, q) {
  const im = await loadImg(file), r = Math.min(1, max / Math.max(im.width, im.height));
  const c = document.createElement('canvas'); c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL('image/jpeg', q);
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', q));
  return { dataUrl, blob };
}
async function setPhoto(id, file) {
  const w = getW(id); if (!w) return;
  if (LOCAL || !sb || !USER) { const p = await processImage(file, 760, .72); upd('watches', id, { thumb: p.dataUrl }); changed(); return; }
  const th = await processImage(file, 380, .72);
  upd('watches', id, { thumb: th.dataUrl }); changed();
  try {
    const full = await processImage(file, 1280, .8);
    const path = `${USER.id}/${id}-${Date.now()}.jpg`;
    const { error } = await sb.storage.from('watch-photos').upload(path, full.blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const old = w.photo_path; photoCache[path] = full.dataUrl;
    upd('watches', id, { photo_path: path }); changed();
    if (old) sb.storage.from('watch-photos').remove([old]);
  } catch (e) { onToast('Photo enregistrée en miniature seulement (envoi impossible)'); }
}
async function fullPhoto(w) {
  if (!w.photo_path || LOCAL || !sb) return null;
  if (photoCache[w.photo_path]) return photoCache[w.photo_path];
  try { const { data } = await sb.storage.from('watch-photos').createSignedUrl(w.photo_path, 3600); if (data) photoCache[w.photo_path] = data.signedUrl; } catch (e) {}
  return photoCache[w.photo_path] || null;
}

/* ── données d'exemple (reprennent le prototype) ── */
function loadDemo() {
  wipeAll();
  S.settings.starting_capital = 3000; enqueue('settings', 'up', { user_id: USER && USER.id, starting_capital: 3000 });
  const W = (o) => put('watches', { id: uid(), reference: '', period: '', movement: '', case_info: '', condition: '', accessories: '', source: '', notes: '', listings: [], buy_fees: 0, buy_ship: 0, asking_price: null, ...o });
  const buy = (w, d) => {
    const n = wname(w), paid = r2(num(w.buy_price) + num(w.buy_fees));
    mv(w.id, 'purchase', `Achat ${n}${num(w.buy_fees) > 0 ? ' (+ frais)' : ''}`, -paid, { date: d });
    if (num(w.buy_ship) > 0) mv(w.id, 'shipping', `Transport — ${n}`, -num(w.buy_ship), { date: d });
    log(w.id, `Acheté — ${eur(paid)} · ${w.source}`, -(paid + num(w.buy_ship)), d);
  };
  const rep = (w, label, cost, d) => { put('repairs', { id: uid(), watch_id: w.id, label, cost, done_at: d }); mv(w.id, 'repair', `${label} — ${wname(w)}`, -cost, { date: d }); log(w.id, `${label} — ${eur(cost)}`, -cost, d); };
  const sold = (w, price, fees, platform, d, paid, pd_) => {
    const n = wname(w); mv(w.id, 'sale', `Vente ${n} · ${platform}`, price - fees, { date: paid ? pd_ : d, pending: !paid });
    log(w.id, `Vendue — ${eur(price)} · ${platform}`, null, d);
    if (paid) log(w.id, `Paiement reçu — ${eur(price - fees)} · ${platform}`, price - fees, pd_);
  };
  // anciennes ventes
  const omega = W({ brand: 'Omega', model: 'Seamaster', source: 'Chrono24', bought_at: daysAgo(70), buy_price: 520, status: 'cloturee', sale_price: 825, sale_fees: 85, sale_ship: 0, sold_at: daysAgo(24), paid_at: daysAgo(22), sale_platform: 'Chrono24' });
  buy(omega, daysAgo(70)); sold(omega, 825, 85, 'Chrono24', daysAgo(24), true, daysAgo(22));
  const cert = W({ brand: 'Certina', model: 'DS-2', source: 'Leboncoin', bought_at: daysAgo(44), buy_price: 285, buy_ship: 15, status: 'cloturee', sale_price: 420, sale_fees: 0, sale_ship: 0, sold_at: daysAgo(5), paid_at: daysAgo(5), sale_platform: 'Leboncoin' });
  buy(cert, daysAgo(44)); sold(cert, 420, 0, 'Leboncoin', daysAgo(5), true, daysAgo(5));
  const seiko5 = W({ brand: 'Seiko', model: '5 Automatic', source: 'Vinted', bought_at: daysAgo(22), buy_price: 78, buy_fees: 6, buy_ship: 6, status: 'cloturee', sale_price: 165, sale_fees: 0, sale_ship: 0, sold_at: daysAgo(3), paid_at: daysAgo(3), sale_platform: 'Vinted' });
  buy(seiko5, daysAgo(22)); sold(seiko5, 165, 0, 'Vinted', daysAgo(3), true, daysAgo(3));
  const tissot = W({ brand: 'Tissot', model: 'Seastar', source: 'Leboncoin', bought_at: daysAgo(30), buy_price: 195, buy_fees: 10, buy_ship: 5, status: 'vendue', sale_price: 390, sale_fees: 30, sale_ship: 0, sold_at: daysAgo(2), sale_platform: 'Vinted' });
  buy(tissot, daysAgo(30)); sold(tissot, 390, 30, 'Vinted', daysAgo(2), false);
  addTask('Vérifier le paiement Vinted — Tissot', tissot.id);
  // stock
  const long = W({ brand: 'Longines', model: 'Conquest', reference: '9006', period: 'c. 1972', movement: 'Automatique', case_info: 'Acier · 35 mm', condition: 'Très bon', accessories: 'Boîte', source: 'Catawiki', bought_at: daysAgo(34), buy_price: 420, buy_fees: 25, buy_ship: 15, status: 'en_vente', listed_at: daysAgo(22), asking_price: 740, listings: [{ id: uid(), platform: 'Chrono24', price: 790, date: daysAgo(22) }, { id: uid(), platform: 'Vinted', price: 740, date: daysAgo(21) }] });
  buy(long, daysAgo(34)); rep(long, 'Révision complète', 90, daysAgo(26)); addTask('Revoir le prix de la Longines', long.id);
  const cyma = W({ brand: 'Cyma', model: 'Automatic', source: 'Vinted', bought_at: daysAgo(18), buy_price: 180, buy_ship: 10, status: 'en_vente', listed_at: daysAgo(10), asking_price: 390, listings: [{ id: uid(), platform: 'Leboncoin', price: 390, date: daysAgo(10) }] });
  buy(cyma, daysAgo(18)); rep(cyma, 'Polissage boîtier', 30, daysAgo(12)); rep(cyma, 'Bracelet cuir', 20, daysAgo(11));
  const spk = W({ brand: 'Seiko', model: 'Premier Kinetic', source: 'eBay', bought_at: daysAgo(9), buy_price: 150, buy_fees: 8, buy_ship: 12, status: 'prete', asking_price: 320 });
  buy(spk, daysAgo(9)); rep(spk, 'Condensateur', 15, daysAgo(5)); addTask('Mettre la Seiko sur Chrono24', spk.id);
  const rico = W({ brand: 'Ricoh', model: 'Cosmotron', source: 'Leboncoin', bought_at: daysAgo(6), buy_price: 95, status: 'travaux', asking_price: 240 });
  buy(rico, daysAgo(6)); addTask('Commander une couronne — Ricoh Cosmotron', rico.id);
  const eter = W({ brand: 'Eterna', model: 'Eterna-Matic 1000', source: 'Leboncoin', bought_at: daysAgo(3), buy_price: 160, buy_ship: 10, status: 'expediee_vendeur', expected_at: daysFrom(3), asking_price: 340 });
  buy(eter, daysAgo(3)); log(eter.id, 'Expédiée — Mondial Relay', null, daysAgo(2)); addTask(`Réceptionner l’Eterna (${fdate(daysFrom(3))})`, eter.id);
  changed();
}
