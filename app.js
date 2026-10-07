'use strict';
/* ═══════════════════════════════════════════════════════════════
   WatchFlow — interface (5 écrans + fiche montre + feuilles)
   ═══════════════════════════════════════════════════════════════ */
const I = {
  grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></svg>',
  watch: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5.4"/><path d="M9.2 6.6l.5-3h4.6l.5 3M9.2 17.4l.5 3h4.6l.5-3M12 9.6v2.6l1.6 1"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M5 8h14M5 12h14M5 16h9"/></svg>',
  bars: '<svg viewBox="0 0 24 24"><path d="M6 19v-7M12 19V6M18 19v-10"/></svg>',
  img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4.5" width="16" height="15" rx="2.5"/><circle cx="9.2" cy="9.7" r="1.4"/><path d="M4.5 16.5l4.4-4.2 3.3 3 2.6-2.4 4.7 4.4"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
const FORM0 = () => ({ brand: '', model: '', reference: '', period: '', movement: '', source: 'Vinted', price: '', fees: '', ship: '', received: false });
const UI = { tab: 'home', stockF: 'all', sortBy: 'duree', wid: null, wtab: 'apercu', mode: 'ia', form: FORM0(), slots: [null, null, null, null], slotFiles: [null, null, null, null], ai: { state: 'idle', items: [], note: '' }, sheet: null, sale: null, keep: {}, lplat: 'Vinted', mvSign: -1, authMode: 'in', authMsg: '', ready: false };
const SLOT_NAMES = ['Cadran', 'Fond', 'Boîtier', 'Détails'];
const mem = {};
const $ = s => document.querySelector(s);

/* ── petits composants ── */
const chips = (arr, cur, act, key) => arr.map(v => `<button class="chip ${v === cur ? 'on' : ''}" data-act="${act}" data-v="${esc(v)}">${esc(v)}</button>`).join('');
const keep = k => esc(UI.keep[k] ?? '');
const initials = () => { const e = (USER && USER.email) || 'WF'; return e.slice(0, 2).toUpperCase(); };
const syncDot = () => (!LOCAL && Q.length ? '<i></i>' : '');
function photoOf(w) { return (w.photo_path && photoCache[w.photo_path]) || w.thumb || ''; }
function pillOf(w) { const s = ST[w.status] || {}; return `<span class="pill p-${s.g}">${esc(s.l || w.status)}</span>`; }
function toast(msg) {
  const old = $('.toast'); if (old) old.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#app').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ═════════ ACCUEIL ═════════ */
function viewHome() {
  const cash = cashNow(), pend = pendingIn(), im = immo(), val = valeur(), lat = r2(val - im), held = heldList();
  const cp = cash > 0 && cash + im > 0 ? Math.round(cash / (cash + im) * 100) : 0;
  const now = new Date(), P = perf(), mp = monthProfit(), tasks = openTasks(), al = alerts();
  const arriv = held.filter(w => grp(w) === 'transit').sort((a, b) => (a.expected_at || '9').localeCompare(b.expected_at || '9')).slice(0, 3);
  return `
  <div class="head"><div><div class="date">${DAYS_L[now.getDay()]} ${now.getDate()} ${MONTHS_L[now.getMonth()]}</div><h1>Tableau de bord</h1></div>
    <button class="avatar" data-act="settings">${initials()}${syncDot()}</button></div>
  <div class="hero">
    <div class="lab">Cash disponible</div>
    <div class="big">${eur(cash)}</div>
    <div class="pend">${pend > 0 ? `+ ${eur(pend)} en attente d’encaissement` : 'Aucun encaissement en attente'}</div>
    <div class="bar"><i class="c" style="width:${cp}%"></i><i class="s" style="width:${cash > 0 || im > 0 ? 100 - cp : 0}%"></i></div>
    <div class="split"><span>Cash ${cp} %</span><span>Stock ${im > 0 || cash > 0 ? 100 - cp : 0} %</span></div>
    <div class="net"><span>Patrimoine activité estimé</span><b>${eur(cash + val + pend)}</b></div>
  </div>
  ${S.settings.starting_capital == null ? `<div class="note">Indique ton <b>capital de départ</b> pour que le cash soit juste. <button data-act="settings">Régler →</button></div>` : ''}
  <div class="tiles">
    <div class="tile"><div class="t">Capital immobilisé</div><div class="v">${eur(im)}</div><div class="n">${held.length} montre${held.length > 1 ? 's' : ''} détenue${held.length > 1 ? 's' : ''}</div></div>
    <div class="tile"><div class="t">Valeur estimée</div><div class="v">${eur(val)}</div><div class="n">aux prix demandés</div></div>
    <div class="tile"><div class="t">Profit latent</div><div class="v ${lat >= 0 ? 'pos' : 'neg'}">${eur(lat, true)}</div><div class="n">${im > 0 ? pct(lat / im * 100, true) + ' sur le coût' : '—'}</div></div>
    <div class="tile"><div class="t">Réalisé · ${MONTHS_L[now.getMonth()]}</div><div class="v ${mp >= 0 ? 'pos' : 'neg'}">${eur(mp, true)}</div><div class="n">${eur(P.profit, true)} depuis le début</div></div>
  </div>
  ${arriv.length ? `<div class="eyebrow">Arrive bientôt</div>${arriv.map(w => {
    const late = w.expected_at && w.expected_at < today();
    return `<button class="card arrive" data-act="open" data-id="${w.id}" style="width:100%;text-align:left;margin-bottom:8px">
      <div class="thumb">${photoOf(w) ? `<img src="${photoOf(w)}" alt="">` : I.img}</div>
      <div class="m"><div class="nm">${esc(wname(w))}</div><div class="s">${esc(w.source || '—')} · achetée ${fdate(w.bought_at)}</div></div>
      <div class="r"><span class="mono">${eur(w.buy_price)}</span>${w.expected_at ? `<span class="tag ${late ? 'late' : ''}">prévue ${fdate(w.expected_at)}</span>` : ''}</div></button>`;
  }).join('')}` : ''}
  <div class="eyebrow">À faire aujourd’hui <b>${tasks.length ? tasks.length + ' restante' + (tasks.length > 1 ? 's' : '') : ''}</b></div>
  <div class="card list">${tasks.length ? tasks.slice(0, 4).map(taskRow).join('') : '<div class="empty">Rien à faire pour l’instant.</div>'}</div>
  ${al.length ? `<div class="eyebrow">Alertes</div>${al.map(a => `<div class="alert" ${a.w ? `data-act="open" data-id="${a.w}" style="cursor:pointer"` : ''}><b>${esc(a.t)}</b>${esc(a.d)}</div>`).join('')}` : ''}
  ${!S.watches.length ? `<div class="note">Aucune montre pour l’instant. Touche <b>+</b> pour enregistrer ton premier achat.</div>` : ''}`;
}
function taskRow(t) {
  const w = t.watch_id ? getW(t.watch_id) : null;
  return `<button class="trow ${t.done ? 'done' : ''}" data-act="task" data-id="${t.id}"><span class="circle">${t.done ? I.check : ''}</span><span class="tx"><div class="a">${esc(t.label)}</div>${w ? `<div class="b">${esc(wname(w))}</div>` : ''}</span></button>`;
}

/* ═════════ STOCK ═════════ */
function stockList() {
  const held = heldList(), F = UI.stockF;
  let L = F === 'all' ? held : F === 'vendues' ? S.watches.filter(w => ['vendue', 'fin'].includes(grp(w))) : held.filter(w => grp(w) === F);
  const key = w => UI.sortBy === 'duree' ? daysHeld(w) : UI.sortBy === 'profit' ? (isSold(w) ? profitOf(w) : potential(w)) : costOf(w);
  return L.slice().sort((a, b) => key(b) - key(a));
}
function viewStock() {
  const held = heldList(), g = k => held.filter(w => grp(w) === k).length;
  const vend = S.watches.filter(w => ['vendue', 'fin'].includes(grp(w))).length;
  const F = [['all', 'Tout', held.length], ['transit', 'En transit', g('transit')], ['atelier', 'Atelier', g('atelier')], ['vente', 'En vente', g('vente')], ['vendues', 'Vendues', vend]];
  const L = stockList();
  return `<h1>Stock</h1><p class="sub">${held.length} montre${held.length > 1 ? 's' : ''} détenue${held.length > 1 ? 's' : ''} · ${eur(immo())} immobilisés</p>
  <div class="chips">${F.map(([k, l, n]) => `<button class="chip ${UI.stockF === k ? 'on' : ''}" data-act="filter" data-v="${k}">${l}<sup>${n}</sup></button>`).join('')}</div>
  <div class="sortrow">Trier par <div class="seg">${[['duree', 'Durée'], ['profit', 'Profit'], ['cout', 'Coût']].map(([k, l]) => `<button class="${UI.sortBy === k ? 'on' : ''}" data-act="sort" data-v="${k}">${l}</button>`).join('')}</div></div>
  ${L.length ? L.map(wcard).join('') : `<div class="card empty">${S.watches.length ? 'Aucune montre dans ce filtre.' : 'Ton stock est vide. Touche + pour ajouter une montre.'}</div>`}`;
}
function wcard(w) {
  const sold = isSold(w), ph = photoOf(w), p = profitOf(w);
  const m3 = sold
    ? [['Coût réel', eur(costOf(w))], ['Vendu', eur(w.sale_price)], ['Profit', `<span class="${p >= 0 ? 'pos' : 'neg'}">${eur(p, true)}</span>`]]
    : [['Coût réel', eur(costOf(w))], [w.status === 'en_vente' ? 'Demandé' : 'Prix visé', asking(w) ? eur(asking(w)) : '—'], ['Potentiel', asking(w) ? `<span class="${potential(w) >= 0 ? 'pos' : 'neg'}">${eur(potential(w), true)}</span>` : '—']];
  return `<button class="wcard" data-act="open" data-id="${w.id}">
    <div class="ph ${ph ? 'has' : ''}">${ph ? `<img src="${ph}" alt="">` : `<div>${I.img}Photo principale<small>à ajouter dans la fiche</small></div>`}${pillOf(w)}<span class="dd">${daysHeld(w)} j</span></div>
    <div class="wb"><div class="brand">${esc(w.brand)}</div><div class="model">${esc(w.model)}</div>
    <div class="mets">${m3.map(([l, v]) => `<div><i>${l}</i><b>${v}</b></div>`).join('')}</div></div></button>`;
}

/* ═════════ FICHE MONTRE ═════════ */
function viewDetail(w) {
  const sold = isSold(w), g = grp(w), p = profitOf(w), ph = photoOf(w);
  const d = daysHeld(w);
  const stline = sold ? `Vendue le ${fdate(w.sold_at)}${w.sale_platform ? ' · ' + esc(w.sale_platform) : ''}` : (g === 'transit' ? `Achetée le ${fdate(w.bought_at)}${w.expected_at ? ' · prévue ' + fdate(w.expected_at) : ''}` : `En stock depuis ${d} jour${d > 1 ? 's' : ''} · achetée le ${fdate(w.bought_at)}`);
  let cta = '';
  if (sold && w.status !== 'cloturee') cta = '<button class="btn main" data-act="confirmPay">Confirmer le paiement reçu</button>';
  else if (g === 'transit') cta = '<button class="btn main" data-act="markRecv">Marquer comme reçue</button>';
  else if (['atelier', 'vente', 'garde', 'litige'].includes(g)) cta = '<button class="btn main" data-act="saleOpen">Enregistrer la vente</button>';
  const m3 = sold
    ? [['Coût réel', eur(costOf(w))], ['Vendu', eur(w.sale_price)], ['Profit', `<span class="${p >= 0 ? 'pos' : 'neg'}">${eur(p, true)}</span>`]]
    : [['Coût réel', eur(costOf(w))], [w.status === 'en_vente' ? 'Demandé' : 'Prix visé', asking(w) ? eur(asking(w)) : '—'], ['Potentiel', asking(w) ? `<span class="${potential(w) >= 0 ? 'pos' : 'neg'}">${eur(potential(w), true)}</span>` : '—']];
  const T = [['apercu', 'Aperçu'], ['couts', 'Coûts'], ['travaux', 'Travaux'], ['vente', 'Vente'], ['histo', 'Historique']];
  const body = { apercu: tabApercu, couts: tabCouts, travaux: tabTravaux, vente: tabVente, histo: tabHisto }[UI.wtab](w);
  return `<div class="detail" data-k="d${w.id}">
    <div style="position:relative"><button class="back" data-act="back">‹ Retour</button>
      <label class="dph ${ph ? 'has' : ''}">${ph ? `<img src="${ph}" alt="">` : `<div>${I.img}Ajouter la photo principale<small style="display:block;font-size:11.5px;color:#9a9684;margin-top:3px">touche pour choisir</small></div>`}<input type="file" accept="image/*" data-photo="${w.id}"></label></div>
    <div class="dbody">
      <div class="brand">${esc(w.brand)}${w.reference ? ' · ' + esc(w.reference) : ''}</div>
      <h1>${esc(w.model)}</h1>
      <div class="stline"><button class="spill p-${g}" data-act="statusSheet">${esc((ST[w.status] || {}).l || w.status)} ▾</button><span>${stline}</span></div>
      ${cta}
      <div class="metstrip">${m3.map(([l, v]) => `<div><i>${l}</i><b>${v}</b></div>`).join('')}</div>
      <div class="tabs">${T.map(([k, l]) => `<button class="${UI.wtab === k ? 'on' : ''}" data-act="wtab" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="tabbody">${body}</div>
    </div></div>`;
}
function tabApercu(w) {
  const F = (l, f, ph, type) => `<div><label class="lbl">${l}</label><input class="fld" ${type ? `type="${type}"` : ''} data-wf="${f}" data-id="${w.id}" value="${esc(w[f] || '')}" placeholder="${ph || '—'}"></div>`;
  return `<div class="facts">${F('Référence', 'reference')}${F('Période', 'period')}${F('Mouvement', 'movement')}${F('Boîtier', 'case_info')}${F('État', 'condition')}${F('Accessoires', 'accessories')}${F('Source', 'source')}${F('Acheté le', 'bought_at', '', 'date')}${grp(w) === 'transit' ? F('Livraison prévue', 'expected_at', '', 'date') : ''}</div>
  <label class="lbl" style="margin-top:22px">Notes</label><textarea class="in" data-wf="notes" data-id="${w.id}" placeholder="Défauts, remarques, idées de prix…">${esc(w.notes || '')}</textarea>
  <button class="danger" data-act="delWatch" data-id="${w.id}">Supprimer cette fiche</button>`;
}
function tabCouts(w) {
  const reps = repairsOf(w.id), sold = isSold(w);
  const A = (l, f) => `<div class="rw"><span>${l}</span><b><input data-wf="${f}" data-id="${w.id}" inputmode="decimal" value="${num(w[f]) ? num(w[f]) : ''}" placeholder="0"> €</b></div>`;
  let h = `<div class="card ledgerlist">${A(`Prix payé${w.source ? ' · ' + esc(w.source) : ''}`, 'buy_price')}${A('Frais acheteur', 'buy_fees')}${A('Transport', 'buy_ship')}
    <div class="rw sub"><span>Coût d’acquisition</span><b>${eur(acq(w))}</b></div>
    ${reps.map(r => `<div class="rw"><span>${esc(r.label)}</span><b>${eur(r.cost)}</b></div>`).join('')}
    <div class="rw tot"><span>Coût total de revient</span><b>${eur(costOf(w))}</b></div></div>`;
  if (sold) {
    const p = profitOf(w), roi = costOf(w) ? p / costOf(w) * 100 : 0;
    h += `<div class="eyebrow">Vente</div><div class="card ledgerlist">
      <div class="rw"><span>Prix de vente${w.sale_platform ? ' · ' + esc(w.sale_platform) : ''}</span><b>${eur(w.sale_price)}</b></div>
      <div class="rw"><span>Frais plateforme</span><b>${eur(-num(w.sale_fees))}</b></div>
      <div class="rw"><span>Expédition</span><b>${eur(-num(w.sale_ship))}</b></div>
      <div class="rw tot"><span>Profit net · ROI ${pct(roi, true)}</span><b class="${p >= 0 ? 'pos' : 'neg'}">${eur(p, true)}</b></div></div>`;
  }
  return h;
}
function tabTravaux(w) {
  const reps = repairsOf(w.id);
  return `${reps.length ? `<div class="card list">${reps.map(r => `<div class="rep"><span class="ck">${I.check}</span><div class="tx"><b>${esc(r.label)}</b><small>${fdate(r.done_at)}</small></div><span class="am">${eur(r.cost)}</span><button class="x" data-act="repDel" data-id="${r.id}" aria-label="Supprimer">×</button></div>`).join('')}</div>` : '<div class="card empty">Aucune intervention pour l’instant.</div>'}
  <div class="addrow"><input class="in" id="repL" data-keep="repL" placeholder="Intervention (ex. pile)" value="${keep('repL')}"><input class="in eur" id="repC" data-keep="repC" inputmode="decimal" placeholder="€" value="${keep('repC')}"><button class="sq" data-act="repAdd" aria-label="Ajouter">+</button></div>
  <p class="hint">Chaque intervention réalisée augmente le coût de revient et sort du cash.</p>`;
}
function tabVente(w) {
  if (isSold(w)) return `<div class="card ledgerlist"><div class="rw"><span>Vendue le</span><b>${fdate(w.sold_at)}</b></div><div class="rw"><span>Plateforme</span><b>${esc(w.sale_platform || '—')}</b></div><div class="rw"><span>Prix</span><b>${eur(w.sale_price)}</b></div><div class="rw"><span>Paiement</span><b>${w.status === 'cloturee' ? 'reçu ' + fdate(w.paid_at) : 'en attente'}</b></div></div>`;
  const ls = w.listings || [];
  return `${ls.length ? `<div class="card list">${ls.map(l => `<div class="lst"><div class="tx"><b>${esc(l.platform)}</b><small>Publiée le ${fdate(l.date)}</small></div><span class="am">${eur(l.price)}</span><button class="mini" data-act="lstMinus" data-lid="${l.id}">−10 €</button><button class="x" style="color:#b3af9f;font-size:18px" data-act="lstDel" data-lid="${l.id}" aria-label="Retirer">×</button></div>`).join('')}</div><p class="hint">Le prix demandé suit l’annonce la moins chère.</p>` : `<div class="card empty">Pas encore d’annonce.</div>
  <label class="lbl" style="margin-top:14px">Prix visé (avant mise en vente)</label><input class="in" data-wf="asking_price" data-id="${w.id}" inputmode="decimal" placeholder="€" value="${w.asking_price != null ? w.asking_price : ''}">`}
  <div class="eyebrow blue">Nouvelle annonce</div>
  <div class="src">${chips(SOURCES, UI.lplat, 'lplat')}</div>
  <div class="addrow" style="margin-top:0"><input class="in" id="lstP" data-keep="lstP" inputmode="decimal" placeholder="Prix en €" value="${keep('lstP')}"><button class="btn main" style="width:auto;padding:0 20px" data-act="lstAdd">Publier</button></div>`;
}
function tabHisto(w) {
  const ev = S.events.filter(e => e.watch_id === w.id).sort((a, b) => (b.at + (b.created_at || '')).localeCompare(a.at + (a.created_at || '')));
  return ev.length ? `<div>${ev.map(e => histRow(e, false)).join('')}</div>` : '<div class="card empty">Pas encore d’événement.</div>';
}
function histRow(e, showW) {
  const w = showW && e.watch_id ? getW(e.watch_id) : null, a = e.amount;
  const cls = a > 0 ? 'g' : a < 0 ? 'b' : '';
  return `<div class="hist"><span class="d">${fdate(e.at)}</span><span class="dot ${cls}"></span><div class="tx">${esc(e.label)}${w ? `<small>${esc(wname(w))}</small>` : ''}</div>${a != null ? `<span class="am ${a > 0 ? 'pos' : ''}" style="${a < 0 ? 'color:var(--brass)' : ''}">${eur(a, true)}</span>` : ''}</div>`;
}

/* ═════════ AJOUTER ═════════ */
function viewAdd() {
  const f = UI.form, ia = UI.mode === 'ia';
  const cost = num(f.price) + num(f.fees) + num(f.ship), ok = f.brand.trim() && f.model.trim();
  const a = UI.ai;
  const sug = a.state === 'done' ? `<div class="eyebrow blue" style="margin:20px 0 8px">Suggestions de l’IA <button class="link" data-act="aiAll" style="text-transform:none;letter-spacing:0">Tout accepter</button></div>
    <div class="card sug">${a.items.map((it, i) => { const c = Math.round(it.confidence || 0), col = c >= 85 ? 'var(--green)' : c >= 70 ? 'var(--brass)' : 'var(--rust)'; return `<div class="row"><div class="x"><div class="cf"><span class="k" style="font-family:var(--sans)">${esc(it.label)}</span><span style="color:${col}">confiance ${c} %</span></div><b>${esc(it.value)}</b><div class="mt"><i style="width:${c}%;background:${col}"></i></div></div><button class="ok ${it.ok ? 'on' : ''}" data-act="aiOk" data-i="${i}">${it.ok ? '✓ Validé' : 'Valider'}</button></div>`; }).join('')}</div>${a.note ? `<p class="hyp">${esc(a.note)}</p>` : ''}` : '';
  return `<h1>Nouvelle montre</h1><p class="sub">Saisie rapide — les détails pourront être complétés plus tard.</p>
  <div class="modes"><button class="mode ${ia ? 'on' : ''}" data-act="mode" data-v="ia"><b>Analyser avec l’IA</b><span>Photos → fiche pré-remplie à valider</span></button>
  <button class="mode ${!ia ? 'on' : ''}" data-act="mode" data-v="manual"><b>Saisie manuelle</b><span>Marque, modèle, prix — c’est tout</span></button></div>
  ${ia ? `<div class="slots">${SLOT_NAMES.map((n, i) => `<label class="slot">${UI.slots[i] ? `<img src="${UI.slots[i]}" alt=""><em>${n}</em>` : `<div>${I.img}${n}<small>touche pour ajouter</small></div>`}<input type="file" accept="image/*" data-slot="${i}"></label>`).join('')}</div>
  <button class="btn main" style="margin-top:12px" data-act="aiGo" ${a.state === 'loading' ? 'disabled' : ''}>${a.state === 'loading' ? 'Analyse en cours…' : 'Analyser la montre avec l’IA'}</button>${sug}` : ''}
  <div class="eyebrow blue">Identification</div>
  <div class="grid2"><input class="in" data-form="brand" placeholder="Marque" value="${esc(f.brand)}" autocapitalize="words"><input class="in" data-form="model" placeholder="Modèle" value="${esc(f.model)}" autocapitalize="words"></div>
  <div class="grid2" style="margin-top:10px"><input class="in" data-form="reference" placeholder="Référence" value="${esc(f.reference)}"><input class="in" data-form="period" placeholder="Année / période" value="${esc(f.period)}"></div>
  <div class="eyebrow" style="margin-top:22px">Achat</div>
  <div class="src">${chips(SOURCES, f.source, 'src')}</div>
  <div class="grid3"><div><label class="lbl">Prix payé €</label><input class="in" data-form="price" inputmode="decimal" placeholder="0" value="${esc(f.price)}"></div><div><label class="lbl">Frais €</label><input class="in" data-form="fees" inputmode="decimal" placeholder="0" value="${esc(f.fees)}"></div><div><label class="lbl">Port €</label><input class="in" data-form="ship" inputmode="decimal" placeholder="0" value="${esc(f.ship)}"></div></div>
  <div class="toggle"><button class="${!f.received ? 'on' : ''}" data-act="recv" data-v="0">En transit</button><button class="${f.received ? 'on' : ''}" data-act="recv" data-v="1">Déjà reçue</button></div>
  <div class="dark"><div class="r1"><span>Coût d’acquisition réel</span><span class="serif" id="lc">${eur(cost)}</span></div>
  <div class="r2"><span>Cash après achat</span><b id="lcash">${eur(cashNow() - cost)}</b></div>
  <button class="btn" id="createBtn" data-act="create" ${ok ? '' : 'disabled'}>Créer la fiche</button></div>`;
}
function liveAdd() {
  const f = UI.form, cost = num(f.price) + num(f.fees) + num(f.ship);
  const a = $('#lc'), b = $('#lcash'), c = $('#createBtn');
  if (a) a.textContent = eur(cost); if (b) b.textContent = eur(cashNow() - cost);
  if (c) c.disabled = !(f.brand.trim() && f.model.trim());
}

/* ═════════ ACTIVITÉ ═════════ */
function viewActivity() {
  const tasks = openTasks();
  const ev = S.events.slice().sort((a, b) => (b.at + (b.created_at || '')).localeCompare(a.at + (a.created_at || ''))).slice(0, 80);
  return `<h1>Activité</h1><p class="sub">Actions, travaux et mouvements récents</p>
  <div class="eyebrow">Actions</div>
  <div class="card list">${tasks.length ? tasks.map(taskRow).join('') : '<div class="empty">Aucune action en attente.</div>'}</div>
  <div class="addrow"><input class="in" id="tskL" data-keep="tskL" placeholder="Nouvelle action…" value="${keep('tskL')}"><button class="sq" data-act="tskAdd" aria-label="Ajouter">+</button></div>
  <div class="eyebrow">Journal</div>
  ${ev.length ? `<div>${ev.map(e => histRow(e, true)).join('')}</div>` : '<div class="card empty">Le journal se remplit au fil de tes actions.</div>'}`;
}

/* ═════════ FINANCES ═════════ */
function viewFinances() {
  const cap = capital0(), ins = r2(sum(S.movements.filter(m => !m.pending && num(m.amount) > 0), m => m.amount)), outs = r2(sum(S.movements.filter(m => !m.pending && num(m.amount) < 0), m => m.amount));
  const P = perf(), BR = byBrand(), maxp = Math.max(1, ...BR.map(b => Math.abs(b.profit)));
  const chrono = S.movements.slice().sort((a, b) => (a.date + (a.created_at || '')).localeCompare(b.date + (b.created_at || '')));
  let bal = cap; const balOf = {};
  chrono.forEach(m => { if (!m.pending) bal = r2(bal + num(m.amount)); balOf[m.id] = bal; });
  const rows = chrono.slice().reverse();
  return `<h1>Finances</h1><p class="sub">Le cash change de forme : Cash → Stock → Cash + bénéfice</p>
  <div class="card ctab"><div class="rw"><span>Capital initial</span><b>${eur(cap)}</b></div>
    <div class="rw"><span>Entrées (ventes encaissées)</span><b class="pos">${eur(ins, true)}</b></div>
    <div class="rw"><span>Sorties (achats, frais, travaux)</span><b class="neg">${eur(outs)}</b></div>
    <div class="rw last"><b style="font-family:var(--sans)">Cash actuel</b><span class="serif">${eur(cashNow())}</span></div></div>
  <div class="eyebrow">Performance réalisée</div>
  <div class="card perf"><div><i>Chiffre d’affaires</i><b>${eur(P.ca)}</b></div><div><i>Bénéfice net</i><b class="${P.profit >= 0 ? 'pos' : 'neg'}">${eur(P.profit, true)}</b></div><div><i>Ventes</i><b>${P.n}</b></div>
    <div><i>Marge moy.</i><b>${P.n ? pct(P.marge, true) : '—'}</b></div><div><i>ROI moyen</i><b>${P.n ? pct(P.roi, true) : '—'}</b></div><div><i>Détention moy.</i><b>${P.n ? Math.round(P.det) + ' j' : '—'}</b></div></div>
  ${BR.length ? `<div class="eyebrow">Par marque</div><div class="card" style="padding-bottom:10px">${BR.map(b => `<div class="brandrow"><div class="t"><span><span class="serif">${esc(b.brand)}</span><small>· ${b.n} vente${b.n > 1 ? 's' : ''}</small></span><span><b class="${b.profit >= 0 ? 'pos' : 'neg'}">${eur(b.profit, true)}</b> ROI ${pct(b.cost ? b.profit / b.cost * 100 : 0, true)}</span></div><div class="tk"><i style="width:${Math.max(6, Math.abs(b.profit) / maxp * 100)}%"></i></div></div>`).join('')}</div>` : ''}
  <div class="eyebrow">Ledger <button class="addmv" data-act="mvOpen">+ Mouvement</button></div>
  ${rows.length ? `<div class="card list">${rows.map(m => `<div class="lrow"><div><div class="a">${esc(m.label)}</div><div class="b">${fdate(m.date)}${m.pending ? '' : ' · solde ' + eur(balOf[m.id])}</div></div>${m.pending ? `<div class="am pending">${eur(m.amount, true)} · en attente</div>` : `<div class="am ${num(m.amount) > 0 ? 'pos' : ''}">${eur(m.amount, true)}</div>`}</div>`).join('')}</div>` : '<div class="card empty">Aucun mouvement d’argent.</div>'}`;
}

/* ═════════ FEUILLES ═════════ */
function sheetHTML() {
  const s = UI.sheet; if (!s) return '';
  let h = '';
  if (s === 'status') {
    const w = getW(UI.wid); if (!w) return '';
    const row = x => `<button class="opt ${x.k === w.status ? 'on' : ''}" data-act="setStatus" data-k="${x.k}"><span>${esc(x.l)}</span>${x.k === w.status ? '<span>✓</span>' : ''}</button>`;
    h = `<h2>Statut</h2><div class="gap"></div>${STATUSES.map(row).join('')}<div class="eyebrow" style="margin:18px 0 4px">Cas particuliers</div>${SPECIAL.map(row).join('')}`;
  } else if (s === 'sale') {
    const w = getW(UI.wid), v = UI.sale; if (!w) return '';
    h = `<h2>Enregistrer la vente</h2><p class="sub" style="margin-bottom:14px">${esc(wname(w))}</p>
      <label class="lbl">Prix de vente €</label><input class="in" data-sale="price" inputmode="decimal" placeholder="0" value="${esc(v.price)}">
      <div class="eyebrow blue" style="margin:18px 0 8px">Plateforme</div><div class="src" style="margin-bottom:6px">${chips(SOURCES, v.platform, 'salePlat')}</div>
      <div class="grid2" style="margin-top:8px"><div><label class="lbl">Frais plateforme €</label><input class="in" data-sale="fees" inputmode="decimal" placeholder="0" value="${esc(v.fees)}"></div><div><label class="lbl">Frais d’envoi €</label><input class="in" data-sale="ship" inputmode="decimal" placeholder="0" value="${esc(v.ship)}"></div></div>
      <div class="sumdark"><div class="l"><span>Coût de revient</span><b>${eur(costOf(w))}</b></div><div class="l"><span>Encaissement net</span><b id="sNet">—</b></div><div class="l big"><span>Profit · ROI</span><b id="sProfit">—</b></div></div>
      <label class="chk"><input type="checkbox" data-salepaid ${v.paid ? 'checked' : ''}> Paiement déjà reçu</label>
      <button class="btn main" data-act="saleGo">Valider la vente</button>`;
  } else if (s === 'movement') {
    h = `<h2>Mouvement d’argent</h2><p class="sub" style="margin-bottom:14px">Pour tout ce qui ne vient pas d’une fiche montre (outillage, remboursement…).</p>
      <div class="toggle" style="margin-top:0"><button class="${UI.mvSign < 0 ? 'on' : ''}" data-act="mvSign" data-v="-1">Sortie</button><button class="${UI.mvSign > 0 ? 'on' : ''}" data-act="mvSign" data-v="1">Entrée</button></div>
      <input class="in" id="mvL" data-keep="mvL" placeholder="Libellé" value="${keep('mvL')}"><div style="height:10px"></div><input class="in" id="mvA" data-keep="mvA" inputmode="decimal" placeholder="Montant €" value="${keep('mvA')}">
      <div class="gap"></div><button class="btn main" data-act="mvGo">Ajouter</button>`;
  } else if (s === 'settings') {
    const nq = Q.length;
    h = `<h2>Réglages</h2><div class="gap"></div>
      <div class="kv"><span>Compte</span><b>${LOCAL ? 'Mode local (cet appareil)' : esc(USER ? USER.email : '')}</b></div>
      <div class="kv"><span>Sauvegarde</span><b>${LOCAL ? 'non synchronisée' : (nq ? nq + ' modif. en attente' : 'à jour ✓')}</b></div>
      <label class="lbl" style="margin-top:16px">Capital de départ €</label>
      <div class="addrow" style="margin-top:0"><input class="in" id="capIn" inputmode="decimal" placeholder="0" value="${S.settings.starting_capital == null ? '' : S.settings.starting_capital}"><button class="btn main" style="width:auto;padding:0 20px" data-act="capSave">Enregistrer</button></div>
      <p class="hint">Somme dont tu disposais avant ta première opération. Le cash actuel = capital + entrées − sorties.</p>
      <div class="gap"></div><button class="btn ghost" data-act="export">Exporter mes données (JSON)</button>
      <div style="height:8px"></div><button class="btn ghost" data-act="demo">Charger des données d’exemple</button>
      <div style="height:8px"></div><button class="btn ghost" data-act="wipe" style="color:var(--rust)">Tout effacer</button>
      ${LOCAL ? `<p class="hint">Supabase n’est pas encore branché : renseigne <b>config.js</b> pour sauvegarder dans le cloud (voir README).</p>` : `<div style="height:8px"></div><button class="btn ghost" data-act="logout">Se déconnecter</button>`}`;
  }
  return `<div class="backdrop" data-act="closeSheet"></div><div class="sheet"><div class="grab"></div>${h}</div>`;
}
function liveSale() {
  const w = getW(UI.wid), v = UI.sale; if (!w || !v) return;
  const net = num(v.price) - num(v.fees), p = net - num(v.ship) - costOf(w), roi = costOf(w) ? p / costOf(w) * 100 : 0;
  const a = $('#sNet'), b = $('#sProfit');
  if (a) a.textContent = eur(net);
  if (b) { b.textContent = `${eur(p, true)} · ${pct(roi, true)}`; b.style.color = p >= 0 ? '#9ED8B0' : '#F0A68A'; }
}

/* ═════════ AUTH ═════════ */
function viewAuth() {
  const up = UI.authMode === 'up';
  return `<div class="auth"><h1>WatchFlow</h1><p class="sub" style="font-size:15px">Ton ledger d’achat-revente de montres : stock, cash et profit, sauvegardés.</p>
  <form id="authForm"><input class="in" id="aEmail" type="email" autocomplete="email" placeholder="Email" required><input class="in" id="aPass" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" placeholder="Mot de passe${up ? ' (8 caractères min.)' : ''}" required minlength="6">
  <button class="btn main" type="submit" style="margin-top:6px">${up ? 'Créer le compte' : 'Se connecter'}</button></form>
  <div class="msg" id="aMsg" style="color:var(--rust)">${esc(UI.authMsg)}</div>
  <div class="sw">${up ? 'Déjà un compte ?' : 'Première fois ?'} <button data-act="authSw">${up ? 'Se connecter' : 'Créer un compte'}</button></div></div>`;
}
async function authSubmit(e) {
  e.preventDefault();
  const email = $('#aEmail').value.trim(), password = $('#aPass').value, msg = $('#aMsg'), btn = e.target.querySelector('button');
  msg.style.color = 'var(--rust)'; msg.textContent = ''; btn.disabled = true;
  try {
    const r = UI.authMode === 'up' ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
    if (r.error) throw r.error;
    if (!r.data.session) { msg.style.color = 'var(--green)'; msg.textContent = 'Compte créé. Vérifie ta boîte mail pour confirmer, puis connecte-toi.'; UI.authMode = 'in'; btn.disabled = false; return; }
    startSession(r.data.session);
  } catch (err) { msg.textContent = /invalid login/i.test(err.message) ? 'Email ou mot de passe incorrect.' : err.message; btn.disabled = false; }
}
function startSession(session) {
  if (USER && USER.id === session.user.id) return;
  USER = { id: session.user.id, email: session.user.email };
  loadCache(); render(); pull();
}

/* ═════════ RENDER ═════════ */
function render() {
  const app = $('#app'); if (!app) return;
  const v = $('#view'), d = $('.detail');
  if (v) mem[v.dataset.k] = v.scrollTop; if (d) mem[d.dataset.k] = d.scrollTop;
  if (!UI.ready) { app.innerHTML = '<div class="loading">WatchFlow</div>'; return; }
  if (!LOCAL && !USER) { app.innerHTML = viewAuth(); const f = $('#authForm'); if (f) f.addEventListener('submit', authSubmit); return; }
  const w = UI.wid ? getW(UI.wid) : null; if (UI.wid && !w) UI.wid = null;
  const T = [['home', 'Accueil', I.grid], ['stock', 'Stock', I.watch], ['activity', 'Activité', I.list], ['fin', 'Finances', I.bars]];
  const tb = t => `<button class="tb ${UI.tab === t[0] ? 'on' : ''}" data-act="tab" data-t="${t[0]}">${t[2]}<span>${t[1]}</span></button>`;
  const body = { home: viewHome, stock: viewStock, add: viewAdd, activity: viewActivity, fin: viewFinances }[UI.tab]();
  app.innerHTML = `<div class="view" id="view" data-k="${UI.tab}">${body}</div>
    <nav class="tabbar">${tb(T[0])}${tb(T[1])}<button class="fab ${UI.tab === 'add' ? 'on' : ''}" data-act="tab" data-t="add" aria-label="Ajouter">${I.plus}</button>${tb(T[2])}${tb(T[3])}</nav>
    ${w ? viewDetail(w) : ''}${sheetHTML()}`;
  const nv = $('#view'); if (nv) nv.scrollTop = mem[nv.dataset.k] || 0;
  const nd = $('.detail'); if (nd) nd.scrollTop = mem[nd.dataset.k] || 0;
  if (UI.sheet === 'sale') liveSale();
}

/* ═════════ ACTIONS (clics) ═════════ */
const val = id => { const e = document.getElementById(id); return e ? e.value : ''; };
const ACT = {
  tab: d => { UI.tab = d.t; UI.wid = null; UI.sheet = null; render(); },
  open: d => { UI.wid = d.id; UI.wtab = 'apercu'; UI.sheet = null; render(); const w = getW(d.id); if (w) fullPhoto(w).then(u => { if (u && UI.wid === d.id) { const im = $('.dph img'); if (im) im.src = u; else render(); } }); },
  back: () => { UI.wid = null; UI.sheet = null; render(); },
  wtab: d => { UI.wtab = d.v; render(); },
  filter: d => { UI.stockF = d.v; render(); },
  sort: d => { UI.sortBy = d.v; render(); },
  mode: d => { UI.mode = d.v; render(); },
  src: d => { UI.form.source = d.v; render(); },
  recv: d => { UI.form.received = d.v === '1'; render(); },
  create: () => {
    const f = UI.form; if (!(f.brand.trim() && f.model.trim())) return;
    const file = UI.slotFiles.find(Boolean);
    const id = addWatch(f);
    if (file) setPhoto(id, file);
    UI.form = FORM0(); UI.slots = [null, null, null, null]; UI.slotFiles = [null, null, null, null]; UI.ai = { state: 'idle', items: [], note: '' };
    UI.tab = 'stock'; UI.stockF = 'all'; UI.wid = id; UI.wtab = 'apercu'; render(); toast('Fiche créée');
  },
  statusSheet: () => { UI.sheet = 'status'; render(); },
  setStatus: d => {
    const id = UI.wid, w = getW(id); if (!w) return;
    if (d.k === 'vendue' || (d.k === 'cloturee' && !isSold(w))) { openSale(d.k === 'cloturee'); return; }
    if (d.k === 'cloturee') { UI.sheet = null; confirmPayment(id); return; }
    UI.sheet = null; changeStatus(id, d.k);
  },
  markRecv: () => changeStatus(UI.wid, 'recue'),
  saleOpen: () => openSale(false),
  salePlat: d => { UI.sale.platform = d.v; render(); },
  saleGo: () => {
    const v = UI.sale; if (!num(v.price)) { toast('Indique le prix de vente'); return; }
    UI.sheet = null; recordSale(UI.wid, v); toast(v.paid ? 'Vente enregistrée et encaissée' : 'Vente enregistrée');
  },
  confirmPay: () => { confirmPayment(UI.wid); toast('Paiement encaissé'); },
  task: d => toggleTask(d.id),
  tskAdd: () => { const t = val('tskL').trim(); if (!t) return; addTask(t, null); UI.keep.tskL = ''; changed(); },
  repAdd: () => { const l = val('repL'), c = val('repC'); if (!l.trim()) { toast('Nomme l’intervention'); return; } addRepair(UI.wid, l, c); UI.keep.repL = ''; UI.keep.repC = ''; changed(); },
  repDel: d => { if (confirm('Supprimer cette intervention ? Le mouvement d’argent associé sera retiré.')) delRepair(d.id); },
  lplat: d => { UI.lplat = d.v; render(); },
  lstAdd: () => { const p = val('lstP'); if (!num(p)) { toast('Indique le prix'); return; } addListing(UI.wid, UI.lplat, p); UI.keep.lstP = ''; changed(); },
  lstMinus: d => repriceListing(UI.wid, d.lid, -10),
  lstDel: d => delListing(UI.wid, d.lid),
  delWatch: d => { if (confirm('Supprimer définitivement cette fiche, ses travaux et ses mouvements d’argent ?')) { UI.wid = null; deleteWatch(d.id); } },
  settings: () => { UI.sheet = 'settings'; render(); },
  capSave: () => { setCapital(val('capIn')); toast('Capital enregistré'); },
  mvOpen: () => { UI.sheet = 'movement'; render(); },
  mvSign: d => { UI.mvSign = Number(d.v); render(); },
  mvGo: () => { if (addMovement(val('mvL'), val('mvA'), UI.mvSign)) { UI.keep.mvL = ''; UI.keep.mvA = ''; UI.sheet = null; changed(); toast('Mouvement ajouté'); } else toast('Libellé et montant requis'); },
  export: () => {
    const b = new Blob([exportJSON()], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = `watchflow-${today()}.json`; document.body.appendChild(a); a.click(); a.remove();
  },
  demo: () => { if (confirm('Remplacer tes données actuelles par les données d’exemple ?')) { loadDemo(); UI.sheet = null; UI.tab = 'home'; render(); toast('Données d’exemple chargées'); } },
  wipe: () => { if (confirm('Effacer TOUTES tes données ? Action définitive.') && confirm('Vraiment tout effacer ?')) { wipeAll(); S.settings.starting_capital = null; UI.sheet = null; UI.wid = null; render(); } },
  logout: async () => { await sb.auth.signOut(); },
  closeSheet: () => { UI.sheet = null; render(); },
  authSw: () => { UI.authMode = UI.authMode === 'up' ? 'in' : 'up'; UI.authMsg = ''; render(); },
  aiGo: async () => {
    if (!CFG.AI_ENDPOINT) { toast('Analyse IA non activée — voir README (étape 7)'); return; }
    const imgs = UI.slots.filter(Boolean); if (!imgs.length) { toast('Ajoute au moins une photo'); return; }
    UI.ai = { state: 'loading', items: [], note: '' }; render();
    try {
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch(CFG.AI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token, apikey: CFG.SUPABASE_ANON_KEY }, body: JSON.stringify({ images: imgs }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
      const L = { brand: 'Marque', model: 'Modèle probable', reference: 'Référence probable', period: 'Période', movement: 'Mouvement' };
      UI.ai = { state: 'done', items: (j.fields || []).filter(f => f.value).map(f => ({ key: f.key, label: L[f.key] || f.key, value: f.value, confidence: f.confidence, ok: false })), note: j.note || '' };
    } catch (e) { UI.ai = { state: 'idle', items: [], note: '' }; toast('Analyse impossible : ' + e.message); }
    render();
  },
  aiOk: d => { const it = UI.ai.items[Number(d.i)]; if (!it) return; it.ok = true; UI.form[it.key] = it.value; render(); },
  aiAll: () => { UI.ai.items.forEach(it => { it.ok = true; UI.form[it.key] = it.value; }); render(); },
};
function openSale(paid) {
  const w = getW(UI.wid); if (!w) return;
  const ls = w.listings || [];
  UI.sale = { price: asking(w) ? String(asking(w)) : '', platform: (ls[0] && ls[0].platform) || 'Vinted', fees: '', ship: '', paid: !!paid };
  UI.sheet = 'sale'; render();
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const f = ACT[el.dataset.act]; if (f) f(el.dataset, el, e);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.form) { UI.form[t.dataset.form] = t.value; liveAdd(); }
  else if (t.dataset.sale) { UI.sale[t.dataset.sale] = t.value; liveSale(); }
  else if (t.dataset.keep) UI.keep[t.dataset.keep] = t.value;
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.wf) setField(t.dataset.id, t.dataset.wf, t.value);
  else if (t.dataset.salepaid !== undefined) UI.sale.paid = t.checked;
  else if (t.dataset.photo && t.files[0]) { toast('Enregistrement de la photo…'); try { await setPhoto(t.dataset.photo, t.files[0]); } catch (er) { toast('Photo illisible'); } }
  else if (t.dataset.slot !== undefined && t.files[0]) {
    const i = Number(t.dataset.slot);
    try { const p = await processImage(t.files[0], 900, .72); UI.slots[i] = p.dataUrl; UI.slotFiles[i] = t.files[0]; render(); } catch (er) { toast('Photo illisible'); }
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.dataset) return;
  const k = e.target.dataset.keep;
  if (k === 'repL' || k === 'repC') ACT.repAdd(); else if (k === 'lstP') ACT.lstAdd(); else if (k === 'tskL') ACT.tskAdd(); else if (k === 'mvL' || k === 'mvA') ACT.mvGo();
});

/* ═════════ DÉMARRAGE ═════════ */
let lastPull = 0;
async function boot() {
  onChange = render; onToast = toast;
  if (LOCAL) { loadCache(); UI.ready = true; render(); return; }
  if (!window.supabase) { UI.ready = true; $('#app').innerHTML = '<div class="auth"><h1>WatchFlow</h1><p class="sub">Impossible de charger la bibliothèque Supabase (connexion ?). Recharge la page.</p></div>'; return; }
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  const { data } = await sb.auth.getSession();
  UI.ready = true;
  if (data.session) { USER = { id: data.session.user.id, email: data.session.user.email }; loadCache(); render(); lastPull = Date.now(); pull(); } else render();
  sb.auth.onAuthStateChange((ev, s) => {
    if (ev === 'SIGNED_OUT') { try { if (USER) { localStorage.removeItem('wf:' + USER.id + ':data'); localStorage.removeItem('wf:' + USER.id + ':q'); } } catch (e) {} USER = null; resetState(); UI.wid = null; UI.sheet = null; UI.tab = 'home'; render(); }
    else if (s && s.user) startSession(s);
  });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (USER && Date.now() - lastPull > 20000) { lastPull = Date.now(); pull(); } else if (UI.ready && !UI.sheet && !document.activeElement.matches('input,textarea')) render();
});
window.addEventListener('online', () => { flush().then(pull); });
boot();
