import { initDropzone } from './components/file-dropzone.js';
import './account-session.js';

// Inizializza l'app quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs-dist/build/pdf.worker.min.js';
    initDropzone();
});
