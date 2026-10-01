import { handleFile } from '../core/file-handler.js';
import { extractPages } from '../tools/extract/extract.js';
import { downloadPdf } from '../core/download.js';

export function initDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const fileInfoPanel = document.getElementById('file-info');
    const fileNameDisplay = document.getElementById('file-name');
    const fileSizeDisplay = document.getElementById('file-size');
    const filePagesDisplay = document.getElementById('file-pages');
    
    // Nuovi elementi UI
    const toolsSection = document.getElementById('tools-section');
    const startPageInput = document.getElementById('start-page');
    const endPageInput = document.getElementById('end-page');
    const btnExtract = document.getElementById('btn-extract');

    let currentPdfDocument = null;
    let currentFileName = "";

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

    async function processFile(file) {
        fileInfoPanel.style.display = 'block';
        toolsSection.style.display = 'none'; // Nascondi strumenti finché non è pronto
        fileNameDisplay.textContent = `Caricamento di ${file.name} in corso...`;
        fileSizeDisplay.textContent = '';
        filePagesDisplay.textContent = '';

        const fileData = await handleFile(file);
        
        if (fileData) {
            currentPdfDocument = fileData.pdfDocument;
            currentFileName = fileData.name;

            fileNameDisplay.textContent = `Nome: ${fileData.name}`;
            fileSizeDisplay.textContent = `Dimensione: ${fileData.size}`;
            filePagesDisplay.textContent = `Numero di pagine: ${fileData.pageCount}`;
            
            // Imposta i limiti degli input numerici
            endPageInput.value = fileData.pageCount;
            endPageInput.max = fileData.pageCount;
            startPageInput.max = fileData.pageCount;

            // Mostra la sezione strumenti
            toolsSection.style.display = 'block';
        } else {
            fileInfoPanel.style.display = 'none';
        }
    }

    // Gestione click sul pulsante "Estrai e Scarica"
    btnExtract.addEventListener('click', async () => {
        if (!currentPdfDocument) return;

        const start = parseInt(startPageInput.value);
        const end = parseInt(endPageInput.value);

        if (start > end || start < 1 || end > endPageInput.max) {
            alert("Intervallo di pagine non valido!");
            return;
        }

        btnExtract.textContent = "Elaborazione...";
        btnExtract.disabled = true;

        try {
            // Eseguiamo l'estrazione
            const newPdfBytes = await extractPages(currentPdfDocument, start, end);
            
            // Scarichiamo il file
            const newName = `estratto_${start}-${end}_${currentFileName}`;
            downloadPdf(newPdfBytes, newName);
            
        } catch (error) {
            console.error(error);
            alert("Errore durante l'estrazione.");
        } finally {
            btnExtract.textContent = "Estrai e Scarica";
            btnExtract.disabled = false;
        }
    });
}