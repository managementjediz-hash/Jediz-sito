# JEDIZ — sito ufficiale

Sito statico, senza framework e senza dipendenze. I contenuti stanno in `content/*.json`; un piccolo script (`build.mjs`) genera le pagine HTML in `dist/`.

## Struttura

```
content/        ← i contenuti (è l'unica cartella da toccare di solito)
  site.json       nome, frase in home, social, contatti, indirizzo del sito
  releases.json   discografia e brani del player
  live.json       date (prossime e passate si dividono da sole) e formazione
  videos.json     video (basta l'ID YouTube)
  documents.json  archivio PDF e rassegna stampa
  cinema.json     lavori per il cinema
  texts.json      testi, estratti
  photos.json     foto
  bio.json        bio breve ed estesa
assets/         font, immagini, PDF (assets/docs), audio (assets/audio)
src/            CSS e JS del sito
admin/          pannello di gestione (facoltativo)
build.mjs       generatore
```

Pagine: `/` · `/musica/` · `/live/` · `/video/` · `/archivio/` · `/cinema/` · `/testi/` · `/foto/` · `/bio/` · `/contatti/` · `404`.
Il generatore produce anche `sitemap.xml`, `robots.txt`, meta Open Graph, dati strutturati (artista, album, concerti) e `_headers` per la cache.

## Dove sta il sito

- Repository: `github.com/managementjediz-hash/Jediz-sito` (i file sono nella cartella `jediz-sito/`).
- Hosting: Netlify, progetto `venerable-bunny-587ab2` — base directory `jediz-sito`, build `node build.mjs`, publish `jediz-sito/dist`. Ogni modifica su `main` pubblica il sito da sola.
- Pannello: `/admin`, accesso con GitHub (OAuth App "Jediz sito" installata in Netlify → Access & security → OAuth).

## Aggiornare i contenuti

Due modi, a scelta.

**1. Pannello `/admin` (senza toccare file).** Entrare da `www.dominio.it/admin` con l'account GitHub `managementjediz-hash`. Ogni salvataggio aggiorna il sito in circa un minuto. Il login usa una OAuth App di GitHub collegata a Netlify (Site configuration → Access & security → OAuth).

**2. Modificando i JSON.** Aprire il file in `content/`, cambiare il testo, salvare, pubblicare (commit su GitHub se il sito è collegato, oppure `node build.mjs` e caricare `dist/`).

Esempi:
- **Nuova data**: in `live.json` aggiungere un blocco in `dates` con `date` (AAAA-MM-GG), `time`, `venue`, `city`, `ticket_url`. Il giorno dopo il concerto la data passa da sola tra le "passate" al build successivo; nel frattempo il browser la nasconde comunque dalla home.
- **Nuovo video**: in `videos.json` aggiungere `title`, `category`, `date`, `youtube` (solo l'ID, es. `dQw4w9WgXcQ`). Il video si carica solo quando qualcuno preme play: la pagina resta leggera e YouTube non traccia chi non guarda.
- **Nuovo PDF**: copiare il file in `assets/docs/`, poi in `documents.json` compilare `file` (es. `assets/docs/jediz-cinema.pdf`), `version`, `date`, `pages`. Un'immagine di anteprima (`thumb`) è facoltativa: senza, il sito disegna una copertina tipografica.
- **Brani nel player**: mettere gli mp3 in `assets/audio/` e compilare `audio` in `releases.json`. Finché `audio` è vuoto il player usa l'anteprima di 30 secondi.

**Segnaposto.** Ogni campo vuoto compare sul sito come un'etichetta blu tratteggiata "da inserire". Prima della messa online non ne deve restare nessuno visibile.

## Cose da completare prima della pubblicazione

- [ ] Dominio definitivo in `site.json` → `url`
- [ ] Email per Booking, Press, Collaborazioni, Generale (`site.json`)
- [ ] Link YouTube e TikTok (`site.json`)
- [ ] Link biglietti per il 27.09 (`live.json`)
- [ ] I tre PDF: Jediz, Jediz per il cinema, I testi di Jediz; più Bio (`assets/docs/` + `documents.json`)
- [ ] Copertina dell'album in locale (`assets/img/covers/`) al posto del link Apple
- [ ] Audio completo o scelta di restare sulle anteprime
- [ ] Crediti album mancanti (mix e master, copertina)
- [ ] Estratti dei testi, foto, video
- [ ] Rileggere la bio (`bio.json`): è una bozza scritta solo con fatti verificati
- [ ] Straordinaria: confermare se aggiungere "presentato alla Biennale di Venezia" (riportato da RomaToday)
- [ ] Date del tour estivo 2026 (`live.json`)

## Sviluppo

```
node build.mjs              # genera dist/
node build.mjs --preview    # versione piatta con CSS/JS in linea (per anteprime)
npm run serve               # genera e serve su http://localhost:8080
```

Richiede Node 18 o superiore. Nessun `npm install`.

## Scelte tecniche

- **Font in locale** (Bodoni Moda, Archivo, IBM Plex Mono, ~220 KB in totale, i due principali precaricati): niente richieste a Google, più veloce e più pulito lato GDPR.
- **Player proprio** con `<audio>`: nessun widget esterno, stile coerente, si ferma e riprende; un mini-player compare in basso quando si scorre la pagina. Spotify e Apple Music restano a un clic.
- **Due registri visivi**: pagine "carta" (archivio, bio, testi, contatti) e pagine "sala" (musica, live, video, cinema, foto). La dualità Elia/Jediz sta nell'alternanza, nella colonna di metadati a sinistra.
- **Nessun numero di stream o follower** in nessuna pagina.

## Hosting consigliato

Netlify (file `netlify.toml` già pronto) o Cloudflare Pages: collegare il repository, comando di build `node build.mjs`, cartella `dist`. Entrambi gratuiti per un sito di queste dimensioni.
