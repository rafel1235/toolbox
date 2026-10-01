// Logica per ruotare le pagine di un PDF

export async function rotatePages(originalPdfDoc, degrees, targetPage = null) {
    const pages = originalPdfDoc.getPages();
    const { degrees: pdfDegrees } = PDFLib; // Recuperiamo la funzione gradi da pdf-lib

    if (targetPage !== null) {
        // Ruota solo una pagina specifica (targetPage usa base 1)
        const index = targetPage - 1;
        if (index >= 0 && index < pages.length) {
            const currentRotation = pages[index].getRotation().angle;
            pages[index].setRotation(pdfDegrees(currentRotation + degrees));
        }
    } else {
        // Ruota tutte le pagine
        pages.forEach(page => {
            const currentRotation = page.getRotation().angle;
            page.setRotation(pdfDegrees(currentRotation + degrees));
        });
    }

    const pdfBytes = await originalPdfDoc.save();
    return pdfBytes;
}