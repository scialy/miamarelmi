// Genera le pagine SEO di miamarelmi.com a partire dai dati del gioco in index.html.
// Uso:  node seo/build.js      (dalla cartella del repository)
// Rigenera: /he/ /it/ /en/ + una pagina per ogni versetto/massima, sitemap.xml, robots.txt, 404.html
// e aggiorna il blocco <!--SEO--> nell'<head> di index.html. Da rilanciare dopo ogni modifica ai dati del gioco.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const SITE = "https://miamarelmi.com";
const TODAY = new Date().toISOString().slice(0, 10);
let H = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* ---------- 1. Estrazione dati dal gioco ---------- */
function bal(j) {
  const open = H[j], close = { "[": "]", "{": "}", "(": ")" }[open]; let d = 0, s = null;
  for (let p = j; p < H.length; p++) {
    const c = H[p];
    if (s) { if (c === "\\") { p++; continue } if (c === s) s = null; continue }
    if (c === '"' || c === "'" || c === "`") { s = c; continue }
    if (c === "/" && H[p + 1] === "*") { p = H.indexOf("*/", p) + 1; continue }
    if (c === open) d++; else if (c === close) { d--; if (!d) return H.slice(j, p + 1) }
  }
}
const lit = n => { const k = `const ${n}=`; return new Function("return " + bal(H.indexOf(k) + k.length))() };
const Q = lit("Q"), TR = lit("TR"), NAMES = lit("NAMES"), BOOKS = lit("BOOKS"), AV = lit("AV"), TH = lit("TH");
for (let i = 0; (i = H.indexOf("Q.push(", i)) >= 0; i += 7) {
  try { Q.push(...new Function("return [" + bal(i + 6).slice(1, -1) + "]")().flat().filter(x => x && x.v)) } catch (e) { }
}
{ const i = H.indexOf("TR.push("); if (i >= 0) TR.push(...new Function("return " + bal(i + 7).slice(1, -1).replace(/^\s*\.\.\./, ""))()) }
for (let i = 0; (i = H.indexOf("Object.assign(NAMES,", i)) >= 0; i += 10) Object.assign(NAMES, new Function("return " + bal(i + 20))());
Object.assign(BOOKS, { "ויקרא": ["Levitico", "Leviticus"], "דברים": ["Deuteronomio", "Deuteronomy"], "אבות": ["Pirkè Avot", "Pirkei Avot"], "תהלים": ["Salmi", "Psalms"] });
if (TR.length !== Q.length) throw new Error(`Traduzioni (${TR.length}) e domande (${Q.length}) non allineate`);

/* ---------- 2. Utilità ---------- */
const LANGS = ["he", "it", "en"], LI = { it: 0, en: 1 };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const q2 = s => String(s).replace(/[?？]\s*$/, "");
const plain = s => String(s).replace(/[\u0591-\u05C7]/g, "").replace(/[,;:.]+$/, "").trim();
const GEM = { "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6, "ז": 7, "ח": 8, "ט": 9, "י": 10, "כ": 20, "ל": 30, "מ": 40, "נ": 50, "ס": 60, "ע": 70, "פ": 80, "צ": 90, "ק": 100 };
const gem = s => [...s].reduce((a, c) => a + (GEM[c] || 0), 0);
const bookOf = src => src.replace(/ \S+, \S+$/, "");
function SRC(src, L) {
  if (L === "he") return src;
  const m = src.match(/^(.+) (\S+), (\S+)$/); if (!m) return src;
  const b = BOOKS[m[1]] ? BOOKS[m[1]][LI[L]] : m[1];
  const book = m[1] === "תהלים" ? (L === "it" ? "Salmo" : "Psalm") : b;
  return `${book} ${gem(m[2])}:${gem(m[3])}`;
}
const NM = (n, L) => L === "he" ? n : (NAMES[n] ? NAMES[n][LI[L]] : n);
const clip = (s, n) => { s = String(s).replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)) + "…" };
const slugify = s => String(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[’'`]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 8).join("-");

/* ---------- 3. Elementi (versetti e massime) ---------- */
const used = new Set();
const uniq = s => { let k = s || "pasuk", n = 2; while (used.has(k)) k = `${s}-${n++}`; used.add(k); return k };
const ITEMS = [];
Q.forEach((q, i) => {
  const t = TR[i];
  ITEMS.push({
    kind: "q", src: q.src, book: bookOf(q.src), who: q.who, to: q.to, he: q.v,
    tr: { it: t[1], en: t[2] }, ctx: { he: q.ctx, it: t[5], en: t[6] },
    slug: uniq(slugify(t[2]))
  });
});
for (const [arr, kind] of [[AV, "avot"], [TH, "tehillim"]]) arr.forEach(q => ITEMS.push({
  kind, src: q.src, book: bookOf(q.src), who: q.who, he: q.h + " " + q.a, heH: q.h, heA: q.a,
  tr: { it: q.it[0] + " " + q.it[1], en: q.en[0] + " " + q.en[1] }, ctx: { he: q.ctx, it: q.it[2], en: q.en[2] },
  slug: uniq((kind === "avot" ? "avot-" : "tehillim-") + slugify(q.en[0] + " " + q.en[1]).split("-").slice(0, 7).join("-"))
}));
ITEMS.forEach(it => { it.key = gem((it.src.match(/ (\S+), /) || [])[1] || "") * 1000 + gem((it.src.match(/, (\S+)$/) || [])[1] || "") });

/* ---------- 4. Testi ---------- */
const T = {
  he: {
    dir: "rtl", site: "מי אמר אל מי?", hubTitle: "מי אמר אל מי? (מי אמר למי) חידון תנ״ך לילדים ולכל המשפחה",
    hubH1: "מי אמר אל מי?", hubSub: "חידון תנ״ך חינמי לילדים, להורים ולמורים",
    hubDesc: "מי אמר למי? משחק חינמי ללימוד וחזרה על התנ״ך: שומעים פסוק ומנחשים מי אמר אותו ולמי. מתאים לגילאי 8–12 ולכל המשפחה. כולל חידונים על פרקי אבות ותהלים.",
    how: ["שומעים פסוק מהתנ״ך, בקריאה בקול", "מנחשים מי אמר אותו, ואל מי", "לומדים את הסיפור שמאחורי כל פסוק"],
    howT: "איך משחקים", play: "▶ לשחק עכשיו, בחינם", playSmall: "לשחק", all: "כל הפסוקים", count: n => `${n} פסוקים ומשניות`,
    secQ: "מי אמר אל מי? פסוקים מהתנ״ך", secAvot: "פרקי אבות: השלימו את המשנה", secTeh: "תהלים: השלימו את הפסוק",
    qTitle: it => `מי אמר "${plain(it.he)}"? (${it.src})`, qH1: it => `מי אמר "${plain(it.he)}"?`,
    qAns: it => `<b>${esc(it.who)}</b> אמר אל <b>${esc(it.to)}</b>`, qDesc: it => `${it.who} אמר אל ${it.to}: "${plain(it.he)}" (${it.src}). ${it.ctx.he}`,
    aTitle: it => `"${clip(plain(it.he), 60)}" – ${it.src}`, aH1: it => `"${plain(it.heH)} …"`, aQ: it => it.kind === "avot" ? "איך ממשיכה המשנה?" : "איך ממשיך הפסוק?",
    aAns: it => `${it.kind === "avot" ? "אמר" : "כתב"}: <b>${esc(it.who)}</b>`, aDesc: it => `"${plain(it.he)}" – ${it.src}, ${it.who}. ${it.ctx.he}`,
    who: "מי אמר?", to: "אל מי?", story: "הסיפור", source: "מקור", answer: "התשובה", more: "עוד פסוקים מאותו ספר",
    cta: "רוצים לנחש בעצמכם? במשחק שומעים את הפסוק ובוחרים מבין הדמויות.", home: "דף הבית", langs: "שפה",
    nf: "הדף לא נמצא", nfP: "אולי הפסוק עבר מקום. אפשר לחזור למשחק או לרשימת הפסוקים."
  },
  it: {
    dir: "ltr", site: "Chi l'ha detto a chi?", hubTitle: "Chi l'ha detto a chi? Gioco quiz sul Tanakh per bambini",
    hubH1: "Chi l'ha detto a chi?", hubSub: "Il gioco quiz gratuito sul Tanakh per bambini, famiglie e insegnanti",
    hubDesc: "Gioco gratuito per studiare e ripassare il Tanakh: ascolti un versetto della Bibbia ebraica e indovini chi l'ha detto e a chi. Per bambini 8–12 anni e famiglie. Con Pirkè Avot e Tehillim.",
    how: ["Ascolti un versetto del Tanakh, letto ad alta voce", "Indovini chi l'ha detto e a chi", "Scopri la storia dietro ogni versetto"],
    howT: "Come si gioca", play: "▶ Gioca ora, gratis", playSmall: "Gioca", all: "Tutti i versetti", count: n => `${n} versetti e massime`,
    secQ: "Chi l'ha detto a chi? Versetti del Tanakh", secAvot: "Pirkè Avot: completa la massima", secTeh: "Tehillim (Salmi): completa il versetto",
    qTitle: it => `Chi ha detto «${q2(clip(it.tr.it, 70))}»? (${SRC(it.src, "it")})`, qH1: it => `Chi ha detto «${q2(it.tr.it)}»?`,
    qAns: it => `Lo dice <b>${esc(NM(it.who, "it"))}</b> a <b>${esc(NM(it.to, "it"))}</b>`, qDesc: it => `Lo dice ${NM(it.who, "it")} a ${NM(it.to, "it")} (${SRC(it.src, "it")}). ${it.ctx.it}`,
    aTitle: it => `«${clip(it.tr.it, 70)}» – ${SRC(it.src, "it")}`, aH1: it => `«${it.tr.it}»`, aQ: it => it.kind === "avot" ? "Come finisce la massima?" : "Come continua il versetto?",
    aAns: it => `${it.kind === "avot" ? "Insegnamento di" : "Salmo di"} <b>${esc(NM(it.who, "it"))}</b>`, aDesc: it => `«${it.tr.it}» (${SRC(it.src, "it")}), ${NM(it.who, "it")}. ${it.ctx.it}`,
    who: "Chi l'ha detto?", to: "A chi?", story: "La storia", source: "Fonte", answer: "La risposta", more: "Altri versetti dello stesso libro",
    cta: "Vuoi provare a indovinare? Nel gioco ascolti il versetto e scegli tra i personaggi.", home: "Home", langs: "Lingua",
    nf: "Pagina non trovata", nfP: "Forse il versetto è stato spostato. Torna al gioco o all'elenco dei versetti."
  },
  en: {
    dir: "ltr", site: "Who Said It to Whom?", hubTitle: "Who Said It to Whom? A Tanakh Bible Trivia Game for Kids",
    hubH1: "Who Said It to Whom?", hubSub: "A free Tanakh (Hebrew Bible) trivia game for kids, families and teachers",
    hubDesc: "Free game to learn and review the Tanakh: hear a verse from the Hebrew Bible and guess who said it, and to whom. For kids aged 8–12 and families. Includes Pirkei Avot and Psalms.",
    how: ["Hear a verse from the Tanakh, read aloud", "Guess who said it, and to whom", "Learn the story behind every verse"],
    howT: "How to play", play: "▶ Play now, free", playSmall: "Play", all: "All verses", count: n => `${n} verses and sayings`,
    secQ: "Who said it to whom? Verses from the Tanakh", secAvot: "Pirkei Avot: complete the saying", secTeh: "Psalms (Tehillim): complete the verse",
    qTitle: it => `Who said "${q2(clip(it.tr.en, 70))}"? (${SRC(it.src, "en")})`, qH1: it => `Who said "${q2(it.tr.en)}"?`,
    qAns: it => `<b>${esc(NM(it.who, "en"))}</b> said it to <b>${esc(NM(it.to, "en"))}</b>`, qDesc: it => `${NM(it.who, "en")} said it to ${NM(it.to, "en")} (${SRC(it.src, "en")}). ${it.ctx.en}`,
    aTitle: it => `"${clip(it.tr.en, 70)}" – ${SRC(it.src, "en")}`, aH1: it => `"${it.tr.en}"`, aQ: it => it.kind === "avot" ? "How does the saying end?" : "How does the verse continue?",
    aAns: it => `${it.kind === "avot" ? "Teaching of" : "Psalm of"} <b>${esc(NM(it.who, "en"))}</b>`, aDesc: it => `"${it.tr.en}" (${SRC(it.src, "en")}), ${NM(it.who, "en")}. ${it.ctx.en}`,
    who: "Who said it?", to: "To whom?", story: "The story", source: "Source", answer: "The answer", more: "More verses from the same book",
    cta: "Want to guess for yourself? In the game you hear the verse and pick from the characters.", home: "Home", langs: "Language",
    nf: "Page not found", nfP: "The verse may have moved. Go back to the game or to the list of verses."
  }
};
const LANG_NAME = { he: "עברית", it: "Italiano", en: "English" };
const OG_LOCALE = { he: "he_IL", it: "it_IT", en: "en_US" };

/* ---------- 5. Template ---------- */
const url = (L, slug) => `${SITE}/${L}/${slug ? slug + "/" : ""}`;
const alts = slug => LANGS.map(L => `<link rel="alternate" hreflang="${L}" href="${url(L, slug)}">`).join("") +
  `<link rel="alternate" hreflang="x-default" href="${slug ? url("he", slug) : SITE + "/"}">`;
function page({ L, slug, title, desc, body, ld, ogType = "article" }) {
  const t = T[L], u = url(L, slug);
  return `<!doctype html>
<html lang="${L}" dir="${t.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(clip(desc, 158))}">
<link rel="canonical" href="${u}">${alts(slug)}
<meta property="og:type" content="${ogType}"><meta property="og:site_name" content="מי אמר אל מי?"><meta property="og:locale" content="${OG_LOCALE[L]}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(clip(desc, 200))}"><meta property="og:url" content="${u}">
<meta property="og:image" content="${SITE}/og-image.jpg"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ffcf9e"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Varela+Round&family=Frank+Ruhl+Libre:wght@700&display=swap">
<link rel="stylesheet" href="/seo.css">
<script defer src="https://cloud.umami.is/script.js" data-website-id="4d46f713-3144-4d6a-a287-a0431ccc8c59" data-domains="miamarelmi.com"></script>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head><body>
<header class="top"><a class="brand" href="/" data-lang="${L}" dir="rtl" lang="he">מי אמר אל מי?</a>
<nav class="langs" aria-label="${t.langs}">${LANGS.map(x => `<a href="/${x}/${slug ? slug + "/" : ""}" hreflang="${x}" lang="${x}"${x === L ? ' aria-current="true"' : ""}>${LANG_NAME[x]}</a>`).join("")}</nav></header>
<main>${body}</main>
<footer class="foot"><a href="/${L}/">${t.all}</a> · <a href="/" data-lang="${L}">${t.playSmall}</a> · <a href="/he/">עברית</a> · <a href="/it/">Italiano</a> · <a href="/en/">English</a></footer>
<script>document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[data-lang]");if(a)try{localStorage.setItem("mam-lang",a.dataset.lang)}catch(_){}});</script>
</body></html>`;
}
const crumbs = (L, items) => ({
  "@type": "BreadcrumbList", itemListElement: items.map(([name, u], i) => ({ "@type": "ListItem", position: i + 1, name, item: u }))
});
const playBtn = L => `<a class="play" href="/" data-lang="${L}">${T[L].play}</a>`;
const verseBox = (it, L) => `<figure class="verse"><blockquote lang="he" dir="rtl">${esc(it.he)}</blockquote>${L === "he" ? "" : `<figcaption>${esc(it.tr[L])}</figcaption>`}</figure>`;

function itemPage(it, L) {
  const t = T[L], q = it.kind === "q";
  const title = (q ? t.qTitle : t.aTitle)(it) + " | " + t.site;
  const desc = (q ? t.qDesc : t.aDesc)(it);
  const h1 = (q ? t.qH1 : t.aH1)(it);
  const ans = (q ? t.qAns : t.aAns)(it);
  const related = ITEMS.filter(x => x !== it && x.book === it.book && x.kind === it.kind)
    .sort((a, b) => Math.abs(a.key - it.key) - Math.abs(b.key - it.key)).slice(0, 6);
  const quest = q ? `<p class="ask">${t.who} ${t.to}</p>` : `<p class="ask">${t.aQ(it)}</p><p class="half" lang="he" dir="rtl">${esc(it.heH)} …</p>`;
  const body = `<nav class="crumbs"><a href="/${L}/">${t.site}</a> › <span>${esc(SRC(it.src, L))}</span></nav>
<h1>${esc(h1)}</h1>
${quest}
<details class="reveal" open><summary>${t.answer}</summary>${verseBox(it, L)}
<p class="ans">${ans}</p><p class="src">${t.source}: ${esc(SRC(it.src, L))}${L === "he" ? "" : ` · <span lang="he" dir="rtl">${esc(it.src)}</span>`}</p>
<h2>${t.story}</h2><p>${esc(it.ctx[L])}</p></details>
<section class="cta"><p>${t.cta}</p>${playBtn(L)}</section>
${related.length ? `<section><h2>${t.more}</h2><ul class="list">${related.map(r => li(r, L)).join("")}</ul></section>` : ""}`;
  const ld = {
    "@context": "https://schema.org", "@graph": [
      {
        "@type": "FAQPage", inLanguage: L, url: url(L, it.slug), name: h1,
        mainEntity: [{ "@type": "Question", name: h1, acceptedAnswer: { "@type": "Answer", text: desc.replace(/<[^>]+>/g, "") } }]
      },
      crumbs(L, [[t.site, url(L)], [SRC(it.src, L), url(L, it.slug)]])
    ]
  };
  return page({ L, slug: it.slug, title, desc, body, ld });
}
function li(it, L) {
  const label = L === "he" ? `"${clip(plain(it.he), 70)}"` : `«${clip(it.tr[L], 80)}»`;
  return `<li><a href="/${L}/${it.slug}/"><span>${esc(label)}</span><small>${esc(SRC(it.src, L))}</small></a></li>`;
}
function hubPage(L) {
  const t = T[L];
  const groups = [["q", t.secQ], ["avot", t.secAvot], ["tehillim", t.secTeh]].map(([k, name]) => {
    const its = ITEMS.filter(i => i.kind === k);
    const books = [...new Set(its.map(i => i.book))];
    return `<section><h2>${esc(name)}</h2>${books.map(b => {
      const bi = its.filter(i => i.book === b).sort((a, c) => a.key - c.key);
      return `<details${k === "q" && b === "בראשית" ? " open" : ""}><summary>${esc(L === "he" ? b : (BOOKS[b] || [b, b])[LI[L]])} <small>(${bi.length})</small></summary><ul class="list">${bi.map(i => li(i, L)).join("")}</ul></details>`;
    }).join("")}</section>`;
  }).join("");
  const body = `<section class="hero"><h1>${esc(t.hubH1)}</h1><p class="sub">${esc(t.hubSub)}</p>
<img src="/og-image.jpg" width="1456" height="839" alt="${esc(t.hubH1)}" class="shot">
<p>${esc(t.hubDesc)}</p>${playBtn(L)}</section>
<section><h2>${t.howT}</h2><ol class="how">${t.how.map(x => `<li>${esc(x)}</li>`).join("")}</ol><p class="count">${t.count(ITEMS.length)}</p></section>
${groups}`;
  const ld = {
    "@context": "https://schema.org", "@graph": [
      { "@type": "CollectionPage", name: t.hubTitle, inLanguage: L, url: url(L), description: t.hubDesc, isPartOf: { "@id": SITE + "/#game" } },
      crumbs(L, [[t.site, url(L)]])
    ]
  };
  return page({ L, slug: "", title: t.hubTitle, desc: t.hubDesc, body, ld, ogType: "website" });
}

/* ---------- 6. Scrittura ---------- */
const write = (rel, s) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s) };
for (const L of LANGS) fs.rmSync(path.join(ROOT, L), { recursive: true, force: true });
let n = 0;
for (const L of LANGS) {
  write(`${L}/index.html`, hubPage(L)); n++;
  for (const it of ITEMS) { write(`${L}/${it.slug}/index.html`, itemPage(it, L)); n++ }
}
// sitemap con alternative linguistiche
const entry = (loc, slug, pr) => `<url><loc>${loc}</loc><lastmod>${TODAY}</lastmod><priority>${pr}</priority>${slug === null ? "" : LANGS.map(L => `<xhtml:link rel="alternate" hreflang="${L}" href="${url(L, slug)}"/>`).join("")}</url>`;
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entry(SITE + "/", null, "1.0")}
${LANGS.map(L => entry(url(L), "", "0.9")).join("\n")}
${LANGS.flatMap(L => ITEMS.map(it => entry(url(L, it.slug), it.slug, "0.6"))).join("\n")}
</urlset>
`);
write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
write("404.html", page({
  L: "he", slug: "", title: "404 · מי אמר אל מי?", desc: T.he.nfP, ld: { "@context": "https://schema.org", "@type": "WebPage" },
  body: `<section class="hero"><h1>${T.he.nf}</h1><p>${T.he.nfP}</p><p lang="it" dir="ltr">${T.it.nf}. ${T.it.nfP}</p><p lang="en" dir="ltr">${T.en.nf}. ${T.en.nfP}</p>${playBtn("he")}</section>`
}).replace(/<link rel="canonical"[^>]*>(<link rel="alternate"[^>]*>)*/, '<meta name="robots" content="noindex">'));

/* ---------- 7. <head> della home ---------- */
const HEAD = `<!--SEO:start (generato da seo/build.js)-->
<title>מי אמר אל מי? (מי אמר למי) חידון תנ״ך לילדים · Gioco sul Tanakh · Bible trivia</title>
<meta name="description" content="מי אמר למי? משחק חינמי בתנ״ך: שומעים פסוק ומנחשים מי אמר אותו ולמי. לילדים, להורים ולמורים · Gioco gratuito sul Tanakh: chi l'ha detto a chi? · Free Tanakh trivia game for kids">
<link rel="canonical" href="${SITE}/">${alts("")}
<meta name="robots" content="max-image-preview:large">
<meta name="theme-color" content="#ffcf9e"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:site_name" content="מי אמר אל מי?">
<meta property="og:title" content="מי אמר אל מי?">
<meta property="og:description" content="משחק בתנ״ך לילדים ולהורים · Gioco sul Tanakh: chi l'ha detto a chi? · Tehillim · Pirkè Avot">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/">
<meta property="og:image" content="${SITE}/og-image.jpg">
<meta property="og:image:width" content="1456">
<meta property="og:image:height" content="839">
<meta property="og:image:alt" content="מי אמר אל מי? · מי אמר למי? · Chi l'ha detto a chi? · Who said it to whom?">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og-image.jpg">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org", "@graph": [
    { "@type": "WebSite", "@id": SITE + "/#site", url: SITE + "/", name: "מי אמר אל מי?", alternateName: ["מי אמר למי?", "Mi amar el mi", "Mi amar lemi", "Chi l'ha detto a chi?", "Who Said It to Whom?"], inLanguage: ["he", "it", "en"] },
    {
      "@type": ["VideoGame", "WebApplication"], "@id": SITE + "/#game", name: "מי אמר אל מי?", alternateName: ["מי אמר למי?", "Chi l'ha detto a chi?", "Who Said It to Whom?"],
      url: SITE + "/", image: SITE + "/og-image.jpg", description: T.he.hubDesc + " · " + T.en.hubDesc,
      applicationCategory: "EducationalApplication", genre: ["Trivia", "Educational"], operatingSystem: "Web", browserRequirements: "Requires JavaScript",
      inLanguage: ["he", "it", "en"], isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      audience: { "@type": "EducationalAudience", educationalRole: "student", audienceType: "Children 8-12 and families" },
      about: ["Tanakh", "Hebrew Bible", "Pirkei Avot", "Psalms"]
    }
  ]
}).replace(/</g, "\\u003c")}</script>
<script defer src="https://cloud.umami.is/script.js" data-website-id="4d46f713-3144-4d6a-a287-a0431ccc8c59" data-domains="miamarelmi.com"></script>
<!--SEO:end-->`;
// rimuove i vecchi tag finiti nel <body> (prima versione) e il blocco precedente
H = H.replace(/\n?<!--SEO:start[\s\S]*?<!--SEO:end-->\n?/, "");
H = H.replace(/<meta name="description"[^>]*>\n(?:<meta (?:property="og:|name="twitter:)[^>]*>\n)*<script defer src="https:\/\/cloud\.umami\.is\/script\.js"[^>]*><\/script>\n<title>[^<]*<\/title>\n/, "");
if (/<title>/.test(H)) throw new Error("Trovato un <title> non previsto in index.html: controlla prima di procedere");
H = H.replace(/^<!doctype html><html[^>]*><head>/i, '<!doctype html><html lang="he"><head>');
H = H.replace(/(<meta name=viewport[^>]*>)/, `$1\n${HEAD}\n`);
// link interni dalla home alle pagine SEO (fuori dall'app, in fondo alla pagina)
const FOOT = `<!--SEOFOOT:start--><footer class="seo-foot" style="position:relative;z-index:2;text-align:center;font:13px/1.6 var(--f-ui,sans-serif);margin:28px 0 0;opacity:.85"><a href="/he/" style="color:inherit">כל הפסוקים</a> · <a href="/it/" lang="it" style="color:inherit">Tutti i versetti</a> · <a href="/en/" lang="en" style="color:inherit">All verses</a></footer><!--SEOFOOT:end-->`;
H = H.replace(/\n?<!--SEOFOOT:start-->[\s\S]*?<!--SEOFOOT:end-->/, "");
H = H.replace('<main class="app" dir="rtl" lang="he" id="app"></main>', `<main class="app" dir="rtl" lang="he" id="app"></main>\n${FOOT}`);
// il gioco imposta document.title a «מי אמר אל מי?» all'avvio: all'apertura ripristina il titolo SEO (solo prima schermata)
const SEOTITLE = (HEAD.match(/<title>([^<]*)<\/title>/) || [])[1];
H = H.replace(/\n?<!--SEOTITLE-->[\s\S]*?<!--\/SEOTITLE-->/, "");
H = H.replace(/<\/body><\/html>\s*$/, `<!--SEOTITLE--><script>try{if(typeof LANG==="undefined"||LANG==="he")document.title=${JSON.stringify(SEOTITLE)}}catch(e){}</script><!--/SEOTITLE-->\n</body></html>\n`);
fs.writeFileSync(path.join(ROOT, "index.html"), H);
console.log(`Pagine generate: ${n} · elementi: ${ITEMS.length} (domande ${Q.length}, Avot ${AV.length}, Tehillim ${TH.length})`);
