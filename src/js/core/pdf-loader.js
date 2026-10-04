import { pruneUnreachable } from '../tools/document-tools.js';

export async function loadPdf(file, password = '') {
    if (!globalThis.PDFLib) throw new Error('La libreria PDF non è disponibile. Ricarica la pagina.');
    try {
        const document = await PDFLib.PDFDocument.load(await file.arrayBuffer(), { password, updateMetadata: false });
        discardOldCrossReferences(document);
        if (!document.getPageCount()) throw new Error('PDF senza pagine.');
        return { document, pageCount: document.getPageCount() };
    } catch (error) {
        if (/password|encrypt/i.test(error.message)) throw new Error(`${file.name}: inserisci la password di apertura e seleziona di nuovo il file.`);
        throw new Error(`${file.name}: impossibile leggere il PDF. ${error.message}`);
    }
}

// Full rewrites generate a new xref. Old xref streams can retain obsolete Encrypt
// entries and confuse readers after decrypting, even when the new trailer is clean.
export function discardOldCrossReferences(doc) {
    for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
        if (['/XRef', '/ObjStm'].includes(object.dict?.get(PDFLib.PDFName.of('Type'))?.toString())) doc.context.delete(ref);
    }
    pruneUnreachable(doc);
}
