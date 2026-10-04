// Logica per convertire un set di immagini (JPG/PNG) in un unico PDF

export async function imagesToPdf(imageFiles) {
    // Creiamo un nuovo documento PDF vuoto
    const pdfDoc = await PDFLib.PDFDocument.create();
    
    for (const file of imageFiles) {
        // Leggiamo i byte dell'immagine
        const imageBytes = await file.arrayBuffer();
        let pdfImage;
        
        // Incorporiamo l'immagine nel PDF in base al formato
        if (file.type === 'image/jpeg' || file.type === 'image/jpg' || /\.jpe?g$/i.test(file.name)) {
            pdfImage = await pdfDoc.embedJpg(imageBytes);
        } else if (file.type === 'image/png' || /\.png$/i.test(file.name)) {
            pdfImage = await pdfDoc.embedPng(imageBytes);
        } else {
            throw new Error(`Formato immagine non supportato: ${file.name}`);
        }
        
        // Otteniamo le dimensioni dell'immagine
        const { width, height } = pdfImage.scale(1);
        
        // Aggiungiamo una pagina con le stesse identiche dimensioni dell'immagine
        const page = pdfDoc.addPage([width, height]);
        
        // Disegniamo l'immagine in modo che copra l'intera pagina (partendo dalle coordinate 0,0 in basso a sinistra)
        page.drawImage(pdfImage, {
            x: 0,
            y: 0,
            width: width,
            height: height,
        });
    }
    
    // Salviamo e restituiamo il documento PDF completo
    return await pdfDoc.save();
}
