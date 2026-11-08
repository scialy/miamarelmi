# miamarelmi

Gioco «מי אמר אל מי?» — https://miamarelmi.com

## Pagine per Google (SEO)

Le cartelle `he/`, `it/`, `en/`, `sitemap.xml`, `robots.txt` e `404.html` sono **generate automaticamente** dai dati del gioco in `index.html`: una pagina per ogni versetto, massima di Pirkè Avot e versetto di Tehillim, in tre lingue.

Dopo ogni modifica a `index.html` (nuove domande, nuova versione dall'artifact) rilancia:

```
node seo/build.js
```

Lo script aggiorna anche il blocco `<!--SEO:start-->…<!--SEO:end-->` nell'`<head>` di `index.html` (titolo, descrizione, dati strutturati, Umami) e i link in fondo alla pagina. Non modificare a mano questi blocchi e le cartelle generate.
