// Logica per estrarre pagine da un PDF

export async function extractPages(originalPdfDoc, startPage, endPage) {
    // Creiamo un nuovo documento PDF vuoto
    const newPdf = await PDFLib.PDFDocument.create();
    
    // Creiamo un array con gli indici delle pagine da estrarre (pdf-lib usa indici partendo da 0)
    const pagesToExtract = [];
    for (let i = startPage - 1; i <= endPage - 1; i++) {
        pagesToExtract.push(i);
    }
    
    // Copiamo le pagine dal documento originale
    const copiedPages = await newPdf.copyPages(originalPdfDoc, pagesToExtract);
    
    // Aggiungiamo le pagine copiate al nuovo documento
    copiedPages.forEach((page) => {
        newPdf.addPage(page);
    });
    
    // Salviamo il nuovo PDF in un array di byte
    const pdfBytes = await newPdf.save();
    return pdfBytes;
}