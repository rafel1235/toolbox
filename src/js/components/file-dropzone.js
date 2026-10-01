import { handleFile } from '../core/file-handler.js';
import { downloadPdf } from '../core/download.js';
import { extractPages } from '../tools/extract/extract.js';
import { deletePages } from '../tools/delete-pages/delete-pages.js';
import { rotatePages } from '../tools/rotate/rotate.js';
import { mergePdfs } from '../tools/merge/merge.js';

export function initDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    
    // UI Singolo File
    const fileInfoPanel = document.getElementById('file-info');
    const fileNameDisplay = document.getElementById('file-name');
    const fileSizeDisplay = document.getElementById('file-size');
    const filePagesDisplay = document.getElementById('file-pages');
    
    // UI Multi File
    const multiFileInfo = document.getElementById('multi-file-info');
    const fileListUi = document.getElementById('file-list-ui');
    
    // Bottoni
    const btnExtract = document.getElementById('btn-extract');
    const btnDelete = document.getElementById('btn-delete');
    const btnRotate = document.getElementById('btn-rotate');
    const btnMerge = document.getElementById('btn-merge');
    const btnClear = document.getElementById('btn-clear');

    let currentOriginalFiles = []; // Array per contenere tutti i file fisici caricati
    let maxPages = 0;

    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) processFiles(Array.from(event.target.files));
    });

    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) processFiles(Array.from(e.dataTransfer.files));
    });

    async function processFiles(newFiles) {
        // Aggiungiamo i nuovi file all'array globale
        currentOriginalFiles = [...currentOriginalFiles, ...newFiles];

        if (currentOriginalFiles.length === 1) {
            // LOGICA SINGOLO FILE
            multiFileInfo.style.display = 'none';
            fileInfoPanel.style.display = 'block';
            
            const file = currentOriginalFiles[0];
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
            }
        } else if (currentOriginalFiles.length > 1) {
            // LOGICA FILE MULTIPLI (Merge)
            fileInfoPanel.style.display = 'none';
            multiFileInfo.style.display = 'block';
            
            // Aggiorniamo la lista visuale
            fileListUi.innerHTML = '';
            currentOriginalFiles.forEach((f, index) => {
                const li = document.createElement('li');
                li.textContent = `${index + 1}. ${f.name}`;
                fileListUi.appendChild(li);
            });
        }
    }

    async function getFreshPdfDocument(file) {
        const data = await handleFile(file);
        return data.pdfDocument;
    }

    // --- TOOL: MERGE ---
    btnMerge.addEventListener('click', async () => {
        btnMerge.textContent = "Unione in corso...";
        btnMerge.disabled = true;
        
        try {
            // 1. Convertiamo tutti i file fisici in documenti pdf-lib elaborati
            const pdfDocuments = [];
            for (const file of currentOriginalFiles) {
                const doc = await getFreshPdfDocument(file);
                pdfDocuments.push(doc);
            }
            
            // 2. Uniamo i documenti
            const mergedBytes = await mergePdfs(pdfDocuments);
            
            // 3. Scarichiamo il risultato
            downloadPdf(mergedBytes, 'PDF_Toolbox_Unito.pdf');
        } catch (error) {
            console.error(error);
            alert("Errore durante l'unione dei PDF.");
        } finally {
            btnMerge.textContent = "Unisci tutti i PDF";
            btnMerge.disabled = false;
        }
    });

    // --- TOOL: SVUOTA CODA ---
    btnClear.addEventListener('click', () => {
        currentOriginalFiles = [];
        fileInput.value = ""; // Resetta l'input file
        multiFileInfo.style.display = 'none';
        fileInfoPanel.style.display = 'none';
    });

    // --- TOOLS SINGOLO FILE (Estrai, Elimina, Ruota) ---
    // (Stesso codice precedente, adattato per usare currentOriginalFiles[0])
    btnExtract.addEventListener('click', async () => {
        const start = parseInt(document.getElementById('start-page').value);
        const end = parseInt(document.getElementById('end-page').value);
        if (start > end || start < 1 || end > maxPages) return alert("Intervallo non valido!");

        btnExtract.textContent = "...";
        try {
            const freshDoc = await getFreshPdfDocument(currentOriginalFiles[0]);
            const newPdfBytes = await extractPages(freshDoc, start, end);
            downloadPdf(newPdfBytes, `estratto_${currentOriginalFiles[0].name}`);
        } catch (error) { alert("Errore estrazione."); } 
        finally { btnExtract.textContent = "Estrai"; }
    });

    btnDelete.addEventListener('click', async () => {
        const input = document.getElementById('delete-pages').value;
        const pagesArray = input.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n >= 1 && n <= maxPages);
        
        if (pagesArray.length === 0) return alert("Inserisci numeri validi.");
        if (pagesArray.length >= maxPages) return alert("Non puoi eliminare tutte le pagine!");

        btnDelete.textContent = "...";
        try {
            const freshDoc = await getFreshPdfDocument(currentOriginalFiles[0]);
            const newPdfBytes = await deletePages(freshDoc, pagesArray);
            downloadPdf(newPdfBytes, `modificato_${currentOriginalFiles[0].name}`);
        } catch (error) { alert("Errore eliminazione."); } 
        finally { btnDelete.textContent = "Elimina"; }
    });

    btnRotate.addEventListener('click', async () => {
        const degrees = parseInt(document.getElementById('rotate-degrees').value);
        const pageInput = document.getElementById('rotate-page').value;
        const targetPage = pageInput ? parseInt(pageInput) : null;

        btnRotate.textContent = "...";
        try {
            const freshDoc = await getFreshPdfDocument(currentOriginalFiles[0]);
            const newPdfBytes = await rotatePages(freshDoc, degrees, targetPage);
            downloadPdf(newPdfBytes, `ruotato_${currentOriginalFiles[0].name}`);
        } catch (error) { alert("Errore rotazione."); } 
        finally { btnRotate.textContent = "Ruota"; }
    });
}