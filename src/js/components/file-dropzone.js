import { handleFile } from '../core/file-handler.js';
import { downloadPdf } from '../core/download.js';
import { extractPages } from '../tools/extract/extract.js';
import { deletePages } from '../tools/delete-pages/delete-pages.js';
import { rotatePages } from '../tools/rotate/rotate.js';

export function initDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const fileInfoPanel = document.getElementById('file-info');
    
    // UI Dettagli
    const fileNameDisplay = document.getElementById('file-name');
    const fileSizeDisplay = document.getElementById('file-size');
    const filePagesDisplay = document.getElementById('file-pages');
    const toolsSection = document.getElementById('tools-section');

    // UI Tools
    const btnExtract = document.getElementById('btn-extract');
    const btnDelete = document.getElementById('btn-delete');
    const btnRotate = document.getElementById('btn-rotate');

    let currentOriginalFile = null; // Manteniamo il file fisico originale
    let maxPages = 0;

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) processFile(event.target.files[0]);
    });

    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
    });

    async function processFile(file) {
        currentOriginalFile = file;
        fileInfoPanel.style.display = 'block';
        toolsSection.style.display = 'none';
        fileNameDisplay.textContent = `Caricamento di ${file.name} in corso...`;
        
        const fileData = await handleFile(file);
        
        if (fileData) {
            maxPages = fileData.pageCount;
            fileNameDisplay.textContent = `Nome: ${fileData.name}`;
            fileSizeDisplay.textContent = `Dimensione: ${fileData.size}`;
            filePagesDisplay.textContent = `Numero di pagine: ${maxPages}`;
            
            document.getElementById('end-page').value = maxPages;
            document.getElementById('end-page').max = maxPages;
            document.getElementById('start-page').max = maxPages;
            document.getElementById('rotate-page').max = maxPages;

            toolsSection.style.display = 'block';
        }
    }

    // Funzione helper per ottenere una copia fresca del PDF ogni volta che si clicca un tool
    async function getFreshPdfDocument() {
        const data = await handleFile(currentOriginalFile);
        return data.pdfDocument;
    }

    // --- TOOL: ESTRAI ---
    btnExtract.addEventListener('click', async () => {
        const start = parseInt(document.getElementById('start-page').value);
        const end = parseInt(document.getElementById('end-page').value);
        if (start > end || start < 1 || end > maxPages) return alert("Intervallo non valido!");

        btnExtract.textContent = "...";
        try {
            const freshDoc = await getFreshPdfDocument();
            const newPdfBytes = await extractPages(freshDoc, start, end);
            downloadPdf(newPdfBytes, `estratto_${currentOriginalFile.name}`);
        } catch (error) { alert("Errore estrazione."); } 
        finally { btnExtract.textContent = "Estrai"; }
    });

    // --- TOOL: ELIMINA ---
    btnDelete.addEventListener('click', async () => {
        const input = document.getElementById('delete-pages').value;
        // Trasformiamo la stringa "1, 3, 5" in un array di numeri
        const pagesArray = input.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n >= 1 && n <= maxPages);
        
        if (pagesArray.length === 0) return alert("Inserisci numeri di pagina validi separati da virgola.");
        if (pagesArray.length >= maxPages) return alert("Non puoi eliminare tutte le pagine dal PDF!");

        btnDelete.textContent = "...";
        try {
            const freshDoc = await getFreshPdfDocument();
            const newPdfBytes = await deletePages(freshDoc, pagesArray);
            downloadPdf(newPdfBytes, `modificato_${currentOriginalFile.name}`);
        } catch (error) { alert("Errore eliminazione."); } 
        finally { btnDelete.textContent = "Elimina"; }
    });

    // --- TOOL: RUOTA ---
    btnRotate.addEventListener('click', async () => {
        const degrees = parseInt(document.getElementById('rotate-degrees').value);
        const pageInput = document.getElementById('rotate-page').value;
        const targetPage = pageInput ? parseInt(pageInput) : null;

        if (targetPage !== null && (targetPage < 1 || targetPage > maxPages)) {
            return alert("Pagina da ruotare non valida.");
        }

        btnRotate.textContent = "...";
        try {
            const freshDoc = await getFreshPdfDocument();
            const newPdfBytes = await rotatePages(freshDoc, degrees, targetPage);
            downloadPdf(newPdfBytes, `ruotato_${currentOriginalFile.name}`);
        } catch (error) { alert("Errore rotazione."); } 
        finally { btnRotate.textContent = "Ruota"; }
    });
}