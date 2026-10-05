import { loadPdf } from '../core/pdf-loader.js';
import { downloadPdf, downloadBlob } from '../core/download.js';
import { pageList, classifyFile } from '../core/validation.js';
import { mergePdfs } from '../tools/merge/merge.js';
import { splitPdf } from '../tools/split/split.js';
import { reorderPages } from '../tools/reorder/reorder.js';
import { deletePages } from '../tools/delete-pages/delete-pages.js';
import { rotatePages } from '../tools/rotate/rotate.js';
import { imagesToPdf } from '../tools/images-to-pdf/images-to-pdf.js';
import { cleanMetadata, watermark, protect, flatten, numberPages } from '../tools/document-tools.js';
import { rasterPdf, exportImages, ocr } from '../tools/raster-tools.js';
import { renderPageGrid, getSelectedPages, getCurrentOrder, resetPageGrid } from './page-grid.js';
import { initRedaction } from './redaction.js';
import { activityTypes } from '../core/activity-types.js';

const $ = id => document.getElementById(id);
export function initDropzone() {
    let files = [], active = null, busy = false;
    const passwords = new Map(), redactor = initRedaction();
    const status = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error', error); };
    const progress = message => status(`Elaborazione locale: ${message}`);
    const value = id => $(id).value;
    const fresh = async file => { if (!file) throw new Error('Seleziona un PDF.'); return (await loadPdf(file, passwords.get(file) || '')).document; };
    const selected = doc => pageList(value('tool-pages'), doc.getPageCount(), { all: true });

    async function run(action, success = 'Operazione completata. Il risultato è stato scaricato.', operation = null) {
        if (busy) return false;
        busy = true;
        const controls = [...document.querySelectorAll('button, input, select')], disabled = controls.map(control => control.disabled);
        controls.forEach(control => control.disabled = true);
        $('workspace').setAttribute('aria-busy', 'true');
        progress('in corso…');
        try {
            await action(); status(success);
            if (operation && Object.hasOwn(activityTypes, operation)) document.dispatchEvent(new CustomEvent('privatepdf:activity', { detail: { operation } }));
            return true;
        }
        catch (error) { status(error.message || 'Operazione non riuscita.', true); return false; }
        finally {
            controls.forEach((control, i) => { if (control.isConnected) control.disabled = disabled[i]; });
            busy = false; $('workspace').setAttribute('aria-busy', 'false');
        }
    }
    async function activate(file) {
        active = null; $('file-info').hidden = true;
        await resetPageGrid(); redactor.reset();
        if (!file || classifyFile(file) !== 'pdf') return;
        const doc = await fresh(file); active = file;
        $('file-info').hidden = false;
        $('file-name').textContent = file.name;
        $('file-size').textContent = `${(file.size / 1048576).toFixed(2)} MB`;
        $('file-pages').textContent = `${doc.getPageCount()} pagine`;
        $('end-page').value = doc.getPageCount();
        const metadata = { Titolo: doc.getTitle(), Autore: doc.getAuthor(), Oggetto: doc.getSubject(), Creatore: doc.getCreator(), Software: doc.getProducer(), ParoleChiave: doc.getKeywords() };
        $('metadata-info').textContent = Object.entries(metadata).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join('\n') || 'Nessun metadato descrittivo presente.';
        await renderPageGrid(file, 'pdf-page-grid', passwords.get(file) || '');
    }
    function renderQueue() {
        $('queue-panel').hidden = files.length === 0; $('queue-count').textContent = `${files.length} file nella sessione`;
        $('file-list-ui').replaceChildren();
        files.forEach((file, index) => {
            const li = document.createElement('li'), name = document.createElement('button');
            name.textContent = file.name; name.className = 'file-name-button'; name.disabled = classifyFile(file) !== 'pdf';
            name.addEventListener('click', () => run(() => activate(file), 'Documento pronto. Ogni operazione genera una copia.')); li.append(name);
            const move = direction => { [files[index], files[index + direction]] = [files[index + direction], files[index]]; renderQueue(); };
            const remove = async () => { passwords.delete(file); files.splice(index, 1); renderQueue(); if (active === file) await activate(files.find(f => classifyFile(f) === 'pdf')); };
            for (const [label, action, unavailable] of [['↑', () => move(-1), index === 0], ['↓', () => move(1), index === files.length - 1], ['Rimuovi', remove, false]]) {
                const button = document.createElement('button'); button.textContent = label; button.disabled = unavailable;
                button.className = 'queue-action'; button.setAttribute('aria-label', `${label} ${file.name}`);
                button.addEventListener('click', () => run(action, 'Coda aggiornata.')); li.append(button);
            }
            $('file-list-ui').append(li);
        });
    }
    async function addFiles(incoming) {
        await run(async () => {
            incoming.forEach(classifyFile);
            if (files.length + incoming.length > 50) throw new Error('Limite: 50 file per sessione.');
            if ([...files, ...incoming].reduce((sum, file) => sum + file.size, 0) > 500 * 1048576) throw new Error('Limite: 500 MB per sessione.');
            for (const file of incoming.filter(f => classifyFile(f) === 'pdf')) await loadPdf(file, value('open-password'));
            incoming.forEach(file => passwords.set(file, value('open-password')));
            files.push(...incoming); renderQueue();
            if (!active) await activate(files.find(f => classifyFile(f) === 'pdf'));
            $('open-password').value = '';
        }, 'File pronti. Ogni operazione genera una copia dell’originale.');
        $('file-input').value = '';
    }
    $('dropzone').addEventListener('click', event => { if (!busy && event.target !== $('file-input')) $('file-input').click(); });
    $('dropzone').addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); if (!busy) $('file-input').click(); } });
    $('file-input').addEventListener('change', event => addFiles([...event.target.files]));
    $('dropzone').addEventListener('dragover', event => { event.preventDefault(); if (!busy) $('dropzone').classList.add('dragover'); });
    $('dropzone').addEventListener('dragleave', () => $('dropzone').classList.remove('dragover'));
    $('dropzone').addEventListener('drop', event => { event.preventDefault(); $('dropzone').classList.remove('dragover'); if (!busy) addFiles([...event.dataTransfer.files]); });
    const bind = (id, action, success) => $(id).addEventListener('click', () => run(action, success, id));
    bind('btn-clear', async () => { files = []; passwords.clear(); await activate(null); renderQueue(); $('output-password').value = ''; $('open-password').value = ''; }, 'Sessione svuotata.');
    const operations = {
        metadata: async (file, doc) => cleanMetadata(doc).save(),
        watermark: async (file, doc) => watermark(doc, value('watermark-text'), selected(doc)),
        protect: async (file, doc) => protect(doc, value('output-password'), $('restrict-permissions').checked),
        unlock: async (file, doc) => doc.save(),
        flatten: async (file, doc) => flatten(doc),
        numbers: async (file, doc) => numberPages(doc, Number(value('number-start'))),
        compress: async (file, doc) => {
            if (value('compression-mode') === 'lossless') {
                const bytes = await doc.save({ useObjectStreams: true });
                return bytes.length < file.size ? bytes : new Uint8Array(await file.arrayBuffer());
            }
            const bytes = await rasterPdf(file, { password: passwords.get(file), quality: 0.65, scale: 1.3, progress });
            if (bytes.length >= file.size) throw new Error('La copia rasterizzata non è più piccola. Prova l’ottimizzazione senza perdita.');
            return bytes;
        },
    };
    document.querySelectorAll('[data-operation]').forEach(button => button.addEventListener('click', () => run(async () => {
        const file = active, operation = button.dataset.operation;
        downloadPdf(await operations[operation](file, await fresh(file)), `${operation}_${file.name}`);
        if (operation === 'protect') $('output-password').value = '';
    }, undefined, button.dataset.operation)));
    bind('btn-extract', async () => {
        const doc = await fresh(active), start = Number(value('start-page')), end = Number(value('end-page'));
        if (!Number.isInteger(start) || !Number.isInteger(end)) throw new Error('Inserisci un intervallo valido.');
        downloadPdf(await reorderPages(doc, pageList(`${start}-${end}`, doc.getPageCount())), `estratto_${active.name}`);
    });
    bind('btn-delete', async () => {
        const doc = await fresh(active), pages = pageList(value('delete-pages'), doc.getPageCount());
        if (pages.length === doc.getPageCount()) throw new Error('Deve restare almeno una pagina.');
        downloadPdf(await deletePages(doc, pages), `modificato_${active.name}`);
    });
    bind('btn-reorder', async () => {
        const doc = await fresh(active), pages = pageList(value('reorder-pages'), doc.getPageCount(), { unique: false });
        if (pages.length !== doc.getPageCount() || new Set(pages).size !== pages.length) throw new Error('Indica tutte le pagine una volta sola. Per duplicarle usa Estrai / duplica.');
        downloadPdf(await reorderPages(doc, pages), `riordinato_${active.name}`);
    });
    bind('btn-duplicate', async () => {
        const doc = await fresh(active);
        downloadPdf(await reorderPages(doc, pageList(value('duplicate-pages'), doc.getPageCount(), { unique: false })), `selezione_${active.name}`);
    });
    bind('btn-rotate', async () => {
        const doc = await fresh(active), pages = pageList(value('rotate-page'), doc.getPageCount(), { all: true });
        for (const page of pages) await rotatePages(doc, Number(value('rotate-degrees')), page);
        downloadPdf(await doc.save(), `ruotato_${active.name}`);
    });
    bind('btn-split', async () => downloadBlob(await splitPdf(await fresh(active), active.name), `diviso_${active.name}.zip`));
    bind('btn-visual-reorder', async () => downloadPdf(await reorderPages(await fresh(active), getCurrentOrder()), `riordinato_${active.name}`));
    bind('btn-visual-delete', async () => {
        const doc = await fresh(active), pages = getSelectedPages();
        if (!pages.length || pages.length === doc.getPageCount()) throw new Error('Seleziona alcune pagine, lasciandone almeno una.');
        downloadPdf(await deletePages(doc, pages), `modificato_${active.name}`);
    });
    bind('btn-merge', async () => {
        const pdfs = files.filter(f => classifyFile(f) === 'pdf');
        if (pdfs.length < 2) throw new Error('Aggiungi almeno due PDF.');
        const docs = []; for (const file of pdfs) docs.push(await fresh(file));
        downloadPdf(await mergePdfs(docs), 'PrivatePDF_unito.pdf');
    });
    bind('btn-images-to-pdf', async () => {
        const images = files.filter(f => classifyFile(f) === 'image');
        if (!images.length) throw new Error('Aggiungi un’immagine JPG o PNG.');
        downloadPdf(await imagesToPdf(images), 'PrivatePDF_immagini.pdf');
    });
    bind('btn-pdf-images', async () => { await fresh(active); downloadBlob(await exportImages(active, passwords.get(active), progress), 'pagine_png.zip'); });
    bind('btn-ocr', async () => { await fresh(active); downloadBlob(await ocr(active, passwords.get(active), value('ocr-language'), progress), 'PrivatePDF_OCR.zip'); });
    bind('btn-redact-open', async () => { await fresh(active); await redactor.open(active, passwords.get(active)); }, 'Trascina sulla pagina per selezionare le aree da oscurare.');
    bind('btn-redact-save', async () => {
        const rects = redactor.rectangles();
        if (!rects.length) throw new Error('Seleziona almeno un’area da oscurare.');
        downloadPdf(await rasterPdf(active, { password: passwords.get(active), scale: 2, redactions: rects, progress }), `oscurato_${active.name}`);
    });
    bind('btn-batch', async () => {
        const pdfs = files.filter(f => classifyFile(f) === 'pdf');
        if (!pdfs.length) throw new Error('Aggiungi almeno un PDF.');
        const zip = new JSZip(), errors = [], operation = value('batch-operation');
        for (const [index, file] of pdfs.entries()) {
            progress(`${index + 1} di ${pdfs.length}: ${file.name}`);
            try { zip.file(`${index + 1}_${operation}_${file.name}`, await operations[operation](file, await fresh(file))); }
            catch (error) { errors.push(`${file.name}: ${error.message}`); }
        }
        if (errors.length) zip.file('errori.txt', errors.join('\n'));
        downloadBlob(await zip.generateAsync({ type: 'blob' }), 'PrivatePDF_batch.zip');
        if (operation === 'protect') $('output-password').value = '';
    });
}
