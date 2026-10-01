import { handleFile } from '../core/file-handler.js';
import { downloadPdf, downloadBlob } from '../core/download.js';
import { extractPages } from '../tools/extract/extract.js';
import { deletePages } from '../tools/delete-pages/delete-pages.js';
import { rotatePages } from '../tools/rotate/rotate.js';
import { mergePdfs } from '../tools/merge/merge.js';
import { splitPdf } from '../tools/split/split.js';
import { reorderPages } from '../tools/reorder/reorder.js';
import { imagesToPdf } from '../tools/images-to-pdf/images-to-pdf.js';
import { renderPdfPreview } from './pdf-preview.js';

export function initDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    
    // UI Singolo File PDF
    const fileInfoPanel = document.getElementById('file-info');
    const fileNameDisplay = document.getElementById('file-name');
    const fileSizeDisplay = document.getElementById('file-size');
    const filePagesDisplay = document.getElementById('file-pages');
    
    // UI Multi File PDF
    const multiFileInfo = document.getElementById('multi-file-info');
    const fileListUi = document.getElementById('file-list-ui');

    // UI Immagini
    const imageInfoPanel = document.getElementById('image-info');
    const imageListUi = document.getElementById('image-list-ui');
    
    // Bottoni Tools
    const btnExtract = document.getElementById('btn-extract');
    const btnDelete = document.getElementById('btn-delete');
    const btnRotate = document.getElementById('btn-rotate');
    const btnMerge = document.getElementById('btn-merge');
    const btnSplit = document.getElementById('btn-split');
    const btnReorder = document.getElementById('btn-reorder');
    const btnImagesToPdf = document.getElementById('btn-images-to-pdf');
    
    // Bottoni di pulizia coda (ora multipli)
    const clearButtons = document.querySelectorAll('.btn-clear');

    let currentOriginalFiles = [];
    let maxPages = 0;

    // --- 1. EVENTI DROPZONE BASE ---
    dropzone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) processFiles(Array.from(event.target.files));
    });

    dropzone.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        dropzone.classList.add('dragover'); 
    });
    
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) processFiles(Array.from(e.dataTransfer.files));
    });

    // --- 2. GESTIONE FILE E TRANSIZIONI UI ---
    async function processFiles(newFiles) {
        currentOriginalFiles = [...currentOriginalFiles, ...newFiles];

        // Controlliamo se ci sono immagini nella coda
        const isImageMode = currentOriginalFiles.some(f => f.type.startsWith('image/'));

        // Nascondiamo tutti i pannelli
        fileInfoPanel.style.display = 'none';
        multiFileInfo.style.display = 'none';
        if (imageInfoPanel) imageInfoPanel.style.display = 'none';

        if (isImageMode) {
            // LOGICA IMMAGINI
            if (imageInfoPanel) imageInfoPanel.style.display = 'block';
            renderFileList(imageListUi);
        } else if (currentOriginalFiles.length === 1) {
            // LOGICA SINGOLO PDF
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

                // NUOVO: Disegniamo l'anteprima
                renderPdfPreview(file);
            }
        } else if (currentOriginalFiles.length > 1) {
            // LOGICA MULTI PDF (Merge)
            multiFileInfo.style.display = 'block';
            renderFileList(fileListUi);
        }
    }

    // --- 3. DRAG & DROP DELLA LISTA FILE (MERGE E IMMAGINI) ---
    function renderFileList(listContainer) {
        if (!listContainer) return;
        listContainer.innerHTML = '';
        
        currentOriginalFiles.forEach((file, index) => {
            const li = document.createElement('li');
            li.textContent = `${index + 1}. ${file.name}`;
            li.draggable = true;
            li.dataset.index = index;

            li.addEventListener('dragstart', (e) => {
                li.classList.add('dragging');
                e.dataTransfer.setData('text/plain', index);
            });

            li.addEventListener('dragend', () => li.classList.remove('dragging'));

            li.addEventListener('dragover', (e) => {
                e.preventDefault();
                li.classList.add('drag-over');
            });

            li.addEventListener('dragleave', () => li.classList.remove('drag-over'));

            li.addEventListener('drop', (e) => {
                e.preventDefault();
                li.classList.remove('drag-over');
                
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;

                if (fromIndex !== toIndex && !isNaN(fromIndex)) {
                    const movedItem = currentOriginalFiles.splice(fromIndex, 1)[0];
                    currentOriginalFiles.splice(toIndex, 0, movedItem);
                    renderFileList(listContainer);
                }
            });

            listContainer.appendChild(li);
        });
    }

    async function getFreshPdfDocument(file) {
        const data = await handleFile(file);
        return data.pdfDocument;
    }

    // --- 4. ASSEGNAZIONE BOTTONI TOOLS ---

    // Tool: Svuota Coda (Gestisce entrambi i pulsanti)
    clearButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentOriginalFiles = [];
            fileInput.value = "";
            multiFileInfo.style.display = 'none';
            fileInfoPanel.style.display = 'none';
            if (imageInfoPanel) imageInfoPanel.style.display = 'none';
        });
    });

    // Tool: Unisci (Merge)
    btnMerge.addEventListener('click', async () => {
        btnMerge.textContent = "Unione in corso...";
        btnMerge.disabled = true;
        try {
            const pdfDocuments = [];
            for (const file of currentOriginalFiles) {
                const doc = await getFreshPdfDocument(file);
                pdfDocuments.push(doc);
            }
            const mergedBytes = await mergePdfs(pdfDocuments);
            downloadPdf(mergedBytes, 'PDF_Toolbox_Unito.pdf');
        } catch (error) {
            alert("Errore durante l'unione dei PDF.");
        } finally {
            btnMerge.textContent = "Unisci tutti i PDF";
            btnMerge.disabled = false;
        }
    });

    // Tool: Immagini a PDF
    if (btnImagesToPdf) {
        btnImagesToPdf.addEventListener('click', async () => {
            btnImagesToPdf.textContent = "Creazione in corso...";
            btnImagesToPdf.disabled = true;
            try {
                const newPdfBytes = await imagesToPdf(currentOriginalFiles);
                downloadPdf(newPdfBytes, 'Immagini_Convertite.pdf');
            } catch (error) {
                console.error(error);
                alert("Errore durante la conversione delle immagini.");
            } finally {
                btnImagesToPdf.textContent = "Crea PDF dalle Immagini";
                btnImagesToPdf.disabled = false;
            }
        });
    }

    // Tool: Estrai
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

    // Tool: Dividi (Split)
    btnSplit.addEventListener('click', async () => {
        btnSplit.textContent = "Preparazione ZIP...";
        btnSplit.disabled = true;
        try {
            const freshDoc = await getFreshPdfDocument(currentOriginalFiles[0]);
            const originalName = currentOriginalFiles[0].name;
            const zipBlob = await splitPdf(freshDoc, originalName);
            downloadBlob(zipBlob, `Diviso_${originalName.replace('.pdf', '')}.zip`);
        } catch (error) {
            console.error(error);
            alert("Errore durante la divisione del PDF.");
        } finally {
            btnSplit.textContent = "Dividi e Scarica ZIP";
            btnSplit.disabled = false;
        }
    });

    // Tool: Elimina
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

    // Tool: Ruota
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

    // Tool: Riordina (Reorder)
    btnReorder.addEventListener('click', async () => {
        const input = document.getElementById('reorder-pages').value;
        const pagesArray = input.split(',')
            .map(n => parseInt(n.trim()))
            .filter(n => !isNaN(n) && n >= 1 && n <= maxPages);
        
        if (pagesArray.length === 0) {
            return alert("Inserisci un ordine valido (es. 3, 1, 2). Assicurati che le pagine esistano nel documento.");
        }

        btnReorder.textContent = "Elaborazione...";
        btnReorder.disabled = true;
        
        try {
            const freshDoc = await getFreshPdfDocument(currentOriginalFiles[0]);
            const newPdfBytes = await reorderPages(freshDoc, pagesArray);
            downloadPdf(newPdfBytes, `riordinato_${currentOriginalFiles[0].name}`);
        } catch (error) { 
            console.error(error);
            alert("Errore durante il riordinamento delle pagine."); 
        } finally { 
            btnReorder.textContent = "Riordina"; 
            btnReorder.disabled = false;
        }
    });
}