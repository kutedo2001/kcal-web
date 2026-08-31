/* ============================================================
   Balanç — app.js
   ============================================================ */
(function () {
'use strict';
const { FOODS, FOOD_BY_ID, COOK_BY_CLASS, cookOptions, computeEntryMacros } = window.NUTRI_DB;

const KEY = 'balanc.v1';
const MEALS = ['Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena', 'Otros'];
const STEP_KCAL_PER_KG = 0.00032;   // kcal netas por paso y kg de peso
const KCAL_PER_KG_FAT = 7700;

const WORKOUTS = {
  pesas:      { n: 'Pesas / hipertrofia',      met: 5.0 },
  pesas_int:  { n: 'Pesas intenso',            met: 6.0 },
  bandas:     { n: 'Bandas en casa',           met: 4.0 },
  caminar:    { n: 'Caminar (extra)',          met: 3.5 },
  correr:     { n: 'Correr',                   met: 9.8 },
  bici:       { n: 'Bicicleta',                met: 7.5 },
  eliptica:   { n: 'Elíptica / cinta',         met: 5.5 },
  natacion:   { n: 'Natación',                 met: 7.0 },
  hiit:       { n: 'HIIT / circuito',          met: 8.0 },
  deporte:    { n: 'Fútbol, pádel, baloncesto',met: 7.0 },
  moto:       { n: 'Moto (ruta)',              met: 3.0 },
  otro:       { n: 'Otro',                     met: 5.0 }
};

/* ================= Utilidades ================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const r0 = n => Math.round(n || 0);
const r1 = n => Math.round((n || 0) * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

function iso(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }
function todayISO() { return iso(new Date()); }
function mondayOf(s) { const d = parseISO(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return iso(d); }
function niceDate(s) {
  const d = parseISO(s), t = todayISO();
  if (s === t) return 'Hoy';
  if (s === addDays(t, -1)) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
}

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ================= Estado ================= */
function blankProfile(name) {
  return {
    id: uid(), name: name || 'Yo',
    sex: 'h', age: 30, height: 170, weight: 70, bf: null,
    goal: 'mantener', rate: 50,
    protPerKg: 1.8, fatPerKg: 0.9,
    mode: 'dyn', baseMult: 1.15, adapt: true, adaptFactor: 1,
    carry: true, carryCap: 400, carryReset: 'week',
    days: {}, recipes: [], customs: [], recent: {}
  };
}

let DB, P, viewDate = todayISO(), currentView = 'Today';

function load() {
  try { DB = JSON.parse(localStorage.getItem(KEY)); } catch (e) { DB = null; }
  if (!DB || !DB.profiles) {
    const p = blankProfile('Yo');
    DB = { v: 1, active: p.id, profiles: { [p.id]: p } };
  }
  if (!DB.profiles[DB.active]) DB.active = Object.keys(DB.profiles)[0];
  P = DB.profiles[DB.active];
  // migraciones suaves
  P.recent ||= {}; P.recipes ||= []; P.customs ||= []; P.days ||= {};
}
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => localStorage.setItem(KEY, JSON.stringify(DB)), 120); }
function saveNow() { localStorage.setItem(KEY, JSON.stringify(DB)); }

function day(d = viewDate) {
  P.days[d] ||= { meals: [], steps: 0, workouts: [], weight: null };
  return P.days[d];
}
function dayRaw(d) { return P.days[d]; }

/* ================= Cálculos ================= */
function bmr(p = P, weight) {
  const w = weight ?? p.weight;
  if (p.bf && p.bf > 3 && p.bf < 60) return 370 + 21.6 * (w * (1 - p.bf / 100));
  return 10 * w + 6.25 * p.height - 5 * p.age + (p.sex === 'h' ? 5 : -161);
}

function stepsKcal(steps, weight = P.weight) { return (steps || 0) * weight * STEP_KCAL_PER_KG; }

function workoutKcal(type, min, weight = P.weight) {
  const met = (WORKOUTS[type] || WORKOUTS.otro).met;
  return Math.max(0, (met - 1) * 3.5 * weight / 200 * (min || 0));
}

/* Gasto de mantenimiento de un día concreto */
function maintenanceFor(d, useAdapt = true) {
  const dd = dayRaw(d);
  const b = bmr();
  let m = b * P.baseMult;
  if (P.mode === 'dyn' && dd) {
    m += stepsKcal(dd.steps);
    m += (dd.workouts || []).reduce((s, w) => s + (w.kcal || 0), 0);
  }
  if (useAdapt && P.adapt) m *= (P.adaptFactor || 1);
  return m;
}

/* Ajuste porcentual según objetivo y ritmo (0-100) */
function goalAdjust() {
  const r = (P.rate ?? 50) / 100;
  if (P.goal === 'deficit') return -(0.10 + r * 0.20);   // -10% a -30%
  if (P.goal === 'volumen') return (0.03 + r * 0.17);    // +3% a +20%
  return 0;
}

/* Objetivo base del día (sin traspaso) */
function targetFor(d) {
  return maintenanceFor(d) * (1 + goalAdjust());
}

function totalsFor(d) {
  const dd = dayRaw(d);
  const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
  if (!dd) return t;
  for (const e of dd.meals) {
    const m = entryMacros(e);
    t.kcal += m.kcal; t.p += m.p; t.c += m.c; t.f += m.f; t.fib += m.fib || 0;
  }
  return t;
}

function entryMacros(e) {
  return computeEntryMacros(e.food, e.grams, e.cook, e.weighedCooked, e.oil);
}

function isTracked(d) { const dd = dayRaw(d); return dd && dd.meals && dd.meals.length > 0; }

/* Traspaso acumulado que entra en el día d */
function carryIn(d) {
  if (!P.carry) return 0;
  const start = P.carryReset === 'week' ? mondayOf(d) : null;
  let sum = 0, cur = addDays(d, -1), guard = 0;
  while (guard++ < 400) {
    if (start && cur < start) break;
    if (!P.days[cur]) { if (!start && guard > 30) break; cur = addDays(cur, -1); continue; }
    if (isTracked(cur)) sum += targetFor(cur) - totalsFor(cur).kcal;
    cur = addDays(cur, -1);
  }
  return clamp(sum, -P.carryCap, P.carryCap);
}

function macroTargets(kcalTarget) {
  const w = P.weight;
  const p = P.protPerKg * w;
  const f = P.fatPerKg * w;
  const c = Math.max(30, (kcalTarget - p * 4 - f * 9) / 4);
  return { p, f, c };
}

/* Metabolismo real estimado a partir de peso + ingesta */
function adaptiveEstimate() {
  const dates = Object.keys(P.days).filter(d => isTracked(d)).sort();
  if (dates.length < 10) return null;
  const win = dates.slice(-28);
  const wDates = win.filter(d => P.days[d].weight);
  if (wDates.length < 6) return null;

  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  const half = Math.max(3, Math.floor(wDates.length / 3));
  const w0 = avg(wDates.slice(0, half).map(d => P.days[d].weight));
  const w1 = avg(wDates.slice(-half).map(d => P.days[d].weight));
  const days = (parseISO(wDates[wDates.length - 1]) - parseISO(wDates[0])) / 864e5;
  if (days < 10) return null;

  const midStart = wDates[Math.floor(half / 2)];
  const midEnd = wDates[wDates.length - 1 - Math.floor(half / 2)];
  const span = win.filter(d => d >= midStart && d <= midEnd);
  if (span.length < 7) return null;

  const intake = avg(span.map(d => totalsFor(d).kcal));
  const predicted = avg(span.map(d => maintenanceFor(d, false)));
  const dKg = w1 - w0;
  const spanDays = Math.max(1, (parseISO(midEnd) - parseISO(midStart)) / 864e5);
  const real = intake - (dKg * KCAL_PER_KG_FAT / spanDays);

  if (!isFinite(real) || real < 800 || real > 6000) return null;
  return { real, predicted, factor: clamp(real / predicted, 0.82, 1.22), dKg, days: Math.round(days), n: span.length, intake };
}

function refreshAdapt() {
  const a = adaptiveEstimate();
  if (a && P.adapt) {
    const prev = P.adaptFactor || 1;
    P.adaptFactor = clamp(prev * 0.5 + a.factor * 0.5, 0.82, 1.22);
    save();
  }
  return a;
}

/* ================= Render: HOY ================= */
function renderToday() {
  const d = viewDate, dd = day(d);
  $('#hTitle').textContent = niceDate(d);
  const tot = totalsFor(d);
  const base = targetFor(d);
  const ci = carryIn(d);
  const target = Math.max(bmr() * 0.85, base + ci);
  const left = target - tot.kcal;

  // anillo
  const C = 2 * Math.PI * 52;
  const pct = clamp(tot.kcal / Math.max(1, target), 0, 1.35);
  const arc = $('#ringArc');
  arc.setAttribute('stroke-dasharray', C);
  arc.setAttribute('stroke-dashoffset', C * (1 - Math.min(pct, 1)));
  arc.setAttribute('stroke', pct > 1.08 ? 'var(--warn)' : 'var(--kcal)');
  $('#kcalLeft').textContent = r0(Math.abs(left));
  $('#kcalLeftLbl').textContent = left >= 0 ? 'kcal restantes' : 'kcal de más';

  // barras macro
  const mt = macroTargets(target);
  const bars = [
    ['Proteína', tot.p, mt.p, 'var(--prot)'],
    ['Carbohidratos', tot.c, mt.c, 'var(--carb)'],
    ['Grasa', tot.f, mt.f, 'var(--fat)']
  ];
  $('#macroBars').innerHTML = bars.map(([n, v, t, col]) => `
    <div class="macro">
      <div class="row between"><span class="name">${n}</span>
      <span class="val num">${r0(v)} / ${r0(t)} g</span></div>
      <div class="bar"><i style="width:${clamp(v / Math.max(1, t) * 100, 0, 100)}%;background:${col}"></i></div>
    </div>`).join('');

  // stats
  const burn = maintenanceFor(d);
  const sk = P.mode === 'dyn' ? stepsKcal(dd.steps) : 0;
  const wk = P.mode === 'dyn' ? (dd.workouts || []).reduce((s, w) => s + w.kcal, 0) : 0;
  $('#dayStats').innerHTML = [
    ['Objetivo', r0(target), 'kcal'],
    ['Comido', r0(tot.kcal), 'kcal'],
    ['Gasto', r0(burn), 'kcal'],
    ['Pasos', (dd.steps || 0).toLocaleString('es-ES'), sk ? '+' + r0(sk) + ' kcal' : '—'],
    ['Entreno', wk ? '+' + r0(wk) : '—', 'kcal'],
    ['Fibra', r0(tot.fib), 'g']
  ].map(([s, b, u]) => `<div class="stat"><b class="num">${b}</b><span>${s}</span><span>${u}</span></div>`).join('');

  $('#balanceNote').textContent = P.goal === 'deficit' ? 'déficit' : P.goal === 'volumen' ? 'superávit' : 'mantenimiento';
  $('#carryNote').innerHTML = !P.carry ? 'Traspaso desactivado.'
    : ci === 0 ? 'Sin saldo pendiente de días anteriores.'
      : ci > 0 ? `Llevas <b>+${r0(ci)} kcal</b> de saldo a favor de días anteriores, ya sumadas al objetivo de hoy.`
        : `Llevas <b>${r0(ci)} kcal</b> de más de días anteriores, ya restadas del objetivo de hoy.`;

  // comidas
  const box = $('#mealList'); box.innerHTML = '';
  let any = false;
  MEALS.forEach(mname => {
    const items = dd.meals.filter(m => m.meal === mname);
    if (!items.length) return;
    any = true;
    const sum = items.reduce((s, e) => s + entryMacros(e).kcal, 0);
    const head = el('div', 'grouphead');
    head.innerHTML = `<span>${mname}</span><span class="num">${r0(sum)} kcal</span>`;
    box.appendChild(head);
    const list = el('div', 'list');
    items.forEach(e => {
      const m = entryMacros(e);
      const b = el('button', 'item');
      b.innerHTML = `<div class="grow"><div class="t">${esc(e.food.n)}</div>
        <div class="s">${describePortion(e)}</div></div>
        <div class="k num">${r0(m.kcal)}<em>P${r0(m.p)} C${r0(m.c)} G${r0(m.f)}</em></div>`;
      b.onclick = () => openPortion({ edit: e });
      list.appendChild(b);
    });
    const saveBtn = el('button', 'item');
    saveBtn.innerHTML = `<div class="grow"><div class="t" style="color:var(--link)">Guardar «${esc(mname)}» como plato</div></div>`;
    saveBtn.onclick = () => openRecipeSheet(items);
    list.appendChild(saveBtn);
    box.appendChild(list);
  });
  if (!any) box.innerHTML = '<div class="list"><div class="empty">Aún no has apuntado nada hoy.</div></div>';

  // actividad
  $('#inpSteps').value = dd.steps || '';
  const wl = $('#workoutList'); wl.innerHTML = '';
  if ((dd.workouts || []).length) {
    const list = el('div', 'list');
    dd.workouts.forEach(w => {
      const b = el('button', 'item');
      b.innerHTML = `<div class="grow"><div class="t">${esc((WORKOUTS[w.type] || {}).n || w.type)}</div>
        <div class="s">${w.min} min</div></div><div class="k num">${r0(w.kcal)}<em>kcal</em></div>`;
      b.onclick = () => openWorkout(w);
      list.appendChild(b);
    });
    wl.appendChild(list);
  }

  $('#inpWeight').value = dd.weight ? r1(dd.weight) : '';
  const wDates = Object.keys(P.days).filter(x => P.days[x].weight).sort();
  $('#weightNote').textContent = wDates.length
    ? `Último registro: ${r1(P.days[wDates[wDates.length - 1]].weight)} kg (${niceDate(wDates[wDates.length - 1]).toLowerCase()}).`
    : 'Pésate en ayunas, siempre a la misma hora. Con 10-14 días la app ya puede estimar tu metabolismo real.';
}

function describePortion(e) {
  const m = entryMacros(e);
  const opts = cookOptions(e.food);
  const ck = opts[e.cook];
  const multi = Object.keys(opts).length > 1;
  const parts = [];
  parts.push(`${r0(e.grams)} g${multi ? (e.weighedCooked ? ' cocinado' : ' crudo') : ''}`);
  if (ck && multi) parts.push(ck.n.toLowerCase());
  if (m.oilG >= 0.5) parts.push(`+${r1(m.oilG)} g aceite`);
  return parts.join(' · ');
}

/* ================= Render: PROGRESO ================= */
function renderProgress() {
  const dates = Object.keys(P.days).sort();
  const wPts = dates.filter(d => P.days[d].weight).map(d => ({ d, v: P.days[d].weight }));
  drawWeight($('#chartWeight'), wPts);

  if (wPts.length >= 8) {
    const ma = movAvg(wPts, 7);
    const delta = ma[ma.length - 1].v - ma[Math.max(0, ma.length - 8)].v;
    $('#wTrend').textContent = `${delta >= 0 ? '+' : ''}${r1(delta)} kg / semana`;
  } else $('#wTrend').textContent = 'faltan datos';

  const last = dates.filter(isTracked).slice(-21);
  drawKcal($('#chartKcal'), last.map(d => ({ d, v: totalsFor(d).kcal, t: targetFor(d) })));

  const a = refreshAdapt();
  const box = $('#adaptiveBox');
  if (!a) {
    box.innerHTML = `<div class="muted">Necesito unos 10-14 días con comidas apuntadas y pesajes para calcular tu gasto real.
      Mientras tanto uso la fórmula estándar: <b class="num">${r0(maintenanceFor(viewDate, false))} kcal</b> hoy.</div>`;
  } else {
    const diff = a.real - a.predicted;
    box.innerHTML = `
      <div class="stats">
        <div class="stat"><b class="num">${r0(a.real)}</b><span>Gasto real</span><span>kcal/día</span></div>
        <div class="stat"><b class="num">${r0(a.predicted)}</b><span>Fórmula</span><span>kcal/día</span></div>
        <div class="stat"><b class="num">${diff >= 0 ? '+' : ''}${r0(diff)}</b><span>Diferencia</span><span>kcal/día</span></div>
        <div class="stat"><b class="num">${a.dKg >= 0 ? '+' : ''}${r1(a.dKg)}</b><span>kg</span><span>en ${a.days} días</span></div>
      </div>
      <div class="tiny" style="margin-top:10px">Calculado con ${a.n} días de registro y tu curva de peso.
      ${P.adapt ? 'Tus objetivos ya están corregidos con este dato.' : 'El ajuste automático está desactivado en Ajustes.'}</div>`;
  }

  const wk = last.slice(-7);
  const sum = k => wk.reduce((s, d) => s + k(d), 0);
  $('#weekStats').innerHTML = wk.length ? [
    ['Comido', r0(sum(d => totalsFor(d).kcal) / wk.length), 'kcal/día'],
    ['Objetivo', r0(sum(d => targetFor(d)) / wk.length), 'kcal/día'],
    ['Balance', `${sum(d => totalsFor(d).kcal - targetFor(d)) >= 0 ? '+' : ''}${r0(sum(d => totalsFor(d).kcal - targetFor(d)))}`, 'kcal'],
    ['Proteína', r0(sum(d => totalsFor(d).p) / wk.length), 'g/día'],
    ['Pasos', r0(sum(d => P.days[d].steps || 0) / wk.length), 'al día'],
    ['Registrados', wk.length, 'de 7 días']
  ].map(([s, b, u]) => `<div class="stat"><b class="num">${b}</b><span>${s}</span><span>${u}</span></div>`).join('')
    : '<div class="muted">Sin datos todavía.</div>';
}

function movAvg(pts, n) {
  return pts.map((p, i) => {
    const s = pts.slice(Math.max(0, i - n + 1), i + 1);
    return { d: p.d, v: s.reduce((a, b) => a + b.v, 0) / s.length };
  });
}

function setupCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight || 170;
  if (w < 40) return null;
  cv.width = w * dpr; cv.height = h * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
  return { g, w, h };
}
function cssVar(n) { return getComputedStyle(document.body).getPropertyValue(n).trim(); }

function drawWeight(cv, pts) {
  const ctx = setupCanvas(cv); if (!ctx) return;
  const { g, w, h } = ctx;
  if (pts.length < 2) { g.fillStyle = cssVar('--tx2'); g.font = '14px -apple-system,sans-serif'; g.fillText('Apunta tu peso unos días para ver la tendencia.', 8, h / 2); return; }
  const ma = movAvg(pts, 7);
  const vals = pts.map(p => p.v).concat(ma.map(p => p.v));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(0.4, (hi - lo) * 0.18); lo -= pad; hi += pad;
  const X = i => 34 + i * (w - 44) / Math.max(1, pts.length - 1);
  const Y = v => h - 22 - (v - lo) / (hi - lo) * (h - 40);

  g.strokeStyle = cssVar('--sep'); g.lineWidth = 1; g.fillStyle = cssVar('--tx2'); g.font = '10px -apple-system,sans-serif';
  for (let i = 0; i <= 3; i++) {
    const v = lo + (hi - lo) * i / 3, y = Y(v);
    g.beginPath(); g.moveTo(34, y); g.lineTo(w - 6, y); g.stroke();
    g.fillText(v.toFixed(1), 2, y + 3);
  }
  g.strokeStyle = cssVar('--tx3'); g.lineWidth = 1.5; g.beginPath();
  pts.forEach((p, i) => i ? g.lineTo(X(i), Y(p.v)) : g.moveTo(X(i), Y(p.v))); g.stroke();
  g.strokeStyle = cssVar('--kcal'); g.lineWidth = 2.6; g.lineJoin = 'round'; g.beginPath();
  ma.forEach((p, i) => i ? g.lineTo(X(i), Y(p.v)) : g.moveTo(X(i), Y(p.v))); g.stroke();
  g.fillStyle = cssVar('--tx2');
  g.fillText(niceLabel(pts[0].d), 34, h - 6);
  const lbl = niceLabel(pts[pts.length - 1].d);
  g.fillText(lbl, w - 6 - g.measureText(lbl).width, h - 6);
}
function niceLabel(s) { const d = parseISO(s); return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); }

function drawKcal(cv, pts) {
  const ctx = setupCanvas(cv); if (!ctx) return;
  const { g, w, h } = ctx;
  if (!pts.length) { g.fillStyle = cssVar('--tx2'); g.font = '14px -apple-system,sans-serif'; g.fillText('Sin comidas apuntadas todavía.', 8, h / 2); return; }
  const hi = Math.max(...pts.map(p => Math.max(p.v, p.t))) * 1.12;
  const bw = (w - 12) / pts.length;
  pts.forEach((p, i) => {
    const x = 6 + i * bw, bh = p.v / hi * (h - 26);
    g.fillStyle = cssVar('--kcal');
    const rr = Math.max(0, Math.min(4, bw * 0.3, Math.max(2, bh) / 2));
    roundRect(g, x + bw * 0.16, h - 20 - bh, bw * 0.68, Math.max(2, bh), rr); g.fill();
    const ty = h - 20 - p.t / hi * (h - 26);
    g.strokeStyle = cssVar('--tx2'); g.lineWidth = 2; g.beginPath();
    g.moveTo(x, ty); g.lineTo(x + bw, ty); g.stroke();
  });
  g.fillStyle = cssVar('--tx2'); g.font = '10px -apple-system,sans-serif';
  g.fillText(niceLabel(pts[0].d), 6, h - 6);
  const lbl = niceLabel(pts[pts.length - 1].d);
  g.fillText(lbl, w - 6 - g.measureText(lbl).width, h - 6);
}
function roundRect(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/* ================= Render: ALIMENTOS ================= */
function renderFoods() {
  const rl = $('#recipeList'); rl.innerHTML = '';
  if (!P.recipes.length) rl.innerHTML = '<div class="list"><div class="empty">Todavía no has guardado ningún plato.<br>Apunta una comida en Hoy y pulsa «Guardar como plato».</div></div>';
  else {
    const list = el('div', 'list');
    P.recipes.forEach(rec => {
      const kcal = rec.items.reduce((s, e) => s + entryMacros(e).kcal, 0);
      const b = el('button', 'item');
      b.innerHTML = `<div class="grow"><div class="t">${esc(rec.name)}</div>
        <div class="s">${rec.items.length} ingrediente${rec.items.length > 1 ? 's' : ''}</div></div>
        <div class="k num">${r0(kcal)}<em>kcal</em></div>`;
      b.onclick = () => {
        if (!confirm(`¿Añadir «${rec.name}» a ${niceDate(viewDate).toLowerCase()}?`)) return;
        rec.items.forEach(e => day().meals.push({ ...structuredClone(e), id: uid() }));
        save(); toast('Plato añadido'); go('Today');
      };
      b.oncontextmenu = ev => { ev.preventDefault(); if (confirm(`¿Borrar el plato «${rec.name}»?`)) { P.recipes = P.recipes.filter(x => x !== rec); save(); renderFoods(); } };
      list.appendChild(b);
    });
    rl.appendChild(list);
  }

  const cl = $('#customList'); cl.innerHTML = '';
  if (P.customs.length) {
    const list = el('div', 'list');
    P.customs.forEach(f => {
      const b = el('button', 'item');
      b.innerHTML = `<div class="grow"><div class="t">${esc(f.n)}</div><div class="s">${f.barcode ? 'código ' + f.barcode + ' · ' : ''}por 100 g</div></div>
        <div class="k num">${r0(f.kcal)}<em>kcal</em></div>`;
      b.onclick = () => openPortion({ food: f });
      list.appendChild(b);
    });
    cl.appendChild(list);
  }
}

/* ================= Render: AJUSTES ================= */
function renderSettings() {
  $('#pName').value = P.name; $('#pAge').value = P.age;
  $('#pHeight').value = P.height; $('#pWeight').value = P.weight;
  $('#pBf').value = P.bf ?? '';
  $('#pProt').value = P.protPerKg; $('#pFat').value = P.fatPerKg;
  $('#pBase').value = P.baseMult; $('#pCarryCap').value = P.carryCap;
  $('#pRate').value = P.rate;
  seg('#segSex', P.sex); seg('#segGoal', P.goal); seg('#segMode', P.mode); seg('#segCarryReset', P.carryReset);
  $('#swCarry').setAttribute('aria-pressed', P.carry);
  $('#swAdapt').setAttribute('aria-pressed', P.adapt);

  $('#segProfile').innerHTML = Object.values(DB.profiles)
    .map(p => `<button data-p="${p.id}" aria-pressed="${p.id === DB.active}">${esc(p.name)}</button>`).join('');
  $$('#segProfile button').forEach(b => b.onclick = () => {
    DB.active = b.dataset.p; saveNow(); load(); renderAll(); toast('Perfil cambiado');
  });

  $('#modeNote').innerHTML = P.mode === 'dyn'
    ? 'El objetivo cambia cada día: base sin moverte + lo que gastas con los pasos y el entreno. Es el que da más información.'
    : 'Un objetivo fijo todos los días. El multiplicador de abajo ya incluye tu actividad habitual (1,2 sedentario · 1,45 entrenas 3-4 días · 1,6 muy activo).';

  const adj = goalAdjust();
  const m = maintenanceFor(todayISO());
  const kgw = (m * adj * 7) / KCAL_PER_KG_FAT;
  $('#rateLbl').textContent = P.goal === 'mantener' ? 'Ritmo (no aplica al mantener)' : 'Ritmo';
  $('#rateNote').innerHTML = P.goal === 'mantener'
    ? `Objetivo ≈ <b class="num">${r0(m)} kcal</b> hoy.`
    : `${adj > 0 ? '+' : ''}${Math.round(adj * 100)}% · unos <b class="num">${(kgw >= 0 ? '+' : '') + r1(kgw)} kg</b> por semana · ≈ <b class="num">${r0(m * (1 + adj))} kcal</b> hoy.`;
  $('#pRate').disabled = P.goal === 'mantener';

  const a = adaptiveEstimate();
  $('#adaptNote2').innerHTML = a
    ? `Corrigiendo un <b>${((P.adaptFactor - 1) * 100 >= 0 ? '+' : '') + r1((P.adaptFactor - 1) * 100)}%</b> según tu peso real.`
    : 'Aún sin datos suficientes. Con 10-14 días se activa solo.';

  const used = new Blob([JSON.stringify(DB)]).size;
  $('#storageNote').innerHTML = `Todo se guarda solo en este dispositivo (${(used / 1024).toFixed(0)} KB).
    En iPhone, añade la web a la pantalla de inicio para que Safari no borre los datos. Haz una copia de vez en cuando.`;
}

function seg(sel, val) { $$(sel + ' button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === val)); }

/* ================= Navegación ================= */
function go(v) {
  currentView = v;
  ['Today', 'Progress', 'Foods', 'Settings'].forEach(x => $('#view' + x).classList.toggle('hide', x !== v));
  $$('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.view === v));
  const titles = { Today: niceDate(viewDate), Progress: 'Progreso', Foods: 'Alimentos', Settings: 'Ajustes' };
  $('#hTitle').textContent = titles[v];
  const nav = v === 'Today';
  $('#btnDatePrev').classList.toggle('hide', !nav); $('#btnDateNext').classList.toggle('hide', !nav);
  $('#hSub').textContent = nav ? `${P.name}` : '';
  renderAll();
  window.scrollTo(0, 0);
}
function renderAll() {
  if (currentView === 'Today') renderToday();
  if (currentView === 'Progress') renderProgress();
  if (currentView === 'Foods') renderFoods();
  if (currentView === 'Settings') renderSettings();
}

/* ================= Sheets ================= */
function openSheet(id) { $(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeSheet(id) { $(id).classList.remove('open'); document.body.style.overflow = ''; stopScan(); }
$$('.sheet [data-close]').forEach(b => b.onclick = () => closeSheet('#' + b.closest('.sheet').id));

/* ---------- Buscar / añadir ---------- */
let searchMeal = 'Comida';
function guessMeal() {
  const h = new Date().getHours();
  if (h < 10.5) return 'Desayuno';
  if (h < 12.5) return 'Almuerzo';
  if (h < 16.5) return 'Comida';
  if (h < 19.5) return 'Merienda';
  return 'Cena';
}
function openSearch() {
  searchMeal = guessMeal();
  $('#segMeal').innerHTML = MEALS.map(m => `<button data-v="${m}" aria-pressed="${m === searchMeal}">${m}</button>`).join('');
  $$('#segMeal button').forEach(b => b.onclick = () => { searchMeal = b.dataset.v; seg('#segMeal', searchMeal); });
  $('#inpSearch').value = ''; $('#scanWrap').classList.add('hide');
  renderSearchResults('');
  openSheet('#sheetSearch');
  setTimeout(() => $('#inpSearch').focus(), 250);
}

function allLocalFoods() { return [...P.customs, ...FOODS]; }

function renderSearchResults(q) {
  const box = $('#searchResults'); box.innerHTML = '';
  q = q.trim().toLowerCase();
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  if (!q) {
    // frecuentes + recientes
    const freq = Object.entries(P.recent).sort((a, b) => b[1] - a[1]).slice(0, 12)
      .map(([id]) => allLocalFoods().find(f => f.id === id)).filter(Boolean);
    if (freq.length) box.appendChild(groupTitle('Los que más usas'));
    if (freq.length) box.appendChild(foodList(freq));
    if (P.recipes.length) {
      box.appendChild(groupTitle('Tus platos'));
      const list = el('div', 'list');
      P.recipes.forEach(rec => {
        const kcal = rec.items.reduce((s, e) => s + entryMacros(e).kcal, 0);
        const b = el('button', 'item');
        b.innerHTML = `<div class="grow"><div class="t">${esc(rec.name)}</div><div class="s">plato guardado</div></div><div class="k num">${r0(kcal)}<em>kcal</em></div>`;
        b.onclick = () => {
          rec.items.forEach(e => day().meals.push({ ...structuredClone(e), meal: searchMeal, id: uid() }));
          save(); closeSheet('#sheetSearch'); renderToday(); toast('Plato añadido');
        };
        list.appendChild(b);
      });
      box.appendChild(list);
    }
    box.appendChild(groupTitle('Todos los alimentos'));
    box.appendChild(foodList(allLocalFoods().slice(0, 40)));
    return;
  }

  const local = allLocalFoods().filter(f => norm(f.n).includes(norm(q))).slice(0, 25);
  if (local.length) { box.appendChild(groupTitle('En la app')); box.appendChild(foodList(local)); }

  const off = el('div');
  off.innerHTML = `<div class="grouphead"><span>Productos con marca</span><span class="tiny">Open Food Facts</span></div>
    <div class="list"><div class="empty">Buscando…</div></div>`;
  box.appendChild(off);
  searchOFF(q).then(res => {
    off.querySelector('.list').remove();
    if (!res.length) { off.appendChild(el('div', 'list', '<div class="empty">Nada encontrado. Escanea el código de barras o créalo a mano.</div>')); return; }
    off.appendChild(foodList(res));
  }).catch(() => {
    off.querySelector('.list').innerHTML = '<div class="empty">El buscador de Open Food Facts no responde ahora mismo.<br>Escanea el código de barras: eso siempre funciona.</div>';
  });
}
function groupTitle(t) { return el('div', 'grouphead', `<span>${t}</span>`); }
function foodList(arr) {
  const list = el('div', 'list');
  arr.forEach(f => {
    const b = el('button', 'item');
    b.innerHTML = `<div class="grow"><div class="t">${esc(f.n)}</div>
      <div class="s">${f.brand ? esc(f.brand) + ' · ' : ''}${r0(f.kcal)} kcal · P${r1(f.p)} C${r1(f.c)} G${r1(f.f)} por 100 g</div></div>`;
    b.onclick = () => openPortion({ food: f });
    list.appendChild(b);
  });
  return list;
}

/* ---------- Open Food Facts ---------- */
function offToFood(pr) {
  const n = pr.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n['energy_100g'] != null) kcal = n['energy_100g'] / 4.184;
  if (kcal == null) return null;
  const serving = parseFloat(String(pr.serving_size || '').replace(',', '.')) || null;
  return {
    id: 'off_' + pr.code, n: pr.product_name || 'Producto sin nombre',
    brand: (pr.brands || '').split(',')[0] || '',
    cl: 'simple', barcode: pr.code,
    kcal: +kcal || 0, p: +n.proteins_100g || 0, c: +n.carbohydrates_100g || 0,
    f: +n.fat_100g || 0, fib: +n.fiber_100g || 0,
    units: serving ? [{ n: `Ración (${r0(serving)} g)`, g: serving }] : []
  };
}
async function searchOFF(q) {
  const hosts = ['https://es.openfoodfacts.org', 'https://world.openfoodfacts.org'];
  const qs = `/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1` +
    `&page_size=20&sort_by=unique_scans_n&fields=code,product_name,brands,nutriments,serving_size`;
  for (const h of hosts) {
    try {
      const r = await fetch(h + qs);
      const txt = await r.text();
      if (!txt.trim().startsWith('{')) continue;      // OFF devuelve HTML cuando limita el tráfico
      const j = JSON.parse(txt);
      const out = (j.products || []).map(offToFood).filter(f => f && f.n && f.kcal > 0).slice(0, 15);
      if (out.length) return out;
    } catch (e) { /* siguiente host */ }
  }
  throw new Error('offline');
}

async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, '');
  if (code.length < 6) return null;
  const local = P.customs.find(f => f.barcode === code);
  if (local) return local;
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,brands,nutriments,serving_size`);
  const j = await r.json();
  if (j.status !== 1 || !j.product) return null;   // OFF devuelve 200 aunque no exista
  return offToFood(j.product);
}

/* ---------- Escáner ---------- */
let scanStream = null, scanReader = null, scanLoop = null;
async function startScan() {
  $('#scanWrap').classList.remove('hide');
  $('#scanNote').textContent = 'Apunta al código de barras.';
  const video = $('#scanVideo');
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = scanStream; await video.play();
  } catch (e) {
    $('#scanNote').textContent = 'No se puede abrir la cámara. Necesita HTTPS y permiso. Escribe el código a mano.';
    return;
  }
  if ('BarcodeDetector' in window) {
    const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
    const tick = async () => {
      if (!scanStream) return;
      try { const c = await det.detect(video); if (c.length) return onScan(c[0].rawValue); } catch (e) { }
      scanLoop = requestAnimationFrame(tick);
    };
    tick();
  } else {
    try {
      const { BrowserMultiFormatReader } = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm');
      scanReader = new BrowserMultiFormatReader();
      scanReader.decodeFromVideoElement(video, res => { if (res) onScan(res.getText()); });
    } catch (e) {
      $('#scanNote').textContent = 'El lector no se ha podido cargar. Escribe el código a mano.';
    }
  }
}
function stopScan() {
  if (scanLoop) cancelAnimationFrame(scanLoop), scanLoop = null;
  if (scanReader) { try { scanReader.reset(); } catch (e) { } scanReader = null; }
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
}
async function onScan(code) {
  stopScan();
  if (navigator.vibrate) navigator.vibrate(30);
  $('#scanNote').textContent = 'Buscando ' + code + '…';
  const f = await lookupBarcode(code).catch(() => null);
  if (!f) {
    $('#scanNote').textContent = `El código ${code} no está en la base. Créalo a mano una vez y ya lo tendrás para siempre.`;
    pendingBarcode = code;
    openCustom(code);
    return;
  }
  $('#scanWrap').classList.add('hide');
  openPortion({ food: f });
}

/* ---------- Porción ---------- */
let poState = null;
function openPortion({ food, edit }) {
  const f = edit ? edit.food : food;
  const opts = cookOptions(f);
  poState = edit
    ? { food: f, editing: edit, qty: edit.grams, unitIdx: -1, cook: edit.cook, weighed: edit.weighedCooked ? 'cooked' : 'raw', oil: edit.oil, meal: edit.meal }
    : { food: f, editing: null, qty: (f.units && f.units.length ? 1 : 100), unitIdx: (f.units && f.units.length ? 0 : -1), cook: Object.keys(opts)[0], weighed: 'raw', oil: null, meal: searchMeal };

  $('#poTitle').textContent = f.n;
  $('#btnPortionSave').textContent = edit ? 'Guardar' : 'Añadir';
  $('#btnPortionDelete').classList.toggle('hide', !edit);

  // atajos de unidades
  const uw = $('#poUnits'); uw.innerHTML = '';
  if (f.units && f.units.length) {
    const seg2 = el('div', 'seg');
    f.units.forEach((u, i) => {
      const b = el('button', null, u.n.replace(/\s*\(.*\)$/, ''));
      b.dataset.v = i;
      b.onclick = () => { poState.unitIdx = i; poState.qty = 1; syncPortion(true); };
      seg2.appendChild(b);
    });
    const b = el('button', null, 'gramos'); b.dataset.v = '-1';
    b.onclick = () => { poState.unitIdx = -1; poState.qty = 100; syncPortion(true); };
    seg2.appendChild(b);
    uw.appendChild(seg2);
  }

  const sel = $('#poUnitSel'); sel.innerHTML = '';
  (f.units || []).forEach((u, i) => sel.appendChild(new Option(u.n, i)));
  sel.appendChild(new Option('gramos', -1));

  const ck = $('#poCook'); ck.innerHTML = '';
  Object.entries(opts).forEach(([k, v]) => ck.appendChild(new Option(v.n, k)));
  $('#poCookWrap').classList.toggle('hide', Object.keys(opts).length <= 1);

  syncPortion(true);
  openSheet('#sheetPortion');
}

function portionGrams() {
  const f = poState.food;
  if (poState.unitIdx >= 0 && f.units && f.units[poState.unitIdx]) return poState.qty * f.units[poState.unitIdx].g;
  return poState.qty;
}

function syncPortion(fromState) {
  const f = poState.food, opts = cookOptions(f);
  if (fromState) {
    $('#poQty').value = poState.qty;
    $('#poUnitSel').value = poState.unitIdx;
    $('#poCook').value = poState.cook;
    seg('#segWeighed', poState.weighed);
    $$('#poUnits .seg button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.v === poState.unitIdx));
  }
  const grams = portionGrams();
  const cookedFlag = poState.weighed === 'cooked';
  const auto = computeEntryMacros(f, grams, poState.cook, cookedFlag, null);
  if (poState.oil === null || poState.oil === undefined || fromState) {
    if (poState.oil === null || poState.oil === undefined) $('#poOil').value = r1(auto.oilG);
    else $('#poOil').value = r1(poState.oil);
  }
  const oilVal = parseFloat($('#poOil').value);
  const m = computeEntryMacros(f, grams, poState.cook, cookedFlag, isNaN(oilVal) ? null : oilVal);

  const cookName = (opts[poState.cook] || {}).n || '';
  const other = cookedFlag ? `${r0(m.rawG)} g en crudo` : `${r0(m.cookedG)} g ya cocinado`;
  $('#poPreview').innerHTML = `
    <div class="stat"><b class="num">${r0(m.kcal)}</b><span>kcal</span></div>
    <div class="stat"><b class="num">${r1(m.p)}</b><span>proteína</span><span>g</span></div>
    <div class="stat"><b class="num">${r1(m.c)}</b><span>carbos</span><span>g</span></div>
    <div class="stat"><b class="num">${r1(m.f)}</b><span>grasa</span><span>g</span></div>
    <div class="stat" style="grid-column:span 2"><b style="font-size:14px">${esc(cookName)}</b><span>equivale a ${other}</span></div>`;
}

$('#poQty').addEventListener('input', e => { poState.qty = parseFloat(e.target.value) || 0; poState.oil = null; syncPortion(); });
$('#poUnitSel').addEventListener('change', e => { poState.unitIdx = +e.target.value; poState.qty = poState.unitIdx >= 0 ? 1 : 100; poState.oil = null; syncPortion(true); });
$('#poCook').addEventListener('change', e => { poState.cook = e.target.value; poState.oil = null; syncPortion(true); });
$('#poOil').addEventListener('input', e => { poState.oil = parseFloat(e.target.value); syncPortion(); });
$$('#segWeighed button').forEach(b => b.onclick = () => { poState.weighed = b.dataset.v; poState.oil = null; syncPortion(true); });

$('#btnPortionSave').onclick = () => {
  const f = poState.food;
  const oilVal = parseFloat($('#poOil').value);
  const entry = {
    id: poState.editing ? poState.editing.id : uid(),
    meal: poState.meal || searchMeal,
    food: { id: f.id, n: f.n, cl: f.cl || 'simple', kcal: f.kcal, p: f.p, c: f.c, f: f.f, fib: f.fib || 0, units: f.units || [], barcode: f.barcode },
    grams: portionGrams(),
    cook: poState.cook,
    weighedCooked: poState.weighed === 'cooked',
    oil: isNaN(oilVal) ? null : oilVal
  };
  if (poState.editing) Object.assign(poState.editing, entry);
  else {
    day().meals.push(entry);
    P.recent[f.id] = (P.recent[f.id] || 0) + 1;
    if (f.id.startsWith('off_') && !P.customs.some(c => c.id === f.id)) P.customs.push({ ...f });
  }
  save(); closeSheet('#sheetPortion'); closeSheet('#sheetSearch'); go('Today');
  toast(poState.editing ? 'Actualizado' : 'Añadido');
};
$('#btnPortionDelete').onclick = () => {
  const dd = day(); dd.meals = dd.meals.filter(m => m.id !== poState.editing.id);
  save(); closeSheet('#sheetPortion'); renderToday(); toast('Quitado');
};

/* ---------- Entrenamiento ---------- */
let wkEdit = null;
function openWorkout(w) {
  wkEdit = w || null;
  const sel = $('#wkType'); sel.innerHTML = '';
  Object.entries(WORKOUTS).forEach(([k, v]) => sel.appendChild(new Option(v.n, k)));
  sel.value = w ? w.type : 'pesas';
  $('#wkMin').value = w ? w.min : 60;
  $('#wkKcal').value = w ? r0(w.kcal) : r0(workoutKcal(sel.value, 60));
  $('#btnWkDelete').classList.toggle('hide', !w);
  openSheet('#sheetWorkout');
}
const wkRecalc = () => { $('#wkKcal').value = r0(workoutKcal($('#wkType').value, +$('#wkMin').value)); };
$('#wkType').onchange = wkRecalc; $('#wkMin').oninput = wkRecalc;
$('#btnWkSave').onclick = () => {
  const obj = { id: wkEdit ? wkEdit.id : uid(), type: $('#wkType').value, min: +$('#wkMin').value || 0, kcal: +$('#wkKcal').value || 0 };
  const dd = day();
  if (wkEdit) Object.assign(wkEdit, obj); else dd.workouts.push(obj);
  save(); closeSheet('#sheetWorkout'); renderToday();
};
$('#btnWkDelete').onclick = () => {
  const dd = day(); dd.workouts = dd.workouts.filter(w => w.id !== wkEdit.id);
  save(); closeSheet('#sheetWorkout'); renderToday();
};

/* ---------- Alimento a mano ---------- */
let pendingBarcode = null;
function openCustom(barcode) {
  pendingBarcode = barcode || null;
  $('#cuName').value = ''; $('#cuKcal').value = ''; $('#cuP').value = ''; $('#cuC').value = ''; $('#cuF').value = ''; $('#cuUnit').value = '';
  const sel = $('#cuClass'); sel.innerHTML = '';
  const names = { simple: 'No se cocina / ya listo', huevo: 'Huevo', carne: 'Carne', pescado: 'Pescado', cereal: 'Pasta y cereales secos', arroz: 'Arroz', legumbre: 'Legumbre seca', patata: 'Patata', verdura: 'Verdura' };
  Object.keys(COOK_BY_CLASS).forEach(k => sel.appendChild(new Option(names[k] || k, k)));
  $('#cuBarcodeNote').textContent = pendingBarcode ? `Se guardará con el código ${pendingBarcode}: la próxima vez que lo escanees saldrá solo.` : '';
  openSheet('#sheetCustom');
}
$('#btnCustomSave').onclick = () => {
  const name = $('#cuName').value.trim();
  if (!name) return toast('Ponle un nombre');
  const unit = parseFloat($('#cuUnit').value);
  const f = {
    id: 'cu_' + uid(), n: name, cl: $('#cuClass').value,
    kcal: +$('#cuKcal').value || 0, p: +$('#cuP').value || 0, c: +$('#cuC').value || 0, f: +$('#cuF').value || 0,
    units: unit ? [{ n: `Unidad (${r0(unit)} g)`, g: unit }] : [],
    barcode: pendingBarcode || undefined
  };
  P.customs.unshift(f); save();
  closeSheet('#sheetCustom');
  toast('Alimento guardado');
  openPortion({ food: f });
};

/* ---------- Guardar plato ---------- */
let recipeItems = null;
function openRecipeSheet(items) {
  recipeItems = items;
  $('#reName').value = '';
  $('#reItems').innerHTML = `<div class="list">${items.map(e =>
    `<div class="item"><div class="grow"><div class="t">${esc(e.food.n)}</div><div class="s">${describePortion(e)}</div></div>
     <div class="k num">${r0(entryMacros(e).kcal)}<em>kcal</em></div></div>`).join('')}</div>`;
  openSheet('#sheetRecipe');
}
$('#btnRecipeSave').onclick = () => {
  const name = $('#reName').value.trim();
  if (!name) return toast('Ponle un nombre al plato');
  P.recipes.unshift({ id: uid(), name, items: structuredClone(recipeItems).map(e => ({ ...e, id: uid() })) });
  save(); closeSheet('#sheetRecipe'); toast('Plato guardado');
};

/* ================= Eventos generales ================= */
$$('#tabs button').forEach(b => b.onclick = () => go(b.dataset.view));
$('#btnDatePrev').onclick = () => { viewDate = addDays(viewDate, -1); go('Today'); };
$('#btnDateNext').onclick = () => { if (viewDate < todayISO()) { viewDate = addDays(viewDate, 1); go('Today'); } else toast('Ya estás en hoy'); };
$('#btnAddFood').onclick = openSearch;
$('#btnAddWorkout').onclick = () => openWorkout(null);
$('#btnNewCustom').onclick = () => openCustom(null);
$('#btnScan').onclick = () => { $('#scanWrap').classList.toggle('hide'); if (!$('#scanWrap').classList.contains('hide')) startScan(); else stopScan(); };
$('#btnBarcodeGo').onclick = async () => {
  const c = $('#inpBarcode').value.trim();
  if (!c) return;
  $('#scanNote').textContent = 'Buscando…';
  const f = await lookupBarcode(c).catch(() => null);
  if (!f) { $('#scanNote').textContent = 'No está en la base. Créalo a mano.'; openCustom(c); return; }
  openPortion({ food: f });
};

let searchT;
$('#inpSearch').addEventListener('input', e => {
  clearTimeout(searchT);
  const v = e.target.value;
  searchT = setTimeout(() => renderSearchResults(v), v ? 320 : 0);
});

$('#btnQuickRepeat').onclick = () => {
  const y = addDays(viewDate, -1), prev = P.days[y];
  if (!prev || !prev.meals.length) return toast('Ayer no hay nada apuntado');
  if (!confirm(`¿Copiar las ${prev.meals.length} entradas de ayer?`)) return;
  prev.meals.forEach(e => day().meals.push({ ...structuredClone(e), id: uid() }));
  save(); renderToday(); toast('Copiado');
};

$('#inpSteps').addEventListener('input', e => { day().steps = +e.target.value || 0; save(); });
$('#inpSteps').addEventListener('change', renderToday);
$('#inpWeight').addEventListener('change', e => {
  const v = parseFloat(e.target.value);
  day().weight = isNaN(v) ? null : v;
  if (!isNaN(v) && viewDate === todayISO()) P.weight = v;
  save(); renderToday();
});

/* Ajustes */
const bindNum = (sel, key, fn) => $(sel).addEventListener('change', e => {
  const v = parseFloat(e.target.value);
  P[key] = isNaN(v) ? P[key] : (fn ? fn(v) : v); save(); renderSettings();
});
$('#pName').addEventListener('change', e => { P.name = e.target.value.trim() || 'Yo'; save(); renderSettings(); });
bindNum('#pAge', 'age'); bindNum('#pHeight', 'height'); bindNum('#pWeight', 'weight');
bindNum('#pProt', 'protPerKg'); bindNum('#pFat', 'fatPerKg'); bindNum('#pBase', 'baseMult');
bindNum('#pCarryCap', 'carryCap', v => clamp(v, 0, 2000));
$('#pBf').addEventListener('change', e => { const v = parseFloat(e.target.value); P.bf = isNaN(v) ? null : v; save(); renderSettings(); });
$('#pRate').addEventListener('input', e => { P.rate = +e.target.value; save(); renderSettings(); });
$$('#segSex button').forEach(b => b.onclick = () => { P.sex = b.dataset.v; save(); renderSettings(); });
$$('#segGoal button').forEach(b => b.onclick = () => {
  P.goal = b.dataset.v;
  P.protPerKg = P.goal === 'deficit' ? 2.2 : P.goal === 'volumen' ? 2.0 : 1.8;
  P.fatPerKg  = P.goal === 'deficit' ? 0.8 : P.goal === 'volumen' ? 1.0 : 0.9;
  save(); renderSettings();
});
$$('#segMode button').forEach(b => b.onclick = () => {
  P.mode = b.dataset.v;
  P.baseMult = P.mode === 'dyn' ? 1.15 : 1.45;
  save(); renderSettings();
});
$$('#segCarryReset button').forEach(b => b.onclick = () => { P.carryReset = b.dataset.v; save(); renderSettings(); });
$('#swCarry').onclick = () => { P.carry = !P.carry; save(); renderSettings(); };
$('#swAdapt').onclick = () => { P.adapt = !P.adapt; if (!P.adapt) P.adaptFactor = 1; save(); renderSettings(); };
$('#btnAddProfile').onclick = () => {
  const n = prompt('Nombre del nuevo perfil:');
  if (!n) return;
  const p = blankProfile(n.trim());
  DB.profiles[p.id] = p; DB.active = p.id; saveNow(); load(); go('Settings'); toast('Perfil creado');
};

$('#btnExport').onclick = () => {
  const blob = new Blob([JSON.stringify(DB, null, 1)], { type: 'application/json' });
  const a = el('a'); a.href = URL.createObjectURL(blob);
  a.download = `balanc-${todayISO()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
};
$('#btnImport').onclick = () => $('#fileImport').click();
$('#fileImport').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!j.profiles) throw 0;
    if (!confirm('Esto sustituye todos los datos actuales. ¿Seguir?')) return;
    DB = j; saveNow(); load(); go('Today'); toast('Copia restaurada');
  } catch (err) { toast('El archivo no vale'); }
});
$('#btnWipe').onclick = () => {
  if (!confirm(`Se borra todo el historial de «${P.name}». No hay vuelta atrás. ¿Seguro?`)) return;
  const keep = { id: P.id, name: P.name, sex: P.sex, age: P.age, height: P.height, weight: P.weight, bf: P.bf, goal: P.goal, rate: P.rate };
  DB.profiles[P.id] = Object.assign(blankProfile(P.name), keep);
  saveNow(); load(); go('Today'); toast('Datos borrados');
};

/* ================= Arranque ================= */
load();
saveNow();
go('Today');
window.addEventListener('resize', () => { if (currentView === 'Progress') renderProgress(); });
window.addEventListener('pagehide', saveNow);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
