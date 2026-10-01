import { initDropzone } from './components/file-dropzone.js';

// Inizializza l'app quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    console.log('PDF Toolbox Inizializzato');
    
    // Attiva la funzionalità di Drag & Drop
    initDropzone();
});