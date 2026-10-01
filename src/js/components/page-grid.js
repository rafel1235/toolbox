// Gestisce la visualizzazione a griglia delle pagine del PDF per manipolazioni visuali

let currentPdfDocument = null;
let pageCanvases = [];
let selectedPages = new Set();

export async function renderPageGrid(file, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<p>Generazione griglia in corso...</p>';
    pageCanvases = [];
    selectedPages.clear();

    try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        currentPdfDocument = await loadingTask.promise;
        
        container.innerHTML = ''; // Pulisci il messaggio di caricamento
        
        for (let pageNum = 1; pageNum <= currentPdfDocument.numPages; pageNum++) {
            const page = await currentPdfDocument.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.3 }); // Scala ridotta per le miniature
            
            const pageItem = document.createElement('div');
            pageItem.className = 'page-grid-item';
            pageItem.draggable = true;
            pageItem.dataset.pageNumber = pageNum;
            
            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const context = canvas.getContext('2d');
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const pageLabel = document.createElement('div');
            pageLabel.className = 'page-label';
            pageLabel.textContent = pageNum;
            
            pageItem.appendChild(canvas);
            pageItem.appendChild(pageLabel);
            
            // Logica di selezione
            pageItem.addEventListener('click', () => {
                pageItem.classList.toggle('selected');
                if (selectedPages.has(pageNum)) {
                    selectedPages.delete(pageNum);
                } else {
                    selectedPages.add(pageNum);
                }
                updateActionButtons();
            });
            
            // Drag & Drop logic (simile a file-list.js)
            setupDragAndDrop(pageItem, container);
            
            container.appendChild(pageItem);
            pageCanvases.push({ canvas, pageNum });
        }
    } catch (error) {
        console.error("Errore nel rendering della griglia:", error);
        container.innerHTML = '<p>Errore nel caricamento delle pagine.</p>';
    }
}

function setupDragAndDrop(item, container) {
    item.addEventListener('dragstart', (e) => {
        item.classList.add('dragging');
        e.dataTransfer.setData('text/plain', item.dataset.pageNumber);
    });

    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        updatePageOrder(container);
    });

    item.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingItem = container.querySelector('.dragging');
        if (draggingItem && draggingItem !== item) {
            const bounding = item.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            if (e.clientY - offset > 0) {
                item.parentNode.insertBefore(draggingItem, item.nextSibling);
            } else {
                item.parentNode.insertBefore(draggingItem, item);
            }
        }
    });
}

function updatePageOrder(container) {
    const items = container.querySelectorAll('.page-grid-item');
    items.forEach((item, index) => {
        // Opzionale: aggiornare visivamente le etichette per riflettere il nuovo ordine
        // const label = item.querySelector('.page-label');
        // label.textContent = index + 1; 
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

// Un placeholder per disabilitare/abilitare i bottoni in base alla selezione
function updateActionButtons() {
    const btnVisualDelete = document.getElementById('btn-visual-delete');
    if (btnVisualDelete) {
        btnVisualDelete.disabled = selectedPages.size === 0;
    }
}