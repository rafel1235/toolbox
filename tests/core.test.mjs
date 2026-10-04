import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { pageList, classifyFile } from '../src/js/core/validation.js';
import { cleanMetadata, watermark, protect, flatten, numberPages } from '../src/js/tools/document-tools.js';
import { mergePdfs } from '../src/js/tools/merge/merge.js';
import { reorderPages } from '../src/js/tools/reorder/reorder.js';
import { deletePages } from '../src/js/tools/delete-pages/delete-pages.js';
import { rotatePages } from '../src/js/tools/rotate/rotate.js';
import { discardOldCrossReferences } from '../src/js/core/pdf-loader.js';
vm.runInThisContext(await readFile(new URL('../src/vendor/pdf-lib/dist/pdf-lib.min.js', import.meta.url), 'utf8'));
async function fixture() {
    const doc = await PDFLib.PDFDocument.create();
    doc.addPage([300, 400]).drawText('Page one'); doc.addPage([400, 500]).drawText('Page two');
    doc.setAuthor('Sensitive author');
    return doc;
}
test('strict page ranges, duplicates and invalid inputs', () => {
    assert.deepEqual(pageList('1, 3-5, 3', 5), [1,3,4,5]);
    assert.deepEqual(pageList('1,1', 2, { unique: false }), [1,1]);
    for (const value of ['1abc', '0', '6', '3-1', '1,', '', '1.2']) assert.throws(() => pageList(value, 5));
    assert.deepEqual(pageList('', 2, { all: true }), [1,2]);
    assert.equal(classifyFile({ name: 'document.PDF', type: '', size: 4 }), 'pdf');
    assert.throws(() => classifyFile({ name: 'bad.txt', size: 5 }));
});
test('merge, reorder and duplicate preserve page dimensions', async () => {
    const doc = await fixture();
    const output = await PDFLib.PDFDocument.load(await reorderPages(doc, [2,1,1]));
    assert.deepEqual(output.getPages().map(p => p.getWidth()), [400,300,300]);
    const merged = await PDFLib.PDFDocument.load(await mergePdfs([doc, doc]));
    assert.equal(merged.getPageCount(), 4);
});
test('rotation and deletion produce readable documents', async () => {
    const doc = await fixture();
    await rotatePages(doc, -90, 1);
    assert.equal(doc.getPage(0).getRotation().angle, -90);
    const result = await PDFLib.PDFDocument.load(await deletePages(doc, [2]));
    assert.equal(result.getPageCount(), 1);
});
test('metadata cleanup removes Info and XMP including orphan strings', async () => {
    const original = await fixture();
    original.catalog.set(PDFLib.PDFName.of('Metadata'), original.context.register(original.context.stream('SECRET_XMP', { Type: 'Metadata', Subtype: 'XML' })));
    const doc = await PDFLib.PDFDocument.load(await original.save(), { updateMetadata: false });
    const bytes = await cleanMetadata(doc).save({ useObjectStreams: false });
    const reopened = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    assert.equal(reopened.getAuthor(), undefined);
    assert.equal(reopened.catalog.has(PDFLib.PDFName.of('Metadata')), false);
    assert.equal(Buffer.from(bytes).includes(Buffer.from('SECRET_XMP')), false);
    assert.equal(Buffer.from(bytes).includes(Buffer.from('Sensitive author')), false);
});
test('AES-256 requires correct password and preserves contents on decrypt', async () => {
    const bytes = await protect(await fixture(), 'strong-password', true);
    await assert.rejects(PDFLib.PDFDocument.load(bytes, { password: 'wrong' }));
    const doc = await PDFLib.PDFDocument.load(bytes, { password: 'strong-password', updateMetadata: false });
    assert.equal(doc.getPageCount(), 2);
    discardOldCrossReferences(doc);
    const plain = await doc.save();
    assert.equal((await PDFLib.PDFDocument.load(plain)).getPageCount(), 2);
    assert.ok(Buffer.from(bytes).includes(Buffer.from('/AESV3')));
});
test('watermark, numbering and flattening retain pages and flatten field tree', async () => {
    const doc = await fixture();
    const field = doc.getForm().createTextField('name'); field.setText('Example'); field.addToPage(doc.getPage(0));
    const output = await PDFLib.PDFDocument.load(await flatten(doc));
    assert.equal(output.getForm().getFields().length, 0);
    assert.equal((await PDFLib.PDFDocument.load(await watermark(output, 'RISERVATO', [1]))).getPageCount(), 2);
    assert.equal((await PDFLib.PDFDocument.load(await numberPages(output, 4))).getPageCount(), 2);
});
