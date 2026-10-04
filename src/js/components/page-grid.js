// Gestisce la visualizzazione a griglia e la lightbox per le pagine del PDF

let currentPdfDocument = null;
let pageCanvases = [];
let selectedPages = new Set();
let lightboxRenderTask = null;
let lightboxFocus = null;

export async function resetPageGrid() {
    if (lightboxRenderTask) { lightboxRenderTask.cancel(); lightboxRenderTask = null; }
    document.getElementById('page-lightbox').style.display = 'none';
    const canvas = document.getElementById('lightbox-canvas');
    canvas.width = canvas.height = 0;
    if (currentPdfDocument) await currentPdfDocument.destroy();
    currentPdfDocument = null;
    pageCanvases = []; selectedPages.clear();
    document.getElementById('pdf-page-grid').replaceChildren();
}

export async function renderPageGrid(file, containerId, password = '') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<p>Generazione griglia in corso...</p>';
    pageCanvases = [];
    selectedPages.clear();

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, password, cMapUrl: 'vendor/pdfjs-dist/cmaps/', cMapPacked: true, standardFontDataUrl: 'vendor/pdfjs-dist/standard_fonts/', isEvalSupported: false });
        currentPdfDocument = await loadingTask.promise;
        
        container.innerHTML = '';
        
        for (let pageNum = 1; pageNum <= currentPdfDocument.numPages; pageNum++) {
            const page = await currentPdfDocument.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.3 }); // Scala ridotta per miniatura
            
            const pageItem = document.createElement('div');
            pageItem.className = 'page-grid-item';
            pageItem.draggable = true;
            pageItem.dataset.pageNumber = pageNum;
            pageItem.tabIndex = 0;
            pageItem.setAttribute('role', 'button');
            pageItem.setAttribute('aria-label', `Seleziona pagina ${pageNum}`);
            pageItem.setAttribute('aria-pressed', 'false');
            
            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const context = canvas.getContext('2d');
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const pageLabel = document.createElement('div');
            pageLabel.className = 'page-label';
            pageLabel.textContent = pageNum;
            
            // NUOVO: Pulsante lente di ingrandimento
            const zoomBtn = document.createElement('button');
            zoomBtn.className = 'zoom-btn';
            zoomBtn.innerHTML = '🔍'; // Icona lente
            zoomBtn.title = "Visualizza pagina ingrandita";
            
            // Listener per il click sullo zoom (ferma la propagazione per non selezionare la pagina)
            zoomBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openLightbox(pageNum);
            });
            
            pageItem.appendChild(zoomBtn);
            pageItem.appendChild(canvas);
            pageItem.appendChild(pageLabel);
            
            // Logica di selezione
            const toggle = () => {
                pageItem.classList.toggle('selected');
                if (selectedPages.has(pageNum)) {
                    selectedPages.delete(pageNum);
                } else {
                    selectedPages.add(pageNum);
                }
                pageItem.setAttribute('aria-pressed', String(selectedPages.has(pageNum)));
            };
            pageItem.addEventListener('click', toggle);
            pageItem.addEventListener('keydown', event => {
                if (event.target !== pageItem) return;
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
                if (event.altKey && event.key === 'ArrowLeft' && pageItem.previousElementSibling) { event.preventDefault(); container.insertBefore(pageItem, pageItem.previousElementSibling); pageItem.focus(); }
                if (event.altKey && event.key === 'ArrowRight' && pageItem.nextElementSibling) { event.preventDefault(); container.insertBefore(pageItem.nextElementSibling, pageItem); pageItem.focus(); }
            });
            
            setupDragAndDrop(pageItem, container);
            
            container.appendChild(pageItem);
            pageCanvases.push({ canvas, pageNum });
        }
    } catch (error) {
        console.error("Errore nel rendering della griglia:", error);
        container.innerHTML = '<p>Errore nel caricamento delle pagine.</p>';
    }
}

// NUOVO: Logica di apertura della Lightbox
async function openLightbox(pageNum) {
    if (!currentPdfDocument) return;

    const lightbox = document.getElementById('page-lightbox');
    const title = document.getElementById('lightbox-title');
    const canvas = document.getElementById('lightbox-canvas');

    title.textContent = `Pagina ${pageNum}`;
    lightboxFocus = document.activeElement;
    lightbox.style.display = 'flex';
    document.getElementById('btn-close-lightbox').focus();

    // Annulla un render ancora in corso sullo stesso canvas
    if (lightboxRenderTask) {
        lightboxRenderTask.cancel();
        lightboxRenderTask = null;
    }

    try {
        const page = await currentPdfDocument.getPage(pageNum);
        const base = page.getViewport({ scale: 1 });

        // Adatta la pagina alla finestra, con risoluzione piena per lo schermo
        const dpr = window.devicePixelRatio || 1;
        const fitScale = Math.min(
            (window.innerWidth * 0.85) / base.width,
            (window.innerHeight * 0.8) / base.height
        );
        const cssScale = Math.max(fitScale, 1);
        const viewport = page.getViewport({ scale: Math.min(cssScale, 3) * dpr });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        lightboxRenderTask = page.render({
            canvasContext: canvas.getContext('2d'),
            viewport
        });
        await lightboxRenderTask.promise;
        lightboxRenderTask = null;
    } catch (error) {
        if (error?.name === 'RenderingCancelledException') return;
        console.error("Errore rendering lightbox:", error);
        alert("Impossibile caricare l'anteprima ad alta risoluzione.");
    }
}

// Inizializza la chiusura della lightbox (da chiamare una sola volta)
function initLightboxEvents() {
    const lightbox = document.getElementById('page-lightbox');
    const closeBtn = document.getElementById('btn-close-lightbox');
    
    if (closeBtn && lightbox) {
        const close = () => { lightbox.style.display = 'none'; lightboxFocus?.focus(); };
        closeBtn.addEventListener('click', close);
        // Chiudi cliccando fuori dall'immagine
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) close();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && lightbox.style.display !== 'none') close();
            if (event.key === 'Tab' && lightbox.style.display !== 'none') { event.preventDefault(); closeBtn.focus(); }
        });
    }
}

// Chiamiamo l'inizializzazione subito quando il modulo viene caricato
document.addEventListener('DOMContentLoaded', initLightboxEvents);


function setupDragAndDrop(item, container) {
    item.addEventListener('dragstart', (e) => {
        item.classList.add('dragging');
        e.dataTransfer.setData('text/plain', item.dataset.pageNumber);
    });

    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
    });

    item.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingItem = container.querySelector('.dragging');
        if (draggingItem && draggingItem !== item) {
            const bounding = item.getBoundingClientRect();
            const offset = bounding.x + (bounding.width / 2); // Controllo orizzontale per la griglia
            if (e.clientX - offset > 0) {
                item.parentNode.insertBefore(draggingItem, item.nextSibling);
            } else {
                item.parentNode.insertBefore(draggingItem, item);
            }
        }
    });
}

export function getSelectedPages() {
    return Array.from(selectedPages);
}

export function getCurrentOrder() {
    const container = document.getElementById('pdf-page-grid');
    if (!container) return [];
    
    const items = container.querySelectorAll('.page-grid-item');
    return Array.from(items).map(item => parseInt(item.dataset.pageNumber));
}

function updateActionButtons() {
    const btnVisualDelete = document.getElementById('btn-visual-delete');
    if (btnVisualDelete) {
        btnVisualDelete.disabled = selectedPages.size === 0;
    }
}
