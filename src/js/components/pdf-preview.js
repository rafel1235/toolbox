// Genera un'anteprima visiva della prima pagina del PDF

export async function renderPdfPreview(file) {
    const canvas = document.getElementById('pdf-preview-canvas');
    const context = canvas.getContext('2d');
    const previewContainer = document.getElementById('pdf-preview-container');
    
    try {
        // Mostriamo il contenitore
        previewContainer.style.display = 'block';
        
        const arrayBuffer = await file.arrayBuffer();
        
        // pdf.js richiede l'ArrayBuffer del file
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        // Estraiamo la prima pagina
        const page = await pdf.getPage(1);
        
        // Calcoliamo la scala per creare una miniatura (larghezza fissa a 250px)
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = 250 / unscaledViewport.width;
        const viewport = page.getViewport({ scale: scale });
        
        // Impostiamo le dimensioni del canvas
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Renderizziamo la pagina sul canvas
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
    } catch (error) {
        console.error("Errore durante la generazione dell'anteprima:", error);
        previewContainer.style.display = 'none'; // Nascondi se fallisce
    }
}