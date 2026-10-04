"""Remove redundant generated bundles, preserving the exact runtime files."""
from pathlib import Path
root = (Path(__file__).resolve().parents[1] / 'src' / 'vendor').resolve()
keep = {
    'pdf-lib': {'dist/pdf-lib.min.js'},
    'jszip': {'dist/jszip.min.js'},
    'pdfjs-dist': {'build/pdf.min.js', 'build/pdf.worker.min.js'},
    'tesseract.js': {'dist/tesseract.min.js', 'dist/worker.min.js'},
    'tesseract.js-core': set(),
}
for package, exact in keep.items():
    directory = root / package
    for file in directory.rglob('*'):
        if not file.is_file():
            continue
        relative = file.relative_to(directory).as_posix()
        needed = relative in exact or relative.lower().startswith(('license', 'copying')) or (package == 'pdfjs-dist' and relative.startswith(('cmaps/', 'standard_fonts/'))) or (package == 'tesseract.js-core' and relative.endswith('.wasm.js'))
        if not needed:
            if not file.resolve().is_relative_to(root):
                raise ValueError('Path outside vendor directory')
            file.unlink()
print('Browser dependency size:', sum(f.stat().st_size for f in root.rglob('*') if f.is_file()))