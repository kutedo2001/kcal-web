/* ============================================================
   ocr.js — Lectura de tickets de compra
   Dos motores: OCR local (Tesseract) o un servicio de visión
   propio si has puesto la URL en Ajustes.
   ============================================================ */
(function () {
  'use strict';
  const { FOODS } = window.NUTRI_DB;

  /* ---------- Preparación de la imagen ---------- */
  async function fileToCanvas(file, maxW = 1500) {
    const url = URL.createObjectURL(file);
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej; i.src = url;
    });
    const sc = Math.min(1, maxW / img.naturalWidth);
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * sc);
    cv.height = Math.round(img.naturalHeight * sc);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url);
    return cv;
  }

  /* Gris + estirado de contraste: los tickets térmicos salen muy lavados */
  function enhance(cv) {
    const g = cv.getContext('2d');
    const d = g.getImageData(0, 0, cv.width, cv.height), a = d.data;
    let lo = 255, hi = 0;
    for (let i = 0; i < a.length; i += 4) {
      const v = (a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114) | 0;
      a[i] = a[i + 1] = a[i + 2] = v;
      if (v < lo) lo = v; if (v > hi) hi = v;
    }
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < a.length; i += 4) {
      let v = ((a[i] - lo) * 255 / range);
      v = v < 118 ? Math.max(0, v * 0.55) : Math.min(255, 90 + v * 0.85);
      a[i] = a[i + 1] = a[i + 2] = v;
    }
    g.putImageData(d, 0, 0);
    return cv;
  }

  /* ---------- Motor 1: OCR en el propio móvil ---------- */
  let tessLoaded = null;
  function loadTesseract() {
    if (tessLoaded) return tessLoaded;
    tessLoaded = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.onload = () => res(window.Tesseract);
      s.onerror = () => rej(new Error('No se ha podido cargar el lector.'));
      document.head.appendChild(s);
    });
    return tessLoaded;
  }

  async function readLocal(file, onProgress) {
    const T = await loadTesseract();
    const cv = enhance(await fileToCanvas(file));
    onProgress && onProgress(0.1, 'Preparando la imagen…');
    const { data } = await T.recognize(cv, 'spa', {
      logger: m => {
        if (m.status === 'recognizing text') onProgress && onProgress(0.2 + m.progress * 0.8, 'Leyendo el ticket…');
        else if (m.status.includes('loading')) onProgress && onProgress(0.1, 'Descargando el idioma (solo la primera vez)…');
      }
    });
    return parseReceipt(data.text);
  }

  /* ---------- Motor 2: servicio de visión propio ---------- */
  async function readRemote(file, endpoint, onProgress) {
    onProgress && onProgress(0.2, 'Enviando la foto…');
    const cv = await fileToCanvas(file, 1600);
    const b64 = cv.toDataURL('image/jpeg', 0.82).split(',')[1];
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: b64, media_type: 'image/jpeg' })
    });
    if (!r.ok) throw new Error('El servicio ha respondido ' + r.status);
    onProgress && onProgress(0.9, 'Interpretando…');
    const j = await r.json();
    const items = Array.isArray(j.items) ? j.items : [];
    return items.map(it => ({
      raw: it.name || '',
      name: cleanName(String(it.name || '')),
      qty: +it.qty || 1,
      price: it.price != null ? +it.price : null
    })).filter(x => x.name.length > 2);
  }

  /* ---------- Análisis del texto del ticket ---------- */
  const NOISE = /(TOTAL|SUBTOTAL|IVA|I\.V\.A|BASE IMPON|EFECTIVO|TARJETA|CAMBIO|ENTREGA|DEVOLU|DESCUENTO|IMPORTE|FACTURA|TICKET|N\.?I\.?F|C\.?I\.?F|TELEF|TFNO|GRACIAS|VISITA|ATENDID|CAJA|OPERACI|AUTORIZ|TERMINAL|COMERCIO|SIMPLIFICADA|PARKING|SOCIO|PUNTOS|AHORR|FECHA|HORA|MERCADONA|CARREFOUR|CONSUM|LIDL|ALDI|EROSKI|BONPREU|SUPERMERCAD|AVDA|AVENIDA|CALLE|PLAZA|POLIGONO|WWW\.|DEVOLUCION|GARANTIA|P\.?UNIT|DESCRIPCI|UNIDADES|^C\/|^CP ?\d)/i;

  function cleanName(s) {
    return s.replace(/\d+[.,]\d{2}/g, ' ')
      .replace(/\b\d+\s*(x|X)\s*\d*[.,]?\d*/g, ' ')
      .replace(/\b\d{6,}\b/g, ' ')
      .replace(/[^\p{L}\s.%/-]/gu, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function parseReceipt(text) {
    const out = [];
    for (let line of String(text).split('\n')) {
      line = line.replace(/\s+/g, ' ').trim();
      if (line.length < 4 || NOISE.test(line)) continue;
      const price = (line.match(/(\d{1,3}[.,]\d{2})\s*$/) || [])[1];
      const qty = (line.match(/^(\d{1,2})\s+(?=\p{L})/u) || [])[1];
      const name = cleanName(line.replace(/^\d{1,2}\s+/, ''));
      if (name.length < 3) continue;
      if (!/\p{L}{3}/u.test(name)) continue;
      out.push({
        raw: line, name,
        qty: qty ? +qty : 1,
        price: price ? +price.replace(',', '.') : null
      });
    }
    return out;
  }

  /* ---------- Diccionario de abreviaturas de supermercado ---------- */
  const ABBR = {
    PECH: 'PECHUGA', FIL: 'FILETE', FILET: 'FILETE', SEMI: 'SEMIDESNATADA',
    DESN: 'DESNATADA', ENT: 'ENTERA', ACEIT: 'ACEITE', AC: 'ACEITE',
    AOVE: 'ACEITE OLIVA VIRGEN EXTRA', VEXTRA: 'VIRGEN EXTRA', OLIV: 'OLIVA',
    YOG: 'YOGUR', YOGUR: 'YOGUR', NAT: 'NATURAL', QUES: 'QUESO', LONCH: 'LONCHAS',
    JAM: 'JAMON', SERR: 'SERRANO', COC: 'COCIDO', TOM: 'TOMATE', FRIT: 'FRITO',
    MACARR: 'MACARRONES', ESPAG: 'ESPAGUETIS', ESPAGUET: 'ESPAGUETIS', ARR: 'ARROZ',
    HUEV: 'HUEVO', HUEVOS: 'HUEVO', PAT: 'PATATA', PATAT: 'PATATA', CEB: 'CEBOLLA',
    ZANAH: 'ZANAHORIA', LECH: 'LECHUGA', PLAT: 'PLATANO', MANZ: 'MANZANA',
    NARANJ: 'NARANJA', BROC: 'BROCOLI', CALABAC: 'CALABACIN', BERENJ: 'BERENJENA',
    PIMIENT: 'PIMIENTO', CHAMP: 'CHAMPINON', MERL: 'MERLUZA', SALM: 'SALMON',
    GAMB: 'GAMBAS', LANGOST: 'LANGOSTINOS', TERN: 'TERNERA', CERD: 'CERDO',
    LOM: 'LOMO', PAV: 'PAVO', POLL: 'POLLO', INTEG: 'INTEGRAL', MOLD: 'MOLDE',
    GALL: 'GALLETAS', PIST: 'PISTACHOS', ALMEND: 'ALMENDRAS', NUEC: 'NUECES',
    CACAH: 'CACAHUETE', CHOC: 'CHOCOLATE', MANTEQ: 'MANTEQUILLA', MARG: 'MARGARINA',
    GARB: 'GARBANZOS', LENT: 'LENTEJAS', ALUB: 'ALUBIAS', JUD: 'JUDIAS',
    REFR: 'REFRESCO', BEB: 'BEBIDA', CERV: 'CERVEZA', AGU: 'AGUA', ZUM: 'ZUMO',
    CONG: 'CONGELADO', FRESC: 'FRESCO', BAND: 'BANDEJA', PAQ: 'PAQUETE',
    UD: '', UDS: '', KG: '', GR: '', G: '', L: '', ML: '', CL: '', PACK: '', BOLSA: ''
  };

  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

  /* Palabras que YA son un alimento completo: nunca se expanden por prefijo.
     Sin esto, LECHE acaba convertida en LECHUGA por la regla LECH→LECHUGA. */
  const WHOLE = new Set();
  FOODS.forEach(f => norm(f.n).split(/[\s(),/%-]+/).forEach(w => { if (w.length > 2) WHOLE.add(w); }));
  ['LECHE', 'LECHUGA', 'PAN', 'PATATA', 'PAVO', 'POLLO', 'LOMO', 'ACEITE', 'ARROZ',
   'HUEVO', 'HUEVOS', 'QUESO', 'JAMON', 'TOMATE', 'NATURAL', 'ENTERA', 'FRESCO',
   'AGUA', 'ZUMO', 'CERVEZA', 'GALLETAS', 'CHOCOLATE'].forEach(w => WHOLE.add(w));

  function expand(name) {
    return norm(name).split(/[\s./-]+/).filter(Boolean).map(w => {
      if (ABBR[w] !== undefined) return ABBR[w];
      if (WHOLE.has(w)) return w;                       // ya es un alimento, no tocar
      for (const k in ABBR) if (k.length >= 4 && w.startsWith(k) && ABBR[k]) return ABBR[k];
      return w;
    }).filter(w => w.length > 1).join(' ');
  }

  /* ---------- Emparejado con la base de alimentos ---------- */
  function score(query, food) {
    const q = expand(query).split(' ').filter(w => w.length > 2);
    const t = norm(food.n).split(/[\s(),/]+/).filter(w => w.length > 2);
    if (!q.length || !t.length) return 0;
    let hits = 0;
    for (const w of q) {
      if (t.some(x => x === w)) hits += 1;
      else if (t.some(x => x.startsWith(w) || w.startsWith(x))) hits += 0.75;
      else if (t.some(x => x.includes(w) || w.includes(x))) hits += 0.5;
    }
    // premia que coincida la primera palabra, que suele ser el alimento
    const head = t.some(x => q[0] && (x === q[0] || x.startsWith(q[0]))) ? 0.25 : 0;
    return Math.min(1, hits / Math.max(q.length, t.length) + head);
  }

  function match(name, extraFoods) {
    const pool = (extraFoods || []).concat(FOODS);
    const seen = new Set();
    return pool
      .filter(f => !seen.has(f.id) && seen.add(f.id))
      .map(f => ({ food: f, s: score(name, f) }))
      .filter(x => x.s > 0.22)
      .sort((a, b) => b.s - a.s)
      .slice(0, 4);
  }

  /* Prepara la lista de revisión: cada línea con sus candidatos y un
     estado de partida. Nada entra en la despensa sin que lo confirmes. */
  function reviewList(lines, extraFoods) {
    return lines.map(l => {
      const cand = match(l.name, extraFoods);
      const best = cand[0];
      const conf = best ? best.s : 0;
      let state;
      if (conf >= 0.6) state = 'ok';            // muy probable, marcado para aceptar
      else if (conf >= 0.35) state = 'dudoso';  // hay candidato, revísalo
      else if (l.price == null) state = 'fuera'; // ni precio ni parecido: seguramente no es un producto
      else state = 'nuevo';                      // producto real que no está en la base
      return { ...l, cand, conf, state, chosen: (best && conf >= 0.35) ? best.food : null };
    });
  }

  window.NUTRI_OCR = { readLocal, readRemote, parseReceipt, match, expand, cleanName, fileToCanvas, reviewList };
})();
