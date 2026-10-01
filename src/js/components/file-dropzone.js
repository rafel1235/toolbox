import { handleFile } from '../core/file-handler.js';

export function initDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const fileInfoPanel = document.getElementById('file-info');
    const fileNameDisplay = document.getElementById('file-name');
    const fileSizeDisplay = document.getElementById('file-size');
    const filePagesDisplay = document.getElementById('file-pages');

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) processFile(event.target.files[0]);
    });

    dropzone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

    dropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropzone.classList.remove('dragover');
        if (event.dataTransfer.files.length > 0) processFile(event.dataTransfer.files[0]);
    });

    // Modificata in async per attendere la lettura del file
    async function processFile(file) {
        // Mostriamo un feedback di caricamento
        fileInfoPanel.style.display = 'block';
        fileNameDisplay.textContent = `Caricamento di ${file.name} in corso...`;
        fileSizeDisplay.textContent = '';
        filePagesDisplay.textContent = '';

        const fileData = await handleFile(file);
        
        if (fileData) {
            // Aggiorniamo la UI con i dati reali
            fileNameDisplay.textContent = `Nome: ${fileData.name}`;
            fileSizeDisplay.textContent = `Dimensione: ${fileData.size}`;
            filePagesDisplay.textContent = `Numero di pagine: ${fileData.pageCount}`;
            
            console.log("Documento pronto per essere modificato:", fileData.pdfDocument);
        } else {
            fileInfoPanel.style.display = 'none'; // Nascondi se c'è stato un errore
        }
    }
}