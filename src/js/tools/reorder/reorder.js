// Logica per riordinare le pagine di un PDF

export async function reorderPages(originalPdfDoc, newOrderArray) {
    // Creiamo un nuovo documento vuoto
    const newPdf = await PDFLib.PDFDocument.create();
    
    // newOrderArray contiene i numeri di pagina in base 1 (es. [3, 1, 2])
    for (const pageNum of newOrderArray) {
        // pdf-lib usa l'indice a partire da 0, quindi sottraiamo 1
        const index = pageNum - 1;
        
        // Copiamo la singola pagina e la aggiungiamo al nuovo documento
        const [copiedPage] = await newPdf.copyPages(originalPdfDoc, [index]);
        newPdf.addPage(copiedPage);
    }
    
    // Salviamo e restituiamo il nuovo file
    return await newPdf.save();
}