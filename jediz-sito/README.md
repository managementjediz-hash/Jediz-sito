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
  i18n/           traduzioni: en.json, es.json, fr.json, pt-br.json
assets/         font, immagini, PDF (assets/docs), audio (assets/audio)
src/            CSS e JS del sito
admin/          pannello di gestione (facoltativo)
build.mjs       generatore
```

Pagine: `/` · `/musica/` · `/live/` · `/video/` · `/archivio/` · `/cinema/` · `/testi/` · `/foto/` · `/bio/` · `/contatti/` · `404`.
Il generatore produce anche `sitemap.xml`, `robots.txt`, meta Open Graph, dati strutturati (artista, album, concerti) e `_headers` per la cache.

## Dove sta il sito

- Repository: `github.com/managementjediz-hash/Jediz-sito` (i file sono nella cartella `jediz-sito/`).
- Hosting: Cloudflare Pages — root directory `jediz-sito`, build `node build.mjs`, output `dist`. Ogni modifica su `main` pubblica il sito da sola. Netlify (progetto `sitodijediz`) resta solo per il login del pannello, con i build fermati.
- Immagini: dopo averne aggiunte di nuove, `node build.mjs && sh tools/resize.sh` crea le versioni leggere in `assets/_r/` (serve ImageMagick). Senza, il sito usa l'originale: caricare foto già leggere (sotto 500 KB).
- Foto stampa: le versioni per i giornali (lato lungo 3000 px) stanno in `assets/docs/foto-stampa/`, con lo stesso nome della foto del sito; il PDF JDZ/06 rimanda a quei file.
- Pannello: `/admin`, accesso con GitHub (OAuth App "Jediz sito" installata in Netlify → Access & security → OAuth).

## Aggiornare i contenuti

Due modi, a scelta.

**1. Pannello `/admin` (senza toccare file).** Entrare da `jedizmusic.com/admin` con l'account GitHub `managementjediz-hash`. Ogni salvataggio aggiorna il sito in circa un minuto. Il login usa una OAuth App di GitHub collegata a Netlify (Site configuration → Access & security → OAuth).

**2. Modificando i JSON.** Aprire il file in `content/`, cambiare il testo, salvare, pubblicare (commit su GitHub se il sito è collegato, oppure `node build.mjs` e caricare `dist/`).

Esempi:
- **Nuova data**: in `live.json` aggiungere un blocco in `dates` con `date` (AAAA-MM-GG), `time`, `venue`, `city`, `ticket_url`. Il giorno dopo il concerto la data passa da sola tra le "passate" al build successivo; nel frattempo il browser la nasconde comunque dalla home.
- **Nuovo video**: in `videos.json` aggiungere `title`, `category`, `date`, `youtube` (solo l'ID, es. `dQw4w9WgXcQ`). Il video si carica solo quando qualcuno preme play: la pagina resta leggera e YouTube non traccia chi non guarda.
- **Nuovo PDF**: copiare il file in `assets/docs/`, poi in `documents.json` compilare `file` (es. `assets/docs/jediz-cinema.pdf`), `version`, `date`, `pages`. Un'immagine di anteprima (`thumb`) è facoltativa: senza, il sito disegna una copertina tipografica.
- **Brani nel player**: mettere gli mp3 in `assets/audio/` e compilare `audio` in `releases.json`. Finché `audio` è vuoto il player usa l'anteprima di 30 secondi.

**Segnaposto.** Ogni campo vuoto compare sul sito come un'etichetta blu tratteggiata "da inserire". Prima della messa online non ne deve restare nessuno visibile.

## Cose da completare

- [x] Dominio `jedizmusic.com` su Cloudflare Registrar, collegato a Cloudflare Pages (anche `www`)
- [x] `www.jedizmusic.com` rimanda a `jedizmusic.com` (Cloudflare → Rules → Redirect Rules, 301)
- [x] Scheda tecnica live (JDZ/05): tre setup, da 16 a 32 canali
- [x] Foto stampa (JDZ/06): 32 foto in sei serie (Ferramosca, Jacinto, Luzi, Facchinetti), anche nella pagina Foto, in home e in bio. Le foto di Facchinetti sono editate sul look degli shooting di Ferramosca
- [x] PDF della bio (JDZ/04)
- [ ] Making of: caricare le clip per ciascun disco (Video → categoria "Making of")
- [ ] Video Instagram/Facebook: aggiungere una "Miniatura" (Instagram non dà l'anteprima da solo)
- [ ] Email per Booking, Press, Collaborazioni, Generale (`site.json`), link YouTube e TikTok
- [x] Cinema: documentario in Messico → Conquer the Jungle (Iker Cimadevilla, Mendigo Films, 2027)
- [ ] Crediti album mancanti (mix e master, copertina)
- [ ] Date del tour estivo 2026 (`live.json`)

**Novità in home:** in Media, spuntare "In home, tra le Novità" sulle uscite da mettere in evidenza (compaiono le 4 più recenti).

## Lingue

Il sito è in italiano (alla radice) e in inglese, spagnolo, francese e portoghese brasiliano: `/en/`, `/es/`, `/fr/`, `/pt-br/`. Il selettore di lingua è in alto a destra e in fondo a ogni pagina; ogni pagina indica a Google le sue versioni tradotte (`hreflang`, anche nella sitemap).

- Si scrive sempre in italiano, nei file di `content/` o dal pannello. `node build.mjs` genera da solo tutte e cinque le lingue.
- Le traduzioni stanno in `content/i18n/<lingua>.json`. La chiave è il **testo italiano esatto**, il valore è la traduzione. `ui` = testi fissi del sito (menu, pulsanti, titoli di sezione); `content` = testi dei file in `content/` (bio, descrizioni, note, intro).
- Se un testo italiano cambia o se ne aggiunge uno nuovo, finché non c'è la traduzione quella frase compare in italiano anche nelle altre lingue. Il build lo segnala ("N testi senza traduzione") e scrive l'elenco in `.i18n-mancanti-<lingua>.txt`: basta aggiungere quelle frasi al dizionario.
- Restano in italiano, di proposito: i testi dei brani, i titoli dei brani e degli articoli, i PDF dell'archivio (le pagine lo dicono).

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
