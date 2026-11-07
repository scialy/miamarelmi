// Contatore anonimo delle partite: nessun cookie, nessun IP salvato.
const TIPI = new Set(["inizio", "fine"]);
const clip = (v, n = 20) => (v == null ? null : String(v).slice(0, n));
const num = (v) => (Number.isFinite(+v) ? Math.round(+v * 10) / 10 : null);

export async function onRequestPost({ request, env }) {
  try {
    const d = await request.json();
    if (!TIPI.has(d.tipo)) return new Response(null, { status: 400 });
    await env.DB.prepare(
      "INSERT INTO eventi (tipo, sezione, modalita, livello, lingua, punteggio, totale, paese) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(
      d.tipo, clip(d.sezione), clip(d.modalita), clip(d.livello, 5), clip(d.lingua, 5),
      num(d.punteggio), num(d.totale), clip(request.cf && request.cf.country, 2)
    ).run();
    return new Response(null, { status: 204 });
  } catch (e) {
    return new Response(null, { status: 400 });
  }
}
