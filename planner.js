/* ============================================================
   planner.js — Clasificación de alimentos y generador de menús
   ============================================================ */
(function () {
  'use strict';
  const { cookOptions, computeEntryMacros } = window.NUTRI_DB;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round5 = n => Math.max(5, Math.round(n / 5) * 5);

  /* ------------------------------------------------------------
     CATEGORÍAS
     prot · lacteo · carb · verd · fruta · grasa · otro
     "otro" nunca entra en un menú automático.
     ------------------------------------------------------------ */
  const G = {
    prot: `pechuga muslo_pollo pavo lomo_cerdo solomillo_c ternera picada_vac picada_mix hamburguesa
           conejo cordero secreto salchichas merluza salmon bacalao gambas atun_nat atun_aceite huevo
           clara whey mozzarella jamon_york pavo_lonch lomo_embuch lenteja_bo garbanzo_bo
           garbanzo lenteja alubia jamon_serr jamon_iber`,
    lacteo: `leche_ent leche_desn yog_nat yog_griego skyr queso_fres queso_lonch cafe_leche`,
    carb: `pasta pasta_int arroz arroz_int quinoa cuscus avena pan_payes pan_blanco pan_molde pan_int
           tortita_ma tortilla_tr cereales_az patata boniato guisantes`,
    verd: `tomate cebolla pimiento calabacin berenjena brocoli judia_verde champinon lechuga zanahoria`,
    fruta: `platano manzana naranja pera uva fresa sandia melon zumo_nar`,
    grasa: `aceite_oliva aceite_gir aceituna aguacate pistacho almendra nuez anacardo cacahuete
            crema_cacah mantequilla queso_curad mayonesa panceta chorizo salchichon sobrasada yema`
  };
  const TAG = {};
  Object.entries(G).forEach(([t, s]) => s.split(/\s+/).filter(Boolean).forEach(id => TAG[id] = t));

  /* Dónde puede aparecer cada alimento */
  const DES = new Set('avena pan_payes pan_blanco pan_molde pan_int tortita_ma cereales_az tortilla_tr'.split(' '));
  const SNACK_PROT = new Set('yog_nat yog_griego skyr queso_fres whey atun_nat clara jamon_serr jamon_york pavo_lonch huevo queso_lonch'.split(' '));
  /* Grasas que se comen tal cual. Los aceites solo entran al cocinar, nunca como plato. */
  const GRASA_PLATO = new Set('pistacho almendra nuez anacardo cacahuete crema_cacah aguacate aceituna mantequilla queso_curad'.split(' '));

  /* Clasificación automática para lo que no está en la lista (productos escaneados) */
  function classify(f) {
    if (!f) return 'otro';
    if (TAG[f.id]) return TAG[f.id];
    if (f.tg) return f.tg;                      // etiqueta puesta a mano
    const k = f.kcal || 0;
    if (k < 12) return 'otro';
    const pp = (f.p || 0) * 4 / k, cp = (f.c || 0) * 4 / k, fp = (f.f || 0) * 9 / k;
    if (pp > 0.30 && (f.p || 0) >= 10) return 'prot';
    if (fp > 0.60) return 'grasa';
    if (k < 80 && cp > 0.40) return 'verd';
    if (k < 110 && cp > 0.55) return 'fruta';
    if (cp > 0.45) return 'carb';
    return 'otro';
  }

  /* Cocción por defecto: así el aceite de la sartén se cuenta solo */
  const DEFAULT_COOK = {
    huevo: 'plancha', carne: 'plancha', pescado: 'plancha',
    cereal: 'hervido', arroz: 'hervido', legumbre: 'hervido',
    patata: 'horno', verdura: 'hervido', simple: 'tal'
  };
  function defCook(f) {
    const opts = cookOptions(f);
    const want = DEFAULT_COOK[f.cl] || 'tal';
    return opts[want] ? want : Object.keys(opts)[0];
  }
  function macrosOf(food, grams, cook) {
    return computeEntryMacros(food, grams, cook || defCook(food), false, null);
  }

  /* ------------------------------------------------------------
     PLANTILLAS
     Cada hueco: [categoría, gramos de partida, grupo de escalado]
     Grupos: P proteína · C hidratos · F grasa · 0 fijo
     ------------------------------------------------------------ */
  const SPLITS = {
    3: [['Desayuno', .28], ['Comida', .40], ['Cena', .32]],
    4: [['Desayuno', .24], ['Comida', .34], ['Merienda', .13], ['Cena', .29]],
    5: [['Desayuno', .21], ['Almuerzo', .10], ['Comida', .31], ['Merienda', .12], ['Cena', .26]],
    6: [['Desayuno', .19], ['Almuerzo', .09], ['Comida', .28], ['Merienda', .11], ['Cena', .25], ['Otros', .08]]
  };

  const SLOTS = {
    Desayuno: [['lacteo', 200, 'P'], ['carbDes', 60, 'C'], ['fruta', 120, '0'], ['grasaPlato', 15, 'F']],
    Comida: [['prot', 150, 'P'], ['carbPrin', 75, 'C'], ['verd', 180, '0']],
    Cena: [['prot', 150, 'P'], ['carbPrin', 70, 'C'], ['verd', 180, '0']],
    Merienda: [['snackProt', 150, 'P'], ['fruta', 120, '0'], ['grasaPlato', 15, 'F']],
    Almuerzo: [['fruta', 120, '0'], ['grasaPlato', 20, 'F']],
    Otros: [['snackProt', 120, 'P'], ['fruta', 100, '0']]
  };

  const CAT_NAME = {
    prot: 'proteína', carbPrin: 'hidratos (arroz, pasta, patata…)',
    carbDes: 'algo para el desayuno (pan, avena…)', verd: 'verdura',
    lacteo: 'lácteos', snackProt: 'algo proteico para picar', fruta: 'fruta', grasa: 'grasas'
  };

  function poolsFrom(foods) {
    const p = { prot: [], lacteo: [], carb: [], verd: [], fruta: [], grasa: [], otro: [] };
    foods.forEach(f => (p[classify(f)] || p.otro).push(f));
    p.carbDes = p.carb.filter(f => DES.has(f.id));
    p.carbPrin = p.carb.filter(f => !DES.has(f.id));
    if (!p.carbPrin.length) p.carbPrin = p.carb.slice();
    if (!p.carbDes.length) p.carbDes = p.carb.slice();
    p.snackProt = p.lacteo.concat(p.prot.filter(f => SNACK_PROT.has(f.id)));
    if (!p.snackProt.length) p.snackProt = p.lacteo.concat(p.prot);
    p.grasaPlato = p.grasa.filter(f => GRASA_PLATO.has(f.id) || (!TAG[f.id] && (f.f || 0) < 90));
    return p;
  }

  const pick = (list, seed) => list.length ? list[Math.abs(seed) % list.length] : null;

  function sumItems(items) {
    return items.reduce((t, it) => {
      const m = macrosOf(it.food, it.grams, it.cook);
      return { kcal: t.kcal + m.kcal, p: t.p + m.p, c: t.c + m.c, f: t.f + m.f, fib: t.fib + (m.fib || 0) };
    }, { kcal: 0, p: 0, c: 0, f: 0, fib: 0 });
  }

  /* Dos etapas: proteína y grasa a nivel de día; hidratos comida a comida,
     para que cada comida se quede en su porcentaje de calorías. */
  function solveDay(meals, target) {
    const all = meals.flatMap(m => m.items);
    const base = new Map(all.map(it => [it, it.grams]));
    const k = { P: 1, F: 1 };
    const kC = meals.map(() => 1);
    const LIM = { P: [0.5, 2.0], C: [0.15, 2.6], F: [0.2, 3.0] };

    const apply = () => meals.forEach((m, mi) => m.items.forEach(it => {
      if (it.grp === '0') return;
      const f = it.grp === 'C' ? kC[mi] : k[it.grp];
      it.grams = clamp(base.get(it) * f, 8, 420);
    }));

    for (let i = 0; i < 45; i++) {
      apply();
      let t = sumItems(all);
      if (t.p > 0) k.P = clamp(k.P * Math.pow(target.p / t.p, 0.55), LIM.P[0], LIM.P[1]);
      apply(); t = sumItems(all);
      if (t.f > 0) k.F = clamp(k.F * Math.pow(target.f / t.f, 0.45), LIM.F[0], LIM.F[1]);
      apply();

      meals.forEach((m, mi) => {
        const carbs = m.items.filter(it => it.grp === 'C');
        if (!carbs.length) return;
        const carbKcal = sumItems(carbs).kcal;
        const rest = sumItems(m.items).kcal - carbKcal;
        const want = target.kcal * m.share - rest;
        if (carbKcal > 0) kC[mi] = clamp(kC[mi] * Math.pow(Math.max(60, want) / carbKcal, 0.65), LIM.C[0], LIM.C[1]);
      });
    }
    apply();
  }

  function buildDay(target, pools, mealsPerDay, seed) {
    const split = SPLITS[mealsPerDay] || SPLITS[4];
    const meals = [], missing = new Set();
    let n = 0;

    split.forEach(([name, share], mi) => {
      const items = [];
      const slots = SLOTS[name] || SLOTS.Merienda;
      const mealKcal = target.kcal * share;

      // 1) Todo menos los hidratos: se dimensiona por proteína y grasa
      slots.filter(sl => sl[2] !== 'C').forEach(([cat, base, grp], si) => {
        const pool = pools[cat] || [];
        if (!pool.length) {
          if (grp === 'P' || cat === 'verd') missing.add(CAT_NAME[cat] || cat);
          return;
        }
        const f = pick(pool, seed + mi * 31 + si * 7 + (n++));
        let g = base * (share / 0.30);
        if (grp === 'P' && f.p > 3) g = clamp(target.p * share * 0.85 / (f.p / 100), 25, 350);
        if (grp === 'F' && f.f > 5) g = clamp(target.f * share * 0.28 / (f.f / 100), 8, 60);
        items.push({ food: f, grams: g, cook: defCook(f), grp });
      });

      // 2) Los hidratos rellenan las calorías que faltan para esta comida
      slots.filter(sl => sl[2] === 'C').forEach(([cat, base, grp], si) => {
        const pool = pools[cat] || [];
        if (!pool.length) { missing.add(CAT_NAME[cat] || cat); return; }
        const f = pick(pool, seed + mi * 31 + (si + 40) * 7 + (n++));
        const rest = mealKcal - sumItems(items).kcal;
        const per100 = macrosOf(f, 100, defCook(f)).kcal || 100;
        items.push({ food: f, grams: clamp(rest / (per100 / 100), 15, 400), cook: defCook(f), grp });
      });

      meals.push({ name, share, items });
    });

    solveDay(meals, target);
    topUp(meals, target, pools, seed);
    meals.forEach(m => {
      m.items = m.items.filter(it => it.grams >= 8);
      m.items.forEach(it => it.grams = round5(it.grams));
      m.totals = sumItems(m.items);
    });
    return { meals, totals: sumItems(meals.flatMap(m => m.items)), missing: [...missing], seed };
  }

  /* Cierra el hueco de cada comida cuando el alimento elegido es poco denso
     (500 g de patata no llegan a las calorías de una comida). Se hace comida
     a comida para no amontonar 60 g de frutos secos en el desayuno. */
  function topUp(meals, target, pools, seed) {
    const dens = it => (macrosOf(it.food, 100, it.cook).kcal || 1) / 100;

    meals.forEach((m, mi) => {
      for (let pass = 0; pass < 3; pass++) {
        const want = target.kcal * m.share;
        let gap = want - sumItems(m.items).kcal;
        if (Math.abs(gap) < want * 0.04) return;

        // crecer o encoger los hidratos de esta comida, del más denso al menos
        const cs = m.items.filter(it => it.grp === 'C').sort((a, b) => dens(b) - dens(a));
        for (const it of cs) {
          if (Math.abs(gap) < 20) break;
          const d = dens(it);
          const room = gap > 0 ? (400 - it.grams) : (15 - it.grams);
          const delta = gap > 0 ? Math.min(gap / d, room) : Math.max(gap / d, room);
          if (delta * Math.sign(gap) <= 0) continue;
          it.grams += delta; gap -= delta * d;
        }
        if (gap < want * 0.04) return;

        // si sigue corta, añadir un relleno denso a esta misma comida
        const pool = (m.name === 'Desayuno' || m.name === 'Merienda' || m.name === 'Almuerzo')
          ? pools.carbDes.concat(pools.grasaPlato)
          : pools.carbPrin.concat(pools.carbDes);
        const filler = pick(pool.filter(f => f.kcal > 180 && !m.items.some(i => i.food.id === f.id)), seed + mi * 5 + pass);
        if (!filler) return;
        m.items.push({
          food: filler, cook: defCook(filler), grp: 'C',
          grams: clamp(gap / (macrosOf(filler, 100).kcal / 100), 10, 180)
        });
      }
    });
  }

  function buildWeek(target, pantryFoods, mealsPerDay, seed0) {
    const pools = poolsFrom(pantryFoods);
    const days = [];
    for (let d = 0; d < 7; d++) days.push(buildDay(target, pools, mealsPerDay, seed0 + d * 101));
    const gaps = [...new Set(days.flatMap(d => d.missing))];
    return { days, gaps, mealsPerDay, target, seed0 };
  }

  window.NUTRI_PLAN = { classify, defCook, macrosOf, poolsFrom, buildWeek, buildDay, sumItems, SPLITS, TAG, CAT_NAME };
})();
