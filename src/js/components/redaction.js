import { openRenderedPdf, renderPage } from '../tools/raster-tools.js';

export function initRedaction() {
    const $ = id => document.getElementById(id);
    let source = null, rects = [], current = 1, start = null, image = null, navigating = false;
    const canvas = $('redaction-canvas'), ctx = canvas.getContext('2d');
    function paint() {
        if (!image) return;
        ctx.putImageData(image, 0, 0); ctx.fillStyle = '#000';
        rects.filter(rect => rect.page === current).forEach(rect => ctx.fillRect(rect.x * canvas.width, rect.y * canvas.height, rect.w * canvas.width, rect.h * canvas.height));
        $('redaction-count').textContent = `${rects.length} aree da oscurare`;
    }
    async function show() {
        const rendered = await renderPage(source, current, 1.5);
        canvas.width = rendered.canvas.width; canvas.height = rendered.canvas.height;
        ctx.drawImage(rendered.canvas, 0, 0); image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        $('redaction-page').textContent = `Pagina ${current} di ${source.numPages}`;
        $('redact-prev').disabled = current === 1; $('redact-next').disabled = current === source.numPages;
        paint();
    }
    function point(event) {
        const bounds = canvas.getBoundingClientRect();
        return { x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) };
    }
    canvas.addEventListener('pointerdown', event => { start = point(event); canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => {
        if (!start) return; paint(); const end = point(event);
        ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(start.x * canvas.width, start.y * canvas.height, (end.x - start.x) * canvas.width, (end.y - start.y) * canvas.height);
    });
    canvas.addEventListener('pointerup', event => {
        if (!start) return;
        const end = point(event), rect = { page: current, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(start.x - end.x), h: Math.abs(start.y - end.y) };
        if (rect.w > 0.002 && rect.h > 0.002) rects.push(rect);
        start = null; paint();
    });
    canvas.addEventListener('pointercancel', () => { start = null; paint(); });
    async function navigate(offset) {
        if (navigating || !source || current + offset < 1 || current + offset > source.numPages) return; navigating = true;
        try { current += offset; await show(); } catch (error) { $('status').textContent = error.message; } finally { navigating = false; }
    }
    $('redact-prev').addEventListener('click', () => navigate(-1));
    $('redact-next').addEventListener('click', () => navigate(1));
    $('redact-undo').addEventListener('click', () => { rects.pop(); paint(); });
    $('redact-close').addEventListener('click', () => $('redaction-editor').hidden = true);
    return {
        reset() { if (source) source.destroy(); source = null; rects = []; image = null; start = null; canvas.width = canvas.height = 0; $('redaction-editor').hidden = true; },
        async open(file, password) { if (source) await source.destroy(); source = await openRenderedPdf(file, password); rects = []; current = 1; $('redaction-editor').hidden = false; await show(); },
        rectangles: () => rects.map(rect => ({ ...rect })),
    };
}
