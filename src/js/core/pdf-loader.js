// Questo modulo si occupa esclusivamente di interagire con la libreria pdf-lib

export async function loadPdf(file) {
    try {
        // Legge il file come array di byte (necessario per pdf-lib)
        const arrayBuffer = await file.arrayBuffer();
        
        // Carica il documento tramite la libreria globale PDFLib (importata in index.html)
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        
        // Estraiamo alcune informazioni utili
        const pageCount = pdfDoc.getPageCount();
        
        return {
            document: pdfDoc,
            pageCount: pageCount
        };
    } catch (error) {
        console.error("Errore durante il parsing del PDF:", error);
        throw new Error("Impossibile leggere il file PDF. Potrebbe essere corrotto o protetto da password.");
    }
}