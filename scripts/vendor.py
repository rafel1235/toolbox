"""Download pinned browser dependencies; documents never leave the browser."""
from pathlib import Path
import hashlib, io, json, tarfile, urllib.request

root = Path(__file__).resolve().parents[1] / 'src' / 'vendor'
root.mkdir(parents=True, exist_ok=True)
packages = {'@cantoo/pdf-lib': '2.11.1', 'pdfjs-dist': '3.11.174', 'jszip': '3.10.1', 'tesseract.js': '6.0.1', 'tesseract.js-core': '6.0.0'}
manifest = {}
for package, version in packages.items():
    metadata = json.load(urllib.request.urlopen(f'https://registry.npmjs.org/{package}/{version}'))
    payload = urllib.request.urlopen(metadata['dist']['tarball']).read()
    import base64
    integrity = 'sha512-' + base64.b64encode(hashlib.sha512(payload).digest()).decode()
    if integrity != metadata['dist']['integrity']:
        raise ValueError('Integrity mismatch: ' + package)
    target = root / package.split('/')[-1]
    target.mkdir(exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
        for member in archive.getmembers():
            name = member.name.removeprefix('package/')
            browser_files = {
                '@cantoo/pdf-lib': ['dist/pdf-lib.min.js'],
                'jszip': ['dist/jszip.min.js'],
                'pdfjs-dist': ['build/pdf.min.js', 'build/pdf.worker.min.js'],
                'tesseract.js': ['dist/tesseract.min.js', 'dist/worker.min.js'],
            }
            needed = name in browser_files.get(package, []) or (package == 'pdfjs-dist' and name.startswith(('cmaps/', 'standard_fonts/'))) or (package == 'tesseract.js-core' and name.endswith('.wasm.js')) or name.lower().startswith(('license', 'copying'))
            if not member.isfile() or not needed:
                continue
            destination = (target / name).resolve()
            if not destination.is_relative_to(target.resolve()):
                raise ValueError('Unsafe archive path')
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(archive.extractfile(member).read())
    manifest[package] = {'version': version, 'integrity': integrity}
    print(package, version, flush=True)
for lang in ['ita', 'eng']:
    target = root / 'tessdata' / f'{lang}.traineddata.gz'
    target.parent.mkdir(exist_ok=True)
    data = urllib.request.urlopen(f'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/{lang}.traineddata.gz').read()
    target.write_bytes(data)
    manifest[lang] = {'sha256': hashlib.sha256(data).hexdigest()}
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
