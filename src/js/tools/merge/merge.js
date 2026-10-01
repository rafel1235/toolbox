// Logica per unire più file PDF in uno solo

export async function mergePdfs(pdfDocuments) {
    // Creiamo un nuovo documento PDF vuoto che farà da "contenitore"
    const mergedPdf = await PDFLib.PDFDocument.create();
    
    // Cicliamo su tutti i documenti caricati dall'utente
    for (const pdfDoc of pdfDocuments) {
        // Otteniamo l'elenco di tutte le pagine del documento corrente
        const pageIndices = pdfDoc.getPageIndices();
        
        // Copiamo tutte le pagine dal documento originale al nuovo contenitore
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices);
        
        // Aggiungiamo fisicamente le pagine copiate
        copiedPages.forEach((page) => {
            mergedPdf.addPage(page);
        });
    }
    
    // Salviamo il risultato finale in byte
    const pdfBytes = await mergedPdf.save();
    return pdfBytes;
}