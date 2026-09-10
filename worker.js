/* ============================================================
   worker.js — Servicio de lectura de tickets (opcional)
   Cloudflare Workers. Guarda tu clave de API fuera de la web.

   CÓMO SUBIRLO
   1. dash.cloudflare.com → Workers & Pages → Create → Worker
   2. Pega este archivo entero y despliega.
   3. Settings → Variables → Add variable:
        ANTHROPIC_API_KEY = tu clave     (marca "Encrypt")
        ALLOWED_ORIGIN    = https://tuusuario.github.io
   4. Copia la URL del Worker en Balanç → Ajustes → Lectura de tickets.

   La clave vive solo aquí. La web nunca la ve.
   ============================================================ */

const MODEL = 'claude-sonnet-4-6';

const PROMPT = `Eres un lector de tickets de supermercado españoles.
Devuelve SOLO un objeto JSON, sin texto alrededor y sin bloques de código markdown.

Formato:
{"items":[{"name":"...","qty":1,"price":1.23}]}

Reglas:
- Una entrada por producto alimentario comprado.
- "name": el nombre del alimento desarrollado en español claro y en minúsculas.
  Expande las abreviaturas: "PECH.POLLO FIL" -> "filete de pechuga de pollo",
  "AC.OLIVA V.EXTRA" -> "aceite de oliva virgen extra", "LECHE SEMI" -> "leche semidesnatada".
- "qty": unidades compradas. Si el ticket va a peso, pon 1.
- "price": importe total de esa línea en euros, o null si no se lee.
- NO incluyas: totales, IVA, formas de pago, descuentos, bolsas, ni productos
  que no sean comida o bebida (limpieza, higiene, menaje).
- Si una línea no se lee con seguridad, omítela.`;

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') {
      return json({ error: 'Usa POST' }, 405, cors);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'Falta ANTHROPIC_API_KEY en las variables del Worker' }, 500, cors);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400, cors); }
    const image = body.image;
    const mediaType = body.media_type || 'image/jpeg';
    if (!image || typeof image !== 'string') return json({ error: 'Falta el campo image (base64)' }, 400, cors);
    if (image.length > 9_000_000) return json({ error: 'Imagen demasiado grande' }, 413, cors);

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: PROMPT }
          ]
        }]
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      return json({ error: 'La API ha respondido ' + r.status, detail: txt.slice(0, 300) }, 502, cors);
    }

    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { return json({ error: 'No he podido interpretar la respuesta', raw: clean.slice(0, 300) }, 502, cors); }

    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return json({ items }, 200, cors);
  }
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors }
  });
}
