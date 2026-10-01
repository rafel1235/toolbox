// Logica per rimuovere pagine specifiche da un PDF

export async function deletePages(originalPdfDoc, pagesToDelete) {
    // pagesToDelete è un array di numeri di pagina (es. [1, 3, 5]) basato su indice 1 (non zero)
    
    // Rimuoviamo i duplicati e ordiniamo in modo decrescente (dal più grande al più piccolo)
    // Questo è fondamentale: se rimuovi prima la pagina 1, la pagina 2 diventa la nuova pagina 1!
    const uniqueSortedPages = [...new Set(pagesToDelete)].sort((a, b) => b - a);
    
    const totalPages = originalPdfDoc.getPageCount();

    for (const pageNum of uniqueSortedPages) {
        // pdf-lib usa indici partendo da 0, quindi sottraiamo 1
        const index = pageNum - 1;
        
        // Controlliamo che l'indice esista
        if (index >= 0 && index < totalPages) {
            originalPdfDoc.removePage(index);
        }
    }
    
    // Salviamo il documento modificato in un array di byte
    const pdfBytes = await originalPdfDoc.save();
    return pdfBytes;
}