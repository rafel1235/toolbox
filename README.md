# PrivatePDF

Toolbox PDF gratuito, in italiano, eseguito nel browser. Primo modulo di PrivateFiles EU.

## Avvio

Richiede Node.js 22.13 o superiore (consigliato Node.js 24). Il database usa SQLite integrato in Node, senza dipendenze backend da installare. Le librerie browser e i modelli OCR sono già inclusi in `src/vendor`, con versioni e integrità registrate in `manifest.json`.

```sh
npm start
```

Aprire `http://127.0.0.1:4173`. Non aprire `index.html` tramite `file://`: moduli JavaScript e worker richiedono un server HTTP. Il server incluso serve frontend e API account. Un hosting solo statico permette il toolbox, ma non registrazione, accesso o dashboard. Il server non accetta upload di documenti.

## Account e dashboard

Dal menu **Crea account** si registra un account gratuito con nome, email e password (12-128 caratteri). La registrazione apre automaticamente la dashboard; **Accedi** ripristina la sessione di un account esistente. Il toolbox rimane disponibile senza account.

La dashboard mostra profilo, contatori, ultime 20 attività e collegamenti al toolbox. Sono disponibili modifica del nome, cambio password, logout e cancellazione della cronologia con conferma. Cambiare password revoca tutte le sessioni. La cronologia registra solo tipo e data delle operazioni concluse mentre si è connessi; non contiene PDF, nomi dei file o password dei documenti. I dettagli scadono dopo 90 giorni; il contatore totale rimane fino alla cancellazione manuale della cronologia. Non è un registro di audit certificato: gli eventi sono comunicati dal browser.

Utenti e sessioni persistono in `data/privatepdf.sqlite`, escluso da Git e fuori dalla directory pubblica. Le password account vengono memorizzate con scrypt (N=32768, r=8, p=3) e salt casuale. I token casuali delle sessioni hanno scadenza assoluta di 7 giorni e vengono salvati nel database solo come hash SHA-256; i cookie sono HttpOnly e SameSite=Lax. Le API di modifica verificano origine e token CSRF. Accesso, registrazione e cambio password hanno limiti di tentativi; i limiti in memoria si azzerano al riavvio e valgono per una singola istanza. Il cambio password richiede quella attuale.

Verifica email, recupero password via email, MFA e accesso social non sono ancora integrati: non è configurato un servizio di posta. Il controllo dell’indirizzo email non viene verificato. Per questa fase, conservare la password: non è disponibile un reset autonomo se viene dimenticata.

### Configurazione del server

- `PORT`: porta HTTP, predefinita 4173.
- `HOST`: indirizzo di ascolto, predefinito `127.0.0.1`; per un container usare `0.0.0.0`.
- `DATABASE_PATH`: percorso del database SQLite; predefinito `data/privatepdf.sqlite`. In hosting usare un volume persistente, accessibile solo al servizio.
- `PUBLIC_ORIGIN`: origine pubblica esatta, senza slash finale, per esempio `https://pdf.example.eu`.
- `NODE_ENV=production`: rende i cookie Secure e richiede `PUBLIC_ORIGIN` HTTPS. Terminare TLS sul server o sul reverse proxy e inoltrare `/api/` allo stesso backend. Il server non si fida di `X-Forwarded-For`; configurare anche limiti sul proxy prima di un lancio pubblico.

Per provare in locale bastano `npm start`, la registrazione di un account e una prima operazione nel toolbox. Non sono presenti credenziali demo o account predefiniti.

## Funzioni

- Unione PDF e conversione di immagini JPG/PNG in PDF, con coda riordinabile.
- Divisione in ZIP, estrazione, duplicazione, eliminazione, rotazione e riordino delle pagine.
- Anteprime e selezione visuale; riordino anche con Alt + frecce sinistra/destra.
- Rimozione metadati Info, XMP e PieceInfo, compresi oggetti rimasti orfani.
- Watermark, numerazione e appiattimento dei moduli.
- Password PDF AES-256, permessi opzionali e rimozione password dopo apertura autorizzata.
- Ottimizzazione senza perdita e compressione JPEG con rasterizzazione esplicita.
- Esportazione PDF in PNG raccolti in ZIP.
- OCR locale italiano/inglese: ZIP con testo, PDF di ciascuna pagina e documento ricercabile completo.
- Oscuramento permanente: selezione di rettangoli su più pagine e generazione di un PDF nuovo di immagini.
- Batch per metadati, compressione, watermark, password, numerazione e moduli; report degli errori nello ZIP.

Ogni azione scarica una copia. Per applicare altre modifiche al risultato, aggiungerlo alla coda e selezionarlo. I PDF e le immagini possono convivere nella sessione: l'unione usa i PDF e la conversione usa le immagini, rispettando l'ordine della coda.

## Privacy e limiti

I documenti e le loro password restano in memoria nella pagina. Nessun upload, analytics di terze parti, pubblicità o salvataggio persistente dei documenti. Se si crea un account, nome, email, hash della password e cronologia minima vengono salvati sul server. OCR carica worker, WebAssembly e modelli dallo stesso sito; la cache dei modelli in IndexedDB è disabilitata. Il normale hosting può registrare richieste di risorse e indirizzi IP: la modalità locale non elimina i log infrastrutturali dell'hosting.

Limiti preventivi: 50 file, 200 MB per file, 500 MB complessivi; il dispositivo può esaurire memoria anche sotto questi limiti. Le pagine raster sono limitate a 16 milioni di pixel ciascuna. I processi lunghi mostrano avanzamento; chiudere la pagina li interrompe.

L'oscuramento ricostruisce **tutte** le pagine dai pixel renderizzati e non copia testo, allegati, moduli, annotazioni o livelli originali. Le aree nere vengono applicate prima di incorporare l'immagine PNG. Si perdono testo selezionabile, firme e interattività. Il contenuto visibile fuori dalle aree selezionate rimane: verificare sempre il risultato.

La pulizia metadati non anonimizza testo, commenti o allegati. La compressione JPEG perde testo selezionabile, link e moduli; viene rifiutata se non riduce la dimensione. L'ottimizzazione senza perdita restituisce l'originale se non riesce a ridurlo. I permessi PDF non impediscono a tutti i lettori di stampare o copiare. Qualsiasi modifica può invalidare firme digitali.

Conversioni Office, OCR avanzato di tabelle, API, confronto documenti e processing cloud sono evoluzioni successive. Transfer, Request, Vault, Rooms e Sign sono moduli separati, non implementati qui. Questa versione non dichiara certificazioni o conformità legale automatica.

## Verifica

```sh
npm test
npm install
npm run test:browser
```

I test browser usano Microsoft Edge installato, in modalità headless. Impostare `PRIVATEPDF_BROWSER_CHANNEL=chrome` per Chrome. Per Chromium Playwright: installare il browser e impostare il canale `chromium`. I test generano PDF sintetici e verificano download, cifratura/decrittazione, oscuramento, OCR reale, batch, layout mobile e assenza di richieste a host esterni. Verificano anche registrazione, accesso, dashboard, cronologia senza nomi dei file, profilo, cambio password e logout. I test backend controllano isolamento tra utenti, persistenza dopo riavvio, scadenza/revoca sessioni, CSRF, limiti di tentativi e hash nel database. Gli artefatti di verifica sono in `test-results/` e non vengono versionati; i test non creano utenti nel database normale dell’app.

Per rigenerare le librerie serve Python e accesso a Internet: `python scripts/vendor.py`. Le tarball npm sono controllate rispetto all'integrità SHA-512 del registro. Le licenze dei componenti sono incluse nelle rispettive cartelle. Per un hosting diverso, replicare gli header CSP definiti in `scripts/serve.mjs` e servire `.wasm` come `application/wasm`.
