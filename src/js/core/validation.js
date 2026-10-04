export function pageList(value, count, { unique = true, all = false } = {}) {
    if (!value.trim() && all) return Array.from({ length: count }, (_, i) => i + 1);
    const pages = [];
    for (const token of value.split(',')) {
        const match = token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!match) throw new Error('Usa numeri o intervalli, per esempio 1, 3-5.');
        const start = Number(match[1]), end = Number(match[2] || match[1]);
        if (start < 1 || end > count || start > end) throw new Error(`Le pagine devono essere comprese tra 1 e ${count}.`);
        for (let page = start; page <= end; page++) pages.push(page);
    }
    return unique ? [...new Set(pages)] : pages;
}

export function classifyFile(file) {
    if (!file.size) throw new Error(`${file.name}: il file è vuoto.`);
    if (file.size > 200 * 1024 * 1024) throw new Error(`${file.name}: il limite locale è 200 MB per file.`);
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') return 'pdf';
    if (/\.(png|jpe?g)$/i.test(file.name) || ['image/png', 'image/jpeg'].includes(file.type)) return 'image';
    throw new Error(`${file.name}: scegli PDF, JPG o PNG.`);
}
