// Every operation receives a fresh document. Originals are never overwritten.
export function cleanMetadata(doc) {
    const { PDFName, PDFDict } = PDFLib;
    const info = doc.context.lookup(doc.context.trailerInfo.Info);
    if (info instanceof PDFDict) for (const key of info.keys()) info.delete(key);
    for (const [, object] of doc.context.enumerateIndirectObjects()) {
        const dict = object instanceof PDFDict ? object : object?.dict;
        if (dict instanceof PDFDict) {
            dict.delete(PDFName.of('Metadata'));
            dict.delete(PDFName.of('PieceInfo'));
        }
    }
    // Remove unreachable old Info/XMP objects too, by serializing only the reachable graph.
    pruneUnreachable(doc);
    return doc;
}

export function pruneUnreachable(doc) {
    const { PDFRef, PDFDict, PDFArray } = PDFLib;
    const visited = new Set(), seen = new Set();
    function visit(object) {
        if (!object) return;
        if (object instanceof PDFRef) {
            const key = object.toString();
            if (visited.has(key)) return;
            visited.add(key);
            visit(doc.context.lookup(object));
            return;
        }
        if (seen.has(object)) return;
        seen.add(object);
        const dict = object instanceof PDFDict ? object : object.dict;
        if (dict instanceof PDFDict) for (const [, value] of dict.entries()) visit(value);
        if (object instanceof PDFArray) for (const value of object.asArray()) visit(value);
    }
    Object.values(doc.context.trailerInfo).forEach(visit);
    for (const [ref] of doc.context.enumerateIndirectObjects()) if (!visited.has(ref.toString())) doc.context.delete(ref);
}

export async function watermark(doc, text, pages, opacity = 0.25) {
    if (!text.trim()) throw new Error('Inserisci il testo del watermark.');
    const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    try { font.encodeText(text); } catch { throw new Error('Il watermark supporta caratteri latini.'); }
    for (const number of pages) {
        const page = doc.getPage(number - 1), { width, height } = page.getSize();
        const size = Math.min(42, width * 0.72 / font.widthOfTextAtSize(text, 1));
        page.drawText(text, { x: width * 0.15, y: height * 0.4, size, font, rotate: PDFLib.degrees(30), opacity, color: PDFLib.rgb(0.2, 0.25, 0.35) });
    }
    return doc.save();
}

export async function protect(doc, password, restrict) {
    if (password.length < 8) throw new Error('Usa una password di almeno 8 caratteri.');
    const ownerPassword = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    doc.encrypt({ userPassword: password, ownerPassword, algorithm: 'AES-256', permissions: {
        printing: restrict ? false : 'highResolution', copying: !restrict, modifying: !restrict, annotating: !restrict,
        fillingForms: !restrict, documentAssembly: !restrict, contentAccessibility: true,
    } });
    return doc.save();
}

export async function flatten(doc) {
    doc.getForm().flatten();
    return doc.save();
}

export async function numberPages(doc, start) {
    if (!Number.isInteger(start) || start < 1) throw new Error('Il numero iniziale deve essere un intero positivo.');
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    doc.getPages().forEach((page, index) => {
        const text = String(start + index);
        page.drawText(text, { x: (page.getWidth() - font.widthOfTextAtSize(text, 11)) / 2, y: 18, font, size: 11 });
    });
    return doc.save();
}
