// Logica per dividere un PDF in file separati (uno per pagina) e creare un file ZIP

export async function splitPdf(originalPdfDoc, originalFileName) {
    // Inizializziamo un nuovo archivio ZIP (utilizzando la libreria globale JSZip)
    const zip = new JSZip();
    const totalPages = originalPdfDoc.getPageCount();
    
    // Rimuoviamo l'estensione .pdf per usarla nei nomi dei nuovi file
    const baseName = originalFileName.replace(/\.[^/.]+$/, "");

    for (let i = 0; i < totalPages; i++) {
        // Creiamo un nuovo documento PDF vuoto per questa singola pagina
        const singlePagePdf = await PDFLib.PDFDocument.create();
        
        // Copiamo solo la pagina corrente (pdf-lib usa l'indice a partire da 0)
        const [copiedPage] = await singlePagePdf.copyPages(originalPdfDoc, [i]);
        singlePagePdf.addPage(copiedPage);
        
        // Salviamo il file in byte
        const pdfBytes = await singlePagePdf.save();
        
        // Aggiungiamo il file all'archivio ZIP con un nome numerato in sequenza
        zip.file(`${baseName}_pagina_${i + 1}.pdf`, pdfBytes);
    }

    // Generiamo l'archivio ZIP finale sotto forma di Blob (file virtuale)
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return zipBlob;
}