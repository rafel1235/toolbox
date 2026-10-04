// Gestisce il download dei file generati localmente nel browser

export function downloadPdf(pdfBytes, filename) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, filename); // Riutilizziamo la nuova funzione qui sotto
}

// Nuova funzione per scaricare direttamente un Blob (es. file ZIP)
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Pulizia
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
