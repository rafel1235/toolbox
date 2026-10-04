export async function openRenderedPdf(file, password = '') {
    return pdfjsLib.getDocument({ data: await file.arrayBuffer(), password, cMapUrl: 'vendor/pdfjs-dist/cmaps/', cMapPacked: true, standardFontDataUrl: 'vendor/pdfjs-dist/standard_fonts/', isEvalSupported: false }).promise;
}

export async function renderPage(pdf, number, scale = 1.5) {
    const page = await pdf.getPage(number), base = page.getViewport({ scale: 1 });
    const safeScale = Math.min(scale, Math.sqrt(16000000 / (base.width * base.height)));
    const viewport = page.getViewport({ scale: safeScale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: 'white' }).promise;
    return { canvas, width: base.width, height: base.height };
}

export function canvasBlob(canvas, type = 'image/png', quality) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Impossibile convertire la pagina.')), type, quality));
}

export async function rasterPdf(file, { scale = 1.5, quality = 0.75, redactions = [], password = '', progress = () => {} } = {}) {
    const source = await openRenderedPdf(file, password), target = await PDFLib.PDFDocument.create();
    try {
        for (let i = 1; i <= source.numPages; i++) {
            progress(`Pagina ${i} di ${source.numPages}`);
            const { canvas, width, height } = await renderPage(source, i, scale);
            const context = canvas.getContext('2d');
            for (const rect of redactions.filter(r => r.page === i)) {
                context.fillStyle = '#000';
                const x = Math.floor(rect.x * canvas.width), y = Math.floor(rect.y * canvas.height);
                context.fillRect(x, y, Math.ceil((rect.x + rect.w) * canvas.width) - x, Math.ceil((rect.y + rect.h) * canvas.height) - y);
            }
            // Lossless PNG for redaction, JPEG for explicitly lossy compression.
            const blob = await canvasBlob(canvas, redactions.length ? 'image/png' : 'image/jpeg', quality);
            const image = redactions.length ? await target.embedPng(await blob.arrayBuffer()) : await target.embedJpg(await blob.arrayBuffer());
            target.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
            canvas.width = canvas.height = 0;
        }
        target.setProducer(''); target.setCreator('');
        cleanRasterMetadata(target);
        return target.save();
    } finally { await source.destroy(); }
}

function cleanRasterMetadata(doc) {
    const info = doc.context.lookup(doc.context.trailerInfo.Info);
    if (info) for (const key of info.keys()) info.delete(key);
}

export async function exportImages(file, password, progress) {
    const pdf = await openRenderedPdf(file, password), zip = new JSZip();
    try {
        for (let i = 1; i <= pdf.numPages; i++) {
            progress(`Pagina ${i} di ${pdf.numPages}`);
            const { canvas } = await renderPage(pdf, i);
            zip.file(`pagina-${String(i).padStart(3, '0')}.png`, await (await canvasBlob(canvas)).arrayBuffer());
            canvas.width = canvas.height = 0;
        }
        return zip.generateAsync({ type: 'blob' });
    } finally { await pdf.destroy(); }
}

export async function ocr(file, password, language, progress) {
    if (!globalThis.Tesseract) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script'); script.src = 'vendor/tesseract.js/dist/tesseract.min.js';
            script.onload = resolve; script.onerror = () => reject(new Error('Motore OCR non disponibile.'));
            document.head.append(script);
        });
    }
    const worker = await Tesseract.createWorker(language, 1, {
        workerPath: new URL('vendor/tesseract.js/dist/worker.min.js', document.baseURI).href,
        corePath: new URL('vendor/tesseract.js-core/', document.baseURI).href,
        langPath: new URL('vendor/tessdata/', document.baseURI).href,
        cacheMethod: 'none', logger: event => progress(`${event.status} ${Math.round((event.progress || 0) * 100)}%`),
    });
    let pdf;
    try {
        pdf = await openRenderedPdf(file, password);
        const zip = new JSZip(); let text = '';
        // Each OCR result includes its source image and searchable text layer.
        for (let i = 1; i <= pdf.numPages; i++) {
            const { canvas } = await renderPage(pdf, i, 2);
            const result = await worker.recognize(canvas, { pdfTitle: `Pagina ${i}`, pdfTextOnly: false }, { text: true, pdf: true });
            zip.file(`pagina-${String(i).padStart(3, '0')}.pdf`, result.data.pdf);
            text += `\n--- Pagina ${i} ---\n${result.data.text}`;
            canvas.width = canvas.height = 0;
        }
        zip.file('testo.txt', text);
        const target = await PDFLib.PDFDocument.create();
        for (const name of Object.keys(zip.files).filter(name => name.endsWith('.pdf'))) {
            const doc = await PDFLib.PDFDocument.load(await zip.file(name).async('uint8array'), { updateMetadata: false });
            (await target.copyPages(doc, doc.getPageIndices())).forEach(page => target.addPage(page));
        }
        zip.file('documento-ricercabile.pdf', await target.save());
        return zip.generateAsync({ type: 'blob' });
    } finally { await worker.terminate(); if (pdf) await pdf.destroy(); }
}
