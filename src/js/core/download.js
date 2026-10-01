// Gestisce il download dei file generati localmente nel browser

export function downloadPdf(pdfBytes, filename) {
    // Crea un Blob (file virtuale) dai byte del PDF
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    // Crea un URL temporaneo per il Blob
    const url = URL.createObjectURL(blob);
    
    // Crea un link nascosto, lo clicca e lo rimuove
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Pulizia
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}