import { loadPdf } from './pdf-loader.js';

export async function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Errore: Per favore seleziona un file PDF valido.');
        return null;
    }

    const sizeInKB = (file.size / 1024).toFixed(2);
    let displaySize = `${sizeInKB} KB`;
    if (sizeInKB > 1024) {
        displaySize = `${(sizeInKB / 1024).toFixed(2)} MB`;
    }

    try {
        // Attendiamo che il PDF venga letto e processato da pdf-lib
        const pdfData = await loadPdf(file);
        
        return {
            name: file.name,
            size: displaySize,
            originalFile: file,
            pageCount: pdfData.pageCount,
            pdfDocument: pdfData.document // Questo è il documento pronto per lo split/merge!
        };
    } catch (error) {
        alert(error.message);
        return null;
    }
}