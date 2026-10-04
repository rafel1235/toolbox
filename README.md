# PrivatePDF

Toolbox PDF gratuito, in italiano, eseguito nel browser. Primo modulo di PrivateFiles EU.

## Avvio

Richiede Node.js 18 o superiore. Le librerie browser e i modelli OCR sono già inclusi in `src/vendor`, con versioni e integrità registrate in `manifest.json`.

```sh
npm start
```

Aprire `http://127.0.0.1:4173`. Non aprire `index.html` tramite `file://`: moduli JavaScript e worker richiedono un server HTTP. Si può pubblicare la cartella `src` su un hosting statico HTTPS. Il server incluso serve solo file statici e non accetta upload.

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

I documenti e le password restano in memoria nella pagina. Nessun upload, analytics, pubblicità o salvataggio persistente dei documenti. OCR carica worker, WebAssembly e modelli dallo stesso sito; la cache dei modelli in IndexedDB è disabilitata. Il normale hosting può registrare richieste di risorse e indirizzi IP: la modalità locale non elimina i log infrastrutturali dell'hosting.

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

I test browser usano Microsoft Edge installato, in modalità headless. Impostare `PRIVATEPDF_BROWSER_CHANNEL=chrome` per Chrome. Per Chromium Playwright: installare il browser e impostare il canale `chromium`. I test generano PDF sintetici e verificano download, cifratura/decrittazione, oscuramento, OCR reale, batch, layout mobile e assenza di richieste a host esterni. Gli artefatti di verifica sono in `test-results/` e non vengono versionati.

Per rigenerare le librerie serve Python e accesso a Internet: `python scripts/vendor.py`. Le tarball npm sono controllate rispetto all'integrità SHA-512 del registro. Le licenze dei componenti sono incluse nelle rispettive cartelle. Per un hosting diverso, replicare gli header CSP definiti in `scripts/serve.mjs` e servire `.wasm` come `application/wasm`.
